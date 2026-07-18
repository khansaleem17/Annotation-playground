import {
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
  effect,
  signal,
  computed,
  output,
} from '@angular/core';
import { AnnotationRendererService } from '../../services/annotation-renderer.service';
import { PdfService } from '../../services/pdf.service';
import { PlaygroundStateService } from '../../services/playground-state.service';
import { TemplateService } from '../../services/template.service';
import { ValuesService } from '../../services/values.service';
import { RenderedAnnotation } from '../../models/annotation.model';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  templateUrl: './pdf-viewer.component.html',
  styleUrl: './pdf-viewer.component.css',
})
export class PdfViewerComponent {
  private readonly pdfService = inject(PdfService);
  private readonly templateService = inject(TemplateService);
  private readonly valuesService = inject(ValuesService);
  private readonly renderer = inject(AnnotationRendererService);
  readonly state = inject(PlaygroundStateService);

  containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  pageNumber = input(1);
  annotationClick = output<string>();

  readonly scale = this.pdfService.scale;
  private readonly pageWidth = signal(0);
  private readonly pageHeight = signal(0);

  readonly renderedAnnotations = computed(() => {
    const template = this.templateService.template();
    const width = this.pageWidth();
    const height = this.pageHeight();

    if (!template || width === 0 || height === 0) {
      return [] as RenderedAnnotation[];
    }

    const toggles = this.state.toggles();
    this.valuesService.valuesDocument();

    return this.renderer.renderPage(template, {
      pageWidth: width,
      pageHeight: height,
      pageNumber: this.pageNumber(),
      showBoundingBoxes: toggles.boundingBoxes,
      showValues: toggles.values,
      showConfidence: toggles.confidence,
      showSemanticMetadata: toggles.semanticMetadata,
      showBindingPaths: toggles.bindingPaths,
    });
  });

  constructor() {
    effect(() => {
      const scale = this.pdfService.scale();
      const doc = this.pdfService.pdfDocument();
      const page = this.pageNumber();
      if (doc) {
        void this.renderCanvas(page, scale);
      }
    });
  }

  private async renderCanvas(pageNumber: number, scale: number): Promise<void> {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    try {
      const dims = await this.pdfService.renderPageToCanvas(canvas, pageNumber, scale);
      this.pageWidth.set(dims.width);
      this.pageHeight.set(dims.height);
    } catch {
      // Canvas not ready yet
    }
  }

  onAnnotationClick(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.state.selectAnnotation(id);
    this.annotationClick.emit(id);
  }

  onCanvasClick(): void {
    this.state.selectAnnotation(null);
  }

  fitWidth(): void {
    const container = this.containerRef()?.nativeElement;
    if (container) {
      this.pdfService.fitWidth(container.clientWidth);
    }
  }

  isSelected(id: string): boolean {
    return this.state.selectedAnnotationId() === id;
  }

  showValue(ann: RenderedAnnotation): boolean {
    return this.state.toggles().values && !!ann.displayValue;
  }

  showConfidence(ann: RenderedAnnotation): boolean {
    return this.state.toggles().confidence && ann.confidence !== undefined;
  }

  showBinding(ann: RenderedAnnotation): boolean {
    return this.state.toggles().bindingPaths && !!ann.bindingPath;
  }

  showSemantic(ann: RenderedAnnotation): boolean {
    return this.state.toggles().semanticMetadata && !!ann.semanticEntity;
  }

  showBox(): boolean {
    return this.state.toggles().boundingBoxes;
  }

  formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }
}
