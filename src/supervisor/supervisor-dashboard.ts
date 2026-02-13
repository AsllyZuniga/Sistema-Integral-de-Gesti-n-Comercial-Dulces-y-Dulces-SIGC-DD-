import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './supervisor-dashboard.html',
  styleUrls: ['./supervisor-dashboard.css'],
})
export class SupervisorDashboardComponent implements OnInit {
  supervisor = { name: 'Ana Supervisor', company: 'Dulces y Dulces', role: 'Supervisor' };
  stats = { activeSellers: 3, teamNetSales: 9265000, returns: 580000 };
  topSeller = {
    name: 'María González',
    email: 'maria@dulcesydulces.com',
    net: 4795000,
    returnsPercent: 1.54,
    compliance: 11.99,
    clients: 3,
  };
  worstSeller = {
    name: 'Pedro Ramírez',
    email: 'pedro@dulcesydulces.com',
    net: 490000,
    returnsPercent: 32.41,
    compliance: 1.23,
    clients: 5,
  };

  currentView: 'dashboard' | 'upload' = 'dashboard';
  selectedFile: File | null = null;
  csvData: any[] = [];
  csvHeaders: string[] = [];

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['view'] === 'upload') {
        this.currentView = 'upload';
      } else {
        this.currentView = 'dashboard';
      }
    });
  }

  switchView(view: 'dashboard' | 'upload') {
    this.currentView = view;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  processFile() {
    if (!this.selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      this.csvData = this.parseData(text);
      console.log('Datos procesados:', this.csvData);
      alert('Archivo procesado con éxito. ' + this.csvData.length + ' filas encontradas.');
    };
    // Use ISO-8859-1 to correctly handle accents and 'ñ'
    reader.readAsText(this.selectedFile, 'ISO-8859-1');
  }

  parseData(text: string): any[] {
    const lines = text.split('\n');
    if (lines.length === 0) return [];

    // Auto-detect delimiter
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.indexOf('\t') !== -1) {
      delimiter = '\t';
    } else if (firstLine.indexOf(';') !== -1) {
      delimiter = ';';
    }

    const headers = lines[0].split(delimiter).map((h) => h.trim());
    this.csvHeaders = headers;
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i];
      if (!lineStr || !lineStr.trim()) continue; // Skip completely empty lines

      const currentline = lineStr.split(delimiter);
      const obj: any = {};

      // Map columns to headers, preserving empty values
      for (let j = 0; j < headers.length; j++) {
        const val = currentline[j] ? currentline[j].trim() : '';
        obj[headers[j]] = val;
      }
      result.push(obj);
    }
    return result;
  }

  viewDetail(seller: any) {
    // placeholder: open detail modal or navigate
    console.log('Ver detalle de', seller.name);
  }
}
