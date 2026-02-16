import { Component, OnInit, AfterContentInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './supervisor-dashboard.html',
  styleUrls: ['./supervisor-dashboard.css'],
})  
export class SupervisorDashboardComponent implements OnInit, AfterContentInit {
  supervisor = { name: 'Ana Supervisor', company: 'Dulces y Dulces', role: 'Supervisor' };

  // Dashboard Ejecutivo - datos estáticos de ejemplo (Febrero 2026)
  title = 'Dashboard Ejecutivo - Dulces y Dulces';
  month = 'Febrero 2026';
  exportLabel = 'Exportar Excel';

  filters = {
    rangeFrom: '2026-02-01',
    rangeTo: '2026-02-13',
    sellers: ['Todos', 'Juan Pérez','María García','Carlos López','Ana Martínez','Pedro Sánchez'],
    provider: ['Todos','Nestlé','Mondelez','Colcafé','Alpina'],
    category: ['Todas','Café','Modificador','Leches en Polvo','Culinarios','Galletas'],
    city: ['Todas','Bogotá','Medellín','Cali','Barranquilla'],
    // bound values
    selectedSeller: 'Todos',
    selectedProvider: 'Todos',
    selectedCategory: 'Todas',
    selectedCity: 'Todas',
    selectedFrom: '2026-02-01',
    selectedTo: '2026-02-13',
  };

  kpis = {
    ventaTotalAcumulada: 155400000,
    objetivo: 200000000,
    percentVsPreviousMonth: '+12.5%',
    percentCumplimientoGeneral: 77.7,
    cuotaMensualTrend: '+3.2%',
    proyeccionCierre: 206700000,
    proyeccionPorc: 103.4,
    impactosTotales: 20100000,
    nuevosClientesImpactados: '+8.3%',
    nivelServicio: 94.3,
    percentDevoluciones: 2.4,
  };

  categoryParticipation = [
    { name: 'Café', pct: 20.0 },
    { name: 'Modificador', pct: 18.0 },
    { name: 'Leches en Polvo', pct: 16.0 },
    { name: 'Culinarios', pct: 14.0 },
    { name: 'Galletas', pct: 32.0 },
  ];

  sellersCompliance = [
    { code: 'V001', name: 'Juan Pérez', cuotaMes: 42000000, ventaAcum: 32500000, pctCum: 77.4, proyeccion: 43200000, pctProy: 102.9 },
    { code: 'V002', name: 'María García', cuotaMes: 45000000, ventaAcum: 35200000, pctCum: 78.2, proyeccion: 46800000, pctProy: 104.0 },
    { code: 'V003', name: 'Carlos López', cuotaMes: 40000000, ventaAcum: 31200000, pctCum: 78.0, proyeccion: 41500000, pctProy: 103.8 },
    { code: 'V004', name: 'Ana Martínez', cuotaMes: 38000000, ventaAcum: 29500000, pctCum: 77.6, proyeccion: 39200000, pctProy: 103.2 },
    { code: 'V005', name: 'Pedro Sánchez', cuotaMes: 35000000, ventaAcum: 27000000, pctCum: 77.1, proyeccion: 36000000, pctProy: 102.9 },
  ];

  categoryCompliance = [
    { name: 'Café', cuota: 40000000, acumulado: 31100000, pctCum: 77.7, particip: '20.0%' },
    { name: 'Modificador', cuota: 36000000, acumulado: 28000000, pctCum: 77.7, particip: '18.0%' },
    { name: 'Leches en Polvo', cuota: 32000000, acumulado: 24900000, pctCum: 77.7, particip: '16.0%' },
    { name: 'Culinarios', cuota: 28000000, acumulado: 21800000, pctCum: 77.7, particip: '14.0%' },
    { name: 'Galletas', cuota: 64000000, acumulado: 49700000, pctCum: 77.7, particip: '32.0%' },
  ];

  providerSales = [
    { provider: 'Nestlé', cuota: 68000000, venta: 52800000 },
    { provider: 'Mondelez', cuota: 64000000, venta: 49700000 },
    { provider: 'Colcafé', cuota: 36000000, venta: 28000000 },
    { provider: 'Alpina', cuota: 32000000, venta: 24900000 },
  ];

  impactsRanking = [
    { rank: 1, code: 'V002', name: 'María García', cuotaImp: 4500000, impactos: 4700000, pct: 104.0 },
    { rank: 2, code: 'V001', name: 'Juan Pérez', cuotaImp: 4200000, impactos: 4300000, pct: 102.9 },
    { rank: 3, code: 'V003', name: 'Carlos López', cuotaImp: 4000000, impactos: 4050000, pct: 101.3 },
    { rank: 4, code: 'V004', name: 'Ana Martínez', cuotaImp: 3800000, impactos: 3700000, pct: 97.9 },
    { rank: 5, code: 'V005', name: 'Pedro Sánchez', cuotaImp: 3500000, impactos: 3300000, pct: 93.7 },
  ];

