/**
 * parsearExcelSimulacro.js
 * Lee el archivo Excel de simulacro OMR (Áreas A-E) y devuelve
 * la estructura de datos lista para persistir.
 *
 * Estructura esperada del Excel (1ª hoja):
 *
 *  Bloque 1 – Matriz de ponderaciones:
 *    ÁREA | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10
 *    A    |  4 | 20 |  8 | 16 | 12 |  8 | 20 |  4 | 12 |  16
 *    B    |  8 | 16 |  4 | 12 |  4 | 20 |  4 | 16 | 16 |   8
 *    C    | 12 | 12 | 20 | 20 |  8 |  4 | 16 | 12 |  4 |  20
 *    D    | 16 |  8 | 12 |  8 | 20 | 16 | 12 | 20 |  8 |   4
 *    E    | 20 |  4 | 16 |  4 | 16 | 12 |  8 |  8 | 20 |  12
 *
 *  Bloque 2 – Tabla principal:
 *    Fila header : DNI | R1..R100 | [spacer] | DNI' | APELLIDOS Y NOMBRES |
 *                  ÁREA | CARRERA | CICLO | AULA |
 *                  [SECCIÓN ACTITUDINAL × 4] | [HAB. VERBAL × 4] | ... | [BIOLOGÍA × 4] | [TOTAL × 4]
 *    Fila CLAVES : "CLAVES" | <clave1>..<clave100> | … | B | M | N.C | PUNTAJE | …
 *    Filas datos : <DNI numérico> | <R1..R100 letras> | … | datos calculados por Excel
 *
 * Los puntajes por curso ya vienen calculados por las fórmulas del Excel.
 * Este parser los lee directamente sin recalcularlos.
 */

'use strict';

const ExcelJS = require('exceljs');

// Orden exacto de los cursos/secciones en las columnas (cada uno ocupa 4 cols: B, M, N.C, PUNTAJE)
const CURSOS_SIMULACRO = [
  'Actitudinal',
  'Habilidad Verbal',
  'Habilidad Lógico-Matemática',
  'Aritmética',
  'Geometría',
  'Álgebra',
  'Trigonometría',
  'Lenguaje',
  'Literatura',
  'Psicología',
  'Ed. Cívica',
  'Hist. del Perú',
  'Hist. Universal',
  'Geografía',
  'Economía',
  'Filosofía',
  'Física',
  'Química',
  'Biología',
];

// Textos que pueden aparecer en las cabeceras de los cursos (Excel puede variar mayúsculas/acentos)
const PATRON_CURSOS = [
  /actitudinal/i,
  /hab.*verbal|verbal/i,
  /hab.*log|l[oó]gico/i,
  /aritm[eé]tica/i,
  /geometr[ií]a/i,
  /[aá]lgebra/i,
  /trigonometr[ií]a/i,
  /lenguaje/i,
  /literatura/i,
  /psicolog[ií]a/i,
  /c[ií]vica|civismo/i,
  /hist.*per[uú]/i,
  /hist.*univ/i,
  /geograf[ií]a/i,
  /econom[ií]a/i,
  /filosof[ií]a/i,
  /f[ií]sica/i,
  /qu[ií]mica/i,
  /biolog[ií]a/i,
];

/**
 * Devuelve el valor de una celda como string limpio.
 * Maneja errores de fórmula (#N/D, #VALUE!, etc.) devolviendo null.
 */
function cellStr(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    // ExcelJS devuelve errores como { error: '#N/D' }
    if (v.error) return null;
    // Fórmulas con resultado
    if ('result' in v) {
      if (v.result === null || v.result === undefined) return null;
      if (typeof v.result === 'object' && v.result?.error) return null;
      return String(v.result).trim();
    }
    // RichText
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('').trim();
  }
  return String(v).trim();
}

