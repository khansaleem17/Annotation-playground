import { Component, inject, computed } from '@angular/core';
import { AnnotationRendererService } from '../../services/annotation-renderer.service';
import { TemplateService } from '../../services/template.service';
import { TreeNodeComponent } from './tree-node.component';

@Component({
  selector: 'app-annotation-tree',
  standalone: true,
  imports: [TreeNodeComponent],
  templateUrl: './annotation-tree.component.html',
  styleUrl: './annotation-tree.component.css',
})
export class AnnotationTreeComponent {
  private readonly templateService = inject(TemplateService);
  private readonly renderer = inject(AnnotationRendererService);

  readonly treeNodes = computed(() => {
    const template = this.templateService.template();
    if (!template) {
      return [];
    }
    return this.renderer.buildTree(template);
  });
}
