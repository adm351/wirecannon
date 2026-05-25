import * as fs from 'fs'
import * as path from 'path'
import { LintError, ParsedNode } from './types'
import {
  COMPONENTS,
  COMMENT_VOCAB,
  LEAF,
  LAYOUT,
  permittedChildren,
  KEBAB_CASE,
} from './schema'

function err(file: string, line: number, rule: number, message: string): LintError {
  return { file, line, rule, message }
}

// ── Attribute validation (rules 13–15, 23) ────────────────────────────────────

function validateAttrs(node: ParsedNode, file: string): LintError[] {
  const errors: LintError[] = []
  const schema = COMPONENTS[node.type]
  if (!schema) return errors

  for (const [key, def] of Object.entries(schema.attrs)) {
    if (def.required && !(key in node.attrs)) {
      errors.push(err(file, node.line, 13, `[${node.type}] missing required attribute '${key}'`))
    }
  }

  for (const [key, value] of Object.entries(node.attrs)) {
    const def = schema.attrs[key]
    if (!def) {
      errors.push(err(file, node.line, 15, `[${node.type}] unknown attribute '${key}'`))
      continue
    }

    const t = def.type

    if (t === 'boolean') {
      if (value !== true && value !== 'true') {
        errors.push(err(file, node.line, 14, `[${node.type}] attribute '${key}' is boolean — write as a bare flag or :true`))
      }
      continue
    }

    if (value === true) continue // bare flag on a non-boolean attr is still valid syntax; value is absent

    if (typeof t === 'object' && 'enum' in t) {
      if (!t.enum.includes(value)) {
        errors.push(err(file, node.line, 14, `[${node.type}] attribute '${key}' value '${value}' is invalid; expected one of: ${t.enum.join(', ')}`))
      }
    } else if (t === 'integer') {
      if (!/^\d+$/.test(value)) {
        errors.push(err(file, node.line, 14, `[${node.type}] attribute '${key}' must be an integer`))
      }
    } else if (t === 'kebab-case') {
      if (!KEBAB_CASE.test(value)) {
        errors.push(err(file, node.line, 23, `[${node.type}] attribute '${key}' value '${value}' must be kebab-case`))
      }
    }
    // 'string' — any value is valid
  }

  return errors
}

// ── Comment validation (rules 16–20) ─────────────────────────────────────────

function validateComment(node: ParsedNode, file: string): LintError[] {
  const errors: LintError[] = []

  for (const [key, value] of Object.entries(node.comment)) {
    if (!COMMENT_VOCAB.has(key)) {
      errors.push(err(file, node.line, 16, `unknown comment key '${key}'`))
      continue
    }

    if ((key === 'note' || key === 'todo') && value === true) {
      errors.push(err(file, node.line, 18, `comment key '${key}' must have a quoted string value`))
    }

    if (key === 'anchor' && value !== 'true') {
      errors.push(err(file, node.line, 19, `comment key 'anchor' must have value 'true'`))
    }

    if (key === 'hidden' && value !== 'true') {
      errors.push(err(file, node.line, 20, `comment key 'hidden' must have value 'true'`))
    }
  }

  return errors
}

// ── Nesting rule number lookup ────────────────────────────────────────────────

function nestingRule(parentType: string, childType: string): number {
  if (parentType === 'Card' && childType === 'Card') return 6
  if (parentType === 'Nav') return 8
  if (parentType === 'Header' || parentType === 'Footer') return 9
  if (LEAF.has(parentType) && parentType !== 'ButtonGroup' && parentType !== 'Form') return 10
  if (parentType === 'ButtonGroup') return 11
  if (parentType === 'Form') return 12
  return 9
}

// ── Tree walk ─────────────────────────────────────────────────────────────────

interface WalkCtx {
  file: string
  validTargets: Set<string>
  seenIds: Set<string>
  errors: LintError[]
}

