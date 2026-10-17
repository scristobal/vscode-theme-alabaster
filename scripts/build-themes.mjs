import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { palettes } from '../src/palettes.mjs';
import { createTheme } from '../src/theme.mjs';

const check = process.argv.includes('--check');
const root = new URL('../', import.meta.url);

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255);
  const linear = rgb.map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// Check readability without forcing distinct roles to have equal lightness.
function checkContrast(p) {
  const minimum = 4.5;
  const pairs = [
    ...['foreground', 'punctuation', 'comment', 'literal', 'binding', 'declaration'].map(role => [role, 'editor']),
  ];
  for (const [text, background] of pairs) {
    const ratio = contrast(p[text], p[background]);
    if (ratio < minimum) {
      throw new Error(`${p.name}: ${text} on ${background} is ${ratio.toFixed(2)}:1; requires ${minimum}:1`);
    }
  }
}

await mkdir(new URL('themes/', root), { recursive: true });
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (manifest.contributes.themes.length !== palettes.length) throw new Error('Unbuilt theme contribution');
const generated = await readdir(new URL('themes/', root));
if (generated.some(file => !palettes.some(p => p.file === file))) throw new Error('Obsolete theme file');
for (const palette of palettes) {
  checkContrast(palette);
  const theme = createTheme(palette);
  const contribution = manifest.contributes.themes.find(t => t.path === `./themes/${palette.file}`);
  if (!contribution || contribution.label !== palette.name || contribution.uiTheme !== (palette.type === 'dark' ? 'vs-dark' : 'vs')) {
    throw new Error(`Theme contribution does not match ${palette.name}`);
  }
  const path = new URL(`themes/${palette.file}`, root);
  const output = JSON.stringify(theme, null, '\t') + '\n';
  if (check) {
    if (await readFile(path, 'utf8') !== output) throw new Error(`${palette.file} is stale. Run npm run build.`);
  } else {
    await writeFile(path, output);
  }
  console.log(`${check ? 'Checked' : 'Built'} ${palette.name}; syntax text contrast meets 4.5:1.`);
}
