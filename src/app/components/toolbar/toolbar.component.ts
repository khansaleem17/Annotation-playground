import { Component, inject, output } from '@angular/core';
import { PlaygroundStateService, PlaygroundView } from '../../services/playground-state.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.css',
})
export class ToolbarComponent {
  readonly state = inject(PlaygroundStateService);
  readonly themeService = inject(ThemeService);

  zoomIn = output<void>();
  zoomOut = output<void>();
  fitWidth = output<void>();

  toggle(key: 'boundingBoxes' | 'values' | 'confidence' | 'semanticMetadata' | 'bindingPaths'): void {
    this.state.toggle(key);
  }

  setView(view: PlaygroundView): void {
    this.state.setView(view);
  }
}
