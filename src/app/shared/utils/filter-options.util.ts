import { FilterOption } from '../components/filters/filters.component';

/**
 * Enriquece una lista de FilterOption para evitar entradas visualmente
 * duplicadas en el dropdown cuando el backend devuelve el mismo nombre
 * con códigos distintos.
 *
 * Caso típico (enero): dos proveedores con códigos 100 y 200 donde el
 * campo `nombre` viene mal cargado y ambos dicen "PREMIOS PROVEEDORES",
 * pero el campo `reporte_prov_con_obs` sí trae el nombre correcto
 * ("200 - GENOMA"). El dropdown usa `nombre` como label y muestra
 * dos "PREMIOS PROVEEDORES" que parecen duplicados. La tabla sí muestra
 * los datos correctos porque lee del backend directamente.
 *
 * Reglas:
 *  - Si el value ya viene en formato compuesto "código - nombre"
 *    (típico de `reporte_prov_con_obs`), se usa el value como label
 *    (es la fuente más confiable y ya incluye el código diferenciador).
 *  - Si el value es solo un código y el label está duplicado, se
 *    prefija el label con el value para que el usuario pueda
 *    diferenciar las entradas.
 *
 * El value (usado para filtrar contra el backend) queda intacto, así
 * que el matching en `filtrarProveedoresMulti` y similares sigue
 * funcionando sin cambios.
 */
export function enriquecerOpcionesSinDuplicadosVisuales(
  opciones: FilterOption[],
): FilterOption[] {
  if (!Array.isArray(opciones) || opciones.length === 0) return opciones;

  const labelCount = new Map<string, number>();
  for (const opcion of opciones) {
    labelCount.set(opcion.label, (labelCount.get(opcion.label) ?? 0) + 1);
  }

  const enriquecidas = opciones.map((opcion) => {
    if (opcion.value === opcion.label) return opcion;

    const partes = opcion.value
      .split(/\s+-\s+/)
      .map((parte) => parte.trim())
      .filter(Boolean);

    if (partes.length >= 2) {
      return { value: opcion.value, label: opcion.value };
    }

    if ((labelCount.get(opcion.label) ?? 0) > 1) {
      return { value: opcion.value, label: `${opcion.value} - ${opcion.label}` };
    }

    return opcion;
  });

  return enriquecidas.sort((a, b) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true }),
  );
}
