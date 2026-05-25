export interface ParsedNode {
  type: string
  attrs: Record<string, string | true>
  children: ParsedNode[]
  line: number
  indent: number
  isFlowLine: boolean
  raw?: string  // raw text content for non-component lines (flow/table rows)
}

export interface ColorVariant {
  bg: string
  text: string
  border: string
}

export interface BadgeVariant {
  bg: string
  text: string
}

export interface Theme {
  name: string
  font: {
    family: string
    mono: string
  }
  radius: string
  colors: {
    pageBg: string
    surfaceBg: string
    cardBg: string
    border: string
    borderSubtle: string
    text: string
    textMuted: string
    textSubtle: string
    primary: ColorVariant
    secondary: ColorVariant
    ghost: ColorVariant
    danger: ColorVariant
    info: BadgeVariant
    success: BadgeVariant
    warning: BadgeVariant
  }
}

export interface RenderOptions {
  theme?: 'bw' | 'flexoki'
  format?: 'html' | 'svg'
  // Map of screen/overlay id → URL, for resolving button targets
  targets?: Map<string, string>
  // false = return fragment only (no <html> wrapper); default true
  standalone?: boolean
}
