# Tax Form Annotation Specification

**Instead Engineer Technical Assessment**  
**Schema version:** `1.0.0`  
**Author:** Saleem Khan

---

## 1. Purpose

This specification defines a portable data structure for annotating fields and boxes on U.S. tax forms (e.g. IRS Form 1040).

An annotation template describes **where** each box sits on a page, **how** a value should be formatted when printed, and **which** value to read from a deeply nested tax-return dataset.

A separate rendering application (proprietary or open) consumes:

1. A blank (or filled) form PDF/image
2. An annotation template (this spec)
3. A nested tax-return data document

…and prints the resolved values into each box.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Form PDF/Image │  +  │ Annotation Spec  │  +  │ Nested Tax Data │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Overlay / Print Engine │
                    └────────────────────────┘
```

---

## 2. Design Goals

| Goal | Approach |
|------|----------|
| Resolution-independent positioning | Normalized coordinates (`0.0`–`1.0`) relative to page size |
| Deep value references | JSONPath-style `valueRef.path` into nested tax data |
| Print-ready formatting | Per-field appearance + typed formatters (currency, SSN, date, checkbox) |
| Hierarchical forms | Tree of `field` / `group` / `collection` nodes |
| Portable | JSON templates + TypeScript interfaces + JSON Schema |
| Extensible | New forms = new template files; renderer stays unchanged |

### 2.1 Key decisions (and why)

| Decision | Chose | Rejected / deferred | Why |
|----------|-------|---------------------|-----|
| Coordinates | **Normalized 0–1**, origin top-left | Absolute PDF points or raw pixels | Templates stay stable across zoom, DPI, and print size; renderer does a trivial multiply |
| Value binding | **JSONPath subset** (`$.a.b[0].c`) into nested `taxReturn` | Flat key map only (`income.wages`) | Tax data is naturally nested; the assignment requires deep references without forcing a flatten step |
| Template vs data | **Two documents** — reusable template + per-return data | Embedding values inside the template | Same Form 1040 layout serves thousands of clients; only data changes |
| Delivery format | **JSON + TypeScript interfaces + JSON Schema** | XML-only or classes without examples | JSON is easy to author/diff; TS types guide implementers; Schema validates templates |
| Scope of v1 | **Print-oriented annotation** (position, format, path) | Full OCR pipeline, tax calc, MeF e-file | Matches the brief: annotate boxes and print proprietary values; keeps the deliverable clean |
| Demo app | Thin Angular playground that consumes the spec | Spec-only with no runner | Proves someone can build a print overlay from the documentation alone |

These choices favor **portability and cleanliness** over maximizing features in v1. Conditional UI, multi-entity packs, and visual authoring are called out as future enhancements (§14) rather than baked into the MVP.

---

## 3. Document Types

Two documents work together:

| Document | Role |
|----------|------|
| **Annotation Template** | Form layout + field geometry + formatting + value paths |
| **Tax Return Data** | Deeply nested values for a specific taxpayer/return |

Templates are reusable across many returns. Data documents are per-client.

---

## 4. Coordinate System (Positioning)

Each page uses a **normalized** coordinate space:

```json
{
  "coordinateSystem": {
    "space": "normalized",
    "origin": "top_left",
    "xAxis": "left_to_right",
    "yAxis": "top_to_bottom"
  }
}
```

### 4.1 Bounding box

```json
{
  "boundingBox": {
    "x": 0.72,
    "y": 0.358,
    "width": 0.20,
    "height": 0.018
  }
}
```

| Property | Type | Range | Meaning |
|----------|------|-------|---------|
| `x` | number | `0–1` | Left edge as fraction of page width |
| `y` | number | `0–1` | Top edge as fraction of page height |
| `width` | number | `0–1` | Box width as fraction of page width |
| `height` | number | `0–1` | Box height as fraction of page height |

### 4.2 Pixel conversion (renderer responsibility)

```
pixelX      = boundingBox.x      * pageWidthPx
pixelY      = boundingBox.y      * pageHeightPx
pixelWidth  = boundingBox.width  * pageWidthPx
pixelHeight = boundingBox.height * pageHeightPx
```

This keeps templates stable across zoom levels, screen DPI, and print DPI.

### 4.3 Why not PDF points?

PDF points (72 DPI) are absolute. Normalized ratios survive:

- Different render scales in a web viewer
- Print at letter / legal sizes
- Image-scanned forms where intrinsic pixel size varies

Optional: templates may also store `page.widthPoints` / `page.heightPoints` (e.g. `612×792` for US Letter) as a reference for offline PDF libraries.

---

## 5. Value References (Deeply Nested Data)

### 5.1 The problem

Tax return data is naturally nested:

```
taxReturn
 └─ taxpayer
     └─ legal
         ├─ firstName
         └─ lastName
 └─ dependents[]
     └─ [0]
         └─ identifiers
             └─ ssn
 └─ income
     └─ w2Forms[]
         └─ [0]
             └─ wages
