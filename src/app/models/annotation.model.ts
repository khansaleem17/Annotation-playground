export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Appearance {
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
}

export interface Validation {
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  message?: string;
}

export type AnnotationType = 'field' | 'group' | 'collection';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_review';

export interface AnnotationNode {
  id: string;
  type: AnnotationType;
  label?: string;
  fieldType?: string;
  bindingPath?: string;
  semanticEntity?: string;
  validation?: Validation;
  appearance?: Appearance;
  boundingBox?: BoundingBox;
  extractionConfidence?: number;
  reviewStatus?: ReviewStatus;
  children?: AnnotationNode[];
  page?: number;
  collectionItemLabel?: string;
}

export interface AnnotationPage {
  pageNumber: number;
  label: string;
  annotations: AnnotationNode[];
}

export interface AnnotationTemplate {
  formId: string;
  formName: string;
  taxYear: number;
  version: string;
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
