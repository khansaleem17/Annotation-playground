import { Injectable, signal, computed } from '@angular/core';
import {
  DEFAULT_TOGGLES,
  FormIdentifier,
  PlaygroundToggles,
  ProcessingStage,
  TemplateStats,
} from '../models/annotation.model';

@Injectable({ providedIn: 'root' })
export class PlaygroundStateService {
  readonly selectedAnnotationId = signal<string | null>(null);
  readonly toggles = signal<PlaygroundToggles>({ ...DEFAULT_TOGGLES });
  readonly stats = signal<TemplateStats>({ fields: 0, groups: 0, collections: 0 });
  readonly formId = signal<FormIdentifier | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly statusMessage = signal('Ready');
  readonly processingStages = signal<ProcessingStage[]>([]);
  readonly isProcessing = signal(false);

  readonly selectedId = computed(() => this.selectedAnnotationId());

  selectAnnotation(id: string | null): void {
    this.selectedAnnotationId.set(id);
  }

  toggle(key: keyof PlaygroundToggles): void {
    this.toggles.update((t) => ({ ...t, [key]: !t[key] }));
  }

  setToggle(key: keyof PlaygroundToggles, value: boolean): void {
    this.toggles.update((t) => ({ ...t, [key]: value }));
  }

  setStats(stats: TemplateStats): void {
    this.stats.set(stats);
  }

  setStatus(message: string): void {
    this.statusMessage.set(message);
  }

  initProcessingStages(): void {
    this.processingStages.set([
      { id: 'upload', label: 'Upload PDF', status: 'pending' },
      { id: 'detect', label: 'Detect Form', status: 'pending' },
      { id: 'template', label: 'Load Template', status: 'pending' },
      { id: 'values', label: 'Load Form Values', status: 'pending' },
      { id: 'render', label: 'Render Annotations', status: 'pending' },
    ]);
  }

  updateStage(id: string, status: ProcessingStage['status'], message?: string): void {
    this.processingStages.update((stages) =>
      stages.map((s) => (s.id === id ? { ...s, status, message } : s)),
    );
  }

  reset(): void {
    this.selectedAnnotationId.set(null);
    this.toggles.set({ ...DEFAULT_TOGGLES });
    this.stats.set({ fields: 0, groups: 0, collections: 0 });
    this.formId.set(null);
    this.fileName.set(null);
    this.statusMessage.set('Ready');
    this.processingStages.set([]);
    this.isProcessing.set(false);
  }
}
