# Wirecannon

## A cannonical text-based wireframing DSL built for the age of AI-assisted development.

✅ Readable by AI Models   
✅ Readable by Humans  
✅ Changes viewable in Diffs  
✅ Nothing lost between sessions  
✅ Update live previews as you or a model make changes  

Wirecannon lets you define UI wireframes as plain text files that are readable by humans, diffable in pull requests, and natively understood by AI models. Give a model a natural language instruction — it finds the right component, makes the change, and returns updated DSL. No clicking. No exporting. No context lost between sessions.

---

## The problem

Existing wireframing tools were designed before AI models existed. They produce binary files, proprietary formats, or visual state that a model cannot read, address, or reason about. When you want a model to help iterate on a design, you're back to describing the layout in prose and hoping it understands.

Wirecannon is designed from the ground up for the way teams actually work now — where a model is part of the design conversation, not an afterthought.

---

## How it works

Wireframes are `.wcf` files — plain text, square bracket syntax, two-space indentation.

```
[Header]                                              # region=header anchor=true
  [Row align:space-between]
    [Image alt:"Acme logo"]                           # component=brand anchor=true
    [Nav orientation:horizontal]                      # component=nav-primary role=navigation
    [ButtonGroup align:right]                         # region=header.actions
      [Button label:"Login" variant:ghost]            # action=auth-login priority=secondary
      [Button label:"Sign Up" variant:primary]        # action=auth-signup priority=primary anchor=true

[Main]                                                # region=main
  [Section id:products]                               # region=main.products
    [Grid cols:3 gap:md]                              # component=product-grid state=populated
      [Card id:product-card]                          # component=product-card
        [Image alt:"Product image"]
        [Text content:"Product name" variant:subheading]
        [Text content:"$0.00" variant:body]
        [Badge label:"In Stock" variant:success]
        [Button label:"Add to Cart" variant:primary]  # action=cart-add priority=primary anchor=true
```

Every line carries two parallel streams of information:

| Stream | Read by | Purpose |
|--------|---------|---------|
| DSL structure and attributes | Renderer | Produces the visual output |
| `# comment metadata` | Model | Resolves natural language instructions to component addresses |

**The core rule: if it affects pixels, it belongs in the DSL. If it helps a model reason, it belongs in a comment.**

---

## Natural language instructions that actually work

Because every component carries a semantic address, a model can resolve instructions unambiguously:

> *"Move the action buttons in the header to be right aligned"*
→ resolves `region=header.actions`, modifies `align` attribute on `ButtonGroup`

> *"Add a confirmation dialog before the checkout button"*
→ creates `overlays/confirm-dialog.wcf`, adds `target:confirm-dialog` to the checkout button

> *"Show the empty state for the product grid"*
→ resolves `component=product-grid`, sets `state=empty`

> *"Add a rating filter below price range in the sidebar"*
→ resolves `region=sidebar.filters.price-range`, inserts new `Section id:rating` below it

The model edits the DSL. The render is a consequence, not the source of truth.

---

## Project structure

A Wirecannon project is a directory of `.wcf` files:

```
wireframes/
  GRAMMAR.md           ← language spec, always present, always read first
  index.wcf             ← required project manifest
  screens/
    home.wcf
    product-list.wcf
    checkout.wcf
  overlays/
    cart-drawer.wcf
    auth-modal.wcf
```

`index.wcf` is the entry point. It declares every screen, every overlay, and every user flow. A model reads this before touching any other file.

---

## User flows

Flows live in `index.wcf` and define the full application narrative — including branching paths and edge cases:

```
[Flow id:purchase label:"Purchase Flow"]
  home → product-list → product-detail
    | authenticated   → checkout               # happy-path=true
    | unauthenticated → auth-modal → checkout  # frequency=high
  checkout
    | confirmed → order-confirm                # happy-path=true
    | declined  → checkout                     # retry=true
    | error     → support                      # frequency=low
```

A model given only `index.wcf` can answer questions like "what happens if payment fails?" or "where does the auth modal appear?" without reading every screen file.

---

## Using Wirecannon in your project

### 1. Install

```bash
npm install --save-dev @wirecannon/linter @wirecannon/renderer
```

### 2. Create your wireframes directory

```
your-project/
  wireframes/
    index.wcf
    screens/
    overlays/
```

`GRAMMAR.md` is fetched automatically by the model bootstrap — you do not need to copy it manually.

### 3. Bootstrap your AI model

Create `.claude/WIRECANNON.md` in your project root:

```markdown
This project uses Wirecannon (Wirecannon).

Before reading or editing any .wcf file:
1. Fetch the grammar spec: https://raw.githubusercontent.com/adm351/wirecannon/main/GRAMMAR.md
2. Read wireframes/index.wcf

The grammar defines all components, attributes, comment keys, validation rules,
and model instructions. Always use the live spec — do not rely on prior knowledge.
```

Claude Code reads `.claude/` automatically on startup. For other models, include this in your system prompt or inject it as context. The model always fetches the live grammar from GitHub, so it stays current with any language updates without changes to your repo.

### 4. Add a lint script

```json
{
  "scripts": {
    "lint:wireframes": "wirecannon-lint ./wireframes"
  }
}
```

---

## Grammar

The full language specification is in `GRAMMAR.md`. It defines:

- **Three component tiers** — Layout, Structure, Leaf — with explicit nesting rules
- **Sparse attribute vocabulary** — only attributes that would cause ambiguity without them
- **Validated comment keys** — a closed set of semantic metadata keys for model addressing
- **23 validation rules** — enforced by the linter, checkable inline by any model
- **10 model instructions** — explicit rules for how a model must behave when editing `.wcf` files

`GRAMMAR.md` is the contract between authors, models, linters, and renderers. It is versioned alongside the language.

---

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@wirecannon/linter`](packages/linter) | Validates `.wcf` files against the grammar | In progress |
| [`@wirecannon/renderer`](packages/renderer) | Reference HTML renderer for visual verification | In progress |
| [`@wirecannon/vscode`](packages/vscode) | VSCODE plugin for linting and previewing | In progress |

---

## Examples

See [`examples/ecommerce`](examples/ecommerce) for a complete project including:

- `index.wcf` with five user flows and fork syntax
- `screens/product-list.wcf` — header, sidebar filters, product grid
- `overlays/cart-drawer.wcf` — drawer with populated and empty states
- `overlays/auth-modal.wcf` — modal with login and register sections

---

## Design principles

**Sparse is better.** If a renderer can infer it, the DSL does not say it. Every attribute in the grammar exists because omitting it would cause an ambiguous decision.

**Closed vocabularies.** Comment keys and component attributes are a fixed set. Unknown keys are grammar errors. This keeps the semantic layer trustworthy across sessions and contributors.

**Model-first addressing.** The comment system is not documentation — it is a semantic index. `region`, `component`, `action`, and `anchor` exist specifically so a model can locate any component from a natural language instruction without traversing the full tree.

**No framework opinions.** Wirecannon ends at a well-defined wireframe. React, Svelte, Vue, or anything else you want to generate from it is your decision, not the language's.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Grammar changes require discussion — they are breaking changes. Linter and renderer implementations are the most impactful open contributions right now.

## License

MIT — see [`LICENSE`](LICENSE).
