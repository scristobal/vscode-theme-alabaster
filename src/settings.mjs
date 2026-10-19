import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import darkSyntax from './dark-2026-syntax.json' with { type: 'json' };
import lightSyntax from './light-2026-syntax.json' with { type: 'json' };
import { createHighlighting } from './highlighting.mjs';
import { bracketColors } from './theme.mjs';

const require = createRequire(import.meta.url);
const tm = require('vscode-textmate');
const onig = require('vscode-oniguruma');

const stock = {
  dark: { id: 'Dark 2026', ...darkSyntax },
  light: { id: 'Light 2026', ...lightSyntax },
};

// Still scopes that wrap other tokens in VS Code's grammars, shortest first: a
// stock rule inside one of them must still take that scope's color. Covers
// strings, comments, declarations, Markdown headings and links, CSS units, and
// shell $var. Interpolations are listed by name rather than as meta.embedded,
// which would also claim strings inside embedded code blocks. Each context
// adds about 150 selectors per appearance.
const contexts = [
  'string', 'comment', 'punctuation', 'string.regexp', 'markup.heading', 'constant.numeric',
  'string.other.link', 'meta.embedded.line', 'meta.interpolation', 'meta.definition.method',
  'meta.definition.function', 'meta.definition.property', 'meta.definition.variable',
  'meta.embedded.expression', 'meta.embedded.interpolation', 'meta.function.definition.rust',
];

// The stock themes color these C/C++ token types. Still colors them through the
// superTypes the C/C++ extension declares.
const semanticSuperTypes = {
  newOperator: 'operator', stringLiteral: 'string', customLiteral: 'number', numberLiteral: 'number',
};

const selectors = rule => [rule.scope ?? []].flat().flatMap(scope => scope.split(',')).map(s => s.trim()).filter(Boolean);

let onigLib;
function loadOnig() {
  onigLib ??= readFile(require.resolve('vscode-oniguruma/release/onig.wasm'))
    .then(wasm => onig.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)))
    .then(() => ({
      createOnigScanner: patterns => new onig.OnigScanner(patterns),
      createOnigString: text => new onig.OnigString(text),
    }));
  return onigLib;
}

// Style a selector exactly as VS Code's TextMate engine would style a token
// with those scopes, by tokenizing the selector as one token named after it.
async function createStyler(tokenColors) {
  const registry = new tm.Registry({
    theme: { settings: tokenColors },
    onigLib: loadOnig(),
    loadGrammar: async () => ({ scopeName: 'still.probe', patterns: [{ match: '.+', name: '$0' }] }),
  });
  const grammar = await registry.loadGrammar('still.probe');
  const colors = registry.getColorMap();
  const cache = new Map();
  return selector => {
    if (!cache.has(selector)) {
      const metadata = grammar.tokenizeLine2(selector, tm.INITIAL).tokens[1];
      const style = (metadata >>> 11) & 15;
      cache.set(selector, {
        foreground: colors[(metadata >>> 15) & 511].toUpperCase(),
        fontStyle: ['italic', 'bold', 'underline', 'strikethrough'].filter((_, i) => style & (1 << i)).join(' '),
      });
    }
    return cache.get(selector);
  };
}

// Reproduce each Still appearance as customizations of its stock 2026 theme.
// VS Code keeps the stock rules, so every stock selector is restated with the
// style Still gives it, alone and inside each context that needs it.
export async function createSettings(palettes) {
  const settings = {
    'workbench.colorCustomizations': {},
    'editor.tokenColorCustomizations': {},
    'editor.semanticTokenColorCustomizations': {},
  };
  for (const p of palettes) {
    const { id, tokenColors, semanticTokenColors } = stock[p.type];
    const highlighting = createHighlighting(p);
    const style = await createStyler(highlighting.tokenColors);
    const differs = (a, b) => JSON.stringify(style(a)) !== JSON.stringify(style(b));
    const groups = new Map();
    const add = selector => {
      const key = JSON.stringify(style(selector));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(selector);
    };
    for (const selector of new Set(tokenColors.flatMap(selectors))) {
      add(selector);
      const kept = [];
      for (const context of contexts) {
        // Without its own rule, a context falls back to the longest kept context it extends.
        const fallback = kept.filter(k => context.startsWith(`${k}.`)).at(-1);
        const alone = differs(`${context} ${selector}`, fallback ? `${fallback} ${selector}` : selector);
        // VS Code prefers the longer parent scope name, so only then can an inner context win.
        const nested = kept.some(outer => outer.length < context.length
          && differs(`${outer} ${context} ${selector}`, `${outer} ${selector}`));
        if (alone || nested) {
          kept.push(context);
          add(`${context} ${selector}`);
        }
      }
    }
    // Still's scope-less default rule is the stock editor foreground already.
    const restated = [...groups].map(([key, scope]) => ({ scope, settings: JSON.parse(key) }));
    settings['workbench.colorCustomizations'][`[${id}]`] = bracketColors(p);
    settings['editor.tokenColorCustomizations'][`[${id}]`] = {
      textMateRules: [...restated, ...highlighting.tokenColors.filter(rule => rule.scope)],
    };

    const rules = { ...highlighting.semanticTokenColors };
    for (const type of Object.keys(semanticTokenColors)) {
      if (type in rules) continue;
      if (!semanticSuperTypes[type]) throw new Error(`${id} colors semantic token type ${type}; give it a Still color`);
      rules[type] = rules[semanticSuperTypes[type]] ?? rules['*'];
    }
    settings['editor.semanticTokenColorCustomizations'][`[${id}]`] = { enabled: highlighting.semanticHighlighting, rules };
  }
  return settings;
}

const width = 120;
const primitive = value => value === null || typeof value !== 'object';

// Compact JSONC: scope lists are packed into lines and small objects are
// inlined, keeping the file short enough to paste into User Settings.
function format(value, indent, column) {
  const inner = `${indent}  `;
  if (primitive(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'string')) {
      const lines = [];
      let line = '';
      for (const item of value.map(item => JSON.stringify(item))) {
        const next = line ? `${line}, ${item}` : item;
        if (line && inner.length + next.length + 1 > width) {
          lines.push(`${line},`);
          line = item;
        } else line = next;
      }
      lines.push(line);
      return `[\n${lines.map(line => inner + line).join('\n')}\n${indent}]`;
    }
    return `[\n${value.map(item => inner + format(item, inner, inner.length)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value);
  const inline = `{${entries.map(([key, item]) => `${JSON.stringify(key)}: ${JSON.stringify(item)}`).join(', ')}}`;
  if (entries.every(([, item]) => primitive(item)) && column + inline.length <= width) return inline;
  return `{\n${entries.map(([key, item]) => {
    const prefix = `${inner}${JSON.stringify(key)}: `;
    return prefix + format(item, inner, prefix.length);
  }).join(',\n')}\n${indent}}`;
}

export function formatSettings(settings) {
  return [
    '// Still theme (Dark and Light) reproduced as color customizations on the built-in',
    '// "Dark 2026" and "Light 2026" themes. Select one of those themes to see it.',
    '// Generated from the Still theme files; regenerate rather than edit by hand.',
    format(settings, '', 0),
  ].join('\n') + '\n';
}
