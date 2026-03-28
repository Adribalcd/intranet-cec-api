/**
 * parsearExcelResultados.js
 *
 * Formato ESTADÍSTICA INDIVIDUAL (hoja vertical):
 *   Por cada alumno existe un bloque con:
 *     - Fila "DNI"               | valor
 *     - Fila "APELLIDOS Y NOMBRES"| valor
 *     - Fila "ÁREA"              | valor
 *     - Fila "CARRERA"           | valor
 *     - Fila "CICLO"             | valor
 *     - Fila "AULA"              | valor
 *     - Fila cabecera: CURSOS | Total | Aciertos | Fallos | Blanco | PUNTAJE | %Aciertos | %Fallos | %Blanco
 *     - Filas de cursos: nombre_curso | total | aciertos | fallos | blanco | puntaje | %a | %f | %b
 *     - Fila GLOBAL: GLOBAL | total | aciertos | fallos | blanco | puntaje | %a | %f | %b
 *
 * Los bloques se repiten verticalmente para cada alumno.
 *
 * Hoja ALUMNOS (opcional): proporciona mapeo DNI → CODIGO para lookup en BD.
 */

'use strict';

const ExcelJS = require('exceljs');

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellStr(cell) {
  if (!cell) return null;
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
  // Eliminar símbolos de porcentaje y comas decimales europeas
  const clean = s.replace('%', '').replace(',', '.').trim();
  const n = parseFloat(clean);
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

/**
 * Devuelve el texto de la primera celda no vacía de la fila en el rango de columnas dado.
 */
function primerTexto(row, colDesde, colHasta) {
  for (let c = colDesde; c <= colHasta; c++) {
    const v = cellStr(row.getCell(c));
    if (v) return { texto: v, col: c };
  }
  return null;
}

/**
 * Devuelve el valor numérico/texto de la siguiente celda no vacía después de colDesde.
 */
function siguienteValor(row, colDesde) {
  for (let c = colDesde; c <= colDesde + 10; c++) {
    const v = cellStr(row.getCell(c));
    if (v) return v;
  }
  return null;
}

function findSheet(workbook, pattern) {
  return workbook.worksheets.find(ws => pattern.test(ws.name));
}

// ── Hoja ALUMNOS (opcional) ───────────────────────────────────────────────────

/**
 * Lee la hoja ALUMNOS y devuelve Map<dni, { codigo, nombre, area, carrera, ciclo, aula }>
 */
function leerHojaAlumnos(sheet) {
  const mapa = new Map();
  if (!sheet) return mapa;

  let cols = null;
  let filaDatos = null;

  sheet.eachRow((row, rowNum) => {
    if (cols) return;
    const found = {};
    row.eachCell((cell, colNum) => {
      const v = normalizar(cellStr(cell) || '');
      if (v === 'CODIGO' || v === 'COD')                           found.codigo = colNum;
      if (v === 'DNI')                                              found.dni = colNum;
      if (v === 'APELLIDOS Y NOMBRES' || v === 'NOMBRES' ||
          v === 'NOMBRE' || v === 'ALUMNO')                        found.nombre = colNum;
      if (v === 'APELLIDOS' || v === 'APELLIDO')                   found.apellido = colNum;
      if (v === 'AREA' || v === 'ÁREA')                            found.area = colNum;
      if (v === 'CARRERA')                                          found.carrera = colNum;
      if (v === 'CICLO')                                            found.ciclo = colNum;
      if (v === 'AULA')                                             found.aula = colNum;
    });
    if (found.dni || found.codigo) {
      cols = found;
      filaDatos = rowNum + 1;
    }
  });

  if (!cols) return mapa;

  sheet.eachRow((row, rowNum) => {
    if (rowNum < filaDatos) return;
    const codigo  = cols.codigo  ? (cellStr(row.getCell(cols.codigo))  || '').trim() : '';
    const dni     = cols.dni     ? (cellStr(row.getCell(cols.dni))     || '').trim() : '';
    const nombre  = cols.nombre  ? (cellStr(row.getCell(cols.nombre))  || '').trim() : '';
    const apellido = cols.apellido ? (cellStr(row.getCell(cols.apellido)) || '').trim() : '';
    const area    = cols.area    ? (cellStr(row.getCell(cols.area))    || '').trim() : '';
    const carrera = cols.carrera ? (cellStr(row.getCell(cols.carrera)) || '').trim() : '';
    const ciclo   = cols.ciclo   ? (cellStr(row.getCell(cols.ciclo))   || '').trim() : '';
    const aula    = cols.aula    ? (cellStr(row.getCell(cols.aula))    || '').trim() : '';
    if (!dni && !codigo) return;
    const nombreCompleto = apellido ? `${apellido} ${nombre}`.trim() : nombre;
    const alumno = { codigo, nombre: nombreCompleto, area, carrera, ciclo, aula };
    if (dni)    mapa.set(dni, alumno);
    if (codigo) mapa.set(codigo, alumno);
  });

  return mapa;
}

// ── Hoja ESTADÍSTICA INDIVIDUAL (bloques verticales) ─────────────────────────

/**
 * Lee la hoja con bloques verticales por alumno.
 * Cada bloque empieza con una fila que tiene la etiqueta "DNI" en las primeras columnas.
 *
 * Devuelve array de:
 * { dni, nombre, area, carrera, ciclo, aula, cursos: [...], global: {...} }
 */
function leerHojaEstadistica(sheet) {
  const alumnos = [];

  // Primero detectar qué columnas tienen los datos de la tabla de cursos.
  // Lo hacemos buscando la fila de cabecera CURSOS | Total | Aciertos | ...
  // Los índices de columna son fijos para todos los bloques en el mismo sheet.
  let colCursoNombre = null;
  let colTotal = null, colAciertos = null, colFallos = null, colBlanco = null;
  let colPuntaje = null, colPctAciertos = null, colPctFallos = null, colPctBlanco = null;

  const PATRON_HEADERS = {
    total:       /^total$/i,
    aciertos:    /^aciertos$/i,
    fallos:      /^fallos$/i,
    blanco:      /^blanco$/i,
    puntaje:     /^puntaje$/i,
    pctAciertos: /%.*aciertos|aciertos.*%/i,
    pctFallos:   /%.*fallos|fallos.*%/i,
    pctBlanco:   /%.*blanco|blanco.*%/i,
  };

  sheet.eachRow((row, rowNum) => {
    if (colTotal) return; // ya detectado
    let foundCount = 0;
    const temp = {};
    row.eachCell((cell, colNum) => {
      const v = cellStr(cell) || '';
      for (const [key, pat] of Object.entries(PATRON_HEADERS)) {
        if (pat.test(v)) { temp[key] = colNum; foundCount++; }
      }
      // Detectar columna de nombre de curso (antes de Total)
      if (/^cursos$/i.test(v)) temp.cursoNombre = colNum;
    });
    if (foundCount >= 4) {
      colCursoNombre  = temp.cursoNombre  ?? 2; // fallback col B
      colTotal        = temp.total;
      colAciertos     = temp.aciertos;
      colFallos       = temp.fallos;
      colBlanco       = temp.blanco;
      colPuntaje      = temp.puntaje;
      colPctAciertos  = temp.pctAciertos;
      colPctFallos    = temp.pctFallos;
      colPctBlanco    = temp.pctBlanco;
    }
  });

  // Si no se detectaron columnas de tabla, intentar con posiciones típicas (B=2, D=4, E=5, F=6, G=7, H=8, I=9, J=10, K=11)
  if (!colTotal) {
    colCursoNombre = 2; colTotal = 4; colAciertos = 5; colFallos = 6;
    colBlanco = 7; colPuntaje = 8; colPctAciertos = 9; colPctFallos = 10; colPctBlanco = 11;
  }

  function leerFilaCurso(row) {
    return {
      total:       cellInt(row.getCell(colTotal))        ?? 0,
      aciertos:    cellInt(row.getCell(colAciertos))     ?? 0,
      fallos:      cellInt(row.getCell(colFallos))       ?? 0,
      blanco:      cellInt(row.getCell(colBlanco))       ?? 0,
      puntaje:     cellNum(row.getCell(colPuntaje))      ?? 0,
      '%aciertos': cellNum(row.getCell(colPctAciertos))  ?? 0,
      '%fallos':   cellNum(row.getCell(colPctFallos))    ?? 0,
      '%blanco':   cellNum(row.getCell(colPctBlanco))    ?? 0,
    };
  }

  // Ahora leer los bloques por alumno
  let alumnoActual = null;
  let leyendoCursos = false;

  sheet.eachRow((row, rowNum) => {
    // Buscar etiqueta "DNI" en las primeras 5 columnas
    const primeraCelda = primerTexto(row, 1, 5);
    if (!primeraCelda) return;

    const etiqueta = normalizar(primeraCelda.texto);

    // ¿Empieza un nuevo bloque de alumno?
    if (etiqueta === 'DNI') {
      if (alumnoActual) alumnos.push(alumnoActual);
      const dniVal = (siguienteValor(row, primeraCelda.col + 1) || '').trim();
      alumnoActual = { dni: dniVal, nombre: '', area: '', carrera: '', ciclo: '', aula: '', cursos: [], global: null };
      leyendoCursos = false;
      return;
    }

    if (!alumnoActual) return;

    // Leer campos del alumno (key-value)
    if (!leyendoCursos) {
      if (etiqueta.includes('APELLIDO') || etiqueta.includes('NOMBRE')) {
        alumnoActual.nombre = (siguienteValor(row, primeraCelda.col + 1) || '').trim();
      } else if (etiqueta === 'AREA' || etiqueta === 'ÁREA') {
        alumnoActual.area = (siguienteValor(row, primeraCelda.col + 1) || '').trim();
      } else if (etiqueta === 'CARRERA') {
        alumnoActual.carrera = (siguienteValor(row, primeraCelda.col + 1) || '').trim();
      } else if (etiqueta === 'CICLO') {
        alumnoActual.ciclo = (siguienteValor(row, primeraCelda.col + 1) || '').trim();
      } else if (etiqueta === 'AULA') {
        alumnoActual.aula = (siguienteValor(row, primeraCelda.col + 1) || '').trim();
      } else if (etiqueta === 'CURSOS') {
        // Cabecera de la tabla: siguiente fila será datos
        leyendoCursos = true;
      }
      return;
    }

    // Leyendo cursos: cada fila es un curso o el GLOBAL
    const nombreCurso = primeraCelda.texto.trim();
    const nombreNorm  = normalizar(nombreCurso);

    // Ignorar filas de cabecera repetidas
    if (nombreNorm === 'CURSOS') return;

    if (nombreNorm === 'GLOBAL' || nombreNorm === 'TOTAL GENERAL' || nombreNorm === 'TOTAL') {
      alumnoActual.global = leerFilaCurso(row);
    } else if (nombreCurso) {
      alumnoActual.cursos.push({ curso: nombreCurso, ...leerFilaCurso(row) });
    }
  });

  // Último alumno
  if (alumnoActual) alumnos.push(alumnoActual);

  return alumnos;
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ alumnos: Array }>}
 */
