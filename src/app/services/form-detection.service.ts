import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { FormDetectionResult } from '../models/annotation.model';

@Injectable({ providedIn: 'root' })
export class FormDetectionService {
  async detectForm(pdfData: ArrayBuffer): Promise<FormDetectionResult> {
    const pdf = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const hasForm1040 = /Form\s+1040/i.test(pageText);
    const has2025 = /\b2025\b/.test(pageText);

    if (hasForm1040 && has2025) {
      return {
        formId: 'irs_1040_2025',
        confidence: 0.95,
        matchedText: ['Form 1040', '2025'],
      };
    }

    return {
      formId: null,
      confidence: 0,
      matchedText: [],
    };
  }
}
