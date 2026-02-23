import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="card">
    <p class="title">{{title}}</p>
    <h2>{{value}}</h2>
  </div>
  `,
  styleUrls: ['./card.component.css']
})
export class CardComponent {
  @Input() title!: string;
  @Input() value!: string | number;
}