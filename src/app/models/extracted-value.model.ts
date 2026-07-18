export interface ExtractedValue {
  annotationId: string;
  value: string | number | boolean | null;
  confidence?: number;
  source?: string;
}

export interface ExtractedValuesDocument {
  formId: string;
  extractedAt?: string;
  values: Record<string, ExtractedValue | ExtractedValue[]>;
}

export type ValuesMap = Map<string, ExtractedValue>;
