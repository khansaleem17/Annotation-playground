/**
 * Minimal JSONPath subset resolver for tax-return value references.
 *
 * Supported grammar:
 *   $ .ident [index] .ident ...
 *   $ .ident [] .ident   → placeholder; use materializeCollectionPath()
 *
 * Examples:
 *   $.taxpayer.legal.firstName
 *   $.dependents[0].identifiers.ssn
 *   $.income.w2Forms[0].wages
 */

const SEGMENT_RE = /\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d*)\]/g;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

/** Resolve a concrete path (no empty []) against a nested object. */
export function resolvePath(data: unknown, path: string): unknown {
  if (!path || path === '$') {
    return data;
  }
  if (!path.startsWith('$')) {
    throw new Error(`Path must start with "$": ${path}`);
  }

  let cursor: unknown = data;
  SEGMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SEGMENT_RE.exec(path)) !== null) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }

    const property = match[1];
    const indexToken = match[2];

    if (property !== undefined) {
      if (typeof cursor !== 'object' || Array.isArray(cursor)) {
        return undefined;
      }
      cursor = (cursor as JsonObject)[property];
      continue;
    }

    // [] placeholder is not resolvable without an index
    if (indexToken === '') {
      throw new Error(
        `Path contains unresolved collection placeholder "[]": ${path}. ` +
          `Call materializeCollectionPath() first.`,
      );
    }

    const index = Number(indexToken);
    if (!Array.isArray(cursor)) {
      return undefined;
    }
    cursor = cursor[index];
  }

  return cursor;
}

/**
 * Replace the first `[]` placeholder with a concrete index.
 * `$.dependents[].legal.firstName` + 0 → `$.dependents[0].legal.firstName`
 */
export function materializeCollectionPath(path: string, index: number): string {
  if (!path.includes('[]')) {
    return path;
  }
  return path.replace('[]', `[${index}]`);
}

/** True when the path still contains a collection placeholder. */
export function hasCollectionPlaceholder(path: string): boolean {
  return /\[\]/.test(path);
}

/** Coerce a resolved JSON value into a displayable string (pre-formatting). */
export function valueToRawString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}
