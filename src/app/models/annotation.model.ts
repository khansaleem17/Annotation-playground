export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoordinateSystem {
  space: 'normalized';
  origin: 'top_left';
  xAxis?: 'left_to_right';
  yAxis?: 'top_to_bottom';
}

export interface Appearance {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  color?: string;
  backgroundColor?: string;
  overflow?: 'clip' | 'ellipsis' | 'shrink';
}

export interface FormatOptions {
  currency?: {
    currencyCode?: string;
    locale?: string;
    minimumFractionDigits?: number;
  };
  date?: { pattern?: string };
  ssn?: { mask?: string; redact?: boolean };
  checkbox?: { mark?: string };
}

export interface Validation {
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  message?: string;
}

export interface ValueRef {
  /** JSONPath subset into nested tax-return data, e.g. $.income.w2Forms[0].wages */
  path: string;
}

export type AnnotationType = 'field' | 'group' | 'collection';
export type FieldType = 'text' | 'currency' | 'ssn' | 'ein' | 'date' | 'checkbox' | 'number';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_review';

export interface AnnotationNode {
  id: string;
  type: AnnotationType;
  label?: string;
  fieldType?: FieldType | string;
  /** Preferred deep reference into nested tax-return JSON */
  valueRef?: ValueRef;
  /**
   * Legacy / display alias for valueRef.path.
   * Kept so tooling can show the path string directly.
   */
  bindingPath?: string;
  semanticEntity?: string;
  validation?: Validation;
  appearance?: Appearance;
  format?: FormatOptions;
  boundingBox?: BoundingBox;
  extractionConfidence?: number;
  reviewStatus?: ReviewStatus;
  children?: AnnotationNode[];
  page?: number;
  collectionItemLabel?: string;
  /** Normalized vertical distance between collection rows */
  rowStride?: number;
}

export interface AnnotationPage {
  pageNumber: number;
  label: string;
  widthPoints?: number;
  heightPoints?: number;
  annotations: AnnotationNode[];
}

export interface AnnotationTemplate {
  schemaVersion?: string;
  formId: string;
  formName: string;
  taxYear: number;
  version: string;
  coordinateSystem?: CoordinateSystem;
  pages: AnnotationPage[];
}

export interface FlatAnnotation extends AnnotationNode {
  absolutePath: string;
  depth: number;
  parentId?: string;
  pageNumber: number;
  collectionIndex?: number;
  treeLabel: string;
}

export interface PixelBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderedAnnotation {
  id: string;
  absolutePath: string;
  type: AnnotationType;
  label?: string;
  pageNumber: number;
  pixelBox: PixelBoundingBox;
  value: string;
  displayValue: string;
  confidence?: number;
  bindingPath?: string;
  valuePath?: string;
  semanticEntity?: string;
  appearance?: Appearance;
  fieldType?: string;
  validation?: Validation;
  reviewStatus?: ReviewStatus;
  boundingBox: BoundingBox;
}

export interface RenderOptions {
  pageWidth: number;
  pageHeight: number;
  pageNumber: number;
  showBoundingBoxes: boolean;
  showValues: boolean;
  showConfidence: boolean;
  showSemanticMetadata: boolean;
  showBindingPaths: boolean;
}

export interface TemplateStats {
  fields: number;
  groups: number;
  collections: number;
}

export interface TreeNode {
  id: string;
  label: string;
  type: AnnotationType;
  depth: number;
  pageNumber: number;
  children: TreeNode[];
  annotationId: string;
  expanded?: boolean;
}

export type FormIdentifier = 'irs_1040_2025' | string;

export interface FormDetectionResult {
  formId: FormIdentifier | null;
  confidence: number;
  matchedText: string[];
}

export interface ProcessingStage {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  message?: string;
}

export interface PlaygroundToggles {
  boundingBoxes: boolean;
  values: boolean;
  confidence: boolean;
  semanticMetadata: boolean;
  bindingPaths: boolean;
}

export const DEFAULT_TOGGLES: PlaygroundToggles = {
  boundingBoxes: true,
  values: true,
  confidence: false,
  semanticMetadata: false,
  bindingPaths: false,
};

/** Resolve the effective value path for a node. */
export function getValuePath(node: Pick<AnnotationNode, 'valueRef' | 'bindingPath'>): string | undefined {
  return node.valueRef?.path ?? node.bindingPath;
}
