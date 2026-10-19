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
// Resolve a stock 2026 theme through its includes, as VS Code loads it.
async function resolveStock(file) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  const parent = data.include ? await resolveStock(path.resolve(path.dirname(file), data.include)) : { colors: {}, tokenColors: [], semanticTokenColors: {} };
  return {
    colors: { ...parent.colors, ...data.colors },
    tokenColors: [...parent.tokenColors, ...(data.tokenColors ?? [])],
    semanticTokenColors: { ...parent.semanticTokenColors, ...data.semanticTokenColors },
  };
}
const vscodeRoot = await findVSCodeAppRoot();
// still-settings.jsonc has only whole-line comments.
const settings = JSON.parse((await readFile(new URL('../still-settings.jsonc', import.meta.url), 'utf8')).replace(/^\/\/.*$/gm, ''));
// Real files and nested Markdown cover the contexts the settings restate stock rules in.
const samples = [
  ['source.ts', 'playground.ts'], ['source.rust', 'playground.rs'], ['source.clojure', 'playground.clj'],
  ['source.rust', 'tests/fixtures/rust/src/main.rs'], ['source.js', 'src/settings.mjs'], ['source.json', 'package.json'],
  ['text.html.markdown', 'README.md'],
];
const markdown = '# The `readQueue` heading with *emphasis* and **strong**\nSee [the `readQueue` link](https://example.com) and `code`.';
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
  const stock = await resolveStock(path.join(vscodeRoot, `extensions/theme-defaults/themes/2026-${type}.json`));
  test('Stock 2026 workbench colors are preserved exactly, with only syntax bracket colors overridden', async () => {
    const actual = { ...theme.colors };
    for (let i = 1; i <= 6; i++) {
      const key = `editorBracketHighlight.foreground${i}`;
      assert.equal(actual[key], punctuation, 'Syntax brackets must not introduce extra colors');
      if (key in stock.colors) actual[key] = stock.colors[key];
      else delete actual[key];
    }
    assert.deepEqual(actual, stock.colors, 'Every workbench and editor surface color must match its stock 2026 appearance');
  });
  test('Stock 2026 syntax snapshot matches the installed theme', async () => {
    const snapshot = JSON.parse(await readFile(new URL(`../src/${type}-2026-syntax.json`, import.meta.url), 'utf8'));
    assert.deepEqual(snapshot, { tokenColors: stock.tokenColors, semanticTokenColors: stock.semanticTokenColors }, `Update src/${type}-2026-syntax.json from the installed theme`);
  });
  test('Settings on the stock 2026 theme color files exactly like the theme', async () => {
    const id = `[${type === 'dark' ? 'Dark' : 'Light'} 2026]`;
    const { rules } = settings['editor.semanticTokenColorCustomizations'][id];
    for (const [type, style] of Object.entries(theme.semanticTokenColors)) assert.deepEqual(rules[type], style, `Semantic rule ${type}`);
    for (const type of Object.keys(stock.semanticTokenColors)) assert.ok(type in rules, `Stock semantic rule ${type} must be restated`);
    // VS Code applies the editor foreground, then the stock rules, then customizations.
    const customized = await createTokenizer({ tokenColors: [
      { settings: { foreground: stock.colors['editor.foreground'] } }, ...stock.tokenColors, ...settings['editor.tokenColorCustomizations'][id].textMateRules,
    ] });
    const sources = [...await Promise.all(samples.map(async ([scope, file]) => [scope, file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])), ['text.html.markdown', 'nested Markdown', markdown]];
    for (const [scope, name, source] of sources) {
      const expected = await tokenize(scope, source), actual = await customized(scope, source);
      expected.forEach(({ line, spans }, row) => assert.deepEqual(actual[row].spans, spans, `${name}:${row + 1}: ${line}`));
    }
  });
}
