# Wirecannon Grammar Specification
# version: 1.0

## Overview

Wirecannon is a text-based wireframing DSL designed for three audiences:

- **Humans** — readable, diffable, git-friendly
- **Models** — unambiguous structure, semantic metadata, addressable components
- **Renderers** — enough layout information to produce a visual output without interpretation

### Core principle

> If it affects pixels, it belongs in the DSL. If it helps a model reason, it belongs in a comment.

### Project structure

Every Wirecannon project is a directory of `.wcf` files:

```
/wireframes
  GRAMMAR.md          ← this file, always present
  index.wcf            ← required project manifest
  screens/            ← one file per screen
  overlays/           ← modals, drawers, dialogs
```

`index.wcf` is always read first. No model should modify any screen or overlay without
first reading `index.wcf` to understand the full application context.

---

## Syntax rules

### Components

Components are declared with square brackets. The component type is always the first token:

```
[ComponentType attr:value attr:value]
```

### Nesting

Children are indented two spaces beneath their parent. Indentation is structural — it defines
the component tree. Tabs are not permitted, only spaces:

```
[Row align:center]
  [Col]
    [Text content:"Hello" variant:heading]
  [Col]
    [Button label:"Submit" variant:primary]
```

### Attributes

Attributes are key:value pairs separated by spaces. Values containing spaces are quoted:

```
[Text content:"Hello world" variant:heading]
[Table cols:"Name,Email,Role" filter:true]
```

Attributes without a value are boolean true:

```
[Table cols:"Name,Status" filter pagination]
```

### Comments

Comments begin with `#` and appear at the end of a component line, never on their own line.
Comments contain semantic metadata as key=value pairs, space separated.
Freeform annotations use `note` and `todo` keys with quoted values:

```
[ButtonGroup align:end]    # region=header.actions priority=primary
[Button label:"Sign Up"]     # action=auth-signup note="primary CTA, do not move"
```

Comments are stripped before rendering. The renderer never reads comment content.

### Unknown keys

Any comment key not in the validated vocabulary is a grammar error.
Any DSL attribute not defined for that component type is a grammar error.
Models and linters must flag unknown keys rather than silently ignoring them.

---

## index.wcf

The project manifest. Required. Always read first.
Contains no layout or components — only project metadata, screen declarations, overlay
declarations, and flow definitions.

### Structure

```
[Project name:"App Name" version:1]   # description="freeform description"

[Screens]
  [Screen id:screen-id label:"Label" file:screens/filename.wcf entry:true]

[Overlays]
  [Overlay id:overlay-id label:"Label" file:overlays/filename.wcf scope:global|screen]

[Flows]
  [Flow id:flow-id label:"Flow Label"]
    screen-id → screen-id                     # happy-path=true
    screen-id
      | condition → screen-id                 # note="condition description"
      | condition → overlay-id → screen-id
```

### Screen attributes

```
id        required  unique identifier, kebab-case
label     required  human readable name
file      required  path relative to project root
entry     optional  true — marks the default entry screen, only one permitted
```

### Overlay attributes

```
id        required  unique identifier, kebab-case
label     required  human readable name
file      required  path relative to project root
scope     required  global|screen
                    global  — any screen may target this overlay
                    screen  — only the owning screen may target this overlay
```

### Flow syntax

Linear step:
```
screen-a → screen-b → screen-c
```

Fork — branches from the same parent node, indented two spaces, prefixed with `|`:
```
screen-a
  | condition-one → screen-b
  | condition-two → screen-c → screen-d
```

Forks may chain overlays:
```
screen-a
  | unauthenticated → auth-modal → screen-b
  | authenticated   → screen-b
```

Valid comment keys on flow lines:
```
happy-path    true — marks the primary intended path
condition     description of the branch condition
frequency     high|medium|low — expected usage frequency
retry         true — this branch loops back to the same screen
back-navigation  true — this branch represents a user going back
```

---

## Component tiers

Components are organised into three tiers: Layout, Structure, and Leaf.
Higher tiers may contain lower tiers. The nesting rules for each component
define exactly what children are permitted.

---

## Tier 1 — Layout

