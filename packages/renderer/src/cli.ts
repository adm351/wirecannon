#!/usr/bin/env node
import * as fs from 'fs/promises'
import * as path from 'path'
import { render } from './index'
import { startDevServer } from './dev'

function usage(): never {
  console.error(`Usage:
  wirecannon-render <file.wcf> [--out <output>] [--theme bw|flexoki] [--svg]
  wirecannon-render --dev <project-dir|file.wcf> [--theme bw|flexoki] [--port 5173]`)
  process.exit(1)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (!args.length) usage()

  const devIdx = args.indexOf('--dev')
  if (devIdx !== -1) {
    const target = args[devIdx + 1]
    if (!target) usage()
    const themeIdx = args.indexOf('--theme')
    const portIdx = args.indexOf('--port')
    await startDevServer(path.resolve(target), {
      theme: themeIdx !== -1 ? args[themeIdx + 1] : undefined,
      port: portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : undefined,
    })
    return
  }

  // Static render
  const file = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'))
  if (!file) usage()

  const outIdx = args.indexOf('--out')
  const themeIdx = args.indexOf('--theme')
  const svgMode = args.includes('--svg')

  const outFile = outIdx !== -1 ? args[outIdx + 1] : undefined
  const theme = themeIdx !== -1 ? args[themeIdx + 1] : 'bw'
  const format = svgMode ? 'svg' : 'html'

  const output = await render(path.resolve(file), { theme: theme as 'bw' | 'flexoki', format })

  if (outFile) {
    await fs.writeFile(path.resolve(outFile), output, 'utf-8')
    console.log(`Written to ${outFile}`)
  } else {
    process.stdout.write(output)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
