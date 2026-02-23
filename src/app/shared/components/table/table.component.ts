import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule],
  template: `
  <table>
    <thead>
      <tr>
        <th *ngFor="let col of columns">{{col}}</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let row of data">
        <td *ngFor="let col of columns">
          {{row[col]}}
        </td>
      </tr>
    </tbody>
  </table>
  `,
  styleUrls: ['./table.component.css']
})
export class TableComponent {
  @Input() columns: string[] = [];
  @Input() data: any[] = [];
}