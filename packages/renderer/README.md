# @wirecannon/renderer

Reference HTML renderer for Wirecannon `.wcf` files.
Produces visual output for verification purposes only — the DSL is the source of truth.

## Status

Not yet implemented. See `CONTRIBUTING.md` if you want to build this.

## Interface contract

```typescript
interface RenderOptions {
  stripComments: true    // always true, comments are never rendered
}

// Returns self-contained HTML string
async function render(wfFilePath: string, options?: RenderOptions): Promise<string>
```

## CLI usage (planned)

```
npx @wirecannon/renderer ./wireframes/screens/product-list.wcf --out product-list.html
```

## Renderer responsibilities

- Parse the DSL structure and attributes
- Strip all comments before processing
- Produce wireframe-fidelity HTML — not production UI
- Make reasonable layout defaults for omitted attributes
- Never read or act on comment content

## Renderer non-responsibilities

- Pixel-perfect design
- Responsive breakpoints
- Real data or assets
- Framework-specific output

## Packaged language docs

When installed from npm, the language reference is included in the package:

```
node_modules/@wirecannon/renderer/docs/GRAMMAR.md
```

The `docs/` directory also includes the root README, changelog, contribution guide,
and `WIRECANNON.md` model bootstrap instructions.
