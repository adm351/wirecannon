import { ParsedNode } from './types'

function parseAttrs(s: string): Record<string, string | true> {
  const result: Record<string, string | true> = {}
  let i = 0
  s = s.trim()

  while (i < s.length) {
    while (i < s.length && s[i] === ' ') i++
    if (i >= s.length) break

    let key = ''
    while (i < s.length && s[i] !== ':' && s[i] !== ' ') key += s[i++]
    if (!key) break

    if (i >= s.length || s[i] === ' ') {
      result[key] = true
      continue
    }

    i++ // skip ':'

    let value = ''
    if (i < s.length && s[i] === '"') {
      i++
      while (i < s.length && s[i] !== '"') value += s[i++]
      if (i < s.length) i++ // skip closing quote
    } else {
      while (i < s.length && s[i] !== ' ') value += s[i++]
    }
    result[key] = value
  }

  return result
}

function parseComment(s: string): Record<string, string | true> {
  const result: Record<string, string | true> = {}
  let i = 0
  s = s.trim()

  while (i < s.length) {
    while (i < s.length && s[i] === ' ') i++
    if (i >= s.length) break

    let key = ''
    while (i < s.length && s[i] !== '=' && s[i] !== ' ') key += s[i++]
    if (!key) break

    if (i >= s.length || s[i] === ' ') {
      result[key] = true
      continue
    }

    i++ // skip '='

    let value = ''
    if (i < s.length && s[i] === '"') {
      i++
      while (i < s.length && s[i] !== '"') value += s[i++]
      if (i < s.length) i++
    } else {
      while (i < s.length && s[i] !== ' ') value += s[i++]
    }
    result[key] = value
  }

  return result
}

function parseLine(line: string, lineNum: number): ParsedNode | null {
  const trimmed = line.trimStart()
  if (!trimmed || trimmed.startsWith('#')) return null

  const indent = line.length - trimmed.length

  if (!trimmed.startsWith('[')) {
    const hashIdx = trimmed.indexOf('#')
    const raw = (hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed).trim()
    const commentStr = hashIdx >= 0 ? trimmed.slice(hashIdx + 1).trim() : ''
    return {
      type: '_flow',
      attrs: {},
      comment: commentStr ? parseComment(commentStr) : {},
      children: [],
      line: lineNum,
      indent,
      isFlowLine: true,
      raw,
    }
  }

  const closeIdx = trimmed.indexOf(']')
  if (closeIdx < 0) return null

  const inner = trimmed.slice(1, closeIdx)
  const afterBracket = trimmed.slice(closeIdx + 1).trim()
  const commentStr = afterBracket.startsWith('#') ? afterBracket.slice(1).trim() : ''

  const spaceIdx = inner.search(/\s/)
  const type = spaceIdx < 0 ? inner.trim() : inner.slice(0, spaceIdx).trim()
  const attrStr = spaceIdx < 0 ? '' : inner.slice(spaceIdx + 1)

  return {
    type,
    attrs: parseAttrs(attrStr),
    comment: commentStr ? parseComment(commentStr) : {},
    children: [],
    line: lineNum,
    indent,
    isFlowLine: false,
  }
}

export function parseFile(content: string): ParsedNode[] {
  const lines = content.split('\n')
  const roots: ParsedNode[] = []
  const stack: Array<{ indent: number; node: ParsedNode }> = []

  for (let i = 0; i < lines.length; i++) {
    const node = parseLine(lines[i], i + 1)
    if (!node) continue

    while (stack.length > 0 && stack[stack.length - 1].indent >= node.indent) {
      stack.pop()
    }

    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1].node.children.push(node)
    }

    if (!node.isFlowLine) {
      stack.push({ indent: node.indent, node })
    }
  }

  return roots
}
