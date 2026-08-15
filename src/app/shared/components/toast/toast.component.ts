import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
})
export class ToastComponent implements OnInit, OnDestroy {
  @Input() mensaje = '';
  @Input() fechaLimite = '';
  @Input() duracionMs = 9000;

  visible = true;
  private timer: any;

  ngOnInit(): void {
    if (this.fechaLimite) {
      const limite = new Date(this.fechaLimite + 'T23:59:59').getTime();
      if (Date.now() > limite) {
        this.visible = false;
        return;
      }
    }

    if (this.duracionMs > 0) {
      this.timer = setTimeout(() => {
        this.visible = false;
      }, this.duracionMs);
    }
  }

  cerrar(): void {
    this.visible = false;
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
