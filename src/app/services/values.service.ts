import { Injectable, signal } from '@angular/core';
import { ExtractedValue, ExtractedValuesDocument, FieldMeta } from '../models/extracted-value.model';
import { getValuePath } from '../models/annotation.model';
import {
  hasCollectionPlaceholder,
  materializeCollectionPath,
  resolvePath,
  valueToRawString,
} from '../utils/path-resolver';
import { PdfFormField } from './pdf.service';

/** Maps IRS 1040 AcroForm field ids → nested JSONPath into taxReturn. */
const PDF_FIELD_PATHS: Record<string, string> = {
  f1_14: '$.taxpayer.legal.firstName',
  f1_15: '$.taxpayer.legal.lastName',
  f1_16: '$.taxpayer.identifiers.ssn',
  f1_17: '$.spouse.legal.firstName',
  f1_18: '$.spouse.legal.lastName',
  f1_19: '$.spouse.identifiers.ssn',
  f1_20: '$.address.street',
  f1_21: '$.address.aptNumber',
  f1_22: '$.address.city',
  f1_23: '$.address.state',
  f1_24: '$.address.zipCode',
  f1_31: '$.dependents[0].legal.firstName',
  f1_32: '$.dependents[1].legal.firstName',
  f1_35: '$.dependents[0].legal.lastName',
  f1_36: '$.dependents[1].legal.lastName',
  f1_39: '$.dependents[0].identifiers.ssn',
  f1_40: '$.dependents[1].identifiers.ssn',
  f1_43: '$.dependents[0].relationship',
  f1_44: '$.dependents[1].relationship',
};

/** Annotation id → nested path (for sample / PDF overlays). */
const ANNOTATION_PATHS: Record<string, string> = {
  'taxpayer.firstName': '$.taxpayer.legal.firstName',
  'taxpayer.lastName': '$.taxpayer.legal.lastName',
  'taxpayer.ssn': '$.taxpayer.identifiers.ssn',
  'taxpayer.dateOfBirth': '$.taxpayer.dateOfBirth',
  'spouse.firstName': '$.spouse.legal.firstName',
  'spouse.lastName': '$.spouse.legal.lastName',
  'spouse.ssn': '$.spouse.identifiers.ssn',
  'address.street': '$.address.street',
  'address.aptNumber': '$.address.aptNumber',
  'address.city': '$.address.city',
  'address.state': '$.address.state',
  'address.zipCode': '$.address.zipCode',
  'dependents[0].firstName': '$.dependents[0].legal.firstName',
  'dependents[1].firstName': '$.dependents[1].legal.firstName',
  'dependents[0].lastName': '$.dependents[0].legal.lastName',
  'dependents[1].lastName': '$.dependents[1].legal.lastName',
  'dependents[0].ssn': '$.dependents[0].identifiers.ssn',
  'dependents[1].ssn': '$.dependents[1].identifiers.ssn',
  'dependents[0].relationship': '$.dependents[0].relationship',
  'dependents[1].relationship': '$.dependents[1].relationship',
  'employer.companyName': '$.income.w2Forms[0].employer.name',
  'employer.ein': '$.income.w2Forms[0].employer.ein',
  'income.wages': '$.income.w2Forms[0].wages',
  'income.taxableInterest': '$.income.interest.taxable',
  'filingStatus.single': '$.filingStatus.single',
  'dependents.item.firstName': '$.dependents[0].legal.firstName',
  'dependents.item.ssn': '$.dependents[0].identifiers.ssn',
  'dependents.item.relationship': '$.dependents[0].relationship',
};

@Injectable({ providedIn: 'root' })
export class ValuesService {
  readonly valuesDocument = signal<ExtractedValuesDocument | null>(null);
  private readonly overrideMap = signal<Map<string, ExtractedValue>>(new Map());

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
    const extractedValues: Record<string, ExtractedValue> = {};
    const taxReturn: Record<string, unknown> = {};

    for (const field of fields) {
      const path = PDF_FIELD_PATHS[field.id];
      if (!path || field.value === '' || field.value === null || field.value === undefined) {
        continue;
      }
      const annotationId =
        Object.entries(ANNOTATION_PATHS).find(([, p]) => p === path)?.[0] ?? field.id;

      extractedValues[annotationId] = {
        annotationId,
        value: field.value,
        confidence: 1,
        source: 'pdf-form',
      };
      this.assignByPath(taxReturn, path, field.value);
    }