function walkNode(node: ParsedNode, parentType: string | null, sectionDepth: number, ctx: WalkCtx): void {
  if (node.isFlowLine) {
    ctx.errors.push(...validateComment(node, ctx.file))
    return
  }

  if (!(node.type in COMPONENTS)) {
    ctx.errors.push(err(ctx.file, node.line, 15, `unknown component type '${node.type}'`))
    return
  }

  // Nesting check
  if (parentType !== null) {
    const permitted = permittedChildren(parentType)
    if (!permitted.has(node.type)) {
      const rule = nestingRule(parentType, node.type)
      ctx.errors.push(err(ctx.file, node.line, rule, `[${node.type}] is not permitted inside [${parentType}]`))
    }
  }

  // Rule 7: Section depth
  let childSectionDepth = sectionDepth
  if (node.type === 'Section') {
    childSectionDepth = sectionDepth + 1
    if (childSectionDepth > 2) {
      ctx.errors.push(err(ctx.file, node.line, 7, `[Section] exceeds maximum nesting depth of 2`))
    }
  }

  // Rule 10: leaf/flow-only components must not have component children
  const permitted = permittedChildren(node.type)
  const componentChildren = node.children.filter(c => !c.isFlowLine)
  if (permitted.size === 0 && componentChildren.length > 0) {
    ctx.errors.push(err(ctx.file, node.line, 10, `[${node.type}] is a leaf component and must not have children`))
  }

  ctx.errors.push(...validateAttrs(node, ctx.file))
  ctx.errors.push(...validateComment(node, ctx.file))

  // Rule 5: target and triggers must resolve to declared screen/overlay ids
  if (typeof node.attrs.target === 'string' && !ctx.validTargets.has(node.attrs.target)) {
    ctx.errors.push(err(ctx.file, node.line, 5, `target '${node.attrs.target}' does not resolve to a declared screen or overlay id`))
  }
  if (typeof node.comment.triggers === 'string' && !ctx.validTargets.has(node.comment.triggers)) {
    ctx.errors.push(err(ctx.file, node.line, 5, `triggers '${node.comment.triggers}' does not resolve to a declared screen or overlay id`))
  }

  // Rule 21: id uniqueness within file
  if (typeof node.attrs.id === 'string') {
    if (ctx.seenIds.has(node.attrs.id)) {
      ctx.errors.push(err(ctx.file, node.line, 21, `duplicate id '${node.attrs.id}' within file`))
    } else {
      ctx.seenIds.add(node.attrs.id)
    }
  }

  for (const child of node.children) {
    walkNode(child, node.type, childSectionDepth, ctx)
  }
}

export function validateContentFile(filePath: string, nodes: ParsedNode[], validTargets: Set<string>): LintError[] {
  const ctx: WalkCtx = { file: filePath, validTargets, seenIds: new Set(), errors: [] }
  for (const node of nodes) {
    walkNode(node, null, 0, ctx)
  }
  return ctx.errors
}

// ── index.wcf validation ──────────────────────────────────────────────────────

export interface IndexResult {
  errors: LintError[]
  screenFiles: Array<{ id: string; file: string }>
  overlayFiles: Array<{ id: string; file: string }>
  validTargets: Set<string>
}

