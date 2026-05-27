import { ParsedNode, RenderOptions, Theme } from './types'
import { parseFile } from './parser'

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function attr(s: string | true | undefined): string {
  return typeof s === 'string' ? s : ''
}

const GAP: Record<string, string> = { sm: '8px', md: '16px', lg: '24px' }
const PAD: Record<string, string> = { sm: '8px', md: '16px', lg: '24px' }
const JUSTIFY: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  'space-between': 'space-between', 'space-around': 'space-around',
}

function rowStyle(node: ParsedNode): string {
  const parts: string[] = []
  const align = attr(node.attrs.align)
  if (align) parts.push(`justify-content:${JUSTIFY[align] ?? 'flex-start'};align-items:center`)
  const gap = attr(node.attrs.gap)
  if (gap && GAP[gap]) parts.push(`gap:${GAP[gap]}`)
  const pad = attr(node.attrs.padding)
  if (pad && PAD[pad]) parts.push(`padding:${PAD[pad]}`)
  return parts.join(';')
}

function colStyle(node: ParsedNode): string {
  const parts: string[] = []
  const align = attr(node.attrs.align)
  if (align) parts.push(`justify-content:${JUSTIFY[align] ?? 'flex-start'}`)
  const gap = attr(node.attrs.gap)
  if (gap && GAP[gap]) parts.push(`gap:${GAP[gap]}`)
  const pad = attr(node.attrs.padding)
  if (pad && PAD[pad]) parts.push(`padding:${PAD[pad]}`)
  return parts.join(';')
}

// ── Node renderers ─────────────────────────────────────────────────────────────

function renderChildren(node: ParsedNode, opts: RenderOptions): string {
  return node.children.filter(c => !c.isFlowLine).map(c => renderNode(c, opts)).join('')
}

