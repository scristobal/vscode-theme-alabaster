// A declaration is a location, not a class of identifier. Never apply a color
// to entity.name.function, variable.other.constant, or type names as a group:
// those scopes also occur at references and calls in VS Code's grammars.
export function createHighlighting(p) {
  const rule = (name, scope, foreground) => ({ name, scope, settings: { foreground, fontStyle: '' } });
  const semanticTokenColors = {
    '*': { foreground: p.foreground, fontStyle: '' },
    comment: p.comment,
    string: p.literal,
    regexp: p.literal,
    number: p.literal,
    boolean: p.literal,
    character: p.literal,
    operator: p.punctuation,
    // rust-analyzer's specialized punctuation types inherit this token type.
    punctuation: p.punctuation,
    escapeSequence: p.literal,
    formatSpecifier: p.literal,
    invalidEscapeSequence: p.error,
  };
  for (const type of ['variable', 'parameter', 'property', 'typeParameter', 'enumMember']) {
    for (const modifier of ['declaration', 'definition']) semanticTokenColors[`${type}.${modifier}`] = p.binding;
  }
  for (const type of ['function', 'method', 'class', 'type', 'interface', 'struct', 'enum', 'namespace', 'macro']) {
    for (const modifier of ['declaration', 'definition']) semanticTokenColors[`${type}.${modifier}`] = p.declaration;
  }
  // Neovim Still treats a binding to a closure as a function definition.
  for (const modifier of ['declaration', 'definition']) semanticTokenColors[`variable.callable.${modifier}`] = p.declaration;
  return {
    semanticHighlighting: true,
    semanticTokenColors,
    tokenColors: [
      { name: 'Default: references, calls, types, and keywords', settings: { foreground: p.foreground, fontStyle: '' } },
      rule('Punctuation and symbolic operators', ['punctuation', 'keyword.operator', 'meta.brace', 'storage.type.function.arrow'], p.punctuation),
      rule('Word operators are ordinary words', [
        'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.word',
        'keyword.operator.logical.python',
      ], p.foreground),
      rule('Literals share one color', [
        'string', 'constant.numeric', 'constant.language', 'constant.character',
        'constant.other.symbol', 'constant.keyword',
        'string punctuation.definition.string', 'string punctuation.definition.regex',
        'string.regexp punctuation', 'string.regexp keyword.operator',
      ], p.literal),
      rule('Expressions embedded in strings remain code', ['meta.embedded', 'meta.interpolation', 'meta.template.expression'], p.foreground),
      rule('Binding declarations (only where the grammar identifies them)', [
        'meta.definition.variable', 'meta.definition.property',
        'variable.parameter',
      ], p.binding),
      rule('Named declarations (never calls or type references)', [
        'meta.definition.function entity.name.function',
        'meta.definition.method entity.name.function',
        'entity.name.function.python',
        'meta.function.definition.rust entity.name.function',
        'entity.name.type.class.ts', 'entity.name.type.class.js',
        'entity.name.type.interface.ts', 'entity.name.type.alias.ts',
        'entity.name.type.enum.ts',
        'entity.name.type.class.python',
        'entity.name.type.struct.rust', 'entity.name.type.enum.rust',
        'entity.name.type.trait.rust', 'entity.name.type.declaration.rust',
        'entity.global.clojure',
      ], p.declaration),
      rule('Comments deserve attention, including their delimiters', ['comment', 'punctuation.definition.comment', 'comment punctuation'], p.comment),
      // Only grammars that expose discarded code can support this distinction.
      rule('Disabled code, when explicitly identified by the grammar', ['comment.block.discard', 'comment.block.ignored', 'comment.block.inactive'], p.punctuation),
      rule('Invalid syntax', 'invalid', p.error),
      rule('Document headings', 'markup.heading', p.declaration),
      rule('Document links', ['markup.underline.link', 'string.other.link'], p.binding),
      rule('Diff additions', 'markup.inserted', p.literal),
      rule('Diff removals', 'markup.deleted', p.error),
      rule('Diff context', ['meta.diff.header', 'meta.diff.range', 'meta.diff.index'], p.punctuation),
    ],
  };
}