Layout components are invisible containers. They have no visual identity.
The renderer draws no border, background, or decoration on Layout components.
They exist only to position their children.

### Row

Arranges children horizontally.

```
[Row align:start|center|end|space-between|space-around gap:sm|md|lg padding:sm|md|lg grow]
```

| Attribute | Values                                          | Required | Notes                          |
|-----------|-------------------------------------------------|----------|--------------------------------|
| align     | start, center, end, space-between, space-around | no       | default: start                 |
| gap       | sm, md, lg                                      | no       | omit if children have no gap   |
| padding   | sm, md, lg                                      | no       | omit if no internal padding    |
| grow      | boolean                                         | no       | set to make the row flex-grow  |

Permitted children: any Layout, any Structure, any Leaf

### Col

Arranges children vertically.

```
[Col align:start|center|end|space-between|space-around gap:sm|md|lg padding:sm|md|lg grow]
```

| Attribute | Values                                          | Required | Notes                                      |
|-----------|-------------------------------------------------|----------|--------------------------------------------|
| align     | start, center, end, space-between, space-around | no       | controls vertical distribution of children |
| gap       | sm, md, lg                                      | no       | omit if children have no gap               |
| padding   | sm, md, lg                                      | no       | omit if no internal padding                |
| grow      | boolean                                         | no       | set to make the col flex-grow and fill height |

Permitted children: any Layout, any Structure, any Leaf

### Grid

Arranges children in a fixed column grid. Use when children are uniform repeated units
such as product cards or dashboard panels.

```
[Grid cols:2 gap:sm|md|lg padding:sm|md|lg]
```

| Attribute | Values     | Required | Notes                              |
|-----------|------------|----------|------------------------------------|
| cols      | integer    | yes      | renderer cannot infer column count |
| gap       | sm, md, lg | no       | omit if children have no gap       |
| padding   | sm, md, lg | no       | omit if no internal padding        |

Permitted children: Card, any Leaf

### Stack

Arranges children on the z-axis. Children overlap. Use for overlaid UI elements
such as a floating action button over a content area.

```
[Stack anchor:top-left|top-right|bottom-left|bottom-right|center]
```

| Attribute | Values                                            | Required | Notes                              |
|-----------|---------------------------------------------------|----------|------------------------------------|
| anchor    | top-left, top-right, bottom-left, bottom-right, center | yes | renderer cannot infer anchor point |

Permitted children: any Layout, any Leaf

---

## Tier 2 — Structure

Structure components are named page regions. They have implicit visual identity —
a renderer knows how to present each one without additional attributes.
Structure components define the skeleton of a screen.

### Header

Top region of a screen. Singleton — only one Header per screen or Card.

```
[Header]
```

No attributes. Position and dimensions are implicit.

Permitted children: Nav, any Layout, any Leaf
Forbidden children: Footer, Sidebar, Main, Section, Card

### Footer

Bottom region of a screen. Singleton — only one Footer per screen or Card.

```
[Footer]
```

No attributes. Position and dimensions are implicit.

Permitted children: Nav, any Layout, any Leaf
Forbidden children: Header, Sidebar, Main, Section, Card

### Sidebar

Secondary column region. Declare position explicitly — both left and right are valid.

```
[Sidebar position:left|right]
```

| Attribute | Values      | Required | Notes                                |
|-----------|-------------|----------|--------------------------------------|
| position  | left, right | yes      | renderer cannot infer which side     |

Permitted children: Nav, Section, any Layout, any Leaf
Forbidden children: Header, Footer, Main, Card

### Main

Primary content region. Singleton — only one Main per screen.
Fills all space not occupied by Header, Footer, or Sidebar.

```
[Main]
```

No attributes. Dimensions are implicit.

Permitted children: Nav, Section, Card, any Layout, any Leaf
Forbidden children: Header, Footer, Sidebar

### Section

Named subdivision within Main, Sidebar, or Card.
Use to group related content that a model may need to address independently.

```
[Section id:section-id]
```

| Attribute | Values     | Required | Notes                                        |
|-----------|------------|----------|----------------------------------------------|
| id        | kebab-case | yes when nested, recommended always | required for model addressing |

Permitted children: Nav, Section (max 2 levels deep), Card, any Layout, any Leaf
Forbidden children: Header, Footer, Sidebar, Main

