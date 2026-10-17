# Still

## 0.6.0

- Add Still Light, preserving VS Code Light 2026’s workbench and editor surfaces.
- Share declaration-focused syntax rules with Still Dark; adapt the four accents for a white background.
- Verify both appearances against their stock 2026 colors and run the same grammar checks for each.
- Keep the semantic highlighting requirement explicit for both themes.

## 0.5.0

- Match Neovim Still’s syntax palette: blue variable/parameter declarations, yellow function/type definitions, green literals, and violet comments.
- Style Rust closure definitions and rust-analyzer’s specialized punctuation and string tokens.
- Add a Rust fixture covering locals, parameters, tuple/pattern bindings, closures, loops, and `if let`; verify it with the real rust-analyzer extension.
- Document the semantic settings required for Rust declaration highlighting, including theme-specific enablement.

## 0.4.0

- Use the built-in Dark 2026 workbench colors unchanged, replacing the custom navy interface.
- Strip syntax highlighting back to declarations, unified literals, prominent comments, and gray punctuation using Dark 2026 colors.
- Keep keywords, calls, references, and type references in the default editor foreground.
- Verify every workbench color against the installed Dark 2026 theme; limit overrides to syntax bracket colors.

## 0.3.0

- Rebuild Still Dark around the final worked example in Nikita Prokopov’s syntax highlighting article, using its navy background and four semantic colors.
- Color declarations instead of all occurrences of a name; leave calls, readonly references, type references, and keywords white.
- Unify literal colors, highlight comments, dim punctuation, and keep typography plain.
- Replace the earlier palette experiments with this single dark theme.
- Add regression checks against VS Code’s bundled JavaScript, TypeScript, Python, Rust, and Clojure grammars; document grammar limitations.

## 0.2.0

- Add Still Charcoal, with cool graphite surfaces and restrained accents.
- Add Still Black, with near-black surfaces, brighter text, and stronger borders.
- Check Still Black's important text/background pairs against a 7:1 contrast floor.
- Add previews and a comparison of the three dark appearances.

## 0.1.0

- Start Still as an independent fork under `scristobal.still-theme`.
- Introduce Still Dark as the primary appearance, with warm charcoal surfaces and muted clay, sage, lilac, and mist-blue accents.
- Add Still Light, a matching warm-paper companion.
- Add semantic and TextMate highlighting with plain typography and neutral bracket guides.
- Theme the VS Code 1.142 workbench, Modern UI, notebooks, diffs, merges, terminal integration, chat, and Agents window.
- Generate both themes from shared color roles and validate text contrast and generated output.
- Add a development preview, updated samples, and original Still branding.

Alabaster's earlier releases are recorded in [UPSTREAM_CHANGELOG.md](UPSTREAM_CHANGELOG.md).
