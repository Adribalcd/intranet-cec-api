/**
 * parsearExcelResultados.js
 * Procesa el Excel de resultados de examen con hojas:
 *   ALUMNOS            – datos de cada alumno (CODIGO, DNI, NOMBRES, ÁREA, CARRERA, CICLO, AULA)
 *   ESTADÍSTICA INDIVIDUAL – resultados por alumno y por curso
 *
 * Por cada alumno devuelve:
 * {
 *   codigo, dni, nombre, area, carrera, ciclo, aula,
 *   cursos: [{ curso, total, aciertos, fallos, blanco, puntaje, '%aciertos', '%fallos', '%blanco' }, ...],
 *   global: { total, aciertos, fallos, blanco, puntaje, '%aciertos', '%fallos', '%blanco' }
 * }
 */

'use strict';

const ExcelJS = require('exceljs');

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellStr(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v.error) return null;
    if ('result' in v) {
      if (v.result === null || v.result === undefined) return null;
      if (typeof v.result === 'object' && v.result?.error) return null;
      return String(v.result).trim();
    }
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('').trim();
  }
  return String(v).trim();
}

function cellNum(cell) {
  const s = cellStr(cell);
  if (!s) return null;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function cellInt(cell) {
  const n = cellNum(cell);
  return n === null ? null : Math.round(n);
}

function normalizar(str) {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E')
    .replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔÖ]/g, 'O')
    .replace(/[ÚÙÛÜ]/g, 'U')
    .trim();
}

function findSheet(workbook, pattern) {
  return workbook.worksheets.find(ws => pattern.test(ws.name));
}

// ── Hoja ALUMNOS ──────────────────────────────────────────────────────────────

/**
 * Lee la hoja ALUMNOS y devuelve Map<key, alumno>
 * key = codigo normalizado o dni normalizado
 * Detecta columnas por nombre de cabecera.
 */
function leerHojaAlumnos(sheet) {
  const mapa = new Map(); // codigo -> alumno, también DNI -> alumno

  // Buscar fila de cabecera
  let colsCabecera = null;
  let filaDatos = null;

  sheet.eachRow((row, rowNum) => {
    if (colsCabecera) return;
    let tieneCodigo = false;
    const cols = {};

    row.eachCell((cell, colNum) => {
      const v = normalizar(cellStr(cell) || '');
      if (v === 'CODIGO' || v === 'COD' || v === 'CÓD')                     { cols.codigo = colNum; tieneCodigo = true; }
      if (v === 'DNI')                                                         cols.dni = colNum;
      if (v === 'APELLIDOS Y NOMBRES' || v === 'NOMBRES Y APELLIDOS' ||
          v === 'NOMBRES' || v === 'NOMBRE' || v === 'ALUMNO')                cols.nombre = colNum;
      if (v === 'APELLIDOS' || v === 'APELLIDO')                              cols.apellido = colNum;
      if (v === 'AREA' || v === 'ÁREA')                                       cols.area = colNum;
      if (v === 'CARRERA')                                                     cols.carrera = colNum;
      if (v === 'CICLO')                                                       cols.ciclo = colNum;
      if (v === 'AULA')                                                        cols.aula = colNum;
    });

    if (tieneCodigo || cols.dni) {
      colsCabecera = cols;
      filaDatos = rowNum + 1;
    }
  });

  if (!colsCabecera) return mapa;

  sheet.eachRow((row, rowNum) => {
    if (rowNum < filaDatos) return;

    const codigo  = colsCabecera.codigo  ? (cellStr(row.getCell(colsCabecera.codigo))  || '').trim() : null;
    const dni     = colsCabecera.dni     ? (cellStr(row.getCell(colsCabecera.dni))     || '').trim() : null;
    const nombre  = colsCabecera.nombre  ? (cellStr(row.getCell(colsCabecera.nombre))  || '').trim() : '';
    const apellido = colsCabecera.apellido ? (cellStr(row.getCell(colsCabecera.apellido)) || '').trim() : '';
    const area    = colsCabecera.area    ? (cellStr(row.getCell(colsCabecera.area))    || '').trim() : '';
    const carrera = colsCabecera.carrera ? (cellStr(row.getCell(colsCabecera.carrera)) || '').trim() : '';
    const ciclo   = colsCabecera.ciclo   ? (cellStr(row.getCell(colsCabecera.ciclo))   || '').trim() : '';
    const aula    = colsCabecera.aula    ? (cellStr(row.getCell(colsCabecera.aula))    || '').trim() : '';

    if (!codigo && !dni) return;

    const nombreCompleto = apellido ? `${apellido} ${nombre}`.trim() : nombre;
    const alumno = { codigo: codigo || '', dni: dni || '', nombre: nombreCompleto, area, carrera, ciclo, aula };

    if (codigo) mapa.set(codigo, alumno);
    if (dni)    mapa.set(dni, alumno);
  });

  return mapa;
}

