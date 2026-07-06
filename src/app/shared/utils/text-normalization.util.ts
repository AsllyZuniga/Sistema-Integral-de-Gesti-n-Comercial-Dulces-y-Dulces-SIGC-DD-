/**
 * Normaliza textos provenientes del backend para uso en filtros y dropdowns.
 *
 * Problema que resuelve: el backend a veces devuelve nombres con el carácter
 * Unicode de reemplazo U+FFFD (`�`, que se ve como un rombo/diamante con un
 * signo de interrogación dentro). Esto pasa cuando hay mismatch de encoding
 * (típicamente latin-1 interpretado como UTF-8) o bytes inválidos en la
 * respuesta HTTP. En enero los datos suelen estar limpios, pero en otros
 * meses aparecen nombres como "Moctez�ma" o "Garc�a".
 *
 * IMPORTANTE: esta función NO quita tildes, diéresis ni ningún carácter
 * con acento. Las letras áéíóúñüÁÉÍÓÚÑÜ (rango U+00C0-U+00FF) se
 * preservan tal cual. Si se suben planos/archivos con nombres acentuados
 * (ej. "García", "Niño", "Guzmán", "María"), el matching contra la base
 * de datos sigue funcionando porque el carácter acentuado no se modifica.
 *
 * Tabla de rangos Unicode (para referencia):
 * ┌─────────────────────┬──────────────────────────────────────────┐
 * │ Rango               │ Caracteres                               │
 * ├─────────────────────┼──────────────────────────────────────────┤
 * │ U+0000 - U+001F     │ C0 controls (NUL, SOH, STX, ..., US)    │ ← ELIMINADOS
 * │ U+007F - U+009F     │ DEL + C1 controls                        │ ← ELIMINADOS
 * │ U+00A0 - U+00BF     │ Latin-1 punctuation (espacio duro, ¡, ¿) │ ← PRESERVADOS
 * │ U+00C0 - U+00FF     │ Latin-1 Supplement (Á-ÿ, incluye acentos)│ ← PRESERVADOS ✓
 * │ U+FFFD              │ Replacement character (�)                │ ← ELIMINADO
 * └─────────────────────┴──────────────────────────────────────────┘
 *
 * Verificación: la letra "á" es U+00E1 (225 decimal). NO está en ninguno
 * de los rangos eliminados. "Guzmán" pasa intacto: G(71) u(117) z(122)
 * m(109) á(225) n(110).
 *
 * Acciones:
 *  - Aplica normalización Unicode NFC (combina caracteres acentuados que
 *    llegaron descompuestos, ej. `n` + `˜` → `ñ`).
 *  - Elimina el carácter de reemplazo U+FFFD (`�`).
 *  - Elimina caracteres de control (U+0000-U+001F, U+007F-U+009F) que
 *    pueden aparecer por corrupción de bytes.
 *  - Colapsa espacios múltiples y recorta.
 */
export function normalizarTextoFiltro(valor: unknown): string {
  let texto = String(valor ?? '').trim();
  if (!texto) return '';

  texto = texto.normalize('NFC');
  texto = texto.replace(/\uFFFD/g, '');
  texto = texto.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  texto = texto.replace(/\s+/g, ' ').trim();

  return texto;
}

