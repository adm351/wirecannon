#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const action = process.argv[2]
const packageDir = path.resolve(process.argv[3] || process.cwd())
const repoRoot = path.resolve(__dirname, '..')
const docsDir = path.join(packageDir, 'docs')

const docs = [
  ['GRAMMAR.md', 'GRAMMAR.md'],
  ['README.md', 'README.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
  [path.join('.claude', 'WIRECANNON.md'), 'WIRECANNON.md'],
]

function copyDocs() {
  fs.mkdirSync(docsDir, { recursive: true })
  for (const [source, target] of docs) {
    fs.copyFileSync(path.join(repoRoot, source), path.join(docsDir, target))
  }
}

function cleanDocs() {
  fs.rmSync(docsDir, { recursive: true, force: true })
}

if (action === 'copy') {
  copyDocs()
} else if (action === 'clean') {
  cleanDocs()
} else {
  console.error('Usage: node scripts/package-docs.js <copy|clean> [package-dir]')
  process.exit(1)
}