// ── Hoja ESTADÍSTICA INDIVIDUAL ───────────────────────────────────────────────

/**
 * Detecta la fila de cabeceras de cursos y la fila de sub-cabeceras.
 * Devuelve:
 *   { filaCursos, filaSubHeaders, filasDatos, colId, bloques }
 *
 * bloques = [{ nombre, colTotal, colAciertos, colFallos, colBlanco, colPuntaje,
 *              colPctAciertos, colPctFallos, colPctBlanco }]
 * El bloque final se llama 'GLOBAL' / 'TOTAL GENERAL' etc.
 */
function detectarEstructuraEstadistica(sheet) {
  const SUB_HEADERS = ['TOTAL', 'ACIERTOS', 'FALLOS', 'BLANCO', 'PUNTAJE', '%ACIERTOS', '%FALLOS', '%BLANCO'];
  const PATRON_SUB  = [
    /^total$/i,
    /aciertos/i,
    /fallos/i,
    /blanco/i,
    /puntaje/i,
    /%.*aciertos|aciertos.*%/i,
    /%.*fallos|fallos.*%/i,
    /%.*blanco|blanco.*%/i,
  ];

  let filaSubHeaders = null;
  let filaCursos = null;
  let colId = null;

  // Buscar la fila que tiene las sub-cabeceras (TOTAL, ACIERTOS, FALLOS, …)
  sheet.eachRow((row, rowNum) => {
    if (filaSubHeaders) return;
    let matchCount = 0;
    row.eachCell((cell) => {
      const v = cellStr(cell) || '';
      if (PATRON_SUB.some(p => p.test(v))) matchCount++;
    });
    if (matchCount >= 4) {
      filaSubHeaders = rowNum;
      // La fila de nombres de curso está una fila antes
      filaCursos = rowNum - 1;
    }
  });

  if (!filaSubHeaders) return null;

  // Buscar la columna de identificador (CODIGO / DNI) en la fila de sub-headers
  // o en las filas anteriores
  const rowSub = sheet.getRow(filaSubHeaders);
  rowSub.eachCell((cell, colNum) => {
    if (colId) return;
    const v = normalizar(cellStr(cell) || '');
    if (v === 'CODIGO' || v === 'DNI' || v === 'COD') colId = colNum;
  });

  // Si no está en la fila de sub-headers, buscar en filas anteriores
  if (!colId) {
    for (let r = filaSubHeaders - 1; r >= Math.max(1, filaSubHeaders - 3); r--) {
      const row = sheet.getRow(r);
      row.eachCell((cell, colNum) => {
        if (colId) return;
        const v = normalizar(cellStr(cell) || '');
        if (v === 'CODIGO' || v === 'DNI' || v === 'COD') colId = colNum;
      });
      if (colId) break;
    }
  }

  if (!colId) colId = 1; // fallback: primera columna

  // Leer nombres de cursos desde la fila filaCursos
  // y sub-positions desde filaSubHeaders
  // Los bloques de sub-headers se repiten en grupos de 8 (o menos)
  const rowCursos = filaCursos >= 1 ? sheet.getRow(filaCursos) : null;

  // Recolectar posiciones de cada sub-header
  const subPositions = []; // [{ col, tipo }]  tipo = indice en PATRON_SUB
  rowSub.eachCell((cell, colNum) => {
    if (colNum <= colId) return;
    const v = cellStr(cell) || '';
    for (let i = 0; i < PATRON_SUB.length; i++) {
      if (PATRON_SUB[i].test(v)) {
        subPositions.push({ col: colNum, tipo: i });
        break;
      }
    }
  });

  if (subPositions.length === 0) return null;

  // Agrupar en bloques de 8 sub-columnas
  const bloques = [];
  const BLOQUE_SIZE = 8;
  let i = 0;
  while (i < subPositions.length) {
    const bloqueSubs = subPositions.slice(i, i + BLOQUE_SIZE);
    const colTotal        = bloqueSubs.find(s => s.tipo === 0)?.col ?? null;
    const colAciertos     = bloqueSubs.find(s => s.tipo === 1)?.col ?? null;
    const colFallos       = bloqueSubs.find(s => s.tipo === 2)?.col ?? null;
    const colBlanco       = bloqueSubs.find(s => s.tipo === 3)?.col ?? null;
    const colPuntaje      = bloqueSubs.find(s => s.tipo === 4)?.col ?? null;
    const colPctAciertos  = bloqueSubs.find(s => s.tipo === 5)?.col ?? null;
    const colPctFallos    = bloqueSubs.find(s => s.tipo === 6)?.col ?? null;
    const colPctBlanco    = bloqueSubs.find(s => s.tipo === 7)?.col ?? null;

    // Determinar nombre del curso desde filaCursos
    let nombreCurso = null;
    if (rowCursos && colTotal) {
      // Buscar nombre en la misma columna o celdas cercanas anteriores
      for (let c = colTotal; c >= Math.max(colId + 1, colTotal - 3); c--) {
        const v = (cellStr(rowCursos.getCell(c)) || '').trim();
        if (v) { nombreCurso = v; break; }
      }
    }
    if (!nombreCurso) nombreCurso = `CURSO_${bloques.length + 1}`;

    bloques.push({ nombre: nombreCurso, colTotal, colAciertos, colFallos, colBlanco, colPuntaje, colPctAciertos, colPctFallos, colPctBlanco });
    i += BLOQUE_SIZE;
  }

  return { filaCursos, filaSubHeaders, filasDatos: filaSubHeaders + 1, colId, bloques };
}

