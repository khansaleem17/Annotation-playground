import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    this.applyTheme();
  }

  toggle(): void {
    this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
    this.applyTheme();
  }

  private getInitialTheme(): Theme {
    try {
      const savedTheme = this.document.defaultView?.localStorage.getItem('annotation-playground-theme');
      return savedTheme === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  private applyTheme(): void {
    const currentTheme = this.theme();
    this.document.documentElement.dataset['theme'] = currentTheme;
    this.document.documentElement.style.colorScheme = currentTheme;

    try {
      this.document.defaultView?.localStorage.setItem('annotation-playground-theme', currentTheme);
    } catch {
      // The app remains usable when browser storage is unavailable.
    }
  }
}
