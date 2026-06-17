import { ParsedNode, RenderOptions, Theme } from './types'

// ── Layout ────────────────────────────────────────────────────────────────────

interface Box { x: number; y: number; w: number; h: number }
interface LayoutNode { node: ParsedNode; box: Box; children: LayoutNode[] }

const SPACE: Record<string, number> = { sm: 8, md: 16, lg: 24 }
function sp(v: string | true | undefined, def = 0): number {
  return typeof v === 'string' ? (SPACE[v] ?? def) : def
}

function getGap(node: ParsedNode): number { return sp(node.attrs.gap as string | undefined) }
function getPad(node: ParsedNode): number {
  // explicit padding attr wins; otherwise use structural defaults
  if (typeof node.attrs.padding === 'string') return sp(node.attrs.padding)
  switch (node.type) {
    case 'Card': case 'Header': case 'Main': return 16
    case 'Footer': case 'Sidebar': return 12
    default: return 0
  }
}

// ── Height measurement (bottom-up) ────────────────────────────────────────────

function measureH(node: ParsedNode, width: number): number {
  const kids = node.children.filter(c => !c.isFlowLine)
  const gap = getGap(node)
  const pad = getPad(node)

  switch (node.type) {
    case 'Header': return 56
    case 'Footer': return 48
    case 'Nav':
      return node.attrs.orientation === 'vertical' ? kids.length * 36 + pad * 2 : 48
    case 'Row': {
      if (!kids.length) return 0
      const hasSidebar = kids.some(c => c.type === 'Sidebar')
      const heights = kids.map(k => {
        const kw = k.type === 'Sidebar' ? 240 : hasSidebar ? width - 240 : width / kids.length
        return measureH(k, Math.max(kw, 1))
      })
      return Math.max(...heights) + pad * 2
    }
    case 'Col':
    case 'Form': {
      if (!kids.length) return 0
      const total = kids.reduce((s, k) => s + measureH(k, width - pad * 2), 0)
      return total + (kids.length - 1) * (gap || 12) + pad * 2
    }
    case 'Section': {
      if (!kids.length) return 0
      const g = gap || 12
      const total = kids.reduce((s, k) => s + measureH(k, width - pad * 2), 0)
      return total + (kids.length - 1) * g + pad * 2
    }
    case 'Tabs': {
      const panels = kids.filter(k => k.type === 'TabPanel')
      const active = panels.find(p => p.attrs.active === true || p.attrs.active === 'true') ?? panels[0]
      return 48 + (active ? measureH(active, width - pad * 2) : 120) + pad * 2
    }
    case 'TabPanel': {
      if (!kids.length) return 120
      const g = gap || 12
      const total = kids.reduce((s, k) => s + measureH(k, width - pad * 2), 0)
      return total + (kids.length - 1) * g + pad * 2
    }
    case 'Main': {
      if (!kids.length) return 300
      const g = gap || 12
      const total = kids.reduce((s, k) => s + measureH(k, width - pad * 2), 0)
      return total + (kids.length - 1) * g + pad * 2
    }
    case 'Sidebar': {
      if (!kids.length) return 300
      const g = gap || 12
      const total = kids.reduce((s, k) => s + measureH(k, 240 - pad * 2), 0)
      return total + (kids.length - 1) * g + pad * 2
    }
    case 'Card': {
      if (!kids.length) return 120
      const g = gap || 12
      const cw = width - pad * 2
      const total = kids.reduce((s, k) => s + measureH(k, cw), 0)
      return total + (kids.length - 1) * g + pad * 2
    }
    case 'Grid': {
      const cols = parseInt(String(node.attrs.cols)) || 3
      const g = gap || 16
      const cw = (width - pad * 2 - (cols - 1) * g) / cols
      if (!kids.length) return 120 + pad * 2
      const cardH = Math.max(...kids.map(k => measureH(k, cw)))
      const rows = Math.ceil(kids.length / cols)
      return rows * cardH + (rows - 1) * g + pad * 2
    }
    case 'Stack':
    case 'Overlay': {
      if (!kids.length) return 200
      const g = gap || 12
      const total = kids.reduce((s, k) => s + measureH(k, width - pad * 2), 0)
      return total + (kids.length - 1) * g + pad * 2
    }
    // Leaf heights
    case 'Button': case 'ButtonDropdown': return 32
    case 'ButtonGroup': return 32
    case 'Badge': return 24
    case 'Icon': return 24
    case 'Divider': return node.attrs.orientation === 'vertical' ? 80 : 10
    case 'Input': return 36
    case 'Table': {
      const dataRows = node.children.filter(c => c.isFlowLine && c.raw).length
      return 36 + Math.max(dataRows - 1, 3) * 36 // header + data rows (min 3)
    }
    case 'List': return 4 * 22
    case 'Image': return Math.round((width - pad * 2) * 0.5625)
    case 'Branding': return 40
    case 'Text': {
      const v = node.attrs.variant
      return v === 'heading' ? 34 : v === 'subheading' ? 28 : 20
    }
    default: return 32
  }
}

