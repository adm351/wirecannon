import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { lint } from '@wirecannon/linter'

const collection = vscode.languages.createDiagnosticCollection('wirecannon')

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

async function updateDiagnostics(document: vscode.TextDocument): Promise<void> {
  if (!document.fileName.endsWith('.wcf')) return

  const projectRoot = findProjectRoot(document.fileName)
  if (!projectRoot) {
    collection.delete(document.uri)
    return
  }

  let errors
  try {
    errors = await lint(projectRoot)
  } catch {
    return
  }

  const byFile = new Map<string, vscode.Diagnostic[]>()
  for (const err of errors) {
    const range = new vscode.Range(
      Math.max(0, err.line - 1), 0,
      Math.max(0, err.line - 1), Number.MAX_SAFE_INTEGER,
    )
    const diag = new vscode.Diagnostic(range, `[Rule ${err.rule}] ${err.message}`, vscode.DiagnosticSeverity.Error)
    diag.source = 'Wirecannon'
    const key = err.file
    if (!byFile.has(key)) byFile.set(key, [])
    byFile.get(key)!.push(diag)
  }

  collection.clear()
  for (const [file, diags] of byFile) {
    collection.set(vscode.Uri.file(file), diags)
  }
}

export function registerDiagnostics(context: vscode.ExtensionContext): void {
  const active = vscode.window.activeTextEditor?.document
  if (active) updateDiagnostics(active)

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidSaveTextDocument(doc => updateDiagnostics(doc)),
    vscode.workspace.onDidOpenTextDocument(doc => updateDiagnostics(doc)),
  )
}
