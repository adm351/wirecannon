import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'
import type { ViteDevServer } from 'vite'
import { parseFile } from './parser'
import type { ParsedNode } from './types'
import { getTheme } from './themes/index'
import { generateCss, renderHtmlFragment } from './html'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScreenEntry { id: string; label: string; file: string; kind: 'screen' | 'overlay' }
interface FlowEdge { from: string; to: string; label?: string }
interface FlowDef { id: string; label: string; nodes: string[]; edges: FlowEdge[] }
interface ProjectData { entries: ScreenEntry[]; flows: FlowDef[] }
interface GNode { id: string; x: number; y: number }

// ── Lint ──────────────────────────────────────────────────────────────────────

function runLint(projectRoot: string): void {
  const siblingCli = path.resolve(__dirname, '../../linter/dist/cli.js')
  const [cmd, args]: [string, string[]] = fs.existsSync(siblingCli)
    ? [process.execPath, [siblingCli, projectRoot]]
    : ['npx', ['--yes', '@wirecannon/linter', projectRoot]]
  const result = spawnSync(cmd, args, { encoding: 'utf-8', shell: process.platform === 'win32' })
  const output = result.stdout?.trim()
  if (result.status !== 0 && output) console.error('\nLint errors:\n' + output + '\n')
}

// ── Project loading ───────────────────────────────────────────────────────────