// ── Layout pass (top-down, assigns boxes) ─────────────────────────────────────

function layout(node: ParsedNode, box: Box): LayoutNode {
  const kids = node.children.filter(c => !c.isFlowLine)
  if (!kids.length) return { node, box, children: [] }

  const gap = getGap(node) || 12
  const pad = getPad(node)
  const childNodes: LayoutNode[] = []

  switch (node.type) {
    case 'Row':
    case 'Header':
    case 'Footer': {
      const innerPad = node.type === 'Header' || node.type === 'Footer' ? 16 : pad
      const available = box.w - innerPad * 2
      const rowGap = getGap(node) || 8
      const hasSidebar = kids.some(c => c.type === 'Sidebar')
      const totalGap = (kids.length - 1) * rowGap
      let x = box.x + innerPad
      const rowY = box.y + innerPad
      for (const k of kids) {
        let kw: number
        if (k.type === 'Sidebar') kw = 240
        else if (hasSidebar) kw = available - 240 - totalGap
        else kw = (available - totalGap) / kids.length
        kw = Math.max(kw, 1)
        const kh = measureH(k, kw)
        childNodes.push(layout(k, { x, y: rowY, w: kw, h: kh }))
        x += kw + rowGap
      }
      break
    }
    case 'Grid': {
      const cols = parseInt(String(node.attrs.cols)) || 3
      const g = getGap(node) || 16
      const cw = (box.w - pad * 2 - (cols - 1) * g) / cols
      const cardH = kids.length ? Math.max(...kids.map(k => measureH(k, cw))) : 120
      let col = 0, row = 0
      for (const k of kids) {
        const kx = box.x + pad + col * (cw + g)
        const ky = box.y + pad + row * (cardH + g)
        childNodes.push(layout(k, { x: kx, y: ky, w: cw, h: cardH }))
        col++
        if (col >= cols) { col = 0; row++ }
      }
      break
    }
    case 'ButtonGroup': {
      const align = typeof node.attrs.align === 'string' ? node.attrs.align : 'left'
      const g = 8
      const bw = Math.min(140, (box.w - (kids.length - 1) * g) / kids.length)
      const totalW = kids.length * bw + (kids.length - 1) * g
      const startX = align === 'right' ? box.x + box.w - totalW :
                     align === 'center' ? box.x + (box.w - totalW) / 2 : box.x
      let x = startX
      for (const k of kids) {
        childNodes.push(layout(k, { x, y: box.y, w: bw, h: 32 }))
        x += bw + g
      }
      break
    }
    case 'Nav': {
      if (node.attrs.orientation === 'vertical') {
        let y = box.y + pad
        for (const k of kids) {
          childNodes.push(layout(k, { x: box.x + pad, y, w: box.w - pad * 2, h: 32 }))
          y += 32 + 4
        }
      } else {
        const btnW = Math.min(120, (box.w - pad * 2 - (kids.length - 1) * 8) / kids.length)
        let x = box.x + pad
        for (const k of kids) {
          childNodes.push(layout(k, { x, y: box.y + (box.h - 32) / 2, w: btnW, h: 32 }))
          x += btnW + 8
        }
      }
      break
    }
    case 'Tabs': {
      const panels = kids.filter(k => k.type === 'TabPanel')
      const active = panels.find(p => p.attrs.active === true || p.attrs.active === 'true') ?? panels[0]
      if (active) {
        childNodes.push(layout(active, {
          x: box.x + pad,
          y: box.y + pad + 48,
          w: box.w - pad * 2,
          h: measureH(active, box.w - pad * 2),
        }))
      }
      break
    }
    default: {
      // vertical stack
      const g = getGap(node) || 12
      let y = box.y + pad
      for (const k of kids) {
        const kh = measureH(k, box.w - pad * 2)
        childNodes.push(layout(k, { x: box.x + pad, y, w: box.w - pad * 2, h: kh }))
        y += kh + g
      }
    }
  }

  return { node, box, children: childNodes }
}

