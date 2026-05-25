# Contributing to Wirecannon

Wirecannon is an early-stage project. The grammar is defined but the ecosystem around it —
linter, renderer, editor integrations — is being built. Contributions are welcome.

## Areas open for contribution

### Grammar

The grammar is defined in `GRAMMAR.md`. If you find an ambiguity, a missing component,
an unnecessary attribute, or a validation rule that is wrong or missing, open an issue
describing the problem and your proposed resolution.

Grammar changes require discussion before a PR — the grammar is the contract everything
else depends on. A change to the grammar is a breaking change to every `.wcf` file
and every tool that consumes them.

### Linter (`packages/linter`)

The linter validates `.wcf` files against the grammar. It should:

- Parse any `.wcf` file and return a list of errors with line numbers
- Enforce all 23 validation rules defined in `GRAMMAR.md`
- Validate `index.wcf` structure and resolve all file references
- Be usable as a CLI tool and as a library

There is no implementation yet. The interface contract is:

```
Input:  a path to a project root (containing index.wcf and GRAMMAR.md)
Output: an array of { file, line, rule, message } errors
        empty array = valid project
```

Language: TypeScript preferred. Must be publishable to npm.

### Renderer (`packages/renderer`)

The reference renderer produces HTML from a `.wcf` file for visual verification.
It is not the source of truth — the DSL is. The renderer exists to confirm that
a wireframe looks roughly as intended.

The renderer should:

- Accept a screen or overlay `.wcf` file and produce self-contained HTML
- Strip all comments before processing
- Make reasonable default styling decisions without requiring configuration
- Not attempt to produce production-quality UI — wireframe fidelity only

There is no implementation yet. Language: TypeScript preferred.

### Examples

Additional example projects in `examples/` are welcome. Good examples:

- Cover different application types (dashboard, content site, mobile-first)
- Use a variety of components including edge cases
- Include complete `index.wcf` with flows
- Are realistic enough that the DSL feels useful, not toy-like

### Editor integrations

Syntax highlighting, autocomplete, and inline validation for `.wcf` files in editors
such as VS Code and Zed would significantly improve the authoring experience.

There are no integrations yet. A VS Code extension with syntax highlighting for the
bracket notation and comment keys would be a high-value first contribution.

## Process

1. Open an issue describing what you want to change or build
2. Discuss the approach — especially for grammar changes
3. Submit a PR referencing the issue
4. All PRs require a passing linter run against the examples directory

## Changelog

Update the changelog with each release

## Principles

Keep these in mind when contributing:

- **Sparse is better** — if a renderer can infer it, the DSL should not say it
- **Closed vocabularies** — resist adding new comment keys or component attributes without strong justification
- **Model-readability first** — when in doubt, optimise for a model's ability to address and modify components
- **No framework opinions** — Wirecannon does not care about React, Svelte, or any other target
