import { Injectable } from '@angular/core';
import {
  AnnotationNode,
  AnnotationTemplate,
  BoundingBox,
  FlatAnnotation,
  FormatOptions,
  PixelBoundingBox,
  RenderedAnnotation,
  RenderOptions,
  TemplateStats,
  TreeNode,
  getValuePath,
} from '../models/annotation.model';
import { ValuesService } from './values.service';
import { hasCollectionPlaceholder, materializeCollectionPath } from '../utils/path-resolver';

@Injectable({ providedIn: 'root' })
export class AnnotationRendererService {
  constructor(private readonly valuesService: ValuesService) {}

  flattenTemplate(template: AnnotationTemplate): FlatAnnotation[] {
    const flat: FlatAnnotation[] = [];

    for (const page of template.pages) {
      this.flattenNodes(page.annotations, page.pageNumber, '', 0, undefined, flat);
    }

    return flat;
  }

  buildTree(template: AnnotationTemplate): TreeNode[] {
    return template.pages.map((page) => ({
      id: `page-${page.pageNumber}`,
      label: page.label,
      type: 'group' as const,
      depth: 0,
      pageNumber: page.pageNumber,
      annotationId: `page-${page.pageNumber}`,
      children: this.buildTreeNodes(page.annotations, page.pageNumber, 1),
    }));
  }

  computeStats(template: AnnotationTemplate): TemplateStats {
    const flat = this.flattenTemplate(template);
    return {
      fields: flat.filter((n) => n.type === 'field').length,
      groups: flat.filter((n) => n.type === 'group').length,
      collections: flat.filter((n) => n.type === 'collection').length,
    };
  }

  renderPage(template: AnnotationTemplate, options: RenderOptions): RenderedAnnotation[] {
    const flat = this.flattenTemplate(template);
    const rendered: RenderedAnnotation[] = [];

    for (const node of flat) {
      if (node.type !== 'field' || node.pageNumber !== options.pageNumber) {
        continue;
      }
      if (!node.boundingBox) {
        continue;
      }

      const valuePath = getValuePath(node);
      const collectionIndex = node.collectionIndex ?? 0;
      const concretePath =
        valuePath && hasCollectionPlaceholder(valuePath)
          ? materializeCollectionPath(valuePath, collectionIndex)
          : valuePath;

      const pixelBox = this.toPixelBox(node.boundingBox, options.pageWidth, options.pageHeight);
      const value = this.valuesService.getDisplayValue(node.id, valuePath, collectionIndex);
      const extracted = this.valuesService.resolveForAnnotation(node.id, valuePath, collectionIndex);

      rendered.push({
        id: node.id,
        absolutePath: node.absolutePath,
        type: node.type,
        label: node.label,
        pageNumber: node.pageNumber,
        pixelBox,
        value,
        displayValue: this.formatDisplayValue(value, node),
        confidence: extracted?.confidence ?? node.extractionConfidence,
        bindingPath: concretePath ?? node.bindingPath,
        valuePath: concretePath,
        semanticEntity: node.semanticEntity,
        appearance: node.appearance,
        fieldType: node.fieldType,
        validation: node.validation,
        reviewStatus: node.reviewStatus,
        boundingBox: node.boundingBox,
      });
    }

    return rendered;
  }

  findFlatAnnotation(template: AnnotationTemplate, annotationId: string): FlatAnnotation | undefined {
    return this.flattenTemplate(template).find((n) => n.id === annotationId);
  }

  private flattenNodes(
    nodes: AnnotationNode[],
    pageNumber: number,
    parentPath: string,
    depth: number,
    parentId: string | undefined,
    output: FlatAnnotation[],
  ): void {
    for (const node of nodes) {
      const segment = node.label ?? node.id;
      const absolutePath = parentPath ? `${parentPath}.${segment}` : segment;

      if (node.type === 'collection' && node.children?.length) {
        const collectionFlat: FlatAnnotation = {
          ...node,
          absolutePath,
          depth,
          parentId,
          pageNumber: node.page ?? pageNumber,
          treeLabel: node.label ?? node.id,
        };
        output.push(collectionFlat);

        // Materialize first row in the overlay (index 0). Full multi-row
        // expansion can use rowStride when a print engine needs every instance.
        this.flattenNodes(
          node.children.map((child) => ({
            ...child,
            // stash index via a shallow clone consumed below
          })),
          node.page ?? pageNumber,
          absolutePath,
          depth + 1,
          node.id,
          output,
        );

        // Tag collection children with index 0 for path materialization
        for (let i = output.length - 1; i >= 0; i--) {
          if (output[i].parentId === node.id && output[i].collectionIndex === undefined) {
            output[i] = { ...output[i], collectionIndex: 0 };
          } else if (output[i].id === node.id) {
            break;
          }
        }
        continue;
      }

      const flatNode: FlatAnnotation = {
        ...node,
        absolutePath,
        depth,
        parentId,
        pageNumber: node.page ?? pageNumber,
        treeLabel: node.label ?? node.id,
      };
      output.push(flatNode);

      if (node.children?.length) {
        this.flattenNodes(
          node.children,
          node.page ?? pageNumber,
          absolutePath,
          depth + 1,
          node.id,
          output,
        );
      }
    }
  }

  private buildTreeNodes(nodes: AnnotationNode[], pageNumber: number, depth: number): TreeNode[] {
    return nodes.map((node) => ({
      id: node.id,
      label: node.label ?? node.id,
      type: node.type,
      depth,
      pageNumber: node.page ?? pageNumber,
      annotationId: node.id,
      children: node.children?.length
        ? this.buildTreeNodes(node.children, node.page ?? pageNumber, depth + 1)
        : [],
    }));
  }

  private toPixelBox(box: BoundingBox, pageWidth: number, pageHeight: number): PixelBoundingBox {
    return {
      x: box.x * pageWidth,
      y: box.y * pageHeight,
      width: box.width * pageWidth,
      height: box.height * pageHeight,
    };
  }

  private formatDisplayValue(value: string, node: FlatAnnotation): string {
    if (!value) {
      return '';
    }

    const format = node.format;

    if (node.fieldType === 'checkbox') {
      const truthy = value === 'true' || value === '1' || value.toLowerCase() === 'yes';
      return truthy ? (format?.checkbox?.mark ?? 'X') : '';
    }

    if (node.fieldType === 'ssn' && /^\d{9}$/.test(value)) {
      if (format?.ssn?.redact) {
        return `***-**-${value.slice(5)}`;
      }
      return `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
    }

    if (node.fieldType === 'ein' && /^\d{2}-?\d{7}$/.test(value.replace('-', ''))) {
      const digits = value.replace(/\D/g, '');
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }

    if (node.fieldType === 'currency') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return this.formatCurrency(num, format);
      }
    }

    if (node.fieldType === 'date') {
      return this.formatDate(value, format);
    }

    return value;
  }

  private formatCurrency(num: number, format?: FormatOptions): string {
    const locale = format?.currency?.locale ?? 'en-US';
    const currency = format?.currency?.currencyCode ?? 'USD';
    const minimumFractionDigits = format?.currency?.minimumFractionDigits ?? 2;
    return num.toLocaleString(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
    });
  }

  private formatDate(value: string, format?: FormatOptions): string {
    const pattern = format?.date?.pattern ?? 'MM/DD/YYYY';
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!iso) {
      return value;
    }
    const [, yyyy, mm, dd] = iso;
    return pattern.replace('YYYY', yyyy).replace('MM', mm).replace('DD', dd);
  }
}