// ── SVG painting ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function a(s: string | true | undefined): string { return typeof s === 'string' ? s : '' }

function box(b: Box, fill: string, stroke: string, rx = 0, dash = ''): string {
  return `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1"${rx ? ` rx="${rx}"` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function txt(x: number, y: number, content: string, sz: number, fill: string, anchor = 'start', weight = 400): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${sz}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(content)}</text>`
}

function paintLeaf(ln: LayoutNode, theme: Theme): string {
  const { node, box: b } = ln
  const c = theme.colors
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2

  switch (node.type) {
    case 'Button': {
      const label = a(node.attrs.label)
      const variant = a(node.attrs.variant) || 'secondary'
      const align = a(node.attrs.align) || 'center'
      const isPrimary = variant === 'primary'
      const isDanger = variant === 'danger'
      const bg = isPrimary ? c.primary.bg : isDanger ? c.danger.bg : c.pageBg
      const stroke = isPrimary ? c.primary.border : isDanger ? c.danger.border : c.border
      const tc = isPrimary ? c.primary.text : isDanger ? c.danger.text : c.text
      const pad = 10
      const tx = align === 'left' ? b.x + pad : align === 'right' ? b.x + b.w - pad : cx
      const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
      return box(b, bg, stroke, 4) + txt(tx, cy + 5, label, 12, tc, anchor, 500)
    }
    case 'ButtonGroup': {
      const btns = node.children.filter(c => c.type === 'Button')
      if (!btns.length) return box(b, c.pageBg, c.border, 4)
      const bw = (b.w - (btns.length - 1) * 8) / btns.length
      return btns.map((btn, i) => {
        const bx = b.x + i * (bw + 8)
        const label = a(btn.attrs.label)
        const isPrimary = btn.attrs.variant === 'primary'
        const bg = isPrimary ? c.primary.bg : c.pageBg
        const stroke = isPrimary ? c.primary.border : c.border
        const tc = isPrimary ? c.primary.text : c.text
        const bb: Box = { x: bx, y: b.y, w: bw, h: 32 }
        return box(bb, bg, stroke, 4) + txt(bx + bw / 2, b.y + 21, label, 11, tc, 'middle', 500)
      }).join('')
    }
    case 'ButtonDropdown': return box(b, c.pageBg, c.border, 4) + txt(cx, cy + 5, `${a(node.attrs.label)} ▾`, 12, c.text, 'middle', 500)
    case 'Input': {
      const ph = a(node.attrs.placeholder) || 'Enter text…'
      return box(b, c.pageBg, c.border, 3) + txt(b.x + 10, b.y + 23, ph, 12, c.textSubtle)
    }
    case 'Text': {
      const content = a(node.attrs.content)
      const v = a(node.attrs.variant) || 'body'
      const sz = { heading: 22, subheading: 18, body: 14, caption: 11, label: 11 }[v] ?? 14
      const w = v === 'heading' ? 700 : v === 'subheading' ? 600 : 400
      const fill = (v === 'caption' || v === 'label') ? c.textMuted : c.text
      return txt(b.x, b.y + sz, content, sz, fill, 'start', w)
    }
    case 'Image': {
      const altText = a(node.attrs.alt)
      return [
        box(b, c.surfaceBg, c.border, 3, '4 2'),
        `<line x1="${b.x.toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${(b.x+b.w).toFixed(1)}" y2="${(b.y+b.h).toFixed(1)}" stroke="${c.borderSubtle}" stroke-width="1"/>`,
        `<line x1="${(b.x+b.w).toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${(b.y+b.h).toFixed(1)}" stroke="${c.borderSubtle}" stroke-width="1"/>`,
        txt(cx, cy + 5, altText, 11, c.textSubtle, 'middle'),
      ].join('')
    }
    case 'Branding': {
      const bw = Math.min(120, b.w)
      const bh = Math.min(40, b.h)
      const bx = b.x
      const by = b.y + Math.round((b.h - bh) / 2)
      return [
        `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${c.surfaceBg}" stroke="${c.border}" stroke-width="1" rx="3" stroke-dasharray="4 2"/>`,
        txt(bx + bw / 2, by + bh / 2 + 4, 'Acme logo', 9, c.textSubtle, 'middle'),
      ].join('')
    }
    case 'List': {
      const v = a(node.attrs.variant) || 'unordered'
      return ['Item one', 'Item two', 'Item three', 'Item four'].map((label, i) => {
        const bullet = v === 'ordered' ? `${i + 1}.` : '•'
        return txt(b.x, b.y + 16 + i * 22, `${bullet}  ${label}`, 13, c.textMuted)
      }).join('')
    }
    case 'Badge': {
      const label = a(node.attrs.label)
      const v = a(node.attrs.variant) || 'info'
      const bg = { info: c.info.bg, success: c.success.bg, warning: c.warning.bg, danger: c.danger.bg }[v] ?? c.info.bg
      const col = { info: c.info.text, success: c.success.text, warning: c.warning.text, danger: c.danger.text }[v] ?? c.info.text
      const tw = label.length * 6.5 + 14
      const bb: Box = { x: b.x, y: b.y + (b.h - 20) / 2, w: tw, h: 20 }
      return box(bb, bg, 'none', 10) + txt(bb.x + tw / 2, bb.y + 14, label, 11, col, 'middle', 600)
    }
    case 'Icon':
      return `<rect x="${b.x+2}" y="${b.y+2}" width="20" height="20" fill="none" stroke="${c.textSubtle}" stroke-width="1.5" rx="2"/>` +
        txt(b.x + 12, b.y + 16, '⊡', 12, c.textSubtle, 'middle')
    case 'Divider': {
      const vert = node.attrs.orientation === 'vertical'
      return `<line x1="${vert ? b.x+b.w/2 : b.x}" y1="${vert ? b.y : b.y+b.h/2}" x2="${vert ? b.x+b.w/2 : b.x+b.w}" y2="${vert ? b.y+b.h : b.y+b.h/2}" stroke="${c.border}" stroke-width="1"/>`
    }
    case 'Table': {
      const rowLines = node.children.filter(c => c.isFlowLine && c.raw)
      const [headerLine, ...dataLines] = rowLines
      const headers = headerLine ? headerLine.raw!.split('|').map(s => s.trim()) : ['Column']
      if (!headers.length) return box(b, c.surfaceBg, c.border, 2)
      const cw = b.w / headers.length
      const out: string[] = [box(b, c.pageBg, c.border, 2)]
      // header row
      out.push(`<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="36" fill="${c.surfaceBg}" stroke="none"/>`)
      out.push(`<line x1="${b.x}" y1="${b.y+36}" x2="${b.x+b.w}" y2="${b.y+36}" stroke="${c.border}" stroke-width="1.5"/>`)
      headers.forEach((col, i) => {
        out.push(txt(b.x + i * cw + 10, b.y + 24, col, 12, c.text, 'start', 600))
        if (i > 0) out.push(`<line x1="${b.x+i*cw}" y1="${b.y}" x2="${b.x+i*cw}" y2="${b.y+b.h}" stroke="${c.borderSubtle}" stroke-width="1"/>`)
      })
      // data rows — strip inline component syntax to plain label for SVG
      const svgCell = (cell: string) => {
        const t = cell.trim()
        if (t.startsWith('[') && t.includes(']')) {
          const label = t.match(/label:"([^"]+)"/)?.[1] ?? t.match(/content:"([^"]+)"/)?.[1]
          return label ?? (t.replace(/\[[^\]]*\]/, '').trim() || '—')
        }
        return t || '—'
      }
      const rows = dataLines.length ? dataLines : Array(3).fill({ raw: headers.map(() => '—').join(' | ') } as { raw: string })
      rows.forEach((row, r) => {
        const ry = b.y + 36 + r * 36
        if (r > 0) out.push(`<line x1="${b.x}" y1="${ry}" x2="${b.x+b.w}" y2="${ry}" stroke="${c.borderSubtle}" stroke-width="1"/>`)
        const cells = (row.raw ?? '').split('|')
        headers.forEach((_, i) => out.push(txt(b.x + i * cw + 10, ry + 23, svgCell(cells[i] ?? ''), 12, c.textMuted)))
      })
      return out.join('')
    }
    default:
      return box(b, c.surfaceBg, c.border) + txt(cx, cy + 5, node.type, 11, c.textSubtle, 'middle')
  }
}

function paintNode(ln: LayoutNode, theme: Theme): string {
  const { node, box: b } = ln
  const c = theme.colors
  if (node.isFlowLine) return ''
  const childSvg = ln.children.map(child => paintNode(child, theme)).join('')

  switch (node.type) {
    case 'Header':  return box(b, c.surfaceBg, c.border) + childSvg
    case 'Footer':  return box(b, c.surfaceBg, c.border) + childSvg
    case 'Sidebar': return box(b, c.surfaceBg, c.border) + childSvg
    case 'Main':    return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${c.pageBg}" stroke="none"/>` + childSvg
    case 'Card':    return box(b, c.cardBg, c.border, 4) + childSvg
    case 'Overlay': return box(b, c.pageBg, c.border, 4) + childSvg
    case 'Nav': {
      const label = `Nav ${a(node.attrs.orientation) || 'horizontal'}`
      return box(b, c.surfaceBg, c.borderSubtle, 2) + (ln.children.length ? childSvg : txt(b.x + 8, b.y + 16, label, 11, c.textSubtle))
    }
    case 'Tabs': {
      const panels = node.children.filter(child => child.type === 'TabPanel')
      const active = panels.find(panel => panel.attrs.active === true || panel.attrs.active === 'true') ?? panels[0]
      const tabW = panels.length ? Math.min(140, b.w / panels.length) : 120
      const tabSvg = panels.map((panel, i) => {
        const x = b.x + i * tabW
        const isActive = panel === active
        const fill = isActive ? c.pageBg : c.surfaceBg
        const stroke = isActive ? c.primary.border : c.borderSubtle
        return box({ x, y: b.y, w: tabW, h: 36 }, fill, stroke, 3) +
          txt(x + tabW / 2, b.y + 23, a(panel.attrs.label), 12, isActive ? c.text : c.textMuted, 'middle', isActive ? 600 : 400)
      }).join('')
      return box(b, c.pageBg, c.borderSubtle, 3) + tabSvg + childSvg
    }
    // transparent containers
    case 'Row': case 'Col': case 'Grid': case 'Stack':
    case 'Section': case 'TabPanel': case 'Form': case 'ButtonGroup':
      return childSvg
    default:
      return paintLeaf(ln, theme)
  }
}