```

An annotation must point at **one leaf** (or array element) without flattening the whole graph into the template.

### 5.2 `valueRef.path` — JSONPath subset

Every printable field declares:

```json
{
  "valueRef": {
    "path": "$.income.w2Forms[0].wages"
  }
}
```

Supported path grammar (intentional subset of JSONPath):

```
path        := '$' segments
segments    := ('.' IDENT | '[' INDEX ']')+
IDENT       := [A-Za-z_][A-Za-z0-9_]*
INDEX       := [0-9]+
```

Examples:

| Path | Resolves to |
|------|-------------|
| `$.taxpayer.legal.firstName` | `"Jane"` |
| `$.taxpayer.identifiers.ssn` | `"123456789"` |
| `$.dependents[0].relationship` | `"Son"` |
| `$.dependents[1].identifiers.ssn` | second dependent’s SSN |
| `$.income.w2Forms[0].employer.name` | `"Acme Corporation"` |
| `$.income.interest.taxable` | `1250.50` |
| `$.filingStatus.single` | `true` |

### 5.3 Resolution algorithm

```
resolve(data, path):
  assert path starts with "$"
  cursor = data
  for each segment in path after "$":
    if cursor is null/undefined → return undefined
    if segment is property name → cursor = cursor[name]
    if segment is [index] → cursor = cursor[index]
  return cursor
```

Missing paths resolve to empty (do not throw). Renderers may surface a diagnostic for required fields.

### 5.4 Collection templates vs instance paths

In the **template**, a repeating row can use a placeholder form:

```json
"valueRef": { "path": "$.dependents[].legal.firstName" }
```

When materializing instance *i*, the renderer substitutes:

```
$.dependents[].legal.firstName  →  $.dependents[i].legal.firstName
```

Row vertical offsets (if needed) are computed as:

```
instanceY = baseY + (i * rowStride)
```

where `rowStride` is an optional collection property (normalized height between rows).

### 5.5 Separation of concerns

| Layer | Owns |
|-------|------|
| Template `valueRef.path` | *Which* nested value fills the box |
| Tax return JSON | The actual values |
| Renderer | Path resolution + formatting + painting |

---

## 6. Formatting

### 6.1 Field types

| `fieldType` | Raw value | Printed form |
|-------------|-----------|--------------|
| `text` | string | as-is (respects max length / overflow) |
| `currency` | number / numeric string | `$78,500.00` (en-US, USD) |
| `ssn` | 9-digit string | `123-45-6789` |
| `ein` | string | `12-3456789` |
| `date` | ISO `YYYY-MM-DD` | `04/12/1985` (configurable) |
| `checkbox` | boolean / `"true"` | `X` when true, empty when false |
| `number` | number | locale number string |

### 6.2 Appearance

```json
{
  "appearance": {
    "fontFamily": "Helvetica",
    "fontSize": 10,
    "fontWeight": "normal",
    "textAlign": "right",
    "verticalAlign": "middle",
    "color": "#000000",
    "backgroundColor": "transparent",
    "padding": { "top": 1, "right": 2, "bottom": 1, "left": 2 },
    "overflow": "clip"
  }
}
```

| Property | Default | Notes |
|----------|---------|-------|
| `fontFamily` | `Helvetica` | Prefer PDF-safe fonts for print |
| `fontSize` | `10` | Points (or CSS px at 1:1 screen preview) |
| `textAlign` | `left` | `left` \| `center` \| `right` |
| `verticalAlign` | `middle` | `top` \| `middle` \| `bottom` |
| `color` | `#000000` | CSS / hex |
| `overflow` | `clip` | `clip` \| `ellipsis` \| `shrink` |

