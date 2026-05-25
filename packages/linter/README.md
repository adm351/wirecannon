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

All 23 validation rules are defined in `GRAMMAR.md` in the project root.