async function parsearExcelResultados(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const hojaEstadistica = findSheet(workbook, /estad[ií]stica\s*individual/i)
    || findSheet(workbook, /individual/i)
    || findSheet(workbook, /estad[ií]stica/i);

  if (!hojaEstadistica) throw new Error('No se encontró la hoja ESTADÍSTICA INDIVIDUAL en el Excel.');

  const hojaAlumnos = findSheet(workbook, /^alumnos$/i)
    || findSheet(workbook, /alumnos/i);

  const mapaAlumnos = leerHojaAlumnos(hojaAlumnos); // puede estar vacío si no hay hoja ALUMNOS
  const estadisticas = leerHojaEstadistica(hojaEstadistica);

  const alumnos = estadisticas
    .filter(est => est.dni || est.nombre) // descartar bloques vacíos
    .map(est => {
      const meta = mapaAlumnos.get(est.dni)
        || mapaAlumnos.get(est.dni?.replace(/^0+/, ''))
        || {};
      return {
        codigo:  meta.codigo  ?? '',
        dni:     est.dni      ?? meta.codigo ?? '',
        nombre:  est.nombre   || meta.nombre  || '',
        area:    est.area     || meta.area    || '',
        carrera: est.carrera  || meta.carrera || '',
        ciclo:   est.ciclo    || meta.ciclo   || '',
        aula:    est.aula     || meta.aula    || '',
        cursos:  est.cursos,
        global:  est.global,
      };
    });

  return { alumnos };
}

module.exports = { parsearExcelResultados };
