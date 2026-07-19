import { Injectable, signal } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface PdfPageDimensions {
  width: number;
  height: number;
  scale: number;
}

export interface PdfFormField {
  id: string;
  value: string;
  pageNumber: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  readonly pdfDocument = signal<PDFDocumentProxy | null>(null);
  readonly currentPage = signal(1);
  readonly scale = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private pdfData: ArrayBuffer | null = null;

  async loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
    this.loading.set(true);
    this.error.set(null);
    this.pdfData = data.slice(0);

    try {
      // PDF.js transfers the supplied buffer to its worker, which detaches that
      // buffer in the main thread. Keep `pdfData` intact for later processing
      // stages (such as form detection) and give the viewer its own copy.
      const doc = await pdfjsLib.getDocument({ data: this.pdfData.slice(0) }).promise;
      this.pdfDocument.set(doc);
      this.currentPage.set(1);
      return doc;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load PDF';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async renderPageToCanvas(
    canvas: HTMLCanvasElement,
    pageNumber: number,
    scale: number,
  ): Promise<PdfPageDimensions> {
    const doc = this.pdfDocument();
    if (!doc) {
      throw new Error('No PDF loaded');
    }

    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Disable native AcroForm painting — we overlay values from the annotation spec.
    // Avoids missing-standard-font failures on some filled IRS PDFs.
    await page.render({
      canvasContext: context,
      viewport,
      canvas,
      annotationMode: 0, // AnnotationMode.DISABLE
    }).promise;

    return {
      width: viewport.width,
      height: viewport.height,
      scale,
    };
  }

  async getPage(pageNumber: number): Promise<PDFPageProxy> {
    const doc = this.pdfDocument();
    if (!doc) {
      throw new Error('No PDF loaded');
    }
    return doc.getPage(pageNumber);
  }

  getPageCount(): number {
    return this.pdfDocument()?.numPages ?? 0;
  }

  zoomIn(): void {
    this.scale.update((s) => Math.min(s + 0.15, 3));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(s - 0.15, 0.25));
  }

  fitWidth(containerWidth: number): void {
    const doc = this.pdfDocument();
    if (!doc || containerWidth <= 0) {
      return;
    }

    doc.getPage(this.currentPage()).then((page) => {
      const viewport = page.getViewport({ scale: 1 });
      const fitScale = (containerWidth - 48) / viewport.width;
      this.scale.set(Math.max(0.25, Math.min(fitScale, 3)));
    });
  }

  setScale(scale: number): void {
    this.scale.set(Math.max(0.25, Math.min(scale, 3)));
  }

  getPdfData(): ArrayBuffer | null {
    return this.pdfData;
  }

  async getFormFields(): Promise<PdfFormField[]> {
    const doc = this.pdfDocument();
    if (!doc) {
      throw new Error('No PDF loaded');
    }

    const formFields: PdfFormField[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const annotations = (await page.getAnnotations()) as Array<{
        fieldName?: string;
        fieldValue?: unknown;
        rect?: number[];
      }>;

      for (const annotation of annotations) {
        // Include widgets even when empty so we can still place bounding boxes.
        if (!annotation.fieldName || !annotation.rect || annotation.rect.length !== 4) {
          continue;
        }

        const rawValue = annotation.fieldValue;
        const value =
          typeof rawValue === 'string'
            ? rawValue.trim()
            : rawValue === null || rawValue === undefined
              ? ''
              : String(rawValue);

        // Skip unchecked checkboxes ("Off") — they are not printable values.
        if (value === 'Off') {
          continue;
        }

        const [x1, y1, x2, y2] = annotation.rect;
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const bottom = Math.min(y1, y2);
        const top = Math.max(y1, y2);

        formFields.push({
          id: this.getFieldId(annotation.fieldName),
          value,
          pageNumber,
          boundingBox: {
            x: left / viewport.width,
            y: 1 - top / viewport.height,
            width: (right - left) / viewport.width,
            height: (top - bottom) / viewport.height,
          },
        });
      }
    }

    return formFields;
  }

  clear(): void {
    const doc = this.pdfDocument();
    if (doc) {
      void doc.cleanup();
    }
    this.pdfDocument.set(null);
    this.pdfData = null;
    this.currentPage.set(1);
    this.scale.set(1);
    this.error.set(null);
  }

  private getFieldId(name: string): string {
    return name.match(/(f\d+_\d+)(?:\[\d+\])?$/)?.[1] ?? name;
  }
}
