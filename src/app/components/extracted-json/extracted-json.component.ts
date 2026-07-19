import { Component, computed, inject, signal } from '@angular/core';
import { ValuesService } from '../../services/values.service';
import { PlaygroundStateService } from '../../services/playground-state.service';

type JsonTab = 'taxReturn' | 'full';

@Component({
  selector: 'app-extracted-json',
  standalone: true,
  templateUrl: './extracted-json.component.html',
  styleUrl: './extracted-json.component.css',
})
export class ExtractedJsonComponent {
  private readonly valuesService = inject(ValuesService);
  readonly state = inject(PlaygroundStateService);

  readonly activeTab = signal<JsonTab>('taxReturn');
  readonly copied = signal(false);

  readonly document = this.valuesService.valuesDocument;

  readonly jsonText = computed(() => {
    const doc = this.document();
    if (!doc) {
      return '// No extracted values loaded yet.';
    }

    if (this.activeTab() === 'taxReturn') {
      return JSON.stringify(
        {
          formId: doc.formId,
          extractedAt: doc.extractedAt,
          taxReturn: doc.taxReturn ?? {},
        },
        null,
        2,
      );
    }

    return JSON.stringify(doc, null, 2);
  });

  setTab(tab: JsonTab): void {
    this.activeTab.set(tab);
  }

  async copyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.jsonText());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1600);
    } catch {
      // Clipboard may be blocked; ignore.
    }
  }
}