function renderNode(node: ParsedNode, opts: RenderOptions): string {
  switch (node.type) {
    case 'Header': return `<header class="wcf-header">${renderChildren(node, opts)}</header>`
    case 'Footer': return `<footer class="wcf-footer">${renderChildren(node, opts)}</footer>`
    case 'Main':   return `<main class="wcf-main">${renderChildren(node, opts)}</main>`
    case 'Sidebar': {
      const pos = attr(node.attrs.position) || 'left'
      return `<aside class="wcf-sidebar wcf-sidebar--${pos}">${renderChildren(node, opts)}</aside>`
    }
    case 'Section': {
      const id = attr(node.attrs.id)
      return `<section class="wcf-section"${id ? ` id="${esc(id)}"` : ''}>${renderChildren(node, opts)}</section>`
    }
    case 'Nav': {
      const dir = attr(node.attrs.orientation) || 'horizontal'
      return `<nav class="wcf-nav wcf-nav--${dir}">${renderChildren(node, opts)}</nav>`
    }
    case 'Card': {
      const id = attr(node.attrs.id)
      return `<div class="wcf-card"${id ? ` id="${esc(id)}"` : ''}>${renderChildren(node, opts)}</div>`
    }
    case 'Row': {
      const style = rowStyle(node)
      const fill = node.children.some(c => c.type === 'Main' || c.type === 'Sidebar')
      const grow = node.attrs.grow === true
      const cls = `wcf-row${fill ? ' wcf-row--fill' : ''}${grow ? ' wcf-row--grow' : ''}`
      return `<div class="${cls}"${style ? ` style="${style}"` : ''}>${renderChildren(node, opts)}</div>`
    }
    case 'Col': {
      const style = colStyle(node)
      const grow = node.attrs.grow === true
      const cls = `wcf-col${grow ? ' wcf-col--grow' : ''}`
      return `<div class="${cls}"${style ? ` style="${style}"` : ''}>${renderChildren(node, opts)}</div>`
    }
    case 'Grid': {
      const cols = attr(node.attrs.cols) || '3'
      const gap = attr(node.attrs.gap)
      const pad = attr(node.attrs.padding)
      const parts = [`grid-template-columns:repeat(${esc(cols)},1fr)`]
      if (gap && GAP[gap]) parts.push(`gap:${GAP[gap]}`)
      if (pad && PAD[pad]) parts.push(`padding:${PAD[pad]}`)
      return `<div class="wcf-grid" style="${parts.join(';')}">${renderChildren(node, opts)}</div>`
    }
    case 'Stack': return `<div class="wcf-stack">${renderChildren(node, opts)}</div>`

    case 'Button': {
      const label = attr(node.attrs.label)
      const variant = attr(node.attrs.variant) || 'secondary'
      const target = attr(node.attrs.target)
      const align = attr(node.attrs.align)
      const cls = `wcf-button wcf-button--${variant}${align && align !== 'center' ? ` wcf-button--align-${align}` : ''}`
      const href = target ? (opts.targets?.get(target) ?? `#${target}`) : undefined
      if (href) return `<a href="${esc(href)}" class="${cls}">${esc(label)}</a>`
      return `<button type="button" class="${cls}">${esc(label)}</button>`
    }
    case 'ButtonGroup': {
      const align = attr(node.attrs.align) || 'start'
      return `<div class="wcf-button-group wcf-button-group--${align}">${renderChildren(node, opts)}</div>`
    }
    case 'ButtonDropdown': {
      const label = attr(node.attrs.label)
      const variant = attr(node.attrs.variant) || 'secondary'
      const children = renderChildren(node, opts)
      return (
        `<details class="wcf-button-dropdown">` +
        `<summary class="wcf-button wcf-button--${variant} wcf-dropdown-trigger">${esc(label)} <span class="wcf-dropdown-chevron" aria-hidden="true">▾</span></summary>` +
        `<div class="wcf-dropdown-menu">${children}</div>` +
        `</details>`
      )
    }
    case 'Input': {
      const type = attr(node.attrs.type) || 'text'
      const ph = esc(attr(node.attrs.placeholder))
      if (type === 'textarea' || type === 'editor') {
        return `<textarea class="wcf-input wcf-input--${type}" placeholder="${ph}" rows="4"></textarea>`
      }
      if (type === 'select') {
        return `<select class="wcf-input"><option>${ph || 'Select…'}</option></select>`
      }
      return `<input class="wcf-input" type="${esc(type)}" placeholder="${ph}">`
    }
    case 'Text': {
      const content = esc(attr(node.attrs.content))
      const variant = attr(node.attrs.variant) || 'body'
      const tag = { heading: 'h1', subheading: 'h2', body: 'p', caption: 'small', label: 'label' }[variant] ?? 'p'
      return `<${tag} class="wcf-text wcf-text--${variant}">${content}</${tag}>`
    }
    case 'Image': {
      const alt = esc(attr(node.attrs.alt))
      return `<div class="wcf-image" role="img" aria-label="${alt}"><span>${alt}</span></div>`
    }
    case 'Branding': {
      return `<div class="wcf-branding" role="img" aria-label="Brand logo"><span>Logo</span></div>`
    }
    case 'List': {
      const variant = attr(node.attrs.variant) || 'unordered'
      if (variant === 'inline') {
        return `<ul class="wcf-list wcf-list--inline"><li>Item</li><li>Item</li><li>Item</li></ul>`
      }
      const tag = variant === 'ordered' ? 'ol' : 'ul'
      return `<${tag} class="wcf-list"><li>Item one</li><li>Item two</li><li>Item three</li></${tag}>`
    }
    case 'Badge': {
      const label = esc(attr(node.attrs.label))
      const variant = attr(node.attrs.variant) || 'info'
      return `<span class="wcf-badge wcf-badge--${variant}">${label}</span>`
    }
    case 'Icon': {
      const name = esc(attr(node.attrs.name))
      return `<span class="wcf-icon" aria-label="${name}" title="${name}">⊡</span>`
    }
    case 'Divider': {
      const orientation = attr(node.attrs.orientation) || 'horizontal'
      if (orientation === 'vertical') return `<div class="wcf-divider wcf-divider--vertical" aria-hidden="true"></div>`
      return `<hr class="wcf-divider">`
    }
    case 'Form': {
      const id = esc(attr(node.attrs.id))
      return `<form class="wcf-form"${id ? ` id="${id}"` : ''}>${renderChildren(node, opts)}</form>`
    }
    case 'Table': {
      const rowLines = node.children.filter(c => c.isFlowLine && c.raw)
      const filter = node.attrs.filter
      const pagination = node.attrs.pagination
      const rowlink = node.attrs.rowlink
      const rowCls = rowlink ? ' class="wcf-table__row--link"' : ''
      const [headerLine, ...dataLines] = rowLines
      const headers = headerLine ? headerLine.raw!.split('|').map(s => s.trim()) : ['Column']
      const thead = `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${dataLines.map(row =>
        `<tr${rowCls}>${row.raw!.split('|').map(cell => `<td>${renderCellContent(cell, opts)}</td>`).join('')}</tr>`
      ).join('')}</tbody>`
      const filterRow = filter ? `<div class="wcf-table-filter"><input class="wcf-input" placeholder="Filter…" style="max-width:240px"></div>` : ''
      const paginationRow = pagination ? `<div class="wcf-table-pagination"><button class="wcf-button wcf-button--ghost">&#8592; Prev</button><span>Page 1</span><button class="wcf-button wcf-button--ghost">Next &#8594;</button></div>` : ''
      return `<div class="wcf-table-wrap">${filterRow}<table class="wcf-table">${thead}${tbody}</table>${paginationRow}</div>`
    }
    case 'Overlay': {
      const type = attr(node.attrs.type) || 'modal'
      const anchor = attr(node.attrs.anchor)
      const anchorClass = anchor ? ` wcf-overlay--${type}--${anchor}` : ''
      return `<div class="wcf-overlay wcf-overlay--${type}${anchorClass}">${renderChildren(node, opts)}</div>`
    }
    default: return ''
  }
}

