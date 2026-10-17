import assert from 'node:assert/strict';
import { test as runTest } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createTokenizer, findVSCodeAppRoot } from './tokenizer.mjs';
import path from 'node:path';

function expect(lines, row, text, color, occurrence = 0) {
  const { line, spans } = lines[row];
  let index = -1;
  for (let n = 0; n <= occurrence; n++) index = line.indexOf(text, index + 1);
  assert.notEqual(index, -1, `Missing ${text} on line ${row + 1}`);
  for (let i = index; i < index + text.length; i++) {
    const span = spans.find(s => s.start <= i && s.end > i);
    assert.equal(span?.color, color, `${text} on line ${row + 1}, column ${i + 1}`);
    assert.equal(span.style, 0, `${text} must have no font decoration`);
  }
}
// Expectations describe the visible design independently of theme selectors.
const appearances = [
  { type: 'dark', plain: '#BBBEBF', punctuation: '#808080', declaration: '#E5C76B', binding: '#7EB6E8', literal: '#A8CF80', comment: '#C49BE0' },
  { type: 'light', plain: '#202020', punctuation: '#767676', declaration: '#8A6500', binding: '#1F6FAA', literal: '#3C6D2C', comment: '#8250A0' },
];
for (const { type, plain, punctuation, declaration, binding, literal, comment } of appearances) {
  const theme = JSON.parse(await readFile(new URL(`../themes/still-${type}-color-theme.json`, import.meta.url), 'utf8'));
  const tokenize = await createTokenizer(theme);
  const test = (name, run) => runTest(`${type}: ${name}`, run);
  for (const language of ['ts', 'js']) test(`${language}: declarations stand out; identical references and calls stay plain`, async () => {
    const lines = await tokenize(`source.${language}`, `// Keep this explanation visible.\nfunction readQueue(limit) {\n  const queue = ["first", 2, true];\n  return queue.slice(0, limit);\n}\nconst result = readQueue(3);\nconst speaker = new Audio("quiet.ogg");\nconst description = \`queue: \${result}\`;\nclass Box { run(input) { return input; } }\nconst box = new Box();`);
    expect(lines, 0, '// Keep this explanation visible.', comment);
    expect(lines, 1, 'function', plain); expect(lines, 1, 'readQueue', declaration); expect(lines, 1, 'limit', binding); expect(lines, 1, '(', punctuation);
    expect(lines, 2, 'const', plain); expect(lines, 2, 'queue', binding); expect(lines, 2, '=', punctuation); expect(lines, 2, '"first"', literal); expect(lines, 2, '2', literal); expect(lines, 2, 'true', literal);
    expect(lines, 3, 'return', plain); expect(lines, 3, 'queue', plain); expect(lines, 3, 'slice', plain); expect(lines, 3, 'limit', plain);
    expect(lines, 5, 'result', binding); expect(lines, 5, 'readQueue', plain);
    expect(lines, 6, 'new', plain); expect(lines, 6, 'Audio', plain); expect(lines, 6, '"quiet.ogg"', literal);
    expect(lines, 7, 'queue: ', literal); expect(lines, 7, 'result', plain);
    expect(lines, 8, 'Box', declaration); expect(lines, 8, 'run', declaration); expect(lines, 8, 'input', binding); expect(lines, 8, 'input', plain, 1);
    expect(lines, 9, 'Box', plain);
  });
  test('Python: named declarations, plain calls and builtins, visible comments and unified literals', async () => {
    const lines = await tokenize('source.python', '# Keep this explanation visible.\ndef read_queue(limit):\n    queue = ["first", 2, True]\n    return len(queue[:limit])\nqueue = read_queue(3)\nclass Box:\n    pass');
    expect(lines, 0, '# Keep this explanation visible.', comment); expect(lines, 1, 'def', plain); expect(lines, 1, 'read_queue', declaration); expect(lines, 1, 'limit', binding);
    // The bundled Python grammar does not identify assignment targets.
    expect(lines, 2, 'queue', plain); expect(lines, 2, '"first"', literal); expect(lines, 2, '2', literal); expect(lines, 2, 'True', literal);
    expect(lines, 3, 'len', plain); expect(lines, 3, 'limit', plain); expect(lines, 4, 'read_queue', plain); expect(lines, 5, 'Box', declaration);
  });
  test('Rust: function definitions differ from calls; numeric type references are plain', async () => {
    const lines = await tokenize('source.rust', '// Keep this explanation visible.\nfn read_queue(limit: usize) -> usize {\n    let queue = 2;\n    queue + limit\n}\nfn main() { read_queue(3); }\nstruct Box { value: usize }');
    expect(lines, 0, '// Keep this explanation visible.', comment); expect(lines, 1, 'fn', plain); expect(lines, 1, 'read_queue', declaration); expect(lines, 1, 'usize', plain);
    expect(lines, 2, 'queue', plain); expect(lines, 2, '2', literal); expect(lines, 3, 'queue', plain); expect(lines, 3, '+', punctuation); expect(lines, 5, 'main', declaration); expect(lines, 5, 'read_queue', plain); expect(lines, 6, 'Box', declaration);
  });
  test('Clojure: global definitions differ from every nested invocation', async () => {
    const lines = await tokenize('source.clojure', '; Keep this explanation visible.\n(defn read-queue [limit]\n  (let [queue ["first" 2 true]]\n    (take limit queue)))\n(def queue (read-queue 3))');
    expect(lines, 0, '; Keep this explanation visible.', comment); expect(lines, 1, 'defn', plain); expect(lines, 1, 'read-queue', declaration); expect(lines, 1, 'limit', plain);
    expect(lines, 2, 'let', plain); expect(lines, 2, '"first"', literal); expect(lines, 2, '2', literal); expect(lines, 2, 'true', literal);
    expect(lines, 3, 'take', plain); expect(lines, 3, 'queue', plain); expect(lines, 4, 'queue', declaration); expect(lines, 4, 'read-queue', plain);
  });
  test('Word operators stay plain; symbolic operators recede and regex literals share one color', async () => {
    const js = await tokenize('source.ts', 'const compare = (value) => typeof value === "string";\nconst pattern = /[a-z]+\\s?/;');
    expect(js, 0, '=>', punctuation); expect(js, 0, 'typeof', plain); expect(js, 0, '===', punctuation); expect(js, 1, '/[a-z]+\\s?/', literal);
    const python = await tokenize('source.python', 'ready = a == b and a is not None or a in b');
    expect(python, 0, '==', punctuation); expect(python, 0, 'and', plain); expect(python, 0, 'is', plain); expect(python, 0, 'not', plain); expect(python, 0, 'or', plain); expect(python, 0, 'in', plain); expect(python, 0, 'None', literal);
  });
  test('Stock 2026 workbench colors are preserved exactly, with only syntax bracket colors overridden', async () => {
    const root = await findVSCodeAppRoot();
    async function resolveColors(file) {
      const data = JSON.parse(await readFile(file, 'utf8'));
      const parent = data.include ? await resolveColors(path.resolve(path.dirname(file), data.include)) : {};
      return { ...parent, ...data.colors };
    }
    const stock = await resolveColors(path.join(root, `extensions/theme-defaults/themes/2026-${type}.json`));
    const actual = { ...theme.colors };
    for (let i = 1; i <= 6; i++) {
      const key = `editorBracketHighlight.foreground${i}`;
      assert.equal(actual[key], punctuation, 'Syntax brackets must not introduce extra colors');
      if (key in stock) actual[key] = stock[key];
      else delete actual[key];
    }
    assert.deepEqual(actual, stock, 'Every workbench and editor surface color must match its stock 2026 appearance');
  });

}
