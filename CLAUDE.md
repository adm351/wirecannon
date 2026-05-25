# Wirecannon — Claude instructions

This is the Wirecannon repository. You are working on the language itself,
not consuming it.

## Repository structure

```
GRAMMAR.md                  ← the language specification, primary artifact
CONTRIBUTING.md             ← contribution guidelines
examples/                   ← reference projects using Wirecannon
packages/linter/            ← validates .wcf files against the grammar
packages/renderer/          ← produces HTML from .wcf files
.claude/WIRECANNON.md       ← bootstrap file for repos that consume wirecannon
```

## Working on the grammar

`GRAMMAR.md` is the most important file in this repo. Changes to it are breaking
changes. When modifying the grammar:

1. Update the validation rules section if adding or changing constraints
2. Update the example at the bottom of GRAMMAR.md to reflect any new syntax
3. Update `examples/ecommerce` to remain consistent with the grammar
4. Note in your change what linter rules are affected

## Working on examples

Examples must be valid against the current grammar. Run the linter against any
example you modify before committing:

```
npx @wirecannon/linter ./examples/ecommerce
```

## Working on packages

Both packages are TypeScript. The linter and renderer are independent — they share
no code. The linter depends only on the grammar rules. The renderer depends only on
the component and attribute definitions.

## What this repo does not do

- Does not target any frontend framework
- Does not produce production UI
- Does not store design tokens or assets
- Does not define responsive breakpoints