  returnsTable = [
    { code: 'V001', name: 'Juan Pérez', devoluciones: 650000, ventas: 32500000, pctDevoluciones: '2.00%' },
    { code: 'V002', name: 'María García', devoluciones: 705000, ventas: 35200000, pctDevoluciones: '2.00%' },
    { code: 'V003', name: 'Carlos López', devoluciones: 624000, ventas: 31200000, pctDevoluciones: '2.00%' },
    { code: 'V004', name: 'Ana Martínez', devoluciones: 885000, ventas: 29500000, pctDevoluciones: '3.00%' },
    { code: 'V005', name: 'Pedro Sánchez', devoluciones: 810000, ventas: 27000000, pctDevoluciones: '3.00%' },
  ];

  serviceLevel = [
    { code: 'V001', name: 'Juan Pérez', venta: 32500000, agotados: 1600000, nivelServicio: '95.0%' },
    { code: 'V002', name: 'María García', venta: 35200000, agotados: 1400000, nivelServicio: '96.0%' },
    { code: 'V003', name: 'Carlos López', venta: 31200000, agotados: 1900000, nivelServicio: '94.0%' },
    { code: 'V004', name: 'Ana Martínez', venta: 29500000, agotados: 1800000, nivelServicio: '94.0%' },
    { code: 'V005', name: 'Pedro Sánchez', venta: 27000000, agotados: 2200000, nivelServicio: '92.0%' },
  ];

  historicalBySeller = [
    { name: 'Juan Pérez', months: ['29.9M','30.9M','33.1M','28.6M','32.5M'] },
    { name: 'María García', months: ['32.4M','33.4M','35.9M','31.0M','35.2M'] },
    { name: 'Carlos López', months: ['28.7M','29.6M','31.8M','27.5M','31.2M'] },
    { name: 'Ana Martínez', months: ['27.1M','28.0M','30.1M','26.0M','29.5M'] },
    { name: 'Pedro Sánchez', months: ['24.8M','25.6M','27.5M','23.8M','27.0M'] },
  ];

  historicalByCategory = {
    months: ['Oct','Nov','Dic','Ene','Feb'],
    data: [
      { cat: 'Café', values: ['28.6M','29.5M','31.7M','27.4M','31.1M'] },
      { cat: 'Modif', values: ['25.7M','26.6M','28.5M','24.6M','28.0M'] },
      { cat: 'Leches', values: ['22.9M','23.6M','25.4M','21.9M','24.9M'] },
      { cat: 'Culin', values: ['20.0M','20.7M','22.2M','19.1M','21.8M'] },
      { cat: 'Gallet', values: ['45.7M','47.2M','50.7M','43.8M','49.7M'] },
    ]
  };

  // filtered historical
  filteredMonths: string[] = [];
  filteredHistoricalByCategory: any = { months: [], data: [] };
  filteredHistoricalBySeller: any[] = [];

  // filtered views
  filteredSellersCompliance = [] as any[];
  filteredReturnsTable = [] as any[];
  filteredProviderSales = [] as any[];
  filteredImpactsRanking = [] as any[];
  filteredServiceLevel = [] as any[];

  ngAfterContentInit() {
    this.resetFilters();
  }

  resetFilters() {
    this.filteredSellersCompliance = [...this.sellersCompliance];
    this.filteredReturnsTable = [...this.returnsTable];
    this.filteredProviderSales = [...this.providerSales];
    this.filteredImpactsRanking = [...this.impactsRanking];
    this.filteredServiceLevel = [...this.serviceLevel];
  }