    if (Object.keys(extractedValues).length === 0) {
      return false;
    }

    this.setDocument({
      formId,
      extractedAt: new Date().toISOString(),
      taxReturn: taxReturn as ExtractedValuesDocument['taxReturn'],
      values: extractedValues,
    });
    return true;
  }

  setDocument(doc: ExtractedValuesDocument): void {
    this.valuesDocument.set(doc);
    const map = new Map<string, ExtractedValue>();

    if (doc.values) {
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
    }

    this.overrideMap.set(map);
  }

  /**
   * Resolve a display value for an annotation.
   * Precedence: manual/PDF override → nested taxReturn via valueRef path → empty.
   */
  resolveForAnnotation(
    annotationId: string,
    valuePath?: string,
    collectionIndex = 0,
  ): ExtractedValue | undefined {
    const override = this.overrideMap().get(annotationId);
    if (override) {
      return override;
    }

    const path =
      valuePath ??
      ANNOTATION_PATHS[annotationId] ??
      undefined;

    if (!path) {
      return undefined;
    }

    const concrete = hasCollectionPlaceholder(path)
      ? materializeCollectionPath(path, collectionIndex)
      : path;

    const doc = this.valuesDocument();
    if (!doc?.taxReturn) {
      return undefined;
    }

    const raw = resolvePath(doc.taxReturn, concrete);
    if (raw === undefined || raw === null) {
      return undefined;
    }

    const meta = this.getMeta(annotationId);
    return {
      annotationId,
      value: raw as string | number | boolean | null,
      confidence: meta?.confidence,
      source: meta?.source ?? 'taxReturn',
    };
  }

  getValue(annotationId: string): ExtractedValue | undefined {
    return this.resolveForAnnotation(annotationId);
  }

  getDisplayValue(annotationId: string, valuePath?: string, collectionIndex = 0): string {
    const entry = this.resolveForAnnotation(annotationId, valuePath, collectionIndex);
    if (!entry || entry.value === null || entry.value === undefined) {
      return '';
    }
    return valueToRawString(entry.value);
  }

  getPathForAnnotation(annotationId: string, nodePath?: string): string | undefined {
    return nodePath ?? ANNOTATION_PATHS[annotationId];
  }

  updateValue(annotationId: string, value: string): void {
    const current = this.overrideMap();
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
      const path = ANNOTATION_PATHS[annotationId];
      const taxReturn = doc.taxReturn ? structuredClone(doc.taxReturn) : {};
      if (path) {
        this.assignByPath(taxReturn, path, value);
      }

      const newValues = { ...(doc.values ?? {}) };
      newValues[annotationId] = newEntry;

      this.valuesDocument.set({ ...doc, taxReturn, values: newValues });
    }

    this.overrideMap.set(updated);
  }

  clear(): void {
    this.valuesDocument.set(null);
    this.overrideMap.set(new Map());
  }

  private getMeta(annotationId: string): FieldMeta | undefined {
    return this.valuesDocument()?.meta?.[annotationId];
  }

  /** Assign a leaf value into a nested object given a concrete JSONPath. */
  private assignByPath(root: Record<string, unknown>, path: string, value: unknown): void {
    const segments: Array<string | number> = [];
    const re = /\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(path)) !== null) {
      if (match[1] !== undefined) {
        segments.push(match[1]);
      } else {
        segments.push(Number(match[2]));
      }
    }

    let cursor: Record<string, unknown> | unknown[] = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i];
      const nextKey = segments[i + 1];
      if (typeof key === 'number') {
        const arr = cursor as unknown[];
        if (arr[key] === undefined) {
          arr[key] = typeof nextKey === 'number' ? [] : {};
        }
        cursor = arr[key] as Record<string, unknown> | unknown[];
      } else {
        const obj = cursor as Record<string, unknown>;
        if (obj[key] === undefined) {
          obj[key] = typeof nextKey === 'number' ? [] : {};
        }
        cursor = obj[key] as Record<string, unknown> | unknown[];
      }
    }

    const last = segments[segments.length - 1];
    if (typeof last === 'number') {
      (cursor as unknown[])[last] = value;
    } else {
      (cursor as Record<string, unknown>)[last] = value;
    }
  }
}

/** Re-export helper for callers that already have a node. */
export function pathFromNode(node: { valueRef?: { path: string }; bindingPath?: string }): string | undefined {
  return getValuePath(node);
}