function labelNode(ln: LayoutNode, theme: Theme): string {
  const { node, box: b } = ln
  if (node.isFlowLine) return ''
  const childLabels = ln.children.map(l => labelNode(l, theme)).join('')
  const c = theme.colors.textSubtle
  switch (node.type) {
    case 'Header':  return txt(b.x + 4, b.y + 11, 'Header', 9, c) + childLabels
    case 'Footer':  return txt(b.x + 4, b.y + 11, 'Footer', 9, c) + childLabels
    case 'Sidebar': return txt(b.x + 4, b.y + 11, `Sidebar·${a(node.attrs.position)||'left'}`, 9, c) + childLabels
    case 'Section': {
      const id = a(node.attrs.id)
      return (id ? txt(b.x + 2, b.y + 10, `§${id}`, 8, c) : '') + childLabels
    }
    case 'Tabs': {
      const id = a(node.attrs.id)
      return (id ? txt(b.x + 2, b.y + 10, `Tabs·${id}`, 8, c) : '') + childLabels
    }
    default: return childLabels
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function renderSvg(nodes: ParsedNode[], theme: Theme, _opts: RenderOptions): string {
  const W = 1280
  const screenNodes = nodes.filter(n => !n.isFlowLine)
  const totalH = screenNodes.reduce((s, n) => s + measureH(n, W), 0)
  const H = Math.max(totalH, 600)

  const rootLayouts: LayoutNode[] = []
  let y = 0
  for (const n of screenNodes) {
    const h = measureH(n, W)
    rootLayouts.push(layout(n, { x: 0, y, w: W, h }))
    y += h
  }

  const bg = `<rect width="${W}" height="${H}" fill="${theme.colors.pageBg}"/>`
  const paint = rootLayouts.map(ln => paintNode(ln, theme)).join('')
  const labels = rootLayouts.map(ln => labelNode(ln, theme)).join('')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<style>text{font-family:${theme.font.family};}</style>`,
    bg, paint, labels,
    '</svg>',
  ].join('\n')
}
