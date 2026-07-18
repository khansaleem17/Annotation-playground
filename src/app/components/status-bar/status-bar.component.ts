import { Component, inject } from '@angular/core';
import { PlaygroundStateService } from '../../services/playground-state.service';
import { PdfService } from '../../services/pdf.service';
import { TemplateService } from '../../services/template.service';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.css',
})
export class StatusBarComponent {
  readonly state = inject(PlaygroundStateService);
  readonly pdfService = inject(PdfService);
  readonly templateService = inject(TemplateService);

  zoomPercent(): number {
    return Math.round(this.pdfService.scale() * 100);
  }
}