### 6.3 Type-specific format options

```json
{
  "format": {
    "currency": { "currencyCode": "USD", "locale": "en-US", "minimumFractionDigits": 2 },
    "date": { "pattern": "MM/DD/YYYY" },
    "ssn": { "mask": "XXX-XX-XXXX", "redact": false },
    "checkbox": { "mark": "X" }
  }
}
```

Currency amounts on Form 1040 are typically **right-aligned**. Names and addresses are **left-aligned**. Checkboxes are **center-aligned** inside a small square.

---

## 7. Node Model

### 7.1 Annotation node types

| `type` | Purpose |
|--------|---------|
| `field` | Leaf box that can receive a printed value |
| `group` | Logical grouping (Taxpayer, Address) — no box of its own |
| `collection` | Repeating group (Dependents) with item children |

### 7.2 Core fields on a node

```ts
interface AnnotationNode {
  id: string;                    // Stable unique id within the template
  type: 'field' | 'group' | 'collection';
  label?: string;                // Human-readable label for tooling
  fieldType?: FieldType;         // Required when type === 'field'
  valueRef?: { path: string };   // Deep path into tax-return data
  semanticEntity?: string;       // Optional ontology hint (Person.ssn)
  validation?: Validation;
  appearance?: Appearance;
  format?: FormatOptions;
  boundingBox?: BoundingBox;     // Required to print a field
  page?: number;                 // Override page if nested under another page
  children?: AnnotationNode[];   // For group / collection
  collectionItemLabel?: string;
  rowStride?: number;            // Normalized Y stride for collection rows
}
```

### 7.3 Template root

```ts
interface AnnotationTemplate {
  schemaVersion: string;         // e.g. "1.0.0"
  formId: string;                // e.g. "irs_1040_2025"
  formName: string;
  taxYear: number;
  version: string;               // Template revision
  coordinateSystem: CoordinateSystem;
  pages: AnnotationPage[];
}
```

### 7.4 Full field example

```json
{
  "id": "income.wages",
  "type": "field",
  "label": "Wages, salaries, tips",
  "fieldType": "currency",
  "valueRef": { "path": "$.income.w2Forms[0].wages" },
  "semanticEntity": "Income.wages",
  "validation": { "required": false },
  "appearance": {
    "fontFamily": "Helvetica",
    "fontSize": 10,
    "textAlign": "right",
    "color": "#000000"
  },
  "format": {
    "currency": { "currencyCode": "USD", "locale": "en-US" }
  },
  "boundingBox": {
    "x": 0.72,
    "y": 0.358,
    "width": 0.20,
    "height": 0.018
  }
}
```

---

## 8. Tax Return Data Document

```json
{
  "formId": "irs_1040_2025",
  "extractedAt": "2025-03-15T10:30:00Z",
  "taxReturn": {
    "taxYear": 2025,
    "filingStatus": {
      "single": true,
      "marriedFilingJointly": false,
      "headOfHousehold": false
    },
    "taxpayer": {
      "legal": { "firstName": "Jane", "lastName": "Smith" },
      "identifiers": { "ssn": "123456789" },
      "dateOfBirth": "1985-04-12"
    },
    "dependents": [
      {
        "legal": { "firstName": "Alex", "lastName": "Smith" },
        "identifiers": { "ssn": "987654321" },
        "relationship": "Son"
      }
    ],
    "income": {
      "w2Forms": [
        {
          "employer": { "name": "Acme Corporation", "ein": "12-3456789" },
          "wages": 78500.0
        }
      ],
      "interest": { "taxable": 1250.5 }
    }
  }
}
```

Optional metadata (confidence, OCR source) may live beside values in an extraction envelope; the print path only needs the nested `taxReturn` object.

---

## 9. Rendering Contract

A compliant application must:

