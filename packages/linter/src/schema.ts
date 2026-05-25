export type AttrType = 'string' | 'integer' | 'kebab-case' | 'boolean' | { enum: string[] }

export interface AttrSchema {
  required: boolean
  type: AttrType
}

export interface ComponentSchema {
  attrs: Record<string, AttrSchema>
}

export const COMPONENTS: Record<string, ComponentSchema> = {
  // Tier 1 — Layout
  Row: {
    attrs: {
      align: { required: false, type: { enum: ['start', 'center', 'end', 'space-between', 'space-around'] } },
      gap: { required: false, type: { enum: ['sm', 'md', 'lg'] } },
      padding: { required: false, type: { enum: ['sm', 'md', 'lg'] } },
      grow: { required: false, type: 'boolean' },
    },
  },
  Col: {
    attrs: {
      gap: { required: false, type: { enum: ['sm', 'md', 'lg'] } },
      padding: { required: false, type: { enum: ['sm', 'md', 'lg'] } },
    },
  },
  Grid: {
    attrs: {
      cols: { required: true, type: 'integer' },
      gap: { required: false, type: { enum: ['sm', 'md', 'lg'] } },
      padding: { required: false, type: { enum: ['sm', 'md', 'lg'] } },
    },
  },
  Stack: {
    attrs: {
      anchor: { required: true, type: { enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] } },
    },
  },

  // Tier 2 — Structure
  Header: { attrs: {} },
  Footer: { attrs: {} },
  Sidebar: {
    attrs: {
      position: { required: true, type: { enum: ['left', 'right'] } },
    },
  },
  Main: { attrs: {} },
  Section: {
    attrs: {
      id: { required: true, type: 'kebab-case' },
    },
  },
  Nav: {
    attrs: {
      orientation: { required: true, type: { enum: ['horizontal', 'vertical'] } },
    },
  },
  Card: {
    attrs: {
      id: { required: false, type: 'kebab-case' },
    },
  },

  // Tier 3 — Leaf
  Button: {
    attrs: {
      label: { required: true, type: 'string' },
      variant: { required: false, type: { enum: ['primary', 'secondary', 'ghost', 'danger'] } },
      target: { required: false, type: 'string' },
      align: { required: false, type: { enum: ['left', 'center', 'right'] } },
    },
  },
  ButtonGroup: {
    attrs: {
      align: { required: false, type: { enum: ['left', 'right', 'center'] } },
    },
  },
  ButtonDropdown: {
    attrs: {
      label: { required: true, type: 'string' },
      variant: { required: false, type: { enum: ['primary', 'secondary', 'ghost'] } },
      options: { required: true, type: 'string' },
    },
  },
  Input: {
    attrs: {
      type: { required: true, type: { enum: ['text', 'email', 'password', 'search', 'number', 'select', 'textarea', 'editor'] } },
      placeholder: { required: false, type: 'string' },
    },
  },
  Text: {
    attrs: {
      content: { required: true, type: 'string' },
      variant: { required: true, type: { enum: ['heading', 'subheading', 'body', 'caption', 'label'] } },
    },
  },
  Image: {
    attrs: {
      alt: { required: true, type: 'string' },
    },
  },
  Branding: {
    attrs: {},
  },
  List: {
    attrs: {
      variant: { required: true, type: { enum: ['ordered', 'unordered', 'inline'] } },
    },
  },
  Badge: {
    attrs: {
      label: { required: true, type: 'string' },
      variant: { required: true, type: { enum: ['info', 'success', 'warning', 'danger'] } },
    },
  },
  Icon: {
    attrs: {
      name: { required: true, type: 'string' },
    },
  },
  Divider: {
    attrs: {
      orientation: { required: true, type: { enum: ['horizontal', 'vertical'] } },
    },
  },
  Form: {
    attrs: {
      id: { required: true, type: 'kebab-case' },
    },
  },
  Table: {
    attrs: {
      filter: { required: false, type: 'boolean' },
      pagination: { required: false, type: 'boolean' },
      rowlink: { required: false, type: 'boolean' },
    },
  },
  // Overlay file root
  Overlay: {
    attrs: {
      type: { required: true, type: { enum: ['modal', 'drawer', 'dialog'] } },
      anchor: { required: false, type: { enum: ['left', 'right', 'top', 'bottom'] } },
    },
  },
}

export const LAYOUT = new Set(['Row', 'Col', 'Grid', 'Stack'])
export const STRUCTURE = new Set(['Header', 'Footer', 'Sidebar', 'Main', 'Section', 'Nav', 'Card', 'Table'])
export const LEAF = new Set(['Button', 'ButtonGroup', 'ButtonDropdown', 'Input', 'Text', 'Image', 'Branding', 'List', 'Badge', 'Icon', 'Divider', 'Form'])

const ALL = [...LAYOUT, ...STRUCTURE, ...LEAF]
const LAYOUT_ARR = [...LAYOUT]
const LEAF_ARR = [...LEAF]

export function permittedChildren(parentType: string): Set<string> {
  switch (parentType) {
    case 'Row':
    case 'Col':
    case 'Overlay':
      return new Set(ALL)
    case 'Grid':
      return new Set(['Card', ...LEAF_ARR])
    case 'Stack':
      return new Set([...LAYOUT_ARR, ...LEAF_ARR])
    case 'Header':
    case 'Footer':
      return new Set(['Nav', ...LAYOUT_ARR, ...LEAF_ARR])
    case 'Sidebar':
      return new Set(['Nav', 'Section', 'Table', ...LAYOUT_ARR, ...LEAF_ARR])
    case 'Main':
      return new Set(['Nav', 'Section', 'Card', 'Table', ...LAYOUT_ARR, ...LEAF_ARR])
    case 'Section':
      return new Set(['Nav', 'Section', 'Card', 'Table', ...LAYOUT_ARR, ...LEAF_ARR])
    case 'Nav':
      return new Set(LEAF_ARR)
    case 'Card':
      return new Set(['Header', 'Footer', 'Main', 'Section', 'Table', ...LAYOUT_ARR, ...LEAF_ARR])
    case 'Table':
      return new Set() // row content is expressed as pipe-delimited flow lines, not component children
    case 'ButtonGroup':
      return new Set(['Button'])
    case 'Form':
      return new Set(['Input', 'ButtonGroup', 'Button', 'Text', 'Divider'])
    default:
      return new Set()
  }
}

export const COMMENT_VOCAB = new Set([
  'region', 'component',
  'action', 'role', 'state',
  'owner', 'depends-on', 'triggers',
  'priority', 'anchor', 'hidden',
  'note', 'todo',
  'happy-path', 'condition', 'frequency', 'retry', 'back-navigation',
  'description',
])

export const KEBAB_CASE = /^[a-z][a-z0-9-]*$/
