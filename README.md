# Instead Annotation Playground

An internal engineering prototype for visualizing tax form annotation specifications. Upload a PDF, detect the form type, load the matching template and sample values, and inspect annotations overlaid on the rendered document.

## Tech Stack

- Angular 20 (standalone components, signals)
- PDF.js for PDF rendering and text extraction
- Tailwind CSS v4
- TypeScript

## Getting Started

```bash
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200).

## Usage

1. Upload an IRS Form 1040 (2025) PDF on the landing page.
2. Watch the processing pipeline detect the form and load assets.
3. Explore annotations in the tree, PDF overlay, and inspector panels.
4. Toggle bounding boxes, values, confidence, semantic metadata, and binding paths from the toolbar.
5. Edit values in the inspector — changes re-render immediately (in-memory only).

## Form Detection

Page 1 text is extracted via PDF.js. If the content includes **Form 1040** and **2025**, the form is identified as `irs_1040_2025`.

## Project Structure

```
src/app/
  components/     # UI components (landing, toolbar, pdf-viewer, tree, inspector, status-bar)
  services/       # Business logic (PDF, detection, template, values, renderer, registry)
  models/         # TypeScript interfaces
  pages/          # Route-level pages
src/assets/
  templates/      # Annotation template JSON
  values/         # Sample extracted values JSON
```

## Adding a New Form

1. Add template JSON under `src/assets/templates/`.
2. Add sample values under `src/assets/values/`.
3. Register the form in `TemplateRegistryService`.
4. Extend `FormDetectionService` with detection rules.

## Architecture Notes

- **AnnotationRendererService** is a pure rendering engine (no Angular dependencies).
- Overlays use normalized coordinates converted to pixel positions at render time.
- State is managed with Angular signals across services and components.
- No backend, persistence, or authentication — everything runs in the browser.
