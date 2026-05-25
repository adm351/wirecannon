import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { renderContent } from '@wirecannon/renderer'

let panel: vscode.WebviewPanel | undefined
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let currentScreenMap = new Map<string, string>()

function getTheme(): 'bw' | 'flexoki' {
  const cfg = vscode.workspace.getConfiguration('wirecannon')
  return cfg.get<'bw' | 'flexoki'>('previewTheme', 'bw')
}

function findProjectRoot(filePath: string): string | null {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  let dir = path.dirname(filePath)
  while (true) {
    if (fs.existsSync(path.join(dir, 'index.wcf'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    if (wsRoot && dir === wsRoot) return null
    dir = parent
  }
}

function loadScreenMap(projectRoot: string): Map<string, string> {
  const map = new Map<string, string>()
  const indexPath = path.join(projectRoot, 'index.wcf')
  if (!fs.existsSync(indexPath)) return map
  const content = fs.readFileSync(indexPath, 'utf-8')
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*\[(Screen|Overlay)\s+([^\]#]*)\]/)
    if (!match) continue
    const attrs = match[2]
    const id = attrs.match(/\bid:([^\s\]]+)/)?.[1]
    const file = attrs.match(/\bfile:([^\s\]]+)/)?.[1]
    if (id && file) map.set(id, path.resolve(projectRoot, file))
  }
  return map
}

const NAV_SCHEME = 'wcf-navigate:'

function injectNavigationScript(html: string): string {
  const script = `<script>
(function(){
  const vscode = acquireVsCodeApi();
  document.addEventListener('click', function(e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('${NAV_SCHEME}')) {
      e.preventDefault();
      vscode.postMessage({ type: 'navigate', id: href.slice(${NAV_SCHEME.length}) });
    }
  });
}());
</script>`
  return html.replace('</body>', script + '\n</body>')
}

async function refresh(document: vscode.TextDocument): Promise<void> {
  if (!panel) return
  panel.title = `Preview: ${path.basename(document.fileName, '.wcf')}`
  try {
    const projectRoot = findProjectRoot(document.fileName)
    currentScreenMap = projectRoot ? loadScreenMap(projectRoot) : new Map()

    const targets = new Map<string, string>()
    for (const [id] of currentScreenMap) targets.set(id, `${NAV_SCHEME}${id}`)

    const html = await renderContent(document.getText(), {
      theme: getTheme(),
      format: 'html',
      targets: targets.size > 0 ? targets : undefined,
    })
    panel.webview.html = injectNavigationScript(html)
  } catch (e: any) {
    panel.webview.html = errorPage(String(e?.message ?? e))
  }
}

function debounceRefresh(document: vscode.TextDocument): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => refresh(document), 150)
}

function errorPage(message: string): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;color:#c0392b">
<b>Render error</b><pre style="margin-top:8px;white-space:pre-wrap">${escaped}</pre>
</body></html>`
}

function openPanel(document: vscode.TextDocument, context: vscode.ExtensionContext): void {
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'wirecannonPreview',
      'Wirecannon Preview',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    )
    panel.webview.onDidReceiveMessage(async (msg: { type: string; id: string }) => {
      if (msg.type !== 'navigate') return
      const filePath = currentScreenMap.get(msg.id)
      if (filePath && fs.existsSync(filePath)) {
        const doc = await vscode.workspace.openTextDocument(filePath)
        refresh(doc)
      }
    }, null, context.subscriptions)

    panel.onDidDispose(() => {
      panel = undefined
      if (debounceTimer) clearTimeout(debounceTimer)
    }, null, context.subscriptions)
  }
  refresh(document)
}

export function registerPreview(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('wirecannon.showPreview', () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || !editor.document.fileName.endsWith('.wcf')) {
        vscode.window.showErrorMessage('Open a .wcf file to preview it.')
        return
      }
      openPanel(editor.document, context)
    }),

    vscode.workspace.onDidChangeTextDocument(event => {
      if (panel && event.document.fileName.endsWith('.wcf')) {
        debounceRefresh(event.document)
      }
    }),

    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (panel && editor?.document.fileName.endsWith('.wcf')) {
        refresh(editor.document)
      }
    }),
  )
}
