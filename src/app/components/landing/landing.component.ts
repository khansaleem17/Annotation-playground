import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TemplateRegistryService } from '../../services/template-registry.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  private readonly router = inject(Router);
  private readonly registry = inject(TemplateRegistryService);
  readonly themeService = inject(ThemeService);

  readonly supportedForms = this.registry.supportedForms;
  readonly isDragging = signal(false);
  readonly error = signal<string | null>(null);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onBrowse(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  private handleFile(file: File): void {
    if (file.type !== 'application/pdf') {
      this.error.set('Please upload a PDF file.');
      return;
    }

    this.error.set(null);
    this.router.navigate(['/playground'], {
      state: { pdfFile: file, fileName: file.name },
    });
  }
}
