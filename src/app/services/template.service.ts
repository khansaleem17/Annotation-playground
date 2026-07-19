import { Injectable, signal } from '@angular/core';
import { AnnotationNode, AnnotationTemplate } from '../models/annotation.model';
import { PdfFormField } from './pdf.service';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  readonly template = signal<AnnotationTemplate | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadTemplate(path: string): Promise<AnnotationTemplate> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.statusText}`);
      }
      const data = (await response.json()) as AnnotationTemplate;
      this.template.set(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown template error';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Merge PDF AcroForm widget geometry into the loaded template.
   * Keeps the template structure as the source of truth and only upgrades
   * bounding boxes (and adds known mapped fields) when widgets are present.
   */
  applyPdfFormGeometry(formId: string, fields: PdfFormField[]): void {
    if (formId !== 'irs_1040_2025' || fields.length === 0) {
      return;
    }

    const template = this.template();
    const page = template?.pages.find((candidate) => candidate.pageNumber === 1);
    if (!template || !page) {
      return;
    }

    const byId = new Map(fields.map((field) => [field.id, field]));
    const fieldDefs: ReadonlyArray<readonly [string, string, string, string]> = [
      ['f1_14', 'taxpayer.firstName', 'First Name', 'text'],
      ['f1_15', 'taxpayer.lastName', 'Last Name', 'text'],
      ['f1_16', 'taxpayer.ssn', 'SSN', 'ssn'],
      ['f1_17', 'spouse.firstName', 'First Name', 'text'],
      ['f1_18', 'spouse.lastName', 'Last Name', 'text'],
      ['f1_19', 'spouse.ssn', 'SSN', 'ssn'],
      ['f1_20', 'address.street', 'Street Address', 'text'],
      ['f1_21', 'address.aptNumber', 'Apartment', 'text'],
      ['f1_22', 'address.city', 'City', 'text'],
      ['f1_23', 'address.state', 'State', 'text'],
      ['f1_24', 'address.zipCode', 'ZIP Code', 'text'],
      ['f1_31', 'dependents[0].firstName', 'Dependent 1 First Name', 'text'],
      ['f1_32', 'dependents[1].firstName', 'Dependent 2 First Name', 'text'],
      ['f1_35', 'dependents[0].lastName', 'Dependent 1 Last Name', 'text'],
      ['f1_36', 'dependents[1].lastName', 'Dependent 2 Last Name', 'text'],
      ['f1_39', 'dependents[0].ssn', 'Dependent 1 SSN', 'ssn'],
      ['f1_40', 'dependents[1].ssn', 'Dependent 2 SSN', 'ssn'],
      ['f1_43', 'dependents[0].relationship', 'Dependent 1 Relationship', 'text'],
      ['f1_44', 'dependents[1].relationship', 'Dependent 2 Relationship', 'text'],
      ['f1_47', 'income.wages', 'Wages, Salaries, Tips', 'currency'],
      ['f1_59', 'income.taxableInterest', 'Taxable Interest', 'currency'],
    ];

    const createField = (
      fieldId: string,
      id: string,
      label: string,
      fieldType: string,
    ): AnnotationNode | null => {
      const field = byId.get(fieldId);
      if (!field) {
        return null;
      }
      const metadata = this.getFieldMetadata(id);
      const isCurrency = fieldType === 'currency';
      return {
        id,
        type: 'field',
        label,
        fieldType,
        valueRef: metadata.valueRef,
        bindingPath: metadata.bindingPath,
        semanticEntity: metadata.semanticEntity,
        boundingBox: field.boundingBox,
        appearance: {
          fontSize: isCurrency ? 10 : 9,
          textAlign: isCurrency ? 'right' : 'left',
          color: '#000000',
        },
        format: isCurrency
          ? { currency: { currencyCode: 'USD', locale: 'en-US', minimumFractionDigits: 2 } }
          : undefined,
        extractionConfidence: 1,
        reviewStatus: 'approved',
      };
    };

    const groupChildren = (ids: string[]): AnnotationNode[] =>
      fieldDefs
        .filter(([, annotationId]) => ids.some((prefix) => annotationId.startsWith(prefix)))
        .map(([fieldId, id, label, fieldType]) => createField(fieldId, id, label, fieldType))
        .filter((node): node is AnnotationNode => node !== null);

    const taxpayerChildren = groupChildren(['taxpayer.']);
    const spouseChildren = groupChildren(['spouse.']);
    const addressChildren = groupChildren(['address.']);
    const dependentChildren = groupChildren(['dependents[']);
    const incomeChildren = groupChildren(['income.']);

    // Prefer PDF-derived fields when available; otherwise keep template nodes
    // so bounding boxes from the static annotation spec still render.
    const keepOrReplace = (
      existing: AnnotationNode | undefined,
      id: string,
      label: string,
      children: AnnotationNode[],
      fallbackType: 'group' | 'collection' = 'group',
    ): AnnotationNode => {
      if (children.length > 0) {
        return {
          id,
          type: existing?.type ?? fallbackType,
          label: existing?.label ?? label,
          collectionItemLabel: existing?.collectionItemLabel,
          rowStride: existing?.rowStride,
          children,
        };
      }
      return existing ?? { id, type: fallbackType, label, children: [] };
    };

    const existingTaxpayer = page.annotations.find((node) => node.id === 'taxpayer');
    const existingSpouse = page.annotations.find((node) => node.id === 'spouse');
    const existingAddress = page.annotations.find((node) => node.id === 'address');
    const existingDependents = page.annotations.find((node) => node.id === 'dependents');
    const existingIncome = page.annotations.find((node) => node.id === 'income');
    const otherNodes = page.annotations.filter(
      (node) =>
        !['taxpayer', 'spouse', 'address', 'dependents', 'income'].includes(node.id) &&
        !node.id.startsWith('income.'),
    );

    const updatedPage = {
      ...page,
      annotations: [
        keepOrReplace(existingTaxpayer, 'taxpayer', 'Taxpayer', taxpayerChildren),
        keepOrReplace(existingSpouse, 'spouse', 'Spouse', spouseChildren),
        keepOrReplace(existingAddress, 'address', 'Address', addressChildren),
        keepOrReplace(existingDependents, 'dependents', 'Dependents', dependentChildren, 'collection'),
        keepOrReplace(existingIncome, 'income', 'Income', incomeChildren),
        ...otherNodes,
      ],
    };

    this.template.set({
      ...template,
      pages: template.pages.map((candidate) =>
        candidate.pageNumber === page.pageNumber ? updatedPage : candidate,
      ),
    });
  }

  clear(): void {
    this.template.set(null);
    this.error.set(null);
  }

  private getFieldMetadata(id: string): {
    bindingPath: string;
    valueRef: { path: string };
    semanticEntity: string;
  } {
    const pathMap: Record<string, string> = {
      'taxpayer.firstName': '$.taxpayer.legal.firstName',
      'taxpayer.lastName': '$.taxpayer.legal.lastName',
      'taxpayer.ssn': '$.taxpayer.identifiers.ssn',
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
      'income.wages': '$.income.w2Forms[0].wages',
      'income.taxableInterest': '$.income.interest.taxable',
    };

    const property = id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id;
    const personProperties: Record<string, string> = {
      firstName: 'Person.firstName',
      lastName: 'Person.lastName',
      ssn: 'Person.ssn',
      relationship: 'Person.relationship',
    };
    const addressProperties: Record<string, string> = {
      street: 'PostalAddress.streetAddress',
      aptNumber: 'PostalAddress.addressLine2',
      city: 'PostalAddress.addressLocality',
      state: 'PostalAddress.addressRegion',
      zipCode: 'PostalAddress.postalCode',
    };
    const incomeProperties: Record<string, string> = {
      wages: 'Income.wages',
      taxableInterest: 'Income.interest',
    };

    const path = pathMap[id] ?? `$.${id}`;
    let semanticEntity: string | undefined;
    if (id.startsWith('address.')) {
      semanticEntity = addressProperties[property];
    } else if (id.startsWith('income.')) {
      semanticEntity = incomeProperties[property];
    } else {
      semanticEntity = personProperties[property];
    }

    return {
      bindingPath: path,
      valueRef: { path },
      semanticEntity: semanticEntity ?? id,
    };
  }
}
