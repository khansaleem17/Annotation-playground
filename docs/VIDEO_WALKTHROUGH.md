# Video Walkthrough Script (≤ 5 minutes)

Use Loom (or QuickTime + upload) to record this. Speak to the camera briefly, then share your screen.

**Suggested title:** `Instead Engineer Assessment — Tax Form Annotation Spec`

---

## Agenda (4:30 target)

| Time | Topic |
|------|-------|
| 0:00–0:30 | Intro + what you built |
| 0:30–2:00 | Spec: positioning, formatting, nested paths |
| 2:00–4:00 | Live demo of the playground |
| 4:00–4:30 | How a print engine would use the spec |

---

## Script

### 0:00 – Intro

> Hi, I’m Saleem. For the Instead engineer assessment I designed a portable annotation specification for U.S. tax forms, plus a reference Angular playground that overlays values onto Form 1040.
>
> The deliverable is a JSON template + TypeScript model + written spec. Someone can annotate a form once, then any application can print proprietary values into each box.

### 0:30 – Spec overview (share `docs/SPECIFICATION.md`)

> Three requirements from the brief:
>
> **1. Positioning** — every field has a normalized bounding box: `x`, `y`, `width`, `height` as fractions of page size, origin top-left. That stays stable across zoom and print DPI. Pixel conversion is just multiply by page width/height.
>
> **2. Formatting** — each field declares a `fieldType` (text, currency, SSN, date, checkbox) plus `appearance` (font, size, alignment, color) and optional format options. Currency is right-aligned; names left-aligned; checkboxes print an “X”.
>
> **3. Deep nested references** — values live in a nested `taxReturn` object. Fields point at leaves with a JSONPath subset, for example:
> `$.income.w2Forms[0].wages` or `$.dependents[0].identifiers.ssn`.
> Collections use `[]` placeholders that the renderer materializes per row index.

Show briefly:

- `src/assets/templates/irs_1040_2025.json` — one field with `boundingBox`, `appearance`, `valueRef`
- `src/assets/values/irs_1040_2025.sample.json` — nested `taxReturn`
- `src/app/utils/path-resolver.ts` — resolver

### 2:00 – Live demo

1. Run `npm start`, open localhost:4200.
2. Upload an IRS Form 1040 (2025) PDF.
3. Walk processing stages: upload → detect → template → values → render.
4. Toggle **Bounding boxes** and **Values** on.
5. Click a wages field → Inspector shows JSONPath `$.income.w2Forms[0].wages` and formatted currency.
6. Toggle **Binding paths** to show paths on the overlay.
7. Edit a value in the inspector → overlay updates immediately.

> The playground is a reference consumer of the spec — a production print engine would use the same template + path resolution against your proprietary tax data.

### 4:00 – Closing

> To adopt this: author a template per form/year, keep your nested tax-return schema, and resolve `valueRef.path` at print time. Extending to 1120-S or 1065 is a new template file, not a new renderer.
>
> Spec, schema, sample data, and demo are all in the repo. Thanks!

---

## Recording checklist

- [ ] Clean desktop / hide unrelated tabs
- [ ] Font size readable (zoom editor to ~125%)
- [ ] Have a Form 1040 PDF ready before you start
- [ ] Keep total under 5:00
- [ ] Paste Loom link in the submission email / README