function parseFlowLines(children: ParsedNode[]): { nodes: string[]; edges: FlowEdge[] } {
  const nodeSet = new Set<string>()
  const edges: FlowEdge[] = []

  const addEdge = (from: string, to: string, label?: string) => {
    if (!edges.some(e => e.from === from && e.to === to)) edges.push({ from, to, label })
  }

  const minIndent = children.reduce((m, c) => Math.min(m, c.indent), Infinity)
  let fork: string | null = null

  for (const child of children) {
    if (!child.raw) continue
    const raw = child.raw.trim().replace(/#.*$/, '').trim()
    const isBranch = child.indent > minIndent && raw.startsWith('|')

    if (!isBranch) {
      fork = null
      const steps = raw.split('→').map(s => s.trim()).filter(Boolean)
      steps.forEach(s => nodeSet.add(s))
      for (let i = 0; i < steps.length - 1; i++) addEdge(steps[i], steps[i + 1])
      if (steps.length === 1) fork = steps[0]
    } else if (fork) {
      // "| condition → screen-a → screen-b"
      // parts[0] is the condition label, parts[1..] are the screen/overlay chain
      const parts = raw.slice(1).trim().split('→').map(s => s.trim()).filter(Boolean)
      if (parts.length === 0) continue
      if (parts.length === 1) {
        nodeSet.add(parts[0])
        addEdge(fork, parts[0])
      } else {
        const chain = parts.slice(1)
        chain.forEach(s => nodeSet.add(s))
        addEdge(fork, chain[0], parts[0])
        for (let i = 0; i < chain.length - 1; i++) addEdge(chain[i], chain[i + 1])
      }
    }
  }

  return { nodes: [...nodeSet], edges }
}

function loadProject(projectRoot: string): ProjectData {
  const indexPath = path.join(projectRoot, 'index.wcf')
  if (!fs.existsSync(indexPath)) return { entries: [], flows: [] }
  const topNodes = parseFile(fs.readFileSync(indexPath, 'utf-8'))
  const entries: ScreenEntry[] = []
  const flows: FlowDef[] = []

  for (const top of topNodes) {
    if (top.type === 'Screens') {
      for (const s of top.children) {
        if (s.type !== 'Screen') continue
        const id = typeof s.attrs.id === 'string' ? s.attrs.id : ''
        const label = typeof s.attrs.label === 'string' ? s.attrs.label : id
        const file = typeof s.attrs.file === 'string' ? path.join(projectRoot, s.attrs.file) : ''
        if (id && file && fs.existsSync(file)) entries.push({ id, label, file, kind: 'screen' })
      }
    }
    if (top.type === 'Overlays') {
      for (const o of top.children) {
        if (o.type !== 'Overlay') continue
        const id = typeof o.attrs.id === 'string' ? o.attrs.id : ''
        const label = typeof o.attrs.label === 'string' ? o.attrs.label : id
        const file = typeof o.attrs.file === 'string' ? path.join(projectRoot, o.attrs.file) : ''
        if (id && file && fs.existsSync(file)) entries.push({ id, label, file, kind: 'overlay' })
      }
    }
    if (top.type === 'Flows') {
      for (const f of top.children) {
        if (f.type !== 'Flow') continue
        const id = typeof f.attrs.id === 'string' ? f.attrs.id : ''
        const label = typeof f.attrs.label === 'string' ? f.attrs.label : id
        if (!id) continue
        const { nodes: fNodes, edges: fEdges } = parseFlowLines(f.children)
        flows.push({ id, label, nodes: fNodes, edges: fEdges })
      }
    }
  }

  return { entries, flows }
}

// ── Flow layout ───────────────────────────────────────────────────────────────

const NW = 144   // node width
const NH = 40    // node height
const RGAP = 72  // vertical distance between node top edges in the same layer
const HPAD = 32  // horizontal padding around the graph
const VPAD = 36  // vertical padding (extra room for labels at top/bottom)

// Minimum horizontal gap between right edge of one layer and left edge of the next.
// Grows to comfortably fit the longest condition label in the flow.
function edgeGap(flow: FlowDef): number {
  const maxLen = flow.edges.reduce((m, e) => e.label ? Math.max(m, e.label.length) : m, 0)
  // ~6 px per char at font-size 10, plus 28 px padding on each side
  return Math.max(56, Math.ceil(maxLen * 6) + 56)
}

function layoutFlow(flow: FlowDef): { nodes: GNode[]; width: number; height: number; lgap: number } {
  if (flow.nodes.length === 0) return { nodes: [], width: 300, height: 120, lgap: NW + 56 }

  const gap = edgeGap(flow)
  const lgap = NW + gap  // left-edge to left-edge distance between adjacent layers

  // Assign layers via longest-path BFS from source nodes.
  const layers = new Map<string, number>()
  const hasIncoming = new Set(flow.edges.map(e => e.to))
  const sources = flow.nodes.filter(n => !hasIncoming.has(n))
  const starts = sources.length > 0 ? sources : [flow.nodes[0]]

  starts.forEach(s => layers.set(s, 0))
  const queue = [...starts]
  let guard = 0
  while (queue.length > 0 && ++guard < 5000) {
    const id = queue.shift()!
    const l = layers.get(id) ?? 0
    for (const e of flow.edges) {
      if (e.from !== id) continue
      if ((layers.get(e.to) ?? -1) < l + 1) {
        layers.set(e.to, l + 1)
        queue.push(e.to)
      }
    }
  }
  // Ensure every node has a layer (handles disconnected nodes)
  for (const n of flow.nodes) if (!layers.has(n)) layers.set(n, 0)

  // Group nodes by layer
  const byLayer = new Map<number, string[]>()
  for (const [id, l] of layers) {
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l)!.push(id)
  }

  const maxLayer = Math.max(...layers.values())
  const maxRows = Math.max(...[...byLayer.values()].map(a => a.length))
  const totalW = HPAD * 2 + NW + maxLayer * lgap
  const totalH = VPAD * 2 + NH + (maxRows - 1) * RGAP

  const result: GNode[] = []
  for (const [l, ids] of byLayer) {
    // Centre each layer's stack within the total height
    const stackH = NH + (ids.length - 1) * RGAP
    const startY = (totalH - stackH) / 2
    ids.forEach((id, i) => result.push({
      id,
      x: HPAD + l * lgap,
      y: startY + i * RGAP,
    }))
  }

  return { nodes: result, width: Math.max(totalW, 300), height: Math.max(totalH, 120), lgap }
}

// ── Flow SVG renderer ─────────────────────────────────────────────────────────

