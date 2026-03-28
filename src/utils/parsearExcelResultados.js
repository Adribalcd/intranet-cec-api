'use strict';

/**
 * parsearExcelResultados.js
 *
 * Lee un Excel de resultados de simulacro/examen con:
 *   - Hoja "ESTADÍSTICA INDIVIDUAL": bloques verticales por alumno (un bloque = un alumno)
 *     Cada bloque: DNI | <valor>, APELLIDOS Y NOMBRES | <valor>, ..., tabla de cursos, fila GLOBAL
 *   - Hoja "RESULTADOS" (opcional): tabla horizontal con una fila por alumno
 *   - Hoja "ALUMNOS" (opcional): mapeo DNI → CODIGO
 *
 * Devuelve: { mapaExcel: Map<dni_string, datos>, alumnos: Array }
 *   donde `mapaExcel` permite lookup O(1) por DNI desde el controlador.
 */

const ExcelJS = require('exceljs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellStr(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v.error) return null;
    if ('result' in v) {
      const r = v.result;
      if (r === null || r === undefined) return null;
      if (typeof r === 'object' && r?.error) return null;
      return String(r).trim() || null;
    }
    if (Array.isArray(v.richText)) {
      const s = v.richText.map(r => r.text).join('').trim();
      return s || null;
    }
    return null;
  }
  const s = String(v).trim();
  return s || null;
}

function cellNum(cell) {
  const s = cellStr(cell);
  if (!s) return null;
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
    .replace(/[^A-Z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Primera celda no vacía en el rango [colDesde, colHasta]
 */
function primerTexto(row, colDesde, colHasta) {
  for (let c = colDesde; c <= colHasta; c++) {
    const v = cellStr(row.getCell(c));
    if (v) return { texto: v, col: c };
  }
  return null;
}

/**
 * Valor de la siguiente celda no vacía a partir de colDesde (inclusive), hasta +15
 */
function siguienteValor(row, colDesde) {
  for (let c = colDesde; c <= colDesde + 15; c++) {
    const v = cellStr(row.getCell(c));
    if (v) return v;
  }
  return null;
}

function findSheet(workbook, pattern) {
  return workbook.worksheets.find(ws => pattern.test(ws.name)) || null;
}

// ── Hoja ALUMNOS (opcional) ───────────────────────────────────────────────────

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
      if (v === 'CODIGO' || v === 'COD')                    found.codigo = colNum;
      if (v === 'DNI')                                       found.dni    = colNum;
      if (v === 'APELLIDOS Y NOMBRES' || v === 'NOMBRES' ||
          v === 'NOMBRE' || v === 'ALUMNO')                  found.nombre = colNum;
      if (v === 'APELLIDOS' || v === 'APELLIDO')             found.apellido = colNum;
      if (v === 'AREA' || v === 'AREA')                      found.area   = colNum;
      if (v === 'CARRERA')                                   found.carrera = colNum;
      if (v === 'CICLO')                                     found.ciclo  = colNum;
      if (v === 'AULA')                                      found.aula   = colNum;
    });
    if (found.dni || found.codigo) { cols = found; filaDatos = rowNum + 1; }
  });

  if (!cols) return mapa;

  sheet.eachRow((row, rowNum) => {
    if (rowNum < filaDatos) return;
    const codigo   = (cellStr(row.getCell(cols.codigo   || 0)) || '').trim();
    const dni      = (cellStr(row.getCell(cols.dni      || 0)) || '').trim();
    const nombre   = (cellStr(row.getCell(cols.nombre   || 0)) || '').trim();
    const apellido = (cellStr(row.getCell(cols.apellido || 0)) || '').trim();
    const area     = (cellStr(row.getCell(cols.area     || 0)) || '').trim();
    const carrera  = (cellStr(row.getCell(cols.carrera  || 0)) || '').trim();
    const ciclo    = (cellStr(row.getCell(cols.ciclo    || 0)) || '').trim();
    const aula     = (cellStr(row.getCell(cols.aula     || 0)) || '').trim();
    if (!dni && !codigo) return;
    const nombreCompleto = apellido ? `${apellido} ${nombre}`.trim() : nombre;
    const alumno = { codigo, nombre: nombreCompleto, area, carrera, ciclo, aula };
    if (dni)    mapa.set(dni,    alumno);
    if (codigo) mapa.set(codigo, alumno);
  });

  return mapa;
}

