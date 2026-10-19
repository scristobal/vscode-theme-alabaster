import dark2026 from './dark-2026.json' with { type: 'json' };
import light2026 from './light-2026.json' with { type: 'json' };
import { createHighlighting } from './highlighting.mjs';

// Bracket nesting uses the punctuation color instead of adding syntax colors.
export function bracketColors(p) {
  const colors = {};
  for (let i = 1; i <= 6; i++) colors[`editorBracketHighlight.foreground${i}`] = p.punctuation;
  return colors;
}

// Preserve each stock theme's resolved UI colors. Only syntax rules and syntax
// bracket colors are replaced.
export function createTheme(p) {
  const base = p.type === 'light' ? light2026 : dark2026;
  return {
    $schema: 'vscode://schemas/color-theme',
    name: p.name,
    type: p.type,
    colors: { ...base.colors, ...bracketColors(p) },
    ...createHighlighting(p),
  };
}