Nesting limit: Sections may nest to a maximum depth of 2.
A Section inside a Section inside a Section is a grammar error.

Address resolution: nested Sections resolve via dot notation derived from nesting structure.
```
[Main]
  [Section id:featured]         # region=main.featured
    [Section id:trending]       # region=main.featured.trending
```

### Nav

Navigation container. Orientation must be declared — horizontal and vertical
render and behave differently.

```
[Nav orientation:horizontal|vertical]
```

| Attribute   | Values                 | Required | Notes                                   |
|-------------|------------------------|----------|-----------------------------------------|
| orientation | horizontal, vertical   | yes      | renderer cannot infer orientation       |

Permitted children: Leaf only
Forbidden children: any Layout, any Structure

### Card

A bounded content container with implicit border and padding.
Cards may contain Headers and Footers for titled or actioned card patterns.
Cards cannot be nested inside other Cards.

```
[Card id:card-id]
```

| Attribute | Values     | Required | Notes                                         |
|-----------|------------|----------|-----------------------------------------------|
| id        | kebab-case | yes when multiple Cards are siblings | required for model addressing |

Permitted children: Header, Footer, Main, Section, any Layout, any Leaf
Forbidden children: Sidebar, Nav, Card

Permitted parents: Main, Section, Grid, Row, Col
Forbidden parents: Header, Footer, Nav, Card

---

## Tier 3 — Leaf

Leaf components are terminals. They contain no children.
Leaf components carry only data and display attributes necessary
for a renderer or model to understand their purpose.

### Button

A single actionable element.

```
[Button label:"Label" variant:primary|secondary|ghost|danger|label target:screen-id|overlay-id]
```

| Attribute | Values                                  | Required | Notes                              |
|-----------|-----------------------------------------|----------|------------------------------------|
| label     | string                                  | yes      | required for model addressing      |
| variant   | primary, secondary, ghost, danger, label | no      | default: secondary; `label` renders as an uppercase text label |
| target    | screen-id or overlay-id                 | no       | links to another screen or overlay |
| align     | left, center, right                     | no       | label alignment within the button, default: center |

### ButtonGroup

A set of related Button components treated as a coupled unit.

```
[ButtonGroup align:start|center|end]
  [Button label:"Cancel" variant:ghost]
  [Button label:"Save" variant:primary]
```

| Attribute | Values              | Required | Notes                                        |
|-----------|---------------------|----------|----------------------------------------------|
| align     | start, center, end  | no       | required when group position is not implicit |

Permitted children: Button only

### ButtonDropdown

A single button trigger that reveals a menu when clicked. Menu items are declared as
child components — typically `Button`, `Divider`, and `Text` (for section labels).

```
[ButtonDropdown label:"Actions" variant:ghost]
  [Button label:"Edit"]
  [Button label:"Duplicate"]
  [Divider orientation:horizontal]
  [Button label:"Delete" variant:danger]
```

| Attribute | Values                    | Required | Notes                          |
|-----------|---------------------------|----------|--------------------------------|
| label     | string                    | yes      | the trigger button label       |
| variant   | primary, secondary, ghost | no       | default: secondary             |

Permitted children: Button, Divider, Text

### Input

A data entry field. Type drives the rendered component.

```
[Input type:text|email|password|search|number|select|textarea|editor placeholder:"Placeholder text"]
```

| Attribute   | Values                                              | Required | Notes                               |
|-------------|-----------------------------------------------------|----------|-------------------------------------|
| type        | text, email, password, search, number, select, textarea, editor | yes | drives rendered component |
| placeholder | string                                              | no       | semantic hint about expected content |

`editor` renders a code editor component. The renderer chooses the implementation.

### Text

A text content element. Variant defines its role in the typographic hierarchy.

```
[Text content:"Content here" variant:heading|subheading|body|caption|label]
```

| Attribute | Values                                | Required | Notes                    |
|-----------|---------------------------------------|----------|--------------------------|
| content   | string                                | yes      | the text content         |
| variant   | heading, subheading, body, caption, label | yes  | typographic hierarchy    |

No font sizes, weights, or colours — those are renderer decisions.