function renderCellContent(cell: string, opts: RenderOptions): string {
  const trimmed = cell.trim()
  if (!trimmed) return '&nbsp;'
  // Inline component: parse and render the first node
  if (trimmed.startsWith('[') && trimmed.includes(']')) {
    const nodes = parseFile(trimmed)
    if (nodes.length > 0) return renderNode(nodes[0], opts)
  }
  return esc(trimmed)
}

// ── CSS generation ────────────────────────────────────────────────────────────

export function generateCss(theme: Theme): string {
  const c = theme.colors
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:${theme.font.family};font-size:14px;color:${c.text};background:${c.pageBg};line-height:1.5}
/* Screen */
.wcf-screen{display:flex;flex-direction:column;min-height:100vh;background:${c.pageBg}}
/* Layout */
.wcf-row{display:flex;flex-direction:row;align-items:stretch}
.wcf-row--fill{flex:1;min-height:0}
.wcf-row--grow{flex-grow:1}
.wcf-col{display:flex;flex-direction:column}
.wcf-col--grow{flex-grow:1;height:100%}
.wcf-grid{display:grid}
.wcf-stack{position:relative}
.wcf-stack>*{position:absolute}
/* Structure */
.wcf-header{padding:12px 24px;border-bottom:1px solid ${c.border};background:${c.surfaceBg};flex-shrink:0;display:flex;align-items:center}
.wcf-footer{padding:12px 24px;border-top:1px solid ${c.border};background:${c.surfaceBg};flex-shrink:0;margin-top:auto}
.wcf-sidebar{width:240px;flex-shrink:0;padding:16px;background:${c.surfaceBg};overflow-y:auto}
.wcf-sidebar--left{border-right:1px solid ${c.border}}
.wcf-sidebar--right{border-left:1px solid ${c.border}}
.wcf-main{flex:1;padding:24px;min-width:0;overflow-y:auto}
.wcf-section{display:flex;flex-direction:column;gap:12px}
.wcf-nav--horizontal{display:flex;flex-direction:row;align-items:center;gap:4px}
.wcf-nav--vertical{display:flex;flex-direction:column;gap:2px}
.wcf-card{border:1px solid ${c.border};border-radius:${theme.radius};padding:16px;background:${c.cardBg};display:flex;flex-direction:column;gap:12px}
/* Buttons */
.wcf-button{display:inline-flex;align-items:center;justify-content:center;padding:5px 14px;border-radius:${theme.radius};font-size:13px;font-weight:500;cursor:default;border:1px solid transparent;text-decoration:none;line-height:1.5;white-space:nowrap;font-family:inherit}
.wcf-button--primary{background:${c.primary.bg};color:${c.primary.text};border-color:${c.primary.border}}
.wcf-button--secondary{background:${c.secondary.bg};color:${c.secondary.text};border-color:${c.secondary.border}}
.wcf-button--ghost{background:${c.ghost.bg};color:${c.ghost.text};border-color:${c.ghost.border}}
.wcf-button--danger{background:${c.danger.bg};color:${c.danger.text};border-color:${c.danger.border}}
.wcf-button--label{background:transparent;border-color:transparent;padding:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:${c.textMuted}}
.wcf-button--align-left{justify-content:flex-start}
.wcf-button--align-right{justify-content:flex-end}
.wcf-button-group{display:flex;flex-direction:row;align-items:center;gap:8px;flex-wrap:wrap}
.wcf-button-group--end{justify-content:flex-end}
.wcf-button-group--center{justify-content:center}
.wcf-button-group--start{justify-content:flex-start}
.wcf-button-dropdown{display:inline-block;position:relative}
.wcf-button-dropdown>summary.wcf-dropdown-trigger{list-style:none;cursor:default}
.wcf-button-dropdown>summary.wcf-dropdown-trigger::-webkit-details-marker{display:none}
.wcf-dropdown-chevron{display:inline-block;transition:transform .15s}
.wcf-button-dropdown[open]>.wcf-dropdown-chevron,.wcf-button-dropdown[open] .wcf-dropdown-chevron{transform:rotate(180deg)}
.wcf-dropdown-menu{position:absolute;top:calc(100% + 4px);left:0;min-width:100%;background:${c.cardBg};border:1px solid ${c.border};border-radius:${theme.radius};box-shadow:0 4px 12px rgba(0,0,0,.12);padding:4px 0;z-index:10;white-space:nowrap;display:flex;flex-direction:column;gap:0}
.wcf-dropdown-menu .wcf-button{width:100%;justify-content:flex-start;border-radius:0;border-color:transparent;background:transparent}
.wcf-dropdown-menu .wcf-button:hover{background:${c.surfaceBg}}
.wcf-dropdown-menu .wcf-divider{margin:3px 0}
.wcf-dropdown-menu .wcf-text{padding:7px 14px;font-size:12px;color:${c.textSubtle}}
/* Inputs */
.wcf-input{width:100%;max-width:480px;padding:5px 10px;border:1px solid ${c.border};border-radius:${theme.radius};font-size:13px;background:${c.pageBg};color:${c.textMuted};font-family:inherit}
.wcf-input--textarea,.wcf-input--editor{font-family:${theme.font.mono};resize:vertical}
select.wcf-input{cursor:default}
/* Text */
.wcf-text{display:block}
.wcf-text--heading{font-size:22px;font-weight:700;color:${c.text};line-height:1.2}
.wcf-text--subheading{font-size:17px;font-weight:600;color:${c.text};line-height:1.3}
.wcf-text--body{font-size:14px;color:${c.text}}
.wcf-text--caption{font-size:12px;color:${c.textMuted}}
.wcf-text--label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:${c.textMuted}}
/* Image placeholder */
.wcf-image{width:100%;aspect-ratio:16/9;background:${c.surfaceBg};border:1px dashed ${c.border};display:flex;align-items:center;justify-content:center;border-radius:${theme.radius};color:${c.textSubtle};font-size:12px;font-style:italic}
.wcf-branding{width:120px;max-width:200px;aspect-ratio:3/1;background:${c.surfaceBg};border:1px dashed ${c.border};display:flex;align-items:center;justify-content:center;border-radius:${theme.radius};color:${c.textSubtle};font-size:11px;font-style:italic;flex-shrink:0}
/* List */
.wcf-list{padding-left:20px;display:flex;flex-direction:column;gap:4px}
.wcf-list li{font-size:13px;color:${c.textMuted};list-style:inherit}
.wcf-list--inline{list-style:none;padding:0;flex-direction:row;gap:16px}
/* Badge */
.wcf-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600}
.wcf-badge--info{background:${c.info.bg};color:${c.info.text}}
.wcf-badge--success{background:${c.success.bg};color:${c.success.text}}
.wcf-badge--warning{background:${c.warning.bg};color:${c.warning.text}}
.wcf-badge--danger{background:${c.danger.bg};color:${c.danger.text}}
/* Icon */
.wcf-icon{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:${c.textMuted};font-style:normal}
/* Divider */
.wcf-divider{border:none;border-top:1px solid ${c.border};width:100%;height:0}
.wcf-divider--vertical{border:none;border-left:1px solid ${c.border};width:1px;align-self:stretch}
/* Form */
.wcf-form{display:flex;flex-direction:column;gap:12px}
/* Table */
.wcf-table-wrap{width:100%;display:flex;flex-direction:column;gap:8px}
.wcf-table{width:100%;border-collapse:collapse;font-size:13px}
.wcf-table th{padding:7px 12px;text-align:left;font-weight:600;background:${c.surfaceBg};border-bottom:2px solid ${c.border};color:${c.text}}
.wcf-table td{padding:7px 12px;border-bottom:1px solid ${c.borderSubtle};color:${c.textMuted}}
.wcf-table-filter{display:flex;gap:8px;align-items:center}
.wcf-table-pagination{display:flex;gap:8px;align-items:center;justify-content:center;padding-top:4px}
.wcf-table__row--link{cursor:pointer}
.wcf-table__row--link:hover td{background:${c.surfaceBg}}
.wcf-table__link{color:${c.primary.bg};text-decoration:underline;font-size:13px;cursor:pointer}
.wcf-table__thumb{width:32px;height:32px;background:${c.surfaceBg};border:1px dashed ${c.border};border-radius:${theme.radius};display:inline-block}
.wcf-button--sm{padding:2px 8px;font-size:12px}
/* Overlay */
.wcf-overlay--modal{border:1px solid ${c.border};border-radius:${theme.radius};background:${c.pageBg};max-width:480px;margin:40px auto;box-shadow:0 8px 32px rgba(0,0,0,.12);display:flex;flex-direction:column}
.wcf-overlay--drawer{width:380px;background:${c.pageBg};border-left:1px solid ${c.border};box-shadow:-4px 0 16px rgba(0,0,0,.08);display:flex;flex-direction:column}
.wcf-overlay--drawer--left{border-left:none;border-right:1px solid ${c.border}}
.wcf-overlay--dialog{border:1px solid ${c.border};border-radius:${theme.radius};background:${c.pageBg};max-width:320px;margin:40px auto;box-shadow:0 4px 16px rgba(0,0,0,.12);display:flex;flex-direction:column}
`.trim()
}

// ── Public API ────────────────────────────────────────────────────────────────

export function renderHtmlFragment(nodes: ParsedNode[], opts: RenderOptions): string {
  return nodes.filter(n => !n.isFlowLine).map(n => renderNode(n, opts)).join('\n')
}

export function renderHtmlDocument(nodes: ParsedNode[], theme: Theme, opts: RenderOptions, title = 'Wireframe'): string {
  const body = renderHtmlFragment(nodes, opts)
  const css = generateCss(theme)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body>
<div class="wcf-screen">
${body}
</div>
</body>
</html>`
}
