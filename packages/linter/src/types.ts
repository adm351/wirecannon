export interface LintError {
  file: string
  line: number
  rule: number
  message: string
}

export interface ParsedNode {
  type: string
  attrs: Record<string, string | true>
  comment: Record<string, string | true>
  children: ParsedNode[]
  line: number
  indent: number
  isFlowLine: boolean
  raw?: string  // raw text content for non-component lines (flow/table rows)
}
