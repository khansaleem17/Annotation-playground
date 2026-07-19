import { Component, inject, viewChild, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToolbarComponent } from '../../components/toolbar/toolbar.component';
import { PdfViewerComponent } from '../../components/pdf-viewer/pdf-viewer.component';
import { AnnotationTreeComponent } from '../../components/annotation-tree/annotation-tree.component';
import { InspectorComponent } from '../../components/inspector/inspector.component';
import { StatusBarComponent } from '../../components/status-bar/status-bar.component';
import { ExtractedJsonComponent } from '../../components/extracted-json/extracted-json.component';
import { PdfService } from '../../services/pdf.service';
import { FormDetectionService } from '../../services/form-detection.service';
import { TemplateRegistryService } from '../../services/template-registry.service';
import { TemplateService } from '../../services/template.service';
import { ValuesService } from '../../services/values.service';
import { AnnotationRendererService } from '../../services/annotation-renderer.service';
import { PlaygroundStateService } from '../../services/playground-state.service';
import { ProcessingStage } from '../../models/annotation.model';
import { PdfFormField } from '../../services/pdf.service';

const STAGE_DELAY_MS = 450;

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [
    RouterLink,
    ToolbarComponent,
    PdfViewerComponent,
    AnnotationTreeComponent,
    InspectorComponent,
    StatusBarComponent,
    ExtractedJsonComponent,
  ],
  templateUrl: './playground.component.html',
  styleUrl: './playground.component.css',
})
export class PlaygroundPage implements OnInit {
  private readonly router = inject(Router);
  private readonly pdfService = inject(PdfService);
  private readonly formDetection = inject(FormDetectionService);
  private readonly registry = inject(TemplateRegistryService);
  private readonly templateService = inject(TemplateService);
  private readonly valuesService = inject(ValuesService);
  private readonly renderer = inject(AnnotationRendererService);
  readonly state = inject(PlaygroundStateService);

  pdfViewer = viewChild(PdfViewerComponent);

  readonly showPlayground = signal(false);
  readonly processingError = signal<string | null>(null);

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state ?? history.state;
    const pdfFile = state?.['pdfFile'] as File | undefined;

    if (!pdfFile) {
      void this.router.navigate(['/']);
      return;
    }

    void this.runPipeline(pdfFile, state?.['fileName'] ?? pdfFile.name);
  }

  private async runPipeline(file: File, fileName: string): Promise<void> {
    this.state.reset();
    this.state.fileName.set(fileName);
    this.state.isProcessing.set(true);
    this.state.initProcessingStages();
    this.processingError.set(null);
    let pdfFormFields: PdfFormField[] = [];

    try {
      await this.runStage('upload', async () => {
        this.state.setStatus('Uploading PDF…');
        const buffer = await file.arrayBuffer();
        await this.pdfService.loadPdf(buffer);
      });

      const pdfData = this.pdfService.getPdfData();
      if (!pdfData) {
        throw new Error('PDF data unavailable after upload');
      }

      const formId = await this.runStage('detect', async () => {
        this.state.setStatus('Detecting form type…');
        const result = await this.formDetection.detectForm(pdfData);
        if (!result.formId) {
          throw new Error(
            'Could not detect a supported form. Expected "Form 1040" and "2025" on page 1.',
          );
        }
        this.state.formId.set(result.formId);
        return result.formId;
      });

      const assets = this.registry.resolve(formId);
      if (!assets) {
        throw new Error(`No template registered for form: ${formId}`);
      }

      await this.runStage('template', async () => {
        this.state.setStatus('Loading annotation template…');
        await this.templateService.loadTemplate(assets.templatePath);
      });

      await this.runStage('values', async () => {
        this.state.setStatus('Reading form values…');
        pdfFormFields = await this.pdfService.getFormFields();
        this.templateService.applyPdfFormGeometry(formId, pdfFormFields);
        const loadedFormValues = this.valuesService.setPdfFormValues(formId, pdfFormFields);

        if (!loadedFormValues) {
          this.state.setStatus('Loading sample extracted values…');
          await this.valuesService.loadValues(assets.valuesPath);
        }
      });

      await this.runStage('render', async () => {
        this.state.setStatus('Rendering annotations…');
        const template = this.templateService.template();
        if (template) {
          this.state.setStats(this.renderer.computeStats(template));
        }
        await this.delay(STAGE_DELAY_MS);
      });

      this.state.setStatus('Ready');
      this.showPlayground.set(true);

      // Fit width after the viewer mounts; retry once in case layout isn't ready.
      setTimeout(() => this.pdfViewer()?.fitWidth(), 50);
      setTimeout(() => this.pdfViewer()?.fitWidth(), 250);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      this.processingError.set(message);
      this.state.setStatus(`Error: ${message}`);
      this.state.processingStages.update((stages) => {
        const activeIdx = stages.findIndex((s) => s.status === 'active');
        if (activeIdx >= 0) {
          return stages.map((s, i) =>
            i === activeIdx ? { ...s, status: 'error' as const, message } : s,
          );
        }
        return stages;
      });
    } finally {
      this.state.isProcessing.set(false);
    }
  }

  private async runStage<T>(id: string, fn: () => Promise<T>): Promise<T> {
    this.state.updateStage(id, 'active');
    await this.delay(200);
    const result = await fn();
    this.state.updateStage(id, 'complete');
    await this.delay(STAGE_DELAY_MS);
    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  onZoomIn(): void {
    this.pdfService.zoomIn();
  }

  onZoomOut(): void {
    this.pdfService.zoomOut();
  }

  onFitWidth(): void {
    this.pdfViewer()?.fitWidth();
  }

  stageIcon(stage: ProcessingStage): string {
    switch (stage.status) {
      case 'complete':
        return '✓';
      case 'active':
        return '●';
      case 'error':
        return '✗';
      default:
        return '○';
    }
  }
}