function cellNum(cell) {
  const s = cellStr(cell);
  if (!s) return null;
  // Normalizar comas como separador decimal (formato europeo)
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function cellInt(cell) {
  const n = cellNum(cell);
  return n === null ? null : Math.round(n);
}

/**
 * Detecta la fila y columna de inicio de la matriz de ponderaciones.
 * Busca una fila cuya primera celda sea "ÁREA" / "AREA" y la siguiente "P1".
 */
function detectarMatrizPonderaciones(sheet) {
  let filaInicio = null;
  let colInicio = null;

  sheet.eachRow((row, rowNum) => {
    if (filaInicio) return;
    row.eachCell((cell, colNum) => {
      if (filaInicio) return;
      const v = String(cell.value || '').trim().toUpperCase().replace('Á','A');
      if (v === 'AREA' || v === 'ÁREA') {
        // Verificar que la siguiente celda sea P1
        const next = String(row.getCell(colNum + 1).value || '').trim().toUpperCase();
        if (next === 'P1') {
          filaInicio = rowNum;
          colInicio = colNum;
        }
      }
    });
  });

  return { filaInicio, colInicio };
}

/**
 * Lee la matriz 5×10 de ponderaciones.
 * Devuelve: { A: [4,20,8,...], B: [...], C: [...], D: [...], E: [...] }
 */
function leerMatrizPonderaciones(sheet, filaInicio, colInicio) {
  const mapa = {};
  for (let i = 1; i <= 5; i++) {
    const row = sheet.getRow(filaInicio + i);
    const area = String(row.getCell(colInicio).value || '').trim().toUpperCase();
    if (!['A','B','C','D','E'].includes(area)) continue;
    const vals = [];
    for (let p = 1; p <= 10; p++) {
      vals.push(cellNum(row.getCell(colInicio + p)) ?? 0);
    }
    mapa[area] = vals;
  }
  return mapa;
}

/**
 * Detecta la fila del header principal (tiene "DNI" en col y "R1" en la siguiente).
 * Devuelve { filaHeader, colDni1, colR1, colDni2, colNombre, colArea,
 *             colCarrera, colCiclo, colAula, colCursosStart }
 */
function detectarColumnas(sheet) {
  let info = null;

  sheet.eachRow((row, rowNum) => {
    if (info) return;

    // Buscar "DNI" seguido de "R1"
    row.eachCell((cell, colNum) => {
      if (info) return;
      const v = String(cell.value || '').trim().toUpperCase();
      if (v !== 'DNI') return;
      const sig = String(row.getCell(colNum + 1).value || '').trim().toUpperCase();
      if (sig !== 'R1') return;

      // Encontrado: esta es la fila de cabecera principal
      const colDni1 = colNum;
      const colR1   = colNum + 1;
      let colDni2 = null, colNombre = null, colArea = null;
      let colCarrera = null, colCiclo = null, colAula = null;

      row.eachCell((c2, cn2) => {
        if (cn2 <= colR1 + 99) return; // skip R1–R100
        const val = String(c2.value || '').trim().toUpperCase()
          .replace(/[ÁÀÂÄ]/g,'A').replace(/[ÉÈÊË]/g,'E')
          .replace(/[ÍÌÎÏ]/g,'I').replace(/[ÓÒÔÖ]/g,'O')
          .replace(/[ÚÙÛÜ]/g,'U');

        if (val === 'DNI' && !colDni2)          colDni2    = cn2;
        if ((val === 'APELLIDOS Y NOMBRES' || val === 'APELLIDOS Y NOMBRE') && !colNombre)
                                                 colNombre  = cn2;
        if (val === 'AREA' && cn2 > colR1 + 99 && !colArea) colArea = cn2;
        if (val === 'CARRERA' && !colCarrera)    colCarrera = cn2;
        if (val === 'CICLO'   && !colCiclo)      colCiclo   = cn2;
        if (val === 'AULA'    && !colAula)        colAula    = cn2;
      });

      // El bloque de cursos empieza justo después de AULA
      const colCursosStart = colAula ? colAula + 1 : null;

      info = { filaHeader: rowNum, colDni1, colR1, colDni2,
               colNombre, colArea, colCarrera, colCiclo, colAula, colCursosStart };
    });
  });

  return info;
}

/**
 * Lee la fila CLAVES y extrae el array de 100 claves (letras A-E o null).
 */
function leerClaves(sheet, filaHeader, colR1) {
  const claves = Array(100).fill(null);
  let filaClaves = null;

  sheet.eachRow((row, rowNum) => {
    if (filaClaves || rowNum <= filaHeader) return;
    const v = String(row.getCell(1).value || '').trim().toUpperCase();
    // Buscar "CLAVES" en cualquiera de las primeras 3 columnas
    let found = false;
    for (let c = 1; c <= 3; c++) {
      if (String(row.getCell(c).value || '').trim().toUpperCase() === 'CLAVES') {
        found = true; break;
      }
    }
    if (found) filaClaves = rowNum;
  });

  if (!filaClaves) return { claves, filaClaves: null };

  const row = sheet.getRow(filaClaves);
  for (let i = 0; i < 100; i++) {
    const v = String(row.getCell(colR1 + i).value || '').trim().toUpperCase();
    claves[i] = ['A','B','C','D','E'].includes(v) ? v : null;
  }
  return { claves, filaClaves };
}

/**
 * Detecta las posiciones de columna de los cursos buscando los patrones en la
 * fila de cabecera o en las filas adyacentes.
 * Devuelve un array de índices de columna inicio para cada curso (col de "B").
 * Si no puede detectar, usa colCursosStart + idx*4 como fallback.
 */
function detectarColsCursos(sheet, filaHeader, filaClaves, colCursosStart) {
  // Intentar detectar desde la fila header principal (nombres de curso en celdas merged)
  const colsCursos = [];
  let encontrados = 0;

  if (colCursosStart) {
    const row = sheet.getRow(filaHeader);
    // Escanear columnas desde colCursosStart buscando patrones de nombre de curso
    let col = colCursosStart;
    for (let ci = 0; ci < PATRON_CURSOS.length; ci++) {
      // Buscar la siguiente celda no vacía que coincida con el patrón
      let found = false;
      for (let offset = 0; offset < 8; offset++) {
        const v = cellStr(row.getCell(col + offset)) || '';
        if (PATRON_CURSOS[ci].test(v)) {
          colsCursos.push(col + offset + 1); // +1: la col del curso es el nombre, B empieza 1 después
          // Avanzar al siguiente bloque (el curso ocupa 4 cols: nombre + B + M + NC + PUNTAJE = en realidad el nombre es merged)
          // En la mayoría de los casos el curso ocupa 4 columnas de datos
          col = col + offset + 4;
          found = true;
          encontrados++;
          break;
        }
      }
      if (!found) {
        // Fallback: usar posición fija
        colsCursos.push(colCursosStart + ci * 4);
        col = colCursosStart + (ci + 1) * 4;
      }
    }
  }

  // Si no pudo detectar nada, usar fallback completamente fijo
  if (encontrados < 3 && colCursosStart) {
    colsCursos.length = 0;
    for (let i = 0; i < CURSOS_SIMULACRO.length; i++) {
      colsCursos.push(colCursosStart + i * 4);
    }
  }

  return colsCursos;
}

/**
 * Lee un número de la celda, tolerando formatos ES (coma decimal) y errores de fórmula.
 */
function leerPuntajeCurso(row, colBase) {
  // colBase = columna de "B" (buenas)
  // colBase+0 = B, colBase+1 = M (malas, valor negativo), colBase+2 = N.C, colBase+3 = PUNTAJE
  const buenas  = cellInt(row.getCell(colBase))     ?? 0;
  const malasRaw = cellNum(row.getCell(colBase + 1)) ?? 0;
  const malas   = Math.abs(malasRaw); // viene como negativo en el Excel
  const nc      = cellInt(row.getCell(colBase + 2)) ?? 0;
  const puntaje = cellNum(row.getCell(colBase + 3));
  return { buenas, malas, nc, puntaje };
}

/**
 * Función principal exportada.
 * @param {string|Buffer} fuente  Ruta al archivo o Buffer en memoria
 * @returns {Promise<ParseResult>}
 */
async function parsearExcelSimulacro(fuente) {
  const workbook = new ExcelJS.Workbook();

  if (Buffer.isBuffer(fuente)) {
    await workbook.xlsx.load(fuente);
  } else {
    await workbook.xlsx.readFile(fuente);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('El archivo no contiene hojas de cálculo.');

  // ── 1. Matriz de ponderaciones ────────────────────────────────────────────
  const { filaInicio: filaMatriz, colInicio: colMatriz } = detectarMatrizPonderaciones(sheet);
  const ponderaciones = filaMatriz
    ? leerMatrizPonderaciones(sheet, filaMatriz, colMatriz)
    : {};

  // ── 2. Detectar columnas ──────────────────────────────────────────────────
  const cols = detectarColumnas(sheet);
  if (!cols) {
    throw new Error('No se encontró la fila de cabecera (DNI | R1 | R2 | …). Verifica el formato del Excel.');
  }
  const { filaHeader, colDni1, colR1, colDni2,
          colNombre, colArea, colCarrera, colCiclo, colAula, colCursosStart } = cols;

  // ── 3. Claves de respuesta ────────────────────────────────────────────────
  const { claves, filaClaves } = leerClaves(sheet, filaHeader, colR1);
  const filaDatosStart = filaClaves ? filaClaves + 1 : filaHeader + 2;

  // ── 4. Posiciones de columnas de cursos ───────────────────────────────────
  const colsCursos = detectarColsCursos(sheet, filaHeader, filaClaves, colCursosStart);

  // Columnas del total global (después del último curso)
  const colTotal = colCursosStart
    ? colCursosStart + CURSOS_SIMULACRO.length * 4
    : null;

  // ── 5. Leer filas de alumnos ──────────────────────────────────────────────
  const alumnos = [];
  const errores = [];

  sheet.eachRow((row, rowNum) => {
    if (rowNum < filaDatosStart) return;

    // DNI: debe ser numérico
    const dniRaw = cellStr(row.getCell(colDni1));
    if (!dniRaw || !/^\d{7,12}$/.test(dniRaw.replace(/\s/g, ''))) return;
    const dni = dniRaw.replace(/\s/g, '');

    // Respuestas R1-R100
    const respuestas = [];
    for (let i = 0; i < 100; i++) {
      const v = (cellStr(row.getCell(colR1 + i)) || '').toUpperCase();
      respuestas.push(['A','B','C','D','E'].includes(v) ? v : null);
    }

    // Metadatos del alumno (del bloque derecho)
    const apellidosNombres = colNombre  ? (cellStr(row.getCell(colNombre))  || '').trim() : '';
    const area             = colArea    ? (cellStr(row.getCell(colArea))    || '').trim().toUpperCase() : null;
    const carrera          = colCarrera ? (cellStr(row.getCell(colCarrera)) || '').trim() : '';
    const cicloNombre      = colCiclo   ? (cellStr(row.getCell(colCiclo))   || '').trim() : '';
    const aula             = colAula    ? (cellStr(row.getCell(colAula))    || '').trim() : '';

    // Validar área
    const areaVal = ['A','B','C','D','E'].includes(area) ? area : null;

    // Puntajes por curso (ya calculados por Excel)
    const puntajesCurso = {};
    CURSOS_SIMULACRO.forEach((nombre, idx) => {
      const colBase = colsCursos[idx];
      if (!colBase) { puntajesCurso[nombre] = { buenas: 0, malas: 0, nc: 0, puntaje: null }; return; }
      puntajesCurso[nombre] = leerPuntajeCurso(row, colBase);
    });

    // Total global
    let totalBuenas = 0, totalMalas = 0, totalNC = 0, puntajeGlobal = null;
    if (colTotal) {
      totalBuenas  = cellInt(row.getCell(colTotal))     ?? 0;
      const mRaw   = cellNum(row.getCell(colTotal + 1)) ?? 0;
      totalMalas   = Math.abs(mRaw);
      totalNC      = cellInt(row.getCell(colTotal + 2)) ?? 0;
      puntajeGlobal = cellNum(row.getCell(colTotal + 3));
    }

    // Si no hay puntaje global calculado, lo derivamos de las ponderaciones
    if (puntajeGlobal === null && areaVal && ponderaciones[areaVal]) {
      puntajeGlobal = calcularPuntajeDesdeRespuestas(respuestas, claves, ponderaciones[areaVal]);
    }

    alumnos.push({
      dni,
      apellidosNombres,
      area: areaVal,
      carrera,
      cicloNombre,
      aula,
      respuestas,
      puntajesCurso,
      puntajeGlobal,
      totalBuenas,
      totalMalas,
      totalNC,
    });
  });

  // ── 6. Determinar el área dominante del examen ────────────────────────────
  let areaDelExamen = null;
  if (alumnos.length > 0) {
    const conteo = {};
    alumnos.forEach(a => { if (a.area) conteo[a.area] = (conteo[a.area] || 0) + 1; });
    const max = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    areaDelExamen = max[0]?.[0] ?? null;
  }

  return {
    ponderaciones,
    areaDelExamen,
    claves,
    alumnos,
    errores,
    meta: { totalFilasLeidas: alumnos.length },
  };
}

/**
 * Calcula el puntaje global desde respuestas crudas cuando el Excel no tiene
 * los valores pre-calculados.
 * Fórmula: cada grupo de 10 preguntas tiene un peso Px.
 * puntaje = Σ(buenas_en_grupo × Px) − Σ(malas_en_grupo × Px / factor_mala)
 * Usamos la relación conocida: factor_mala ≈ 20/1.125 ≈ 17.78 (basado en sistema existente)
 */
function calcularPuntajeDesdeRespuestas(respuestas, claves, ponderaciones) {
  if (!ponderaciones || ponderaciones.length < 10) return null;
  let total = 0;
  for (let i = 0; i < 100; i++) {
    const grupo = Math.floor(i / 10); // 0-9
    const p = ponderaciones[grupo] ?? 0;
    if (respuestas[i] === null) continue; // N.C → 0
    if (claves[i] === null) continue;     // sin clave → skip
    if (respuestas[i] === claves[i]) {
      total += p;
    } else {
      total -= p * (1.125 / 20); // misma proporción que el sistema base
    }
  }
  return Math.max(0, parseFloat(total.toFixed(3)));
}

module.exports = { parsearExcelSimulacro, CURSOS_SIMULACRO };
