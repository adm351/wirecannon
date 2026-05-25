import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'
import type { ViteDevServer } from 'vite'
import { parseFile } from './parser'
import { getTheme } from './themes/index'
import { generateCss, renderHtmlFragment } from './html'

interface ScreenEntry { id: string; label: string; file: string; kind: 'screen' | 'overlay' }

function runLint(projectRoot: string): void {
  const siblingCli = path.resolve(__dirname, '../../linter/dist/cli.js')
  const [cmd, args]: [string, string[]] = fs.existsSync(siblingCli)
    ? [process.execPath, [siblingCli, projectRoot]]
    : ['npx', ['--yes', '@wirecannon/linter', projectRoot]]

  const result = spawnSync(cmd, args, {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  })

  const output = result.stdout?.trim()
  if (result.status !== 0 && output) {
    console.error('\nLint errors:\n' + output + '\n')
  }
}

function loadProject(projectRoot: string): ScreenEntry[] {
  const indexPath = path.join(projectRoot, 'index.wcf')
  if (!fs.existsSync(indexPath)) return []
  const nodes = parseFile(fs.readFileSync(indexPath, 'utf-8'))
  const entries: ScreenEntry[] = []
  for (const top of nodes) {
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
  }
  return entries
}

function renderPage(
  entries: ScreenEntry[],
  activeId: string,
  wcfPath: string,
  themeName: string,
): string {
  const theme = getTheme(themeName)
  const targets = new Map(entries.map(e => [e.id, `/view/${e.id}?theme=${themeName}`]))
  const wcfContent = fs.existsSync(wcfPath) ? fs.readFileSync(wcfPath, 'utf-8') : ''
  const nodes = parseFile(wcfContent)
  const activeEntry = entries.find(e => e.id === activeId) || entries[0]
  const wireframeHtml = renderHtmlFragment(nodes, { theme: themeName as 'bw' | 'flexoki', targets })

  const navItems = entries.map(e => {
    const active = e.id === activeId
    const kind = e.kind === 'overlay' ? ' [overlay]' : ''
    return `<a href="/view/${e.id}?theme=${themeName}" class="nav-item${active ? ' active' : ''}">${e.label}${kind}</a>`
  }).join('\n')

  const themeOptions = ['bw', 'flexoki'].map(t =>
    `<option value="${t}"${t === themeName ? ' selected' : ''}>${t}</option>`
  ).join('')

  const wcfCss = generateCss(theme)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${activeEntry ? activeEntry.label + ' — ' : ''}Wirecannon Dev</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.shell{display:flex;height:100vh;background:#1c1b1a}
.sidebar{width:220px;flex-shrink:0;background:#1c1b1a;border-right:1px solid #343331;display:flex;flex-direction:column;overflow:hidden}
.sidebar-header{padding:12px 16px;border-bottom:1px solid #343331;color:#878580;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0}
.sidebar-controls{padding:10px 12px;border-bottom:1px solid #343331;display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.sidebar-controls select{background:#282726;color:#cecdc3;border:1px solid #343331;border-radius:4px;padding:4px 8px;font-size:12px;width:100%;cursor:pointer}
.sidebar-controls label{color:#878580;font-size:11px}
.nav-list{overflow-y:auto;flex:1;padding:8px}
.nav-item{display:block;padding:7px 10px;border-radius:4px;color:#878580;text-decoration:none;font-size:13px;margin-bottom:2px;transition:background .1s,color .1s}
.nav-item:hover{background:#282726;color:#cecdc3}
.nav-item.active{background:#343331;color:#fffcf0;font-weight:500}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f0eee6}
.toolbar{height:38px;background:#282726;border-bottom:1px solid #343331;display:flex;align-items:center;padding:0 16px;gap:12px;flex-shrink:0;color:#878580;font-size:12px}
.wireframe-wrap{flex:1;overflow:auto;padding:32px}
.wcf-frame{background:white;box-shadow:0 4px 24px rgba(0,0,0,.18);min-height:600px}
/* Wireframe CSS */
${wcfCss}
</style>
</head>
<body>
<div class="shell">
  <aside class="sidebar">
    <div class="sidebar-header">Wirecannon</div>
    <div class="sidebar-controls">
      <label>Theme</label>
      <select onchange="navigate(this.value)">
        ${themeOptions}
      </select>
    </div>
    <nav class="nav-list">
      ${navItems}
    </nav>
  </aside>
  <div class="main">
    <div class="toolbar">
      <span>${activeEntry?.label ?? wcfPath}</span>
    </div>
    <div class="wireframe-wrap">
      <div class="wcf-frame"><div class="wcf-screen">${wireframeHtml}</div></div>
    </div>
  </div>
</div>
<script>
function navigate(theme) {
  const url = new URL(location.href)
  url.searchParams.set('theme', theme)
  location.href = url.toString()
}
</script>
</body>
</html>`
}

export async function startDevServer(target: string, options: { theme?: string; port?: number } = {}): Promise<void> {
  const { createServer } = await import('vite')
  const themeName = options.theme ?? 'bw'
  const port = options.port ?? 5173

  // Determine if target is a directory (project) or single file
  const isDir = fs.existsSync(target) && fs.statSync(target).isDirectory()
  const projectRoot = isDir ? target : path.dirname(target)

  let entries: ScreenEntry[] = isDir ? loadProject(target) : []

  // Single file mode: treat the file as a standalone entry
  if (!isDir || entries.length === 0) {
    const id = path.basename(target, '.wcf')
    entries = [{ id, label: id, file: target, kind: 'screen' }]
  }

  const allWcfFiles = new Set(entries.map(e => e.file))
  if (isDir) allWcfFiles.add(path.join(projectRoot, 'index.wcf'))

  const wirecannon = {
    name: 'wirecannon',
    configureServer(server: ViteDevServer) {
      // Watch all .wcf files
      server.watcher.add([...allWcfFiles])
      server.watcher.add(path.join(projectRoot, '**/*.wcf'))

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', `http://localhost:${port}`)
        const pathname = url.pathname

        // Reload entry list on each request (handles new screens added)
        if (isDir) {
          const fresh = loadProject(target)
          if (fresh.length > 0) {
            entries.length = 0
            entries.push(...fresh)
          }
        }

        if (pathname === '/') {
          const first = entries[0]
          if (first) {
            res.writeHead(302, { Location: `/view/${first.id}?theme=${themeName}` })
            res.end()
            return
          }
        }

        const viewMatch = pathname.match(/^\/view\/(.+)$/)
        if (viewMatch) {
          const id = viewMatch[1]
          const entry = entries.find(e => e.id === id) ?? entries[0]
          if (!entry) { next(); return }

          const qTheme = url.searchParams.get('theme') ?? themeName

          const html = renderPage(entries, entry.id, entry.file, qTheme)
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
