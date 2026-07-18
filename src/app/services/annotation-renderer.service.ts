import { Injectable } from '@angular/core';
import {
  AnnotationNode,
  AnnotationTemplate,
  BoundingBox,
  FlatAnnotation,
  PixelBoundingBox,
  RenderedAnnotation,
  RenderOptions,
  TemplateStats,
  TreeNode,
} from '../models/annotation.model';
import { ValuesService } from './values.service';

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

  renderPage(
    template: AnnotationTemplate,
    options: RenderOptions,
  ): RenderedAnnotation[] {
    const flat = this.flattenTemplate(template);
    const rendered: RenderedAnnotation[] = [];

    for (const node of flat) {
      if (node.type !== 'field' || node.pageNumber !== options.pageNumber) {
        continue;
      }
      if (!node.boundingBox) {
        continue;
      }

      const pixelBox = this.toPixelBox(node.boundingBox, options.pageWidth, options.pageHeight);
      const value = this.valuesService.getDisplayValue(node.id);
      const extracted = this.valuesService.getValue(node.id);

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
        bindingPath: node.bindingPath,
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

        this.flattenNodes(
          node.children,
          node.page ?? pageNumber,
          absolutePath,
          depth + 1,
          node.id,
          output,
        );
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

  private buildTreeNodes(
    nodes: AnnotationNode[],
    pageNumber: number,
    depth: number,
  ): TreeNode[] {
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
    if (node.fieldType === 'ssn' && value.length === 9) {
      return `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
    }
    if (node.fieldType === 'currency') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      }
    }
    return value;
  }
}
