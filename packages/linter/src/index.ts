import * as fs from 'fs/promises'
import * as path from 'path'
import { LintError } from './types'
import { parseFile } from './parser'
import { validateIndex, validateContentFile } from './validate'

export type { LintError }
export { COMPONENTS, COMMENT_VOCAB, LAYOUT, STRUCTURE, LEAF } from './schema'
export type { ComponentSchema, AttrSchema, AttrType } from './schema'

export async function lint(projectRoot: string): Promise<LintError[]> {
  const errors: LintError[] = []

  // Rule 1: project must contain index.wcf
  const indexPath = path.join(projectRoot, 'index.wcf')
  try {
    await fs.access(indexPath)
  } catch {
    return [{ file: indexPath, line: 0, rule: 1, message: 'Project must contain index.wcf' }]
  }

  const indexContent = await fs.readFile(indexPath, 'utf-8')
  const indexNodes = parseFile(indexContent)
  const { errors: indexErrors, screenFiles, overlayFiles, validTargets } = validateIndex(indexPath, indexNodes, projectRoot)
  errors.push(...indexErrors)

  for (const { file } of [...screenFiles, ...overlayFiles]) {
    try {
      const content = await fs.readFile(file, 'utf-8')
      const nodes = parseFile(content)
      errors.push(...validateContentFile(file, nodes, validTargets))
    } catch {
      // file not found already reported as rule 4 in validateIndex
    }
  }

  return errors
}
