import * as vscode from 'vscode'
import { registerDiagnostics } from './diagnostics'
import { registerCompletion } from './completion'
import { registerPreview } from './preview'

export function activate(context: vscode.ExtensionContext): void {
  registerDiagnostics(context)
  registerCompletion(context)
  registerPreview(context)
}

export function deactivate(): void {}
