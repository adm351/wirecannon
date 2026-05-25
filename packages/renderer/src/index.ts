import * as fs from 'fs/promises'
import * as path from 'path'
import { RenderOptions } from './types'
import { parseFile } from './parser'
import { getTheme } from './themes/index'
import { renderHtmlDocument } from './html'
import { renderSvg } from './svg'

export type { RenderOptions }
export { themes } from './themes/index'

export async function renderContent(content: string, options: RenderOptions = {}): Promise<string> {
  const nodes = parseFile(content)
  const theme = getTheme(options.theme)
  if (options.format === 'svg') return renderSvg(nodes, theme, options)
  return renderHtmlDocument(nodes, theme, options)
}

export async function render(wfFilePath: string, options: RenderOptions = {}): Promise<string> {
  const content = await fs.readFile(wfFilePath, 'utf-8')
  const nodes = parseFile(content)
  const theme = getTheme(options.theme)
  const title = path.basename(wfFilePath, '.wcf')

  if (options.format === 'svg') {
    return renderSvg(nodes, theme, options)
  }

  return renderHtmlDocument(nodes, theme, options, title)
}
