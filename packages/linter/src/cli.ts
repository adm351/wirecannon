#!/usr/bin/env node
import * as path from 'path'
import { lint } from './index'

async function main(): Promise<void> {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: wirecannon-lint <project-root>')
    process.exit(1)
  }

  const projectRoot = path.resolve(arg)
  const errors = await lint(projectRoot)

  if (errors.length === 0) {
    console.log('No errors found')
    process.exit(0)
  }

  const cwd = process.cwd()
  for (const e of errors) {
    const rel = path.relative(cwd, e.file)
    const loc = e.line > 0 ? `:${e.line}` : ''
    console.error(`${rel}${loc}: [rule ${e.rule}] ${e.message}`)
  }

  console.error(`\n${errors.length} error${errors.length === 1 ? '' : 's'}`)
  process.exit(1)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
