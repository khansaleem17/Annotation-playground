import { Injectable, signal } from '@angular/core';
import { FormIdentifier } from '../models/annotation.model';

export interface TemplateAssets {
  templatePath: string;
  valuesPath: string;
  displayName: string;
  taxYear: number;
}

@Injectable({ providedIn: 'root' })
export class TemplateRegistryService {
  private readonly registry = new Map<FormIdentifier, TemplateAssets>([
    [
      'irs_1040_2025',
      {
        templatePath: 'assets/templates/irs_1040_2025.json',
        valuesPath: 'assets/values/irs_1040_2025.sample.json',
        displayName: 'IRS Form 1040',
        taxYear: 2025,
      },
    ],
  ]);

  readonly supportedForms = signal(
    Array.from(this.registry.entries()).map(([id, assets]) => ({
      id,
      ...assets,
    })),
  );

  resolve(formId: FormIdentifier): TemplateAssets | null {
    return this.registry.get(formId) ?? null;
  }

  isSupported(formId: FormIdentifier): boolean {
    return this.registry.has(formId);
  }

  register(formId: FormIdentifier, assets: TemplateAssets): void {
    this.registry.set(formId, assets);
    this.supportedForms.set(
      Array.from(this.registry.entries()).map(([id, entry]) => ({
        id,
        ...entry,
      })),
    );
  }
}
