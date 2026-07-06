/**
 * Diccionario canónico de municipios de Nariño (Colombia) y otros que
 * aparecen en la data del dashboard.
 *
 * POR QUÉ EXISTE
 * ──────────────
 * En enero los datos llegan bien desde el backend (UTF-8 correcto, tildes
 * y ñ intactas). En febrero en adelante, el backend empieza a entregar los
 * nombres con las letras acentuadas directamente OMITIDAS (no reemplazadas
 * por la base), por ejemplo:
 *   - "Albán"          -> "Albn"     (letra + tilde omitida)
 *   - "Chachagüí"      -> "Chachag"  (ü + í omitidas)
 *   - "El Peñol"       -> "El Peol"  (ñ omitida)
 *   - "Bogotá, D.C."   -> "Bogot, D.C."
 * Esto sucede cuando el stored procedure / query hace algo como
 * `REPLACE(ciudad COLLATE Latin1_General_CI_AS, 'á', '')` o concatena con
 * un campo de otra tabla con collation distinto. La información se pierde
 * a nivel SQL y el front ya no puede saber qué carácter se omitió.
 *
 * El front no puede decodificar UTF-8 desde un string corrupto, pero SÍ
 * puede hacer fuzzy-matching (Levenshtein) contra un diccionario de
 * municipios para devolver el nombre oficial con su acentuación.
 *
 * CÓMO SE USA
 * ────────────
 *   import { repararNombreMunicipio } from '.../narino-municipios.util';
 *   const ciudad = repararNombreMunicipio(item.ciudad);
 */
import { normalizarTextoFiltro } from './text-normalization.util';

/**
 * Quita tildes/diéresis, colapsa separadores y pasa a MAYÚSCULAS. Esto
 * permite comparar "Albán" / "alban" / "ALBÁN" como "ALBAN".
 */
function pelarParaLookup(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s,._-]+/g, '')
    .trim();
}

/**
 * Distancia Levenshtein O(n*m) estándar. Suficiente para 80 municipios
 * (≈6.400 comparaciones) en el peor caso, que se ejecuta una sola vez
 * por render gracias al cache.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // inserción
        prev[j] + 1,            // borrado
        prev[j - 1] + cost,     // sustitución
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Diccionario: clave = nombre pelado en MAYÚSCULAS, valor = nombre oficial.
 *
 * Incluye los 64 municipios de Nariño + Cali (que aparece en la data
 * aunque no es de Nariño). Si el sistema empieza a traer municipios de
 * otros departamentos, agrégalos aquí.
 */
const MAPA_NARINO: Readonly<Record<string, string>> = Object.freeze({
  ALBAN: 'Albán',
  ALDANA: 'Aldana',
  ANCUYA: 'Ancuya',
  ARGELIA: 'Argelia',
  BALBOA: 'Balboa',
  BARBACOAS: 'Barbacoas',
  BELEN: 'Belén',
  BOGOTADC: 'Bogotá, D.C.',
  BOLIVAR: 'Bolívar',
  BUESACO: 'Buesaco',
  CALI: 'Cali',
  CHACHAGUI: 'Chachagüí',
  COLON: 'Colón',
  COLONGENOVA: 'Colón-Génova',
  CONSACA: 'Consacá',
  CONTADERO: 'Contadero',
  CORDOBA: 'Córdoba',
  CUASPUD: 'Cuaspud',
  CUMBAL: 'Cumbal',
  CUMBITARA: 'Cumbitara',
  ELPENOL: 'El Peñol',
  ELROSARIO: 'El Rosario',
  ELTABLONDEGOMEZ: 'El Tablón De Gómez',
  ELTAMBO: 'El Tambo',
  FLORENCIA: 'Florencia',
  FUNES: 'Funes',
  GUACHUCAL: 'Guachucal',
  GUAITARILLA: 'Guaitarilla',
  GUALMATAN: 'Gualmatán',
  ILES: 'Iles',
  IMUES: 'Imués',
  IPIALES: 'Ipiales',
  LACRUZ: 'La Cruz',
  LAFLORIDA: 'La Florida',
  LALLANADA: 'La Llanada',
  LASIERRA: 'La Sierra',
  LAUNION: 'La Unión',
  LEIVA: 'Leiva',
  LETICIA: 'Leticia',
  LINARES: 'Linares',
  LOSANDES: 'Los Andes',
  MAGUI: 'Magüí',
  MALLAMA: 'Mallama',
  MERCADERES: 'Mercaderes',
  MOCOA: 'Mocoa',
  NARINO: 'Nariño',
  ORITO: 'Orito',
  OSPINA: 'Ospina',
  PASTO: 'Pasto',
  PATIA: 'Patía',
  POLICARPA: 'Policarpa',
  POPAYAN: 'Popayán',
  POTOSI: 'Potosí',
  PUERRES: 'Puerres',
  PUERTOASIS: 'Puerto Asís',
  PUERTOCAICEDO: 'Puerto Caicedo',
  PUERTOGUZMAN: 'Puerto Guzmán',
  PUERTOLEGUIZAMO: 'Puerto Leguízamo',
  PUPIALES: 'Pupiales',
  RICAURTE: 'Ricaurte',
  ROSAS: 'Rosas',
  SAMANIEGO: 'Samaniego',
  SANANDRESDETUMACO: 'San Andrés De Tumaco',
  SANBERNARDO: 'San Bernardo',
  SANFRANCISCO: 'San Francisco',
  SANLORENZO: 'San Lorenzo',
  SANMIGUEL: 'San Miguel',
  SANPABLO: 'San Pablo',
  SANPEDRODECARTAGO: 'San Pedro De Cartago',
  SANDONA: 'Sandoná',
  SANTACRUZ: 'Santacruz',
  SANTIAGO: 'Santiago',
  SAPUYES: 'Sapuyes',
  SIBUNDOY: 'Sibundoy',
  TAMINANGO: 'Taminango',
  TANGUA: 'Tangua',
  TIMBIO: 'Timbío',
  TUQUERRES: 'Túquerres',
  VALLEDELGUAMUEZ: 'Valle Del Guamuez',
  VILLAGARZON: 'Villagarzón',
  YACUANQUER: 'Yacuanquer',
});