export function validateIndex(filePath: string, nodes: ParsedNode[], projectRoot: string): IndexResult {
  const errors: LintError[] = []
  const screenFiles: Array<{ id: string; file: string }> = []
  const overlayFiles: Array<{ id: string; file: string }> = []
  const seenIds = new Set<string>()

  const byType = (t: string) => nodes.filter(n => n.type === t)

  // Rule 2
  for (const block of ['Project', 'Screens', 'Flows'] as const) {
    const found = byType(block)
    if (found.length === 0) errors.push(err(filePath, 0, 2, `index.wcf must contain exactly one [${block}] block`))
    if (found.length > 1) errors.push(err(filePath, found[1].line, 2, `index.wcf must contain exactly one [${block}] block`))
  }

  // [Project]
  const projNodes = byType('Project')
  if (projNodes.length > 0) {
    const proj = projNodes[0]
    if (!proj.attrs.name) errors.push(err(filePath, proj.line, 13, '[Project] missing required attribute name'))
    if (!proj.attrs.version) errors.push(err(filePath, proj.line, 13, '[Project] missing required attribute version'))
    const validProjAttrs = new Set(['name', 'version'])
    for (const key of Object.keys(proj.attrs)) {
      if (!validProjAttrs.has(key)) errors.push(err(filePath, proj.line, 15, `[Project] unknown attribute '${key}'`))
    }
    errors.push(...validateComment(proj, filePath))
  }

  // [Screens]
  let entryCount = 0
  const screensNodes = byType('Screens')
  if (screensNodes.length > 0) {
    for (const screen of screensNodes[0].children) {
      if (screen.type !== 'Screen') continue

      const id = screen.attrs.id
      if (!id) {
        errors.push(err(filePath, screen.line, 13, '[Screen] missing required attribute id'))
      } else if (typeof id === 'string') {
        if (seenIds.has(id)) errors.push(err(filePath, screen.line, 22, `duplicate id '${id}' in index.wcf`))
        else seenIds.add(id)
        if (!KEBAB_CASE.test(id)) errors.push(err(filePath, screen.line, 23, `[Screen] id '${id}' must be kebab-case`))
      }

      if (!screen.attrs.label) errors.push(err(filePath, screen.line, 13, '[Screen] missing required attribute label'))

      if (!screen.attrs.file) {
        errors.push(err(filePath, screen.line, 13, '[Screen] missing required attribute file'))
      } else if (typeof screen.attrs.file === 'string') {
        const fullPath = path.join(projectRoot, screen.attrs.file)
        if (!fs.existsSync(fullPath)) {
          errors.push(err(filePath, screen.line, 4, `[Screen] file '${screen.attrs.file}' does not exist`))
        }
        if (typeof id === 'string') {
          screenFiles.push({ id, file: fullPath })
        }
      }

      if (screen.attrs.entry === true || screen.attrs.entry === 'true') entryCount++

      const validAttrs = new Set(['id', 'label', 'file', 'entry'])
      for (const key of Object.keys(screen.attrs)) {
        if (!validAttrs.has(key)) errors.push(err(filePath, screen.line, 15, `[Screen] unknown attribute '${key}'`))
      }

      errors.push(...validateComment(screen, filePath))
    }
  }

  if (entryCount === 0) errors.push(err(filePath, 0, 3, 'exactly one [Screen] must have entry:true'))
  if (entryCount > 1) errors.push(err(filePath, 0, 3, 'only one [Screen] may have entry:true'))

  // [Overlays]
  const overlaysNodes = byType('Overlays')
  if (overlaysNodes.length > 0) {
    for (const overlay of overlaysNodes[0].children) {
      if (overlay.type !== 'Overlay') continue

      const id = overlay.attrs.id
      if (!id) {
        errors.push(err(filePath, overlay.line, 13, '[Overlay] missing required attribute id'))
      } else if (typeof id === 'string') {
        if (seenIds.has(id)) errors.push(err(filePath, overlay.line, 22, `duplicate id '${id}' in index.wcf`))
        else seenIds.add(id)
        if (!KEBAB_CASE.test(id)) errors.push(err(filePath, overlay.line, 23, `[Overlay] id '${id}' must be kebab-case`))
      }

      if (!overlay.attrs.label) errors.push(err(filePath, overlay.line, 13, '[Overlay] missing required attribute label'))

      if (!overlay.attrs.scope) {
        errors.push(err(filePath, overlay.line, 13, '[Overlay] missing required attribute scope'))
      } else if (typeof overlay.attrs.scope === 'string' && !['global', 'screen'].includes(overlay.attrs.scope)) {
        errors.push(err(filePath, overlay.line, 14, `[Overlay] scope '${overlay.attrs.scope}' is invalid; expected: global, screen`))
      }

      if (!overlay.attrs.file) {
        errors.push(err(filePath, overlay.line, 13, '[Overlay] missing required attribute file'))
      } else if (typeof overlay.attrs.file === 'string') {
        const fullPath = path.join(projectRoot, overlay.attrs.file)
        if (!fs.existsSync(fullPath)) {
          errors.push(err(filePath, overlay.line, 4, `[Overlay] file '${overlay.attrs.file}' does not exist`))
        }
        if (typeof id === 'string') {
          overlayFiles.push({ id, file: fullPath })
        }
      }

      const validAttrs = new Set(['id', 'label', 'file', 'scope'])
      for (const key of Object.keys(overlay.attrs)) {
        if (!validAttrs.has(key)) errors.push(err(filePath, overlay.line, 15, `[Overlay] unknown attribute '${key}'`))
      }

      errors.push(...validateComment(overlay, filePath))
    }
  }

  // [Flows] — validate comment keys on flow lines
  const flowsNodes = byType('Flows')
  if (flowsNodes.length > 0) {
    for (const flow of flowsNodes[0].children) {
      if (flow.type !== 'Flow') continue
      if (!flow.attrs.id) errors.push(err(filePath, flow.line, 13, '[Flow] missing required attribute id'))
      if (!flow.attrs.label) errors.push(err(filePath, flow.line, 13, '[Flow] missing required attribute label'))
      errors.push(...validateComment(flow, filePath))
      for (const line of flow.children) {
        if (line.isFlowLine) errors.push(...validateComment(line, filePath))
      }
    }
  }

  const validTargets = new Set([
    ...screenFiles.map(s => s.id),
    ...overlayFiles.map(o => o.id),
  ])

  return { errors, screenFiles, overlayFiles, validTargets }
}