function xe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderFlowSvg(
  flow: FlowDef,
  knownIds: Set<string>,
  themeName: string,
): string {
  const { nodes, width, height } = layoutFlow(flow)
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const defs = `<defs>
    <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#5a5865"/>
    </marker>
  </defs>`

  // ── Pass 1: edge paths ────────────────────────────────────────────────────
  // Edges are drawn first so nodes and labels always sit on top.
  const edgePathsSvg = flow.edges.map(e => {
    const fn = nodeMap.get(e.from)
    const tn = nodeMap.get(e.to)
    if (!fn || !tn) return ''
    const x1 = fn.x + NW, y1 = fn.y + NH / 2
    const x2 = tn.x - 1,  y2 = tn.y + NH / 2
    const mx = (x1 + x2) / 2
    return (
      `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" ` +
      `fill="none" stroke="#484450" stroke-width="1.5" marker-end="url(#arr)"/>`
    )
  }).join('')

  // ── Pass 2: nodes ─────────────────────────────────────────────────────────
  const nodesSvg = nodes.map(n => {
    const isKnown = knownIds.has(n.id)
    const label = n.id.length > 17 ? n.id.slice(0, 16) + '…' : n.id
    const fill = '#282726'
    const stroke = isKnown ? '#4a4870' : '#363431'
    const textFill = isKnown ? '#cecdc3' : '#6f6e69'

    const body =
      `<rect x="${n.x}" y="${n.y}" width="${NW}" height="${NH}" rx="6" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
      `<text x="${n.x + NW / 2}" y="${n.y + NH / 2 + 5}" text-anchor="middle" ` +
      `font-size="12" font-family="system-ui,sans-serif" fill="${textFill}">${xe(label)}</text>`

    return isKnown
      ? `<a href="/view/${n.id}?theme=${encodeURIComponent(themeName)}" class="flow-node">${body}</a>`
      : `<g>${body}</g>`
  }).join('')

  // ── Pass 3: edge labels ───────────────────────────────────────────────────
  // Rendered last so they always appear on top of both edges and nodes.
  // Each label gets a dark background pill so it reads cleanly at any crossing.
  const FONT_SIZE = 10
  const CHAR_W = 5.8     // approximate px per character at font-size 10
  const PILL_H = 17
  const PILL_PAD_X = 8   // horizontal padding inside the pill

  const edgeLabelsSvg = flow.edges.map(e => {
    if (!e.label) return ''
    const fn = nodeMap.get(e.from)
    const tn = nodeMap.get(e.to)
    if (!fn || !tn) return ''

    const x1 = fn.x + NW, y1 = fn.y + NH / 2
    const x2 = tn.x - 1,  y2 = tn.y + NH / 2

    // True midpoint of the cubic bezier M(x1,y1) C(mx,y1) (mx,y2) (x2,y2) at t=0.5
    // simplifies to ((x1+x2)/2, (y1+y2)/2).
    const lx = (x1 + x2) / 2
    // For flat edges shift the label above the line; for diagonal stay at midpoint.
    const ly = y1 === y2 ? y1 - PILL_H / 2 - 4 : (y1 + y2) / 2

    const text = xe(e.label)
    const pillW = Math.ceil(text.length * CHAR_W) + PILL_PAD_X * 2

    return (
      `<rect x="${lx - pillW / 2}" y="${ly - PILL_H / 2}" ` +
      `width="${pillW}" height="${PILL_H}" rx="4" ` +
      `fill="#1c1b1a" stroke="#3e3b38" stroke-width="0.75"/>` +
      `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" ` +
      `font-size="${FONT_SIZE}" fill="#9a9389" font-family="system-ui,sans-serif">${text}</text>`
    )
  }).join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `${defs}${edgePathsSvg}${nodesSvg}${edgeLabelsSvg}</svg>`
  )
}

// ── Page HTML ─────────────────────────────────────────────────────────────────

// Inline logo SVG (18 px) for the sidebar header
const LOGO_SVG =
  `<svg width="18" height="18" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="128" height="128" rx="14" fill="#1a1b26"/>` +
  `<rect x="16" y="18" width="18" height="8" rx="2" fill="#c8c3b5"/>` +
  `<rect x="16" y="18" width="8" height="92" rx="2" fill="#c8c3b5"/>` +
  `<rect x="16" y="102" width="18" height="8" rx="2" fill="#c8c3b5"/>` +
  `<rect x="94" y="18" width="18" height="8" rx="2" fill="#c8c3b5"/>` +
  `<rect x="104" y="18" width="8" height="92" rx="2" fill="#c8c3b5"/>` +
  `<rect x="94" y="102" width="18" height="8" rx="2" fill="#c8c3b5"/>` +
  `<rect x="32" y="30" width="64" height="16" rx="3" fill="#242438" stroke="#e06c35" stroke-width="2"/>` +
  `<rect x="32" y="52" width="22" height="40" rx="3" fill="#242438" stroke="#e06c35" stroke-width="2"/>` +
  `<rect x="60" y="52" width="36" height="40" rx="3" fill="#242438" stroke="#e06c35" stroke-width="2"/>` +
  `</svg>`

