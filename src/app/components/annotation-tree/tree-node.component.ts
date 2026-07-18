import { Component, inject, input, signal, OnInit } from '@angular/core';
import { PlaygroundStateService } from '../../services/playground-state.service';
import { TreeNode } from '../../models/annotation.model';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [TreeNodeComponent],
  templateUrl: './tree-node.component.html',
  styleUrl: './annotation-tree.component.css',
})
export class TreeNodeComponent implements OnInit {
  readonly state = inject(PlaygroundStateService);

  node = input.required<TreeNode>();
  depth = input(0);
  defaultExpanded = input(true);

  readonly expanded = signal(true);

  ngOnInit(): void {
    this.expanded.set(this.defaultExpanded());
  }

  toggleExpand(event: MouseEvent): void {
    event.stopPropagation();
    this.expanded.update((v) => !v);
  }

  selectNode(event: MouseEvent): void {
    event.stopPropagation();
    if (this.node().type === 'field') {
      this.state.selectAnnotation(this.node().annotationId);
    }
  }

  isSelected(): boolean {
    return (
      this.node().type === 'field' &&
      this.state.selectedAnnotationId() === this.node().annotationId
    );
  }

  hasChildren(): boolean {
    return this.node().children.length > 0;
  }

  typeIcon(): string {
    switch (this.node().type) {
      case 'field':
        return 'F';
      case 'group':
        return 'G';
      case 'collection':
        return 'C';
      default:
        return '?';
    }
  }

  onRowClick(event: MouseEvent): void {
    if (this.hasChildren()) {
      this.toggleExpand(event);
    } else {
      this.selectNode(event);
    }
  }
}