### Image

A visual asset placeholder. No dimensions or sources — wireframes do not use real assets.

```
[Image alt:"Description of image content"]
```

| Attribute | Values | Required | Notes                                              |
|-----------|--------|----------|----------------------------------------------------|
| alt       | string | yes      | describes what the image represents, not its style |

### Branding

A brand mark or logo placeholder. Rendered at a constrained size — never stretches to fill its container. Use this instead of `Image` for logotypes and brand marks.

```
[Branding]
```

No attributes. The renderer supplies a fixed-size placeholder.

### List

An enumerated or inline set of items.

```
[List variant:ordered|unordered|inline]
```

| Attribute | Values                     | Required | Notes                         |
|-----------|----------------------------|----------|-------------------------------|
| variant   | ordered, unordered, inline | yes      | drives rendered list type     |

### Badge

A small labelled indicator conveying status or category.

```
[Badge label:"Status" variant:info|success|warning|danger]
```

| Attribute | Values                          | Required | Notes                          |
|-----------|---------------------------------|----------|--------------------------------|
| label     | string                          | yes      | the badge text                 |
| variant   | info, success, warning, danger  | yes      | conveys semantic meaning       |

### Icon

A single icon from the renderer's icon library.
The renderer maps `name` to its icon set of choice.

```
[Icon name:"icon-name"]
```

| Attribute | Values | Required | Notes                                        |
|-----------|--------|----------|----------------------------------------------|
| name      | string | yes      | semantic name, not library-specific token    |

No size attribute — the renderer infers size from context.

### Divider

A visual separator between regions or components.

```
[Divider orientation:horizontal|vertical]
```

| Attribute   | Values                 | Required | Notes                              |
|-------------|------------------------|----------|------------------------------------|
| orientation | horizontal, vertical   | yes      | renderer cannot infer orientation  |

### Form

A logical grouping of Input components. Does not imply any visual container —
the renderer decides whether to draw a border or background.

```
[Form id:form-id]
  [Input type:text placeholder:"Full name"]
  [Input type:email placeholder:"Email address"]
  [ButtonGroup align:end]
    [Button label:"Submit" variant:primary]
```

| Attribute | Values     | Required | Notes                          |
|-----------|------------|----------|--------------------------------|
| id        | kebab-case | yes      | required for model addressing  |

Permitted children: Input, ButtonGroup, Button, Text, Divider

### Table

A structured data display. Row content is written as pipe-delimited child lines.
The first child line defines column headers; subsequent lines are data rows.
Cells may contain plain text or any inline component in `[Component ...]` syntax.

```
[Table filter pagination rowlink]
  Name | Email | Status | Actions
  John Smith | john@example.com | [Badge label:"Active" variant:success] | [Button label:"Edit" variant:ghost]
  Jane Doe | jane@example.com | [Badge label:"Inactive" variant:danger] | [Button label:"Edit" variant:ghost]
```

| Attribute  | Values  | Required | Notes                                     |
|------------|---------|----------|-------------------------------------------|
| filter     | boolean | no       | renders a filter input above the table    |
| pagination | boolean | no       | renders pagination controls below         |
| rowlink    | boolean | no       | rows are clickable, renders hover state   |

Row lines are not components — they are pipe-delimited text and are not subject to
component nesting or attribute rules. Comment keys valid on flow lines apply.

---

## Comment key vocabulary

Comments appear at the end of component lines, prefixed with `#`.
All keys must come from the validated vocabulary below.
Unknown keys are grammar errors.
Values containing spaces must be quoted.

### Addressing keys

```
region        Dot-path string reflecting the component's position in the page hierarchy.
              Derivable from nesting but declared explicitly for model addressing efficiency.
              region=header.actions
              region=sidebar.filters.category
              region=main.featured.trending

component     Semantic name when the DSL primitive type is insufficient to identify
              the real-world component unambiguously.
              component=search-bar
              component=user-menu
              component=product-grid
```

### Intent keys

