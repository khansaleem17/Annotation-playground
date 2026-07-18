import { Injectable, signal } from '@angular/core';
import { ExtractedValue, ExtractedValuesDocument } from '../models/extracted-value.model';
import { PdfFormField } from './pdf.service';

@Injectable({ providedIn: 'root' })
export class ValuesService {
  readonly valuesDocument = signal<ExtractedValuesDocument | null>(null);
  private readonly valueMap = signal<Map<string, ExtractedValue>>(new Map());

  async loadValues(path: string): Promise<ExtractedValuesDocument> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load values: ${response.statusText}`);
    }
    const doc = (await response.json()) as ExtractedValuesDocument;
    this.setDocument(doc);
    return doc;
  }

  setPdfFormValues(formId: string, fields: PdfFormField[]): boolean {
    const fieldBindings: Record<string, string> = {
      // IRS Form 1040 (2025) AcroForm fields.
      f1_14: 'taxpayer.firstName',
      f1_15: 'taxpayer.lastName',
      f1_16: 'taxpayer.ssn',
      f1_17: 'spouse.firstName',
      f1_18: 'spouse.lastName',
      f1_19: 'spouse.ssn',
      f1_20: 'address.street',
      f1_21: 'address.aptNumber',
      f1_22: 'address.city',
      f1_23: 'address.state',
      f1_24: 'address.zipCode',
      f1_31: 'dependents[0].firstName',
      f1_32: 'dependents[1].firstName',
      f1_35: 'dependents[0].lastName',
      f1_36: 'dependents[1].lastName',
      f1_39: 'dependents[0].ssn',
      f1_40: 'dependents[1].ssn',
      f1_43: 'dependents[0].relationship',
      f1_44: 'dependents[1].relationship',
    };
    const extractedValues: ExtractedValuesDocument['values'] = {};

    for (const field of fields) {
      const annotationId = fieldBindings[field.id];
      if (annotationId) {
        extractedValues[annotationId] = {
          annotationId,
          value: field.value,
          confidence: 1,
          source: 'pdf-form',
        };
      }
    }

    if (Object.keys(extractedValues).length === 0) {
      return false;
    }

    this.setDocument({
      formId,
      extractedAt: new Date().toISOString(),
      values: extractedValues,
    });
    return true;
  }

  setDocument(doc: ExtractedValuesDocument): void {
    this.valuesDocument.set(doc);
    const map = new Map<string, ExtractedValue>();

    for (const [key, entry] of Object.entries(doc.values)) {
      if (Array.isArray(entry)) {
        entry.forEach((item, index) => {
          map.set(`${key}[${index}]`, item);
          map.set(item.annotationId, item);
        });
      } else {
        map.set(key, entry);
        map.set(entry.annotationId, entry);
      }
    }

    this.valueMap.set(map);
  }

  getValue(annotationId: string): ExtractedValue | undefined {
    return this.valueMap().get(annotationId);
  }

  getDisplayValue(annotationId: string): string {
    const entry = this.getValue(annotationId);
    if (!entry || entry.value === null || entry.value === undefined) {
      return '';
    }
    return String(entry.value);
  }

  updateValue(annotationId: string, value: string): void {
    const current = this.valueMap();
    const existing = current.get(annotationId);
    const updated = new Map(current);

    const newEntry: ExtractedValue = {
      annotationId,
      value,
      confidence: existing?.confidence,
      source: existing?.source ?? 'manual',
    };

    updated.set(annotationId, newEntry);

    const doc = this.valuesDocument();
    if (doc) {
      const newValues = { ...doc.values };
      if (annotationId in newValues && !Array.isArray(newValues[annotationId])) {
        newValues[annotationId] = newEntry;
      } else {
        for (const [key, entry] of Object.entries(newValues)) {
          if (Array.isArray(entry)) {
            const idx = entry.findIndex((e) => e.annotationId === annotationId);
            if (idx >= 0) {
              newValues[key] = entry.map((e, i) => (i === idx ? newEntry : e));
            }
          } else if (entry.annotationId === annotationId) {
            newValues[key] = newEntry;
          }
        }
      }
      this.valuesDocument.set({ ...doc, values: newValues });
    }

    this.valueMap.set(updated);
  }

  clear(): void {
    this.valuesDocument.set(null);
    this.valueMap.set(new Map());
  }
}
