import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tm = require('vscode-textmate');
const onig = require('vscode-oniguruma');

export async function findVSCodeAppRoot() {
  const candidates = [process.env.VSCODE_APP_ROOT, '/usr/share/code/resources/app', '/Applications/Visual Studio Code.app/Contents/Resources/app'].filter(Boolean);
  let root;
  for (const candidate of candidates) {
    if (await fs.stat(path.join(candidate, 'extensions')).catch(() => false)) { root = candidate; break; }
  }
  if (!root) throw new Error('Set VSCODE_APP_ROOT to your VS Code resources/app directory to test its bundled grammars.');
  return root;
}

// Use the grammars shipped with the VS Code installation being tested.
export async function createTokenizer(theme) {
  const root = await findVSCodeAppRoot();
  const grammars = new Map();
  const base = path.join(root, 'extensions');
  for (const dir of await fs.readdir(base)) {
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(path.join(base, dir, 'package.json'), 'utf8')); } catch { continue; }
    for (const grammar of manifest.contributes?.grammars ?? []) grammars.set(grammar.scopeName, path.resolve(base, dir, grammar.path));
  }
  const wasm = await fs.readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registry = new tm.Registry({
    theme: { settings: theme.tokenColors },
    onigLib: Promise.resolve({ createOnigScanner: patterns => new onig.OnigScanner(patterns), createOnigString: text => new onig.OnigString(text) }),
    loadGrammar: async scope => {
      const file = grammars.get(scope);
      return file ? tm.parseRawGrammar(await fs.readFile(file, 'utf8'), file) : null;
    },
  });
  return async (scope, source) => {
    const grammar = await registry.loadGrammar(scope);
    if (!grammar) throw new Error(`Missing bundled grammar: ${scope}`);
    const colors = registry.getColorMap();
    let stack;
    return source.split('\n').map(line => {
      const result = grammar.tokenizeLine2(line, stack);
      stack = result.ruleStack;
      const spans = [];
      for (let i = 0; i < result.tokens.length; i += 2) {
        const start = result.tokens[i], end = result.tokens[i + 2] ?? line.length, metadata = result.tokens[i + 1];
        spans.push({ text: line.slice(start, end), start, end, color: colors[(metadata >>> 15) & 511], style: (metadata >>> 11) & 15 });
      }
      return { line, spans };
    });
  };
}