function leerBloqueAlumno(row, bloque) {
  return {
    total:        cellInt(row.getCell(bloque.colTotal))        ?? 0,
    aciertos:     cellInt(row.getCell(bloque.colAciertos))     ?? 0,
    fallos:       cellInt(row.getCell(bloque.colFallos))       ?? 0,
    blanco:       cellInt(row.getCell(bloque.colBlanco))       ?? 0,
    puntaje:      cellNum(row.getCell(bloque.colPuntaje))      ?? 0,
    '%aciertos':  cellNum(row.getCell(bloque.colPctAciertos))  ?? 0,
    '%fallos':    cellNum(row.getCell(bloque.colPctFallos))    ?? 0,
    '%blanco':    cellNum(row.getCell(bloque.colPctBlanco))    ?? 0,
  };
}

function leerHojaEstadistica(sheet) {
  const estructura = detectarEstructuraEstadistica(sheet);
  if (!estructura) throw new Error('No se pudo detectar la estructura de la hoja ESTADÍSTICA INDIVIDUAL.');

  const { filasDatos, colId, bloques } = estructura;

  // El último bloque suele ser el GLOBAL
  const PATRON_GLOBAL = /global|total.*general|general/i;
  let indiceBloqueGlobal = bloques.findIndex(b => PATRON_GLOBAL.test(b.nombre));
  if (indiceBloqueGlobal < 0) indiceBloqueGlobal = bloques.length - 1; // último bloque

  const bloquesCurso = bloques.filter((_, idx) => idx !== indiceBloqueGlobal);
  const bloqueGlobal = bloques[indiceBloqueGlobal];

  const alumnos = [];

  sheet.eachRow((row, rowNum) => {
    if (rowNum < filasDatos) return;

    const idRaw = (cellStr(row.getCell(colId)) || '').trim();
    if (!idRaw || idRaw === '' || !/\S/.test(idRaw)) return;
    // Filtrar filas de totales/promedios
    const idNorm = normalizar(idRaw);
    if (idNorm === 'TOTAL' || idNorm === 'PROMEDIO' || idNorm === 'MEDIA') return;

    const cursos = bloquesCurso.map(bloque => ({
      curso: bloque.nombre,
      ...leerBloqueAlumno(row, bloque),
    }));

    const global = bloqueGlobal ? leerBloqueAlumno(row, bloqueGlobal) : null;

    alumnos.push({ codigo: idRaw, cursos, global });
  });

  return alumnos;
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Procesa el buffer del Excel y devuelve array de alumnos con sus resultados.
 * @param {Buffer} buffer
 * @returns {Promise<{ alumnos: Array }>}
 */
async function parsearExcelResultados(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const hojaAlumnos = findSheet(workbook, /^alumnos$/i)
    || findSheet(workbook, /alumnos/i);
  const hojaEstadistica = findSheet(workbook, /estad[ií]stica\s*individual/i)
    || findSheet(workbook, /individual/i)
    || findSheet(workbook, /estad[ií]stica/i);

  if (!hojaAlumnos) throw new Error('No se encontró la hoja ALUMNOS en el Excel.');
  if (!hojaEstadistica) throw new Error('No se encontró la hoja ESTADÍSTICA INDIVIDUAL en el Excel.');

  const mapaAlumnos = leerHojaAlumnos(hojaAlumnos);
  const estadisticas = leerHojaEstadistica(hojaEstadistica);

  const alumnos = estadisticas.map(est => {
    // Buscar metadatos del alumno por código o DNI
    const meta = mapaAlumnos.get(est.codigo)
      || mapaAlumnos.get(est.codigo.replace(/^0+/, '')) // sin ceros a la izquierda
      || {};
    return {
      codigo:  meta.codigo  ?? est.codigo,
      dni:     meta.dni     ?? '',
      nombre:  meta.nombre  ?? '',
      area:    meta.area    ?? '',
      carrera: meta.carrera ?? '',
      ciclo:   meta.ciclo   ?? '',
      aula:    meta.aula    ?? '',
      cursos:  est.cursos,
      global:  est.global,
    };
  });

  return { alumnos };
}

module.exports = { parsearExcelResultados };
