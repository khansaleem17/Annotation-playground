import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
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
  private readonly destroyRef = inject(DestroyRef);
  readonly state = inject(PlaygroundStateService);

  containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  pageNumber = input(1);
  annotationClick = output<string>();

  readonly scale = this.pdfService.scale;
  private readonly pageWidth = signal(0);
  private readonly pageHeight = signal(0);
  /** True once the container has a measured width and fit-width scale is applied. */
  private readonly layoutReady = signal(false);
  private renderGeneration = 0;
  private resizeObserver: ResizeObserver | null = null;
  private lastFitWidth = 0;

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
    afterNextRender(() => this.observeContainer());

    effect(() => {
      const scale = this.pdfService.scale();
      const doc = this.pdfService.pdfDocument();
      const page = this.pageNumber();
      const canvas = this.canvasRef()?.nativeElement;
      const ready = this.layoutReady();
      // Wait for fit-width so we never paint at the default scale=1 and then
      // race a second render that can leave the canvas distorted.
      if (doc && canvas && ready) {
        void this.renderCanvas(canvas, page, scale);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
    });
  }

  private observeContainer(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container) {
      return;
    }

    const applyLayout = (width: number) => {
      if (width <= 0) {
        return;
      }
      // Ignore sub-pixel noise; always fit on the first real measurement.
      if (this.lastFitWidth > 0 && Math.abs(this.lastFitWidth - width) < 2) {
        return;
      }
      this.lastFitWidth = width;
      void this.pdfService.fitWidth(width).then(() => {
        this.layoutReady.set(true);
      });
    };

    applyLayout(container.clientWidth);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        applyLayout(container.clientWidth);
      });
      this.resizeObserver.observe(container);
    }
  }

  private async renderCanvas(
    canvas: HTMLCanvasElement,
    pageNumber: number,
    scale: number,
  ): Promise<void> {
    const generation = ++this.renderGeneration;
    try {
      const dims = await this.pdfService.renderPageToCanvas(canvas, pageNumber, scale);
      if (generation !== this.renderGeneration) {
        return;
      }
      this.pageWidth.set(dims.width);
      this.pageHeight.set(dims.height);
    } catch (err) {
      if (this.isRenderCancelled(err)) {
        return;
      }
      // Canvas/PDF not ready yet — a later effect run will retry.
    }
  }

  private isRenderCancelled(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'RenderingCancelledException'
    );
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
    if (container && container.clientWidth > 0) {
      this.lastFitWidth = container.clientWidth;
      void this.pdfService.fitWidth(container.clientWidth).then(() => {
        this.layoutReady.set(true);
      });
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