function renderPage(
  data: ProjectData,
  activeScreenId: string | null,
  wcfPath: string,
  themeName: string,
  activeFlowId: string | null,
): string {
  const { entries, flows } = data
  const isFlow = activeFlowId !== null
  const activeEntry = entries.find(e => e.id === activeScreenId)
  const activeFlow = flows.find(f => f.id === activeFlowId)

  // ── Sidebar: screens list ────────────────────────────────────────────────
  const screenItems = entries.length > 0
    ? entries.map(e => {
        const active = !isFlow && e.id === activeScreenId
        const kindTag = e.kind === 'overlay'
          ? `<span class="kind-tag">overlay</span>` : ''
        return (
          `<a href="/view/${e.id}?theme=${themeName}" ` +
          `class="nav-item${active ? ' active' : ''}" ` +
          `data-label="${xe(e.label.toLowerCase())}">${xe(e.label)}${kindTag}</a>`
        )
      }).join('\n')
    : `<p class="empty-msg">No screens found.</p>`

  // ── Sidebar: flows list ──────────────────────────────────────────────────
  const flowItems = flows.length > 0
    ? flows.map(f => {
        const active = isFlow && f.id === activeFlowId
        return (
          `<a href="/flow/${f.id}?theme=${themeName}" ` +
          `class="nav-item${active ? ' active' : ''}">${xe(f.label)}</a>`
        )
      }).join('\n')
    : `<p class="empty-msg">No flows defined<br>in index.wcf</p>`

  // ── Theme picker ─────────────────────────────────────────────────────────
  const themeOptions = ['bw', 'flexoki'].map(t =>
    `<option value="${t}"${t === themeName ? ' selected' : ''}>${t}</option>`
  ).join('')

  // ── Main content ─────────────────────────────────────────────────────────
  let mainContent = ''
  let extraCss = ''

  if (isFlow) {
    if (activeFlow && activeFlow.nodes.length > 0) {
      const knownIds = new Set(entries.map(e => e.id))
      const svg = renderFlowSvg(activeFlow, knownIds, themeName)
      mainContent =
        `<div class="flow-header">${xe(activeFlow.label)}</div>` +
        `<div class="flow-canvas">${svg}</div>`
    } else {
      mainContent = `<p class="empty-msg" style="padding:40px">` +
        `${activeFlow ? 'This flow has no steps defined.' : 'Flow not found.'}</p>`
    }
  } else {
    const theme = getTheme(themeName)
    extraCss = generateCss(theme)
    const targets = new Map(entries.map(e => [e.id, `/view/${e.id}?theme=${themeName}`]))
    const wcfContent = wcfPath && fs.existsSync(wcfPath) ? fs.readFileSync(wcfPath, 'utf-8') : ''
    const wireHtml = renderHtmlFragment(parseFile(wcfContent), {
      theme: themeName as 'bw' | 'flexoki',
      targets,
    })
    mainContent = `<div class="wcf-frame"><div class="wcf-screen">${wireHtml}</div></div>`
  }

  const pageTitle = isFlow
    ? `${activeFlow?.label ?? 'Flow'} — Wirecannon`
    : `${activeEntry?.label ?? 'Wirecannon'} — Wirecannon`

  const toolbarLabel = isFlow
    ? xe(activeFlow?.label ?? '')
    : xe(activeEntry?.label ?? wcfPath)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${xe(pageTitle)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}

/* ── Shell ── */
.shell{display:flex;height:100vh;background:#161514}

/* ── Sidebar ── */
.sidebar{width:232px;flex-shrink:0;background:#1c1b1a;border-right:1px solid #2b2927;display:flex;flex-direction:column;overflow:hidden}
.sidebar-logo{padding:13px 14px 11px;border-bottom:1px solid #2b2927;color:#d4cfc8;font-size:12.5px;font-weight:600;letter-spacing:.03em;display:flex;align-items:center;gap:9px;flex-shrink:0}

/* ── Tabs ── */
.tabs{display:flex;border-bottom:1px solid #2b2927;flex-shrink:0}
.tab{flex:1;padding:9px 0;background:none;border:none;border-bottom:2px solid transparent;color:#6f6e69;font-size:12px;font-weight:500;cursor:pointer;letter-spacing:.03em;transition:color .12s,border-color .12s}
.tab:hover{color:#a8a39c}
.tab.active{color:#fffcf0;border-bottom-color:#e06c35}

/* ── Tab panes ── */
.pane{display:none;flex-direction:column;flex:1;overflow:hidden;min-height:0}
.pane.active{display:flex}

/* ── Search ── */
.search-wrap{padding:10px 12px 8px;flex-shrink:0}
.search{width:100%;background:#282726;color:#cecdc3;border:1px solid #343230;border-radius:5px;padding:6px 10px;font-size:12px;outline:none;transition:border-color .15s}
.search::placeholder{color:#524f4b}
.search:focus{border-color:#5850a0}

/* ── Nav list ── */
.nav-list{overflow-y:auto;flex:1;padding:6px 0}
.nav-item{display:flex;align-items:center;padding:7px 14px;color:#6f6e69;text-decoration:none;font-size:12.5px;border-left:2px solid transparent;transition:background .1s,color .1s,border-color .1s;gap:6px}
.nav-item:hover{background:#242220;color:#b5b0a9}
.nav-item.active{background:#242220;color:#fffcf0;font-weight:500;border-left-color:#e06c35}
.kind-tag{margin-left:auto;font-size:10px;color:#5a5865;border:1px solid #343230;border-radius:3px;padding:1px 5px;flex-shrink:0}
.empty-msg{color:#524f4b;font-size:12px;padding:18px 14px;line-height:1.6}

/* ── Sidebar footer ── */
.sidebar-foot{padding:10px 12px;border-top:1px solid #2b2927;flex-shrink:0}
.sidebar-foot label{display:block;color:#524f4b;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.sidebar-foot select{width:100%;background:#242220;color:#cecdc3;border:1px solid #343230;border-radius:4px;padding:5px 8px;font-size:12px;cursor:pointer;outline:none}

/* ── Main panel ── */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:${isFlow ? '#161514' : '#f0eee6'}}
.toolbar{height:38px;background:#242220;border-bottom:1px solid #2b2927;display:flex;align-items:center;padding:0 16px;color:#6f6e69;font-size:12px;flex-shrink:0;gap:8px;overflow:hidden}
.toolbar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── Wireframe view ── */
.screen-wrap{flex:1;overflow:auto;padding:32px}
.wcf-frame{background:white;box-shadow:0 4px 28px rgba(0,0,0,.16);min-height:calc(100vh - 102px)}

/* ── Flow view ── */
.flow-wrap{flex:1;overflow:auto;padding:32px}
.flow-header{font-size:14px;font-weight:600;color:#a8a39c;letter-spacing:.02em;margin-bottom:22px}
.flow-canvas{display:inline-block}
.flow-canvas svg{display:block}
.flow-canvas a.flow-node rect{transition:filter .15s}
.flow-canvas a.flow-node:hover rect{filter:brightness(1.25)}

${extraCss}
/* dev override — higher specificity beats generateCss's min-height:100vh */
.wcf-frame .wcf-screen{min-height:calc(100vh - 102px)}
/* hotspot pulse */
@keyframes wcf-hs-ping{0%{box-shadow:0 0 0 0 rgba(224,108,53,.75)}100%{box-shadow:0 0 0 14px rgba(224,108,53,0)}}
.wcf-hs{animation:wcf-hs-ping .85s ease-out both}
</style>
</head>
<body>
<div class="shell">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">${LOGO_SVG}Wirecannon</div>

    <div class="tabs">
      <button class="tab${!isFlow ? ' active' : ''}" onclick="switchTab('screens')">Screens</button>
      <button class="tab${isFlow ? ' active' : ''}" onclick="switchTab('flows')">Flows</button>
    </div>

    <!-- Screens pane -->
    <div id="pane-screens" class="pane${!isFlow ? ' active' : ''}">
      <div class="search-wrap">
        <input id="screen-search" class="search" type="search" placeholder="Search…" autocomplete="off" oninput="filterScreens(this.value)">
      </div>
      <nav class="nav-list" id="screen-list">
        ${screenItems}
      </nav>
    </div>

    <!-- Flows pane -->
    <div id="pane-flows" class="pane${isFlow ? ' active' : ''}">
      <nav class="nav-list">
        ${flowItems}
      </nav>
    </div>

    <div class="sidebar-foot">
      <label>Theme</label>
      <select onchange="changeTheme(this.value)">${themeOptions}</select>
    </div>
  </aside>

  <!-- Main -->
  <div class="main">
    <div class="toolbar">
      <span class="toolbar-label">${toolbarLabel}</span>
    </div>
    ${isFlow
      ? `<div class="flow-wrap">${mainContent}</div>`
      : `<div class="screen-wrap">${mainContent}</div>`
    }
  </div>
</div>

<script>
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active') })
  document.querySelectorAll('.pane').forEach(function(p) { p.classList.remove('active') })
  event.currentTarget.classList.add('active')
  var pane = document.getElementById('pane-' + name)
  if (pane) pane.classList.add('active')
  if (name === 'screens') {
    var s = document.getElementById('screen-search')
    if (s) setTimeout(function(){ s.focus() }, 50)
  }
}

function filterScreens(q) {
  var lq = q.toLowerCase()
  document.querySelectorAll('#screen-list .nav-item').forEach(function(el) {
    var label = el.dataset.label || ''
    el.style.display = label.includes(lq) ? '' : 'none'
  })
}

function changeTheme(t) {
  var url = new URL(location.href)
  url.searchParams.set('theme', t)
  location.href = url.toString()
}

window.addEventListener('load', function() {
  var frame = document.querySelector('.wcf-frame')
  if (!frame) return
  var DELAY = 400, STAGGER = 40, DUR = 850
  var buttons = Array.from(frame.querySelectorAll('a.wcf-button, summary.wcf-dropdown-trigger'))
  buttons.forEach(function(el, i) {
    el.classList.add('wcf-hs')
    el.style.animationDelay = (DELAY + i * STAGGER) + 'ms'
  })
  var all = buttons
  if (!all.length) return
  var cleanup = DELAY + (all.length - 1) * STAGGER + DUR + 100
  setTimeout(function() {
    all.forEach(function(el) {
      el.classList.remove('wcf-hs', 'wcf-hs-row')
      el.style.animationDelay = ''
    })
  }, cleanup)
})
</script>
</body>
</html>`
}

// ── Dev server ────────────────────────────────────────────────────────────────

export async function startDevServer(target: string, options: { theme?: string; port?: number } = {}): Promise<void> {
  const { createServer } = await import('vite')
  const themeName = options.theme ?? 'bw'
  const port = options.port ?? 5173

  const isDir = fs.existsSync(target) && fs.statSync(target).isDirectory()
  const projectRoot = isDir ? target : path.dirname(target)

  let data: ProjectData = isDir ? loadProject(target) : { entries: [], flows: [] }

  if (!isDir || data.entries.length === 0) {
    const id = path.basename(target, '.wcf')
    data = { entries: [{ id, label: id, file: target, kind: 'screen' }], flows: [] }
  }

  const allWcfFiles = new Set(data.entries.map(e => e.file))
  if (isDir) allWcfFiles.add(path.join(projectRoot, 'index.wcf'))

  const wirecannon = {
    name: 'wirecannon',
    configureServer(server: ViteDevServer) {
      server.watcher.add([...allWcfFiles])
      server.watcher.add(path.join(projectRoot, '**/*.wcf'))

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', `http://localhost:${port}`)
        const pathname = url.pathname

        // Refresh project on every request so new screens/flows appear immediately
        if (isDir) {
          const fresh = loadProject(target)
          if (fresh.entries.length > 0) Object.assign(data, fresh)
        }

        const qTheme = url.searchParams.get('theme') ?? themeName

        // Root: redirect to first screen
        if (pathname === '/') {
          const first = data.entries[0]
          if (first) {
            res.writeHead(302, { Location: `/view/${first.id}?theme=${qTheme}` })
            res.end()
            return
          }
        }

        // Screen / overlay view
        const viewMatch = pathname.match(/^\/view\/(.+)$/)
        if (viewMatch) {
          const id = viewMatch[1]
          const entry = data.entries.find(e => e.id === id) ?? data.entries[0]
          if (!entry) { next(); return }
          const html = renderPage(data, entry.id, entry.file, qTheme, null)
          const transformed = await server.transformIndexHtml(req.url!, html)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(transformed)
          return
        }

        // Flow view
        const flowMatch = pathname.match(/^\/flow\/(.+)$/)
        if (flowMatch) {
          const id = flowMatch[1]
          const flow = data.flows.find(f => f.id === id) ?? data.flows[0]
          if (!flow) { next(); return }
          const html = renderPage(data, null, '', qTheme, flow.id)
          const transformed = await server.transformIndexHtml(req.url!, html)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(transformed)
          return
        }

        next()
      })
    },

    handleHotUpdate({ file, server }: { file: string; server: ViteDevServer }) {
      if (file.endsWith('.wcf')) {
        runLint(projectRoot)
        server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }

  const server = await createServer({
    root: projectRoot,
    plugins: [wirecannon],
    server: { port, open: true },
  })

  await server.listen()
  server.printUrls()
  runLint(projectRoot)
}