// ── Hoja ESTADÍSTICA INDIVIDUAL (bloques verticales) ─────────────────────────

function leerHojaEstadistica(sheet) {
  const alumnos = [];

  // ── Paso 1: detectar columnas de la tabla de cursos ─────────────────────────
  let colCursoNombre = null;
  let colTotal = null, colAciertos = null, colFallos = null, colBlanco = null;
  let colPuntaje = null, colPctAciertos = null, colPctFallos = null, colPctBlanco = null;

  const PATRONES = {
    total:       /^total$/i,
    aciertos:    /^aciertos$/i,
    fallos:      /^fallos$/i,
    blanco:      /^blanco$/i,
    puntaje:     /^puntaje$/i,
    pctAciertos: /%.*aciertos|aciertos.*%/i,
    pctFallos:   /%.*fallos|fallos.*%/i,
    pctBlanco:   /%.*blanco|blanco.*%/i,
  };

  sheet.eachRow((row, _rowNum) => {
    if (colTotal) return;
    let count = 0;
    const temp = {};
    row.eachCell((cell, colNum) => {
      const v = cellStr(cell) || '';
      for (const [key, pat] of Object.entries(PATRONES)) {
        if (pat.test(v)) { temp[key] = colNum; count++; }
      }
      if (/^cursos$/i.test(v)) temp.cursoNombre = colNum;
    });
    if (count >= 3) {
      colCursoNombre  = temp.cursoNombre  || null;
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

  // Fallback: posiciones típicas (tabla empieza en col C/D)
  if (!colTotal) {
    colCursoNombre = 3; colTotal = 4; colAciertos = 5; colFallos = 6;
    colBlanco = 7; colPuntaje = 8; colPctAciertos = 9; colPctFallos = 10; colPctBlanco = 11;
  }
  if (!colCursoNombre) colCursoNombre = (colTotal || 4) - 1;

  function leerFilaCurso(row) {
    return {
      total:       cellInt(row.getCell(colTotal))       ?? 0,
      aciertos:    cellInt(row.getCell(colAciertos))    ?? 0,
      fallos:      cellInt(row.getCell(colFallos))      ?? 0,
      blanco:      cellInt(row.getCell(colBlanco))      ?? 0,
      puntaje:     cellNum(row.getCell(colPuntaje))     ?? 0,
      '%aciertos': cellNum(row.getCell(colPctAciertos)) ?? 0,
      '%fallos':   cellNum(row.getCell(colPctFallos))   ?? 0,
      '%blanco':   cellNum(row.getCell(colPctBlanco))   ?? 0,
    };
  }

  // ── Paso 2: leer bloques por alumno ─────────────────────────────────────────
  const MAX_COL = Math.max(20, (colPctBlanco || 11) + 5);
  let alumnoActual = null;
  let leyendoCursos = false;

  sheet.eachRow((row, _rowNum) => {
    // Buscar etiqueta en ancho amplio
    const primeraCelda = primerTexto(row, 1, MAX_COL);
    if (!primeraCelda) return;

    const etiqueta = normalizar(primeraCelda.texto);

    // ¿Empieza bloque de alumno?
    if (etiqueta === 'DNI') {
      if (alumnoActual && (alumnoActual.dni || alumnoActual.nombre)) {
        alumnos.push(alumnoActual);
      }
      const dniRaw = siguienteValor(row, primeraCelda.col + 1) || '';
      alumnoActual = {
        dni:     dniRaw.replace(/\s/g, ''),
        nombre:  '',
        area:    '',
        carrera: '',
        ciclo:   '',
        aula:    '',
        cursos:  [],
        global:  null,
      };
      leyendoCursos = false;
      return;
    }

    if (!alumnoActual) return;

    if (!leyendoCursos) {
      if (etiqueta.includes('APELLIDO') || etiqueta.includes('NOMBRE')) {
        alumnoActual.nombre = siguienteValor(row, primeraCelda.col + 1) || '';
      } else if (etiqueta.startsWith('AREA') || etiqueta.startsWith('AREA')) {
        alumnoActual.area = siguienteValor(row, primeraCelda.col + 1) || '';
      } else if (etiqueta.startsWith('CARRERA')) {
        alumnoActual.carrera = siguienteValor(row, primeraCelda.col + 1) || '';
      } else if (etiqueta === 'CICLO') {
        alumnoActual.ciclo = siguienteValor(row, primeraCelda.col + 1) || '';
      } else if (etiqueta === 'AULA') {
        alumnoActual.aula = siguienteValor(row, primeraCelda.col + 1) || '';
      } else if (etiqueta === 'CURSOS') {
        leyendoCursos = true;
      }
      return;
    }

    // Leyendo cursos
    const nombreCurso = primeraCelda.texto.trim();
    const nombreNorm  = normalizar(nombreCurso);

    if (nombreNorm === 'CURSOS') return; // cabecera repetida

    if (nombreNorm === 'GLOBAL' || nombreNorm === 'TOTAL GENERAL' || nombreNorm === 'TOTAL') {
      alumnoActual.global = leerFilaCurso(row);
    } else if (nombreCurso) {
      alumnoActual.cursos.push({ curso: nombreCurso, ...leerFilaCurso(row) });
    }
  });

  if (alumnoActual && (alumnoActual.dni || alumnoActual.nombre)) {
    alumnos.push(alumnoActual);
  }

  return alumnos;
}

// ── Hoja RESULTADOS (tabla horizontal, opcional) ──────────────────────────────

/**
 * Lee la hoja RESULTADOS si tiene formato tabular (una fila por alumno).
 * Detecta automáticamente columnas de DNI, aciertos, fallos, blanco, puntaje.
 */
function leerHojaResultadosTabular(sheet) {
  const alumnos = [];
  if (!sheet) return alumnos;

  let cols = null;
  let filaDatos = null;

  sheet.eachRow((row, rowNum) => {
    if (cols) return;
    const found = {};
    let count = 0;
    row.eachCell((cell, colNum) => {
      const v = normalizar(cellStr(cell) || '');
      if (v === 'DNI')                                                       { found.dni = colNum; count++; }
      if (v === 'CODIGO' || v === 'COD')                                     { found.codigo = colNum; count++; }
      if (v === 'APELLIDOS Y NOMBRES' || v === 'NOMBRE' || v === 'ALUMNO')   { found.nombre = colNum; count++; }
      if (v === 'AREA' || v === 'AREA')                                       { found.area = colNum; }
      if (v === 'CARRERA')                                                   { found.carrera = colNum; }
      if (v === 'CICLO')                                                     { found.ciclo = colNum; }
      if (v === 'AULA')                                                      { found.aula = colNum; }
      if (/^aciertos$/i.test(v) || /^correctas$/i.test(v))                   { found.aciertos = colNum; count++; }
      if (/^fallos?$/i.test(v) || /^incorrectas$/i.test(v))                  { found.fallos = colNum; count++; }
      if (/^blanco$/i.test(v) || /^omitidas$/i.test(v))                      { found.blanco = colNum; }
      if (/^puntaje$/i.test(v) || /^nota$/i.test(v) || /^score$/i.test(v))   { found.puntaje = colNum; count++; }
    });
    if (count >= 2 && (found.dni || found.codigo)) {
      cols = found;
      filaDatos = rowNum + 1;
    }
  });

  if (!cols) return alumnos;

  sheet.eachRow((row, rowNum) => {
    if (rowNum < filaDatos) return;
    const dni     = (cellStr(row.getCell(cols.dni     || 0)) || '').trim().replace(/\s/g, '');
    const codigo  = (cellStr(row.getCell(cols.codigo  || 0)) || '').trim();
    const nombre  = (cellStr(row.getCell(cols.nombre  || 0)) || '').trim();
    const area    = (cellStr(row.getCell(cols.area    || 0)) || '').trim();
    const carrera = (cellStr(row.getCell(cols.carrera || 0)) || '').trim();
    const ciclo   = (cellStr(row.getCell(cols.ciclo   || 0)) || '').trim();
    const aula    = (cellStr(row.getCell(cols.aula    || 0)) || '').trim();
    if (!dni && !codigo) return;

    const aciertos = cellInt(row.getCell(cols.aciertos || 0)) ?? 0;
    const fallos   = cellInt(row.getCell(cols.fallos   || 0)) ?? 0;
    const blanco   = cellInt(row.getCell(cols.blanco   || 0)) ?? 0;
    const puntaje  = cellNum(row.getCell(cols.puntaje  || 0)) ?? 0;

    alumnos.push({
      dni, codigo, nombre, area, carrera, ciclo, aula,
      cursos: [],
      global: { aciertos, fallos, blanco, puntaje, total: aciertos + fallos + blanco },
    });
  });

  return alumnos;
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ alumnos: Array, mapaExcel: Map<string, object> }>}
 */
async function parsearExcelResultados(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const hojaEstadistica = findSheet(workbook, /estad[ií]stica\s*individual/i)
    || findSheet(workbook, /individual/i)
    || findSheet(workbook, /estad[ií]stica/i);

  const hojaResultados = findSheet(workbook, /^resultados$/i)
    || findSheet(workbook, /resultados/i);

  const hojaAlumnos = findSheet(workbook, /^alumnos$/i)
    || findSheet(workbook, /alumnos/i);

  if (!hojaEstadistica && !hojaResultados) {
    throw new Error(
      'No se encontró la hoja ESTADÍSTICA INDIVIDUAL ni RESULTADOS en el Excel. ' +
      `Hojas encontradas: ${workbook.worksheets.map(w => w.name).join(', ')}`
    );
  }

  const mapaAlumnosSheet = leerHojaAlumnos(hojaAlumnos);

  // Intentar hoja de estadística primero
  let estadisticas = hojaEstadistica ? leerHojaEstadistica(hojaEstadistica) : [];

  // Si no rindió resultados, probar con la hoja RESULTADOS (formato tabular)
  if (estadisticas.length === 0 && hojaResultados) {
    estadisticas = leerHojaResultadosTabular(hojaResultados);
  }

  const alumnos = estadisticas
    .filter(est => est.dni || est.nombre)
    .map(est => {
      const meta = mapaAlumnosSheet.get(est.dni)
        || mapaAlumnosSheet.get((est.dni || '').replace(/^0+/, ''))
        || {};
      return {
        codigo:  est.codigo  || meta.codigo  || '',
        dni:     est.dni     || meta.codigo  || '',
        nombre:  est.nombre  || meta.nombre  || '',
        area:    est.area    || meta.area    || '',
        carrera: est.carrera || meta.carrera || '',
        ciclo:   est.ciclo   || meta.ciclo   || '',
        aula:    est.aula    || meta.aula    || '',
        cursos:  est.cursos  || [],
        global:  est.global  || null,
      };
    });

  // Construir mapa DNI → datos para lookup O(1) desde el controlador
  const mapaExcel = new Map();
  for (const a of alumnos) {
    const key = (a.dni || '').trim();
    if (key) mapaExcel.set(key, a);
    // También indexar sin ceros iniciales
    const keySinCeros = key.replace(/^0+/, '');
    if (keySinCeros && keySinCeros !== key) mapaExcel.set(keySinCeros, a);
    // También por código si lo tiene
    if (a.codigo) mapaExcel.set(a.codigo.trim(), a);
  }

  return { alumnos, mapaExcel };
}

module.exports = { parsearExcelResultados };
