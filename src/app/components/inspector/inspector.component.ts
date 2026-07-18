import { Component, inject, computed, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnnotationRendererService } from '../../services/annotation-renderer.service';
import { PlaygroundStateService } from '../../services/playground-state.service';
import { TemplateService } from '../../services/template.service';
import { ValuesService } from '../../services/values.service';
import { FlatAnnotation, getValuePath } from '../../models/annotation.model';

@Component({
  selector: 'app-inspector',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './inspector.component.html',
  styleUrl: './inspector.component.css',
})
export class InspectorComponent {
  private readonly templateService = inject(TemplateService);
  private readonly valuesService = inject(ValuesService);
  private readonly renderer = inject(AnnotationRendererService);
  readonly state = inject(PlaygroundStateService);

  readonly editValue = signal('');

  readonly selectedAnnotation = computed((): FlatAnnotation | null => {
    const id = this.state.selectedAnnotationId();
    const template = this.templateService.template();
    if (!id || !template) {
      return null;
    }
    return this.renderer.findFlatAnnotation(template, id) ?? null;
  });

  readonly currentValue = computed(() => {
    const ann = this.selectedAnnotation();
    if (!ann) {
      return '';
    }
    return this.valuesService.getDisplayValue(
      ann.id,
      getValuePath(ann),
      ann.collectionIndex ?? 0,
    );
  });

  readonly valuePath = computed(() => {
    const ann = this.selectedAnnotation();
    return ann ? getValuePath(ann) : undefined;
  });

  readonly extractedConfidence = computed(() => {
    const ann = this.selectedAnnotation();
    if (!ann) {
      return undefined;
    }
    const extracted = this.valuesService.resolveForAnnotation(
      ann.id,
      getValuePath(ann),
      ann.collectionIndex ?? 0,
    );
    return extracted?.confidence ?? ann.extractionConfidence;
  });

  constructor() {
    effect(() => {
      this.editValue.set(this.currentValue());
    });
  }

  onValueChange(value: string): void {
    const ann = this.selectedAnnotation();
    if (ann) {
      this.valuesService.updateValue(ann.id, value);
    }
  }

  formatBox(box: { x: number; y: number; width: number; height: number } | undefined): string {
    if (!box) {
      return '—';
    }
    return `x:${box.x.toFixed(4)} y:${box.y.toFixed(4)} w:${box.width.toFixed(4)} h:${box.height.toFixed(4)}`;
  }

  formatConfidence(confidence: number | undefined): string {
    if (confidence === undefined) {
      return '—';
    }
    return `${Math.round(confidence * 100)}%`;
  }

  formatJson(obj: unknown): string {
    if (!obj) {
      return '—';
    }
    return JSON.stringify(obj, null, 2);
  }
}