```
action        The identifier of what this component triggers.
              Kebab-case. Scoped to the screen or overlay.
              action=auth-login
              action=cart-open
              action=filter-apply
              action=form-submit

role          ARIA-adjacent semantic purpose of the component.
              role=navigation
              role=search
              role=status
              role=content
              role=action

state         The default display state of the component.
              Useful for Tables, Lists, and Cards with multiple states.
              state=loading
              state=empty
              state=error
              state=populated
```

### Relationship keys

```
owner         The screen-id or overlay-id this component belongs to.
              Used when a component's file context is ambiguous.
              owner=product-detail

depends-on    Dot-path of another component this one reacts to.
              Used to express data relationships between components.
              depends-on=sidebar.filters.category
              depends-on=header.search

triggers      The overlay-id or screen-id this component opens.
              Complements the DSL target attribute with model-readable intent.
              triggers=cart-drawer
              triggers=auth-modal
```

### Priority and stability keys

```
priority      Relative importance of this component within its siblings.
              priority=primary
              priority=secondary
              priority=tertiary

anchor        Marks a component as stable. A model must not move, remove, or
              structurally alter an anchored component without an explicit instruction
              to do so. Boolean, always true when present.
              anchor=true

hidden        Component is declared in the DSL but not rendered in the default state.
              Used for collapsed sidebars, inactive panels, conditional UI.
              hidden=true
```

### Annotation keys

```
note          Freeform human annotation. A model reads this for context but does not
              act on it unless explicitly instructed. Values must be quoted.
              note="confirm with design team"
              note="placeholder until API contract is finalised"

todo          An outstanding decision or missing information. A model must surface
              todos when asked to review a wireframe and must not silently resolve them.
              Values must be quoted.
              todo="decide on empty state copy"
              todo="need real column names from backend"
```

### Flow line keys

Valid only on lines inside a `[Flow]` block in `index.wcf`:

```
happy-path        true — marks the primary intended path through the flow
condition         string — describes the branch condition
frequency         high|medium|low — expected relative usage frequency
retry             true — this branch returns to the same screen
back-navigation   true — this branch represents backwards navigation
```

---

## Overlay files

Overlay files follow the same DSL grammar as screen files.
The root component of an overlay file must declare its presentation type:

```
[Overlay type:modal|drawer|dialog]    # region=overlay role=...
```

| Attribute | Values                | Required | Notes                                     |
|-----------|-----------------------|----------|-------------------------------------------|
| type      | modal, drawer, dialog | yes      | drives how the renderer frames the overlay |

`modal` — centred, blocks background interaction
`drawer` — slides in from an edge, requires `anchor:left|right|top|bottom`
`dialog` — compact, typically for confirmations

```
[Overlay type:drawer anchor:right]    # region=cart role=checkout-flow
  [Header]
    [Text content:"Your Cart" variant:heading]
    [Button label:"Close" variant:ghost]   # action=cart-close
  [Main]
    [List variant:unordered]               # component=cart-items state=populated
  [Footer]
    [ButtonGroup align:end]
      [Button label:"Checkout" variant:primary target:checkout]  # action=checkout-begin priority=primary anchor=true
```

---

## Validation rules

The following rules must be enforced by a linter or model before accepting a `.wcf` file:

**Structure**
1. Every project must contain `index.wcf`
2. Every `index.wcf` must contain exactly one `[Project]`, one `[Screens]`, and one `[Flows]` block
3. Exactly one Screen must have `entry:true`
4. Every `file` path in `index.wcf` must resolve to an existing `.wcf` file
5. Every `target` and `triggers` value must resolve to a declared screen-id or overlay-id in `index.wcf`

**Nesting**
6. Cards must not contain Cards
7. Sections must not nest more than 2 levels deep
8. Nav must only contain Leaf components
9. Header and Footer must not contain Header, Footer, Sidebar, Main, Section, or Card
10. Leaf components must not contain any children
11. ButtonGroup must only contain Button components
12. Form must only contain Input, ButtonGroup, Button, Text, and Divider

**Attributes**
13. All required attributes must be present
14. All attribute values must be from the defined enum where an enum is specified
15. Unknown attributes on any component are errors

**Comments**
16. All comment keys must be from the validated vocabulary
17. Unknown comment keys are errors
18. `note` and `todo` values must be quoted strings
19. `anchor=true` is the only valid value for the `anchor` key
20. `hidden=true` is the only valid value for the `hidden` key

