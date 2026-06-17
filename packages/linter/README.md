# @wirecannon/linter

Validates `.wcf` files against the Wirecannon grammar specification.

## Status

Not yet implemented. See `CONTRIBUTING.md` if you want to build this.

## Interface contract

```typescript
interface LintError {
  file: string
  line: number
  rule: number      // validation rule number from GRAMMAR.md
  message: string
}

// Returns empty array for a valid project
async function lint(projectRoot: string): Promise<LintError[]>
```

## CLI usage (planned)

```
npx @wirecannon/linter ./wireframes
```

## Validation rules

All validation rules are defined in `GRAMMAR.md`.

When installed from npm, the language reference is included in the package:

```
node_modules/@wirecannon/linter/docs/GRAMMAR.md
```

The `docs/` directory also includes the root README, changelog, contribution guide,
and `WIRECANNON.md` model bootstrap instructions.