1. Load the form visual (PDF page or image).
2. Load the annotation template for that form + tax year.
3. Load the tax-return data document.
4. For each `field` with a `boundingBox`:
   1. Resolve `valueRef.path` against `taxReturn` (after collection index substitution).
   2. Format the value using `fieldType` + `format` + `appearance`.
   3. Convert `boundingBox` → pixels (or PDF points).
   4. Draw the text/mark inside the box with the specified alignment.
5. Ignore groups for painting; traverse them only for structure.

Pseudo-code:

```ts
for (const field of flattenFields(template)) {
  const raw = resolvePath(taxReturn, materializePath(field.valueRef.path, field));
  const text = formatValue(raw, field.fieldType, field.format);
  const box = toPixels(field.boundingBox, pageWidth, pageHeight);
  drawText(text, box, field.appearance);
}
```

---

## 10. Validation (optional but recommended)

```json
{
  "validation": {
    "required": true,
    "pattern": "^\\d{9}$",
    "minLength": 9,
    "maxLength": 9,
    "message": "SSN must be 9 digits"
  }
}
```

Validation does not block printing by default; review UIs may flag failures before e-file.

---

## 11. Extending to New Forms

1. Create `templates/{formId}.json` with pages + fields + boxes + paths.
2. Align `valueRef.path` values with your firm’s tax-return schema (or map via an adapter).
3. Register the template in the application’s form registry.
4. Supply sample nested data for tests.

No renderer changes required if the new form uses the same coordinate system and path grammar.

---

## 12. Deliverable Artifacts in This Repo

| Path | Description |
|------|-------------|
| `docs/SPECIFICATION.md` | This document |
| `docs/schema/annotation-template.schema.json` | JSON Schema for templates |
| `src/app/models/annotation.model.ts` | TypeScript interfaces |
| `src/app/utils/path-resolver.ts` | JSONPath subset resolver |
| `src/assets/templates/irs_1040_2025.json` | Example Form 1040 (2025) template |
| `src/assets/values/irs_1040_2025.sample.json` | Nested sample tax-return data |
| Angular playground | Reference app that overlays values on a PDF |

---

## 13. Non-Goals

- OCR / extraction algorithms (templates bind to *already structured* data)
- Tax calculation logic
- E-file XML (MeF) generation
- Multi-jurisdiction state form packs (same model applies; out of scope for the sample)

---

## 14. Future Enhancements

The current spec is intentionally minimal so a print engine can adopt it quickly. Natural next steps, without breaking the core model:

### 14.1 Conditional visibility & required-when

Show or require fields based on other answers (e.g. spouse block only when filing status is married filing jointly).

```json
{
  "visibility": {
    "dependsOn": "$.filingStatus.marriedFilingJointly",
    "equals": true
  }
}
```

### 14.2 Richer collection layout

Auto-expand repeating rows with `rowStride`, overflow to continuation schedules, and per-instance bounding boxes for more than two dependents.

### 14.3 Multi-form / multi-entity packs

Compose linked templates for 1040 + Schedules + K-1s, and for multi-entity returns (1120-S, 1065, 1041) sharing one nested client graph.

### 14.4 Collaborative review metadata

First-class review workflow on each field: confidence, reviewer, comments, approve/reject — already sketched via `reviewStatus` / `extractionConfidence`, expandable to audit trails.

### 14.5 Locale & accessibility formatting

Per-jurisdiction number/date masks, screen-reader labels, and high-contrast print profiles for taxpayer-facing packets.

### 14.6 Visual authoring tooling

A drag-to-draw annotator that writes valid template JSON (validated by the JSON Schema), so tax ops can add forms without hand-editing coordinates.

### 14.7 Bidirectional binding

Today the path is read → print. A future mode could write edited overlay values back into the nested `taxReturn` object for prep workflows.

These enhancements layer onto `AnnotationNode` / `valueRef` / `boundingBox`; they do not require replacing the coordinate system or path grammar.

---

## 15. Summary

**Positioning** → normalized `boundingBox` (`x`, `y`, `width`, `height` in `0–1`).  
**Formatting** → `fieldType` + `appearance` + optional `format` options.  
**Deep references** → `valueRef.path` JSONPath subset into nested `taxReturn` data.

Together, these three concerns let any team annotate a U.S. tax form once and print proprietary values into every box with a thin rendering layer.