**Identifiers**
21. All `id` values must be unique within their file scope
22. All screen and overlay `id` values must be unique within `index.wcf`
23. All identifiers must be kebab-case

---

## Model instructions

When working with Wirecannon files a model must follow these rules:

1. **Always read `index.wcf` first** before reading or modifying any screen or overlay file
2. **Edit the DSL, not the render** — the DSL is the source of truth
3. **Resolve natural language instructions to component addresses** before making changes
   - Use `region` comment keys as the primary address resolution mechanism
   - Use `component` keys when `region` is insufficient
   - Use structural nesting as a fallback when neither key is present
4. **Return only the modified DSL** for change requests — not the full file unless asked
5. **Never silently resolve a `todo`** — surface it to the human
6. **Never move or alter an `anchor=true` component** without an explicit instruction to do so
7. **Validate before returning** — a model must not return DSL that violates the grammar rules
8. **Add semantic comment keys** to components that lack them when authoring or editing,
   using the minimum keys needed to make the component unambiguously addressable
9. **Propagate `note` and `todo` keys** — do not drop them when editing surrounding components
10. **Declare overlay files separately** — do not inline overlay content into screen files

---

## Example — screen file

```
# screens/product-list.wcf
# owner=product-list

[Header]                                                           # region=header anchor=true
  [Row grow align:space-between]
    [Branding] 
    [Row align:right]
      [Nav orientation:horizontal]                                   # component=nav-primary role=navigation
        [Button label:"Home" variant:ghost target:home]
        [Button label:"Products" variant:ghost target:product-list]
      [ButtonGroup align:end]                                      # region=header.actions
        [Button label:"Cart" variant:ghost target:cart-drawer]       # action=cart-open triggers=cart-drawer priority=secondary
        [Button label:"Login" variant:ghost target:auth-modal]       # action=auth-login priority=secondary
        [Button label:"Sign Up" variant:primary target:auth-modal]   # action=auth-signup priority=primary anchor=true

[Row]
  [Sidebar position:left]                                          # region=sidebar role=search
    [Section id:filters]                                           # region=sidebar.filters
      [Text content:"Filters" variant:subheading]
      [Section id:category]                                        # region=sidebar.filters.category
        [Text content:"Category" variant:label]
        [List variant:unordered]                                   # component=category-filter state=populated
      [Section id:price-range]                                     # region=sidebar.filters.price-range
        [Text content:"Price Range" variant:label]
        [Input type:number placeholder:"Min"]
        [Input type:number placeholder:"Max"]                      # depends-on=sidebar.filters.price-range
      [Divider orientation:horizontal]
      [ButtonGroup align:end]
        [Button label:"Apply" variant:primary]                     # action=filter-apply
        [Button label:"Clear" variant:ghost]                       # action=filter-clear

  [Main]                                                           # region=main
    [Section id:results]                                           # region=main.results
      [Row align:space-between]
        [Text content:"Products" variant:heading]
        [Row gap:sm]
          [Input type:search placeholder:"Search products"]        # component=search-bar action=search-apply depends-on=sidebar.filters
          [ButtonDropdown label:"Sort" variant:ghost]                    # component=sort-control
            [Button label:"Price: Low to High"]
            [Button label:"Price: High to Low"]
            [Button label:"Newest"]
            [Button label:"Bestselling"]
      [Grid cols:3 gap:md]                                         # component=product-grid state=populated todo="confirm col count at tablet breakpoint"
        [Card id:product-card]                                     # component=product-card
          [Image alt:"Product image"]
          [Text content:"Product name" variant:subheading]
          [Text content:"$0.00" variant:body]
          [Badge label:"In Stock" variant:success]                 # component=stock-status state=populated
          [Button label:"Add to Cart" variant:primary]             # action=cart-add priority=primary

[Footer]                                                           # region=footer anchor=true
  [Row align:space-between]
    [Nav orientation:horizontal]                                   # component=nav-secondary role=navigation
      [Button label:"About" variant:ghost]
      [Button label:"Help" variant:ghost]
      [Button label:"Privacy" variant:ghost]
    [Text content:"© 2026 Acme Store" variant:caption]
```
