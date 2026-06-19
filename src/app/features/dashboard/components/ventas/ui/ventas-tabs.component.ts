import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VentasViewOption } from '../config/ventas-view.config';

@Component({
  selector: 'app-ventas-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tabs">
      @for (view of views; track view.key) {
        <button
          type="button"
          [class.active]="activeView === view.key"
          (click)="viewChange.emit(view.key)"
        >
          {{ view.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentasTabsComponent {
  @Input() views: VentasViewOption[] = [];
  @Input() activeView = '';
  @Output() viewChange = new EventEmitter<string>();
}
