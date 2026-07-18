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

  applyPdfFormGeometry(formId: string, fields: PdfFormField[]): void {
    if (formId !== 'irs_1040_2025') {
      return;
    }

    const template = this.template();
    const page = template?.pages.find((candidate) => candidate.pageNumber === 1);
    if (!template || !page) {
      return;
    }

    const byId = new Map(fields.map((field) => [field.id, field]));
    const taxpayer = page.annotations.find((node) => node.id === 'taxpayer');
    const dependents = page.annotations.find((node) => node.id === 'dependents');
    if (!taxpayer || !dependents) {
      return;
    }

    const createFields = (
      definitions: ReadonlyArray<readonly [string, string, string, string]>,
    ): AnnotationNode[] =>
      definitions.flatMap(([fieldId, id, label, fieldType]) => {
        const field = byId.get(fieldId);
        const metadata = this.getFieldMetadata(id);
        return field
          ? [
              {
                id,
                type: 'field',
                label,
                fieldType,
                bindingPath: metadata.bindingPath,
                semanticEntity: metadata.semanticEntity,
                boundingBox: field.boundingBox,
                appearance: { fontSize: 9, textAlign: 'left', color: '#000000' },
                extractionConfidence: 1,
                reviewStatus: 'approved',
              },
            ]
          : [];
      });

    const updatedTaxpayer = createFields([
      ['f1_14', 'taxpayer.firstName', 'First Name', 'text'],
      ['f1_15', 'taxpayer.lastName', 'Last Name', 'text'],
      ['f1_16', 'taxpayer.ssn', 'SSN', 'ssn'],
    ]);
    const updatedSpouse = createFields([
      ['f1_17', 'spouse.firstName', 'First Name', 'text'],
      ['f1_18', 'spouse.lastName', 'Last Name', 'text'],
      ['f1_19', 'spouse.ssn', 'SSN', 'ssn'],
    ]);
    const updatedAddress = createFields([
      ['f1_20', 'address.street', 'Street Address', 'text'],
      ['f1_21', 'address.aptNumber', 'Apartment', 'text'],
      ['f1_22', 'address.city', 'City', 'text'],
      ['f1_23', 'address.state', 'State', 'text'],
      ['f1_24', 'address.zipCode', 'ZIP Code', 'text'],
    ]);

    const dependentDefinitions = [
      ['f1_31', 'dependents[0].firstName', 'Dependent 1 First Name', 'text'],
      ['f1_32', 'dependents[1].firstName', 'Dependent 2 First Name', 'text'],
      ['f1_35', 'dependents[0].lastName', 'Dependent 1 Last Name', 'text'],
      ['f1_36', 'dependents[1].lastName', 'Dependent 2 Last Name', 'text'],
      ['f1_39', 'dependents[0].ssn', 'Dependent 1 SSN', 'ssn'],
      ['f1_40', 'dependents[1].ssn', 'Dependent 2 SSN', 'ssn'],
      ['f1_43', 'dependents[0].relationship', 'Dependent 1 Relationship', 'text'],
      ['f1_44', 'dependents[1].relationship', 'Dependent 2 Relationship', 'text'],
    ] as const;
    const updatedDependents = createFields(dependentDefinitions);

    const dynamicGroups: AnnotationNode[] = [
      { id: 'spouse', type: 'group', label: 'Spouse', children: updatedSpouse },
      { id: 'address', type: 'group', label: 'Address', children: updatedAddress },
    ];
    const updatedPage = {
      ...page,
      annotations: [
        { ...taxpayer, children: updatedTaxpayer },
        ...dynamicGroups,
        { ...dependents, children: updatedDependents },
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

  private getFieldMetadata(id: string): { bindingPath: string; semanticEntity: string } {
    const property = id.slice(id.lastIndexOf('.') + 1);
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

    return {
      bindingPath: id,
      semanticEntity: id.startsWith('address.')
        ? addressProperties[property]
        : personProperties[property],
    };
  }
}
