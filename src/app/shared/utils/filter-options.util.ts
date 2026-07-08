import { FilterOption } from '../components/filters/filters.component';

/**
 * Quita un código de reporte antepuesto tipo "1132 - TONING" o
 * "1132-TONING", dejando solo el nombre.
 */
function quitarCodigoAntepuesto(valor: string): string {
  return String(valor ?? '')
    .replace(/^\s*\d+\s*-\s*/u, '')
    .trim();
}

/**
 * Enriquece una lista de FilterOption para el dropdown de filtros:
 *  - Nunca muestra el código de reporte antepuesto en el label (solo
 *    el nombre, ej. "TONING" en vez de "1132 - TONING").
 *  - Si dos o más códigos distintos corresponden al mismo nombre real
 *    (típico: un proveedor con varios códigos de reporte, o el backend
 *    trayendo variantes por importación), se fusionan en una sola
 *    entrada visible. El value fusionado concatena los códigos por
 *    coma ("1132,1167") — tanto el backend (`toArr` en los controllers)
 *    como `normalizarValoresFiltro` en frontend expanden ese CSV a
 *    valores individuales, así que el filtrado sigue funcionando OR
 *    sobre todos los códigos fusionados sin cambios adicionales.
 */
export function enriquecerOpcionesSinDuplicadosVisuales(
  opciones: FilterOption[],
): FilterOption[] {
  if (!Array.isArray(opciones) || opciones.length === 0) return opciones;

  const porNombre = new Map<string, { label: string; values: string[] }>();

  for (const opcion of opciones) {
    const labelLimpio = quitarCodigoAntepuesto(opcion.label) || opcion.label;
    const key = labelLimpio.toLowerCase();

    const existente = porNombre.get(key);
    if (!existente) {
      porNombre.set(key, { label: labelLimpio, values: [opcion.value] });
    } else if (!existente.values.includes(opcion.value)) {
      existente.values.push(opcion.value);
    }
  }

  const fusionadas: FilterOption[] = Array.from(porNombre.values()).map((entrada) => ({
    label: entrada.label,
    value: entrada.values.join(','),
  }));

  return fusionadas.sort((a, b) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true }),
  );
}
