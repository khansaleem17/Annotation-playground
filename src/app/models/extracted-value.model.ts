import { JsonObject } from '../utils/path-resolver';

export interface ExtractedValue {
  annotationId: string;
  value: string | number | boolean | null;
  confidence?: number;
  source?: string;
}

export interface FieldMeta {
  confidence?: number;
  source?: string;
}

/**
 * Nested tax-return document.
 * Values are resolved via JSONPath (valueRef.path) against `taxReturn`.
 */
export interface ExtractedValuesDocument {
  formId: string;
  extractedAt?: string;
  /** Deeply nested tax return payload — primary source of truth for printing */
  taxReturn?: JsonObject;
  /**
   * Optional flat map for PDF AcroForm / OCR overrides keyed by annotation id
   * or legacy path. Takes precedence over taxReturn when present.
   */
  values?: Record<string, ExtractedValue | ExtractedValue[]>;
  /** Optional extraction metadata keyed by annotation id */
  meta?: Record<string, FieldMeta>;
}

export type ValuesMap = Map<string, ExtractedValue>;
