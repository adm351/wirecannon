# Wirecannon

This project uses **Wirecannon** — a text-based wireframing DSL.
Wireframe files use the `.wcf` extension and live in the `wireframes/` directory.

## Your first step — always

Before reading, editing, or creating any `.wcf` file you must fetch the live grammar spec:

```
https://raw.githubusercontent.com/adm351/wirecannon/main/GRAMMAR.md
```

This is the authoritative language specification. It defines every component, attribute,
comment key, validation rule, and model instruction. Do not rely on prior knowledge of
the format — always fetch and read the current spec first.

## Then read index.wcf

After fetching the grammar, read `wireframes/index.wcf` (or other project directory containing wireframes, *.wcf files) 
before touching any screen or overlay file. It contains the full project manifest, screen declarations, overlay
declarations, and user flows.

## Linting

Before returning any modified `.wcf` content, validate it against the 23 rules defined
in `GRAMMAR.md`. If the linter package is available:

```
npx @wirecannon/linter ./wireframes
```

If not available, self-validate inline — the grammar rules are explicit enough to check
without tooling. Never return DSL that violates a grammar rule.

## Rendering

To visually verify a screen or overlay:

```
npx @wirecannon/renderer ./wireframes/screens/my-screen.wcf
```

The render is for verification only. Always edit the DSL, never the rendered output.

## Key principles

- The DSL is the source of truth — not the render
- If it affects pixels, it belongs in the DSL
- If it helps a model reason, it belongs in a comment
- Edits to `.wcf` files must preserve all existing comment metadata unless explicitly instructed to remove it
- Never move or alter a component tagged `anchor=true` without an explicit instruction

## Resources

- Grammar spec: https://raw.githubusercontent.com/adm351/wirecannon/main/GRAMMAR.md
- Repository: https://github.com/adm351/wirecannon
- Linter: https://www.npmjs.com/package/@wirecannon/linter
- Renderer: https://www.npmjs.com/package/@wirecannon/renderer