  applyFilters() {
    const selSeller = this.filters.selectedSeller;
    const selProvider = this.filters.selectedProvider;
    const selCategory = this.filters.selectedCategory;
    const selCity = this.filters.selectedCity;

    // Filter sellersCompliance by selected seller
    this.filteredSellersCompliance = this.sellersCompliance.filter(s => {
      if (selSeller && selSeller !== 'Todos') return s.name === selSeller;
      return true;
    });

    // Returns table
    this.filteredReturnsTable = this.returnsTable.filter(r => {
      if (selSeller && selSeller !== 'Todos') return r.name === selSeller;
      return true;
    });

    // Provider sales
    this.filteredProviderSales = this.providerSales.filter(p => {
      if (selProvider && selProvider !== 'Todos') return p.provider === selProvider;
      return true;
    });

    // impacts
    this.filteredImpactsRanking = this.impactsRanking.filter(i => {
      if (selSeller && selSeller !== 'Todos') return i.name === selSeller;
      return true;
    });

    // service level
    this.filteredServiceLevel = this.serviceLevel.filter(s => {
      if (selSeller && selSeller !== 'Todos') return s.name === selSeller;
      return true;
    });

    // Filter months in historical data based on selectedFrom/selectedTo (by month name)
    const from = new Date(this.filters.selectedFrom);
    const to = new Date(this.filters.selectedTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      this.filteredMonths = [...this.historicalByCategory.months];
    } else {
      const monthNameToNum: any = { 'Ene':1,'Feb':2,'Mar':3,'Abr':4,'May':5,'Jun':6,'Jul':7,'Ago':8,'Sep':9,'Oct':10,'Nov':11,'Dic':12 };
      const months = this.historicalByCategory.months.filter(m => monthNameToNum[m] !== undefined);
      const fromMonth = from.getMonth()+1;
      const toMonth = to.getMonth()+1;
      // include months between fromMonth and toMonth (handles year wrap naively)
      this.filteredMonths = months.filter(m => {
        const mNum = monthNameToNum[m];
        if (fromMonth <= toMonth) return mNum >= fromMonth && mNum <= toMonth;
        // wrap year
        return mNum >= fromMonth || mNum <= toMonth;
      });
    }

    // Build filtered historical data with only filteredMonths
    const idxs = this.filteredMonths.map(m => this.historicalByCategory.months.indexOf(m)).filter(i=>i>=0);
    this.filteredHistoricalByCategory.months = [...this.filteredMonths];
    this.filteredHistoricalByCategory.data = this.historicalByCategory.data.map((c: any) => ({ cat: c.cat, values: idxs.map((i: number) => c.values[i]) }));

    // build filtered historical by seller
    this.filteredHistoricalBySeller = this.historicalBySeller.map(h => ({ name: h.name, months: idxs.map((i: number) => h.months[i]) }));
  }

  currentView: 'dashboard' | 'upload' = 'dashboard';
  selectedFile: File | null = null;
  csvData: any[] = [];
  csvHeaders: string[] = [];
  csvTotalRow: any | null = null;
 

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
    this.csvTotalRow = null; // Reset total row
    this.csvTotalRow = null; // Reset total row

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      this.csvData = this.parseData(text);

      // Check for and extract total row
      if (this.csvData.length > 0) {
        const lastRow = this.csvData[this.csvData.length - 1];
        const firstColumnKey = this.csvHeaders[0];
        if (
          lastRow &&
          lastRow[firstColumnKey] &&
          lastRow[firstColumnKey].toLowerCase().includes('total')
        ) {
          this.csvTotalRow = this.csvData.pop();
          console.log('Gran total extraído:', this.csvTotalRow);
          console.log('Headers:', this.csvHeaders);
        }
      }

      console.log('Datos procesados:', this.csvData.length, 'filas');
      console.log('Primera fila:', this.csvData[0]);

      // Check for and extract total row
      if (this.csvData.length > 0) {
        const lastRow = this.csvData[this.csvData.length - 1];
        const firstColumnKey = this.csvHeaders[0];
        if (
          lastRow &&
          lastRow[firstColumnKey] &&
          lastRow[firstColumnKey].toLowerCase().includes('total')
        ) {
          this.csvTotalRow = this.csvData.pop();
          console.log('Gran total extraído:', this.csvTotalRow);
          console.log('Headers:', this.csvHeaders);
        }
      }

      console.log('Datos procesados:', this.csvData.length, 'filas');
      console.log('Primera fila:', this.csvData[0]);
      alert('Archivo procesado con éxito. ' + this.csvData.length + ' filas encontradas.');
    };
    // Use ISO-8859-1 to correctly handle accents and 'ñ'
    reader.readAsText(this.selectedFile, 'ISO-8859-1');
  }

  parseData(text: string): any[] {
    this.csvTotalRow = null;
    const lines = text.split('\n');
      }

      console.log('Datos procesados:', this.csvData);
      alert('Archivo procesado con éxito. ' + this.csvData.length + ' filas encontradas.');
    };
    // Use ISO-8859-1 to correctly handle accents and 'ñ'
    reader.readAsText(this.selectedFile, 'ISO-8859-1');
  }

  parseData(text: string): any[] {
    this.csvTotalRow = null;
    this.csvTotalRow = null;
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
