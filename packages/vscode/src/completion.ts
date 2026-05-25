import * as vscode from 'vscode'
import { COMPONENTS, COMMENT_VOCAB } from '@wirecannon/linter'

// ── Index-file-only component schemas ────────────────────────────────────────

const INDEX_COMPONENTS: Record<string, Record<string, string[]>> = {
  Project: { name: [], version: [] },
  Screens: {},
  Screen: { id: [], label: [], file: [], entry: ['true'] },
  Overlays: {},
  Overlay: { id: [], label: [], file: [], scope: ['global', 'screen'] },
  Flows: {},
  Flow: { id: [], label: [] },
}

// ── Line context parser ───────────────────────────────────────────────────────

type Ctx =
  | { kind: 'component-type' }
  | { kind: 'attr-key'; componentType: string; usedAttrs: Set<string> }
  | { kind: 'attr-value'; componentType: string; attrKey: string }
  | { kind: 'comment-key' }

function parseContext(lineText: string, cursorChar: number): Ctx | null {
  const before = lineText.slice(0, cursorChar)

  // Comment context — cursor is after '#'
  const hashIdx = before.indexOf('#')
  if (hashIdx >= 0) return { kind: 'comment-key' }

  // Must be inside a component bracket
  const bracketStart = before.lastIndexOf('[')
  if (bracketStart < 0) return null

  const inside = before.slice(bracketStart + 1)
  const tokens = inside.split(/\s+/).filter(Boolean)

  // Still typing component type (no space yet after it)
  if (tokens.length === 0 || (tokens.length === 1 && !inside.match(/\s/))) {
    return { kind: 'component-type' }
  }

  const componentType = tokens[0]
  const lastToken = tokens[tokens.length - 1] ?? ''

  // Cursor is after 'attrKey:' — suggest values
  if (lastToken.includes(':') && !inside.endsWith(' ')) {
    const attrKey = lastToken.split(':')[0]
    return { kind: 'attr-value', componentType, attrKey }
  }

  // Suggest attr keys, excluding already-used ones
  const usedAttrs = new Set(tokens.slice(1).map(t => t.split(':')[0]))
  return { kind: 'attr-key', componentType, usedAttrs }
}

// ── Completion items ──────────────────────────────────────────────────────────

function componentTypeItems(isIndex: boolean): vscode.CompletionItem[] {
  const types = isIndex
    ? Object.keys(INDEX_COMPONENTS)
    : Object.keys(COMPONENTS)
  return types.map(t => {
    const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.Class)
    item.detail = 'Wirecannon component'
    return item
  })
}

function attrKeyItems(componentType: string, usedAttrs: Set<string>, isIndex: boolean): vscode.CompletionItem[] {
  if (isIndex) {
    const schema = INDEX_COMPONENTS[componentType]
    if (!schema) return []
    return Object.keys(schema)
      .filter(k => !usedAttrs.has(k))
      .map(k => {
        const item = new vscode.CompletionItem(k, vscode.CompletionItemKind.Property)
        const values = schema[k]
        item.insertText = values.length === 0 ? `${k}:"` : `${k}:`
        return item
      })
  }

  const schema = COMPONENTS[componentType]
  if (!schema) return []
  return Object.entries(schema.attrs)
    .filter(([k]) => !usedAttrs.has(k))
    .map(([k, attrSchema]) => {
      const item = new vscode.CompletionItem(k, vscode.CompletionItemKind.Property)
      if (attrSchema.type === 'boolean') {
        item.insertText = k
        item.detail = 'boolean flag'
      } else if (typeof attrSchema.type === 'object' && 'enum' in attrSchema.type) {
        item.insertText = `${k}:`
        item.detail = attrSchema.type.enum.join(' | ')
      } else {
        item.insertText = `${k}:"`
        item.detail = String(attrSchema.type)
      }
      if (attrSchema.required) item.label = `${k}*`
      return item
    })
}

function attrValueItems(componentType: string, attrKey: string, isIndex: boolean): vscode.CompletionItem[] {
  if (isIndex) {
    const values = INDEX_COMPONENTS[componentType]?.[attrKey] ?? []
    return values.map(v => new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember))
  }

  const attrSchema = COMPONENTS[componentType]?.attrs[attrKey]
  if (!attrSchema) return []
  if (typeof attrSchema.type === 'object' && 'enum' in attrSchema.type) {
    return attrSchema.type.enum.map(v => new vscode.CompletionItem(v, vscode.CompletionItemKind.EnumMember))
  }
  if (attrSchema.type === 'boolean') {
    return [new vscode.CompletionItem('true', vscode.CompletionItemKind.EnumMember)]
  }
  return []
}

function commentKeyItems(): vscode.CompletionItem[] {
  return [...COMMENT_VOCAB].map(k => {
    const item = new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword)
    item.insertText = `${k}=`
    item.detail = 'comment annotation'
    return item
  })
}

// ── Provider ──────────────────────────────────────────────────────────────────

const provider: vscode.CompletionItemProvider = {
  provideCompletionItems(document, position) {
    const lineText = document.lineAt(position.line).text
    const ctx = parseContext(lineText, position.character)
    if (!ctx) return []

    const isIndex = document.fileName.endsWith('index.wcf')

    switch (ctx.kind) {
      case 'component-type':
        return componentTypeItems(isIndex)
      case 'attr-key':
        return attrKeyItems(ctx.componentType, ctx.usedAttrs, isIndex)
      case 'attr-value':
        return attrValueItems(ctx.componentType, ctx.attrKey, isIndex)
      case 'comment-key':
        return commentKeyItems()
    }
  },
}

export function registerCompletion(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', language: 'wirecannon' },
      provider,
      '[', ' ', ':', '#',
    ),
  )
}