/**
 * Lista de keys del diccionario, pre-computada una sola vez para que
 * cada llamada a `repararNombreMunicipio` no tenga que iterar el objeto.
 */
const KEYS_DICCIONARIO: readonly string[] = Object.freeze(Object.keys(MAPA_NARINO));

/**
 * Threshold de Levenshtein permitido. Lo calculamos como 1 para nombres
 * de 4-6 letras y 2 para nombres más largos. Esto evita falsos positivos
 * entre municipios parecidos (ej. Cali/Calima) y a la vez repara las
 * omisiones típicas (1-2 letras acentuadas perdidas).
 */
function thresholdPara(len: number): number {
  if (len <= 5) return 1;
  if (len <= 10) return 2;
  return 3;
}

/**
 * Busca la key del diccionario más cercana al input pelado.
 * Devuelve la key si la distancia ≤ threshold y NO hay empate, si no null.
 */
function buscarKeyPorLevenshtein(inputKey: string): string | null {
  const threshold = thresholdPara(inputKey.length);
  let mejorDist = Infinity;
  let mejorKey: string | null = null;
  let empates = 0;

  for (const key of KEYS_DICCIONARIO) {
    // Atajo: si las longitudes difieren más que el threshold, ni mido.
    if (Math.abs(key.length - inputKey.length) > threshold) continue;

    // Atajo: el primer carácter debe coincidir (reduce falsos positivos).
    if (key.charCodeAt(0) !== inputKey.charCodeAt(0)) continue;

    const d = levenshtein(key, inputKey);
    if (d < mejorDist) {
      mejorDist = d;
      mejorKey = key;
      empates = 1;
    } else if (d === mejorDist) {
      empates++;
    }
  }

  if (mejorKey === null) return null;
  if (mejorDist > threshold) return null;
  if (empates > 1) return null; // ambiguo, no reparamos
  return mejorKey;
}

/**
 * Intenta reparar el nombre de un municipio cuando llega sin tildes
 * del backend. Devuelve el nombre oficial si encuentra un match único
 * en el diccionario (con tolerancia Levenshtein), o el valor saneado
 * si no hay match.
 */
export function repararNombreMunicipio(valor: unknown): string {
  const saneado = normalizarTextoFiltro(valor);
  if (!saneado) return '';

  const key = pelarParaLookup(saneado);

  // 1) Match exacto: el caso "Pasto" sin tilde, o "Bogotá, D.C." con tildes
  //    bien puestas, o "Magüí" etc. No tocamos nada.
  const exacto = MAPA_NARINO[key];
  if (exacto) return exacto;

  // 2) Match por Levenshtein: repara "Albn" -> "Albán", "Chachag" -> "Chachagüí", etc.
  const fuzzyKey = buscarKeyPorLevenshtein(key);
  if (fuzzyKey) return MAPA_NARINO[fuzzyKey];

  // 3) Sin match: devolvemos el valor saneado (sirve para categorías,
  //    líneas, o municipios de otros deptos que no están en el diccionario).
  return saneado;
}
