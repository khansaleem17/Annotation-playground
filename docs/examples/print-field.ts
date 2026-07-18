/**
 * Minimal illustration of a proprietary print engine using the annotation spec.
 * Not wired into the Angular app — for documentation / video walkthrough only.
 */
import { resolvePath, materializeCollectionPath, hasCollectionPlaceholder } from '../../src/app/utils/path-resolver';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Field {
  id: string;
  fieldType: string;
  valueRef: { path: string };
  appearance: { fontSize: number; textAlign: 'left' | 'center' | 'right'; color: string };
  boundingBox: Box;
}

function toPixels(box: Box, pageWidth: number, pageHeight: number) {
  return {
    x: box.x * pageWidth,
    y: box.y * pageHeight,
    width: box.width * pageWidth,
    height: box.height * pageHeight,
  };
}

function formatValue(raw: unknown, fieldType: string): string {
  if (raw === null || raw === undefined) return '';
  if (fieldType === 'currency') {
    return Number(raw).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }
  if (fieldType === 'ssn' && String(raw).length === 9) {
    const v = String(raw);
    return `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}`;
  }
  if (fieldType === 'checkbox') {
    return raw === true || raw === 'true' ? 'X' : '';
  }
  return String(raw);
}

/** Draw one annotated field onto a page canvas / PDF content stream. */
export function printField(
  field: Field,
  taxReturn: unknown,
  pageWidth: number,
  pageHeight: number,
  drawText: (text: string, box: Box, appearance: Field['appearance']) => void,
  collectionIndex = 0,
): void {
  let path = field.valueRef.path;
  if (hasCollectionPlaceholder(path)) {
    path = materializeCollectionPath(path, collectionIndex);
  }
  const raw = resolvePath(taxReturn, path);
  const text = formatValue(raw, field.fieldType);
  const box = toPixels(field.boundingBox, pageWidth, pageHeight);
  drawText(text, box, field.appearance);
}
