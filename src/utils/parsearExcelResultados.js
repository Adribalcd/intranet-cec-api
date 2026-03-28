'use strict';

/**
 * parsearExcelResultados.js
 *
 * Enfoque: pre-indexar todas las celdas de la hoja una sola vez,
 * luego buscar cada DNI matriculado en ese índice en O(1).
 *
 * Exporta:
 *   buscarNotasPorAlumnos(buffer, alumnos) → Array de resultados por alumno
 *   parsearExcelResultados(buffer)         → compatibilidad legacy
 */

const ExcelJS = require('exceljs');

// ── Helpers de celda ─────────────────────────────────────────────────────────

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
      // Si el resultado es un número, asegurar conversión limpia
      if (typeof r === 'number') return String(Math.round(r * 1e6) / 1e6).replace(/\.0+$/, '').trim() || null;
      return String(r).trim() || null;
    }
    if (Array.isArray(v.richText)) {
      const s = v.richText.map(r => r.text).join('').trim();
      return s || null;
    }
    return null;
  }
  if (typeof v === 'number') return String(v).trim() || null;
  return String(v).trim() || null;
}

function cellNum(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  // Manejar resultado de fórmula
  if (typeof v === 'object') {
    if (v.error) return null;
    if ('result' in v) {
      const r = v.result;
      if (r === null || r === undefined) return null;
      if (typeof r === 'object') return null;
      const n = parseFloat(String(r).replace(',', '.'));
      return isNaN(n) ? null : n;
    }
    return null;
  }
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(',', '.'));
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
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSheet(workbook, pattern) {
  return workbook.worksheets.find(ws => pattern.test(ws.name)) || null;
}

// ── Detectar columnas de scores ───────────────────────────────────────────────

function detectarColumnas(sheet) {
  let cols = null;

  sheet.eachRow((row, _rowNum) => {
    if (cols) return;
    let count = 0;
    const temp = {};
    row.eachCell((cell, colNum) => {
      const v = normalizar(cellStr(cell) || '');
      if (/^total$/i.test(v))            { temp.total = colNum; count++; }
      if (/^aciertos$/i.test(v))         { temp.aciertos = colNum; count++; }
      if (/^(fallos?|incorrectas?)$/i.test(v)) { temp.fallos = colNum; count++; }
      if (/^(blanco|omitidas?)$/i.test(v))     { temp.blanco = colNum; }
      if (/^puntaje$/i.test(v))          { temp.puntaje = colNum; count++; }
      if (/^cursos$/i.test(v))           { temp.cursoNombre = colNum; }
      if (/%.*aciertos|aciertos.*%/i.test(v)) { temp.pctAciertos = colNum; }
      if (/%.*fallos|fallos.*%/i.test(v))     { temp.pctFallos = colNum; }
    });
    if (count >= 2) cols = temp;
  });

  // Fallback a posiciones fijas si no se detectaron
  if (!cols) {
    cols = { cursoNombre: 3, total: 4, aciertos: 5, fallos: 6, blanco: 7, puntaje: 8 };
  }
  if (!cols.cursoNombre) cols.cursoNombre = Math.max(1, (cols.aciertos || 5) - 2);

  return cols;
}

function leerFilaScore(row, cols) {
  const total    = cols.total    ? cellInt(row.getCell(cols.total))    ?? 0 : 0;
  const aciertos = cols.aciertos ? cellInt(row.getCell(cols.aciertos)) ?? 0 : 0;
  const fallos   = cols.fallos   ? cellInt(row.getCell(cols.fallos))   ?? 0 : 0;
  const blanco   = cols.blanco   ? cellInt(row.getCell(cols.blanco))   ?? 0 : 0;
  const puntaje  = cols.puntaje  ? cellNum(row.getCell(cols.puntaje))  ?? 0 : 0;
  return { total, aciertos, fallos, blanco, puntaje };
}

// ── Pre-indexar todas las celdas de la hoja ───────────────────────────────────

/**
 * Construye un Map<valorString, [{rowNum, colNum}]> con TODAS las celdas
 * que contengan un valor parecido a un DNI (>= 6 caracteres de dígitos).
 * También indexa cadenas alfanuméricas >= 4 chars (para códigos).
 */
function preindexarCeldas(sheet) {
  const idx = new Map();

  sheet.eachRow((row, rowNum) => {
    row.eachCell({ includeEmpty: false }, (cell, colNum) => {
      const v = cellStr(cell);
      if (!v) return;
      const clean = v.replace(/\s/g, '');
      if (clean.length < 4) return; // demasiado corto para ser DNI o código

      const entries = new Set([clean]);
      // también sin ceros iniciales
      const sinCeros = clean.replace(/^0+/, '');
      if (sinCeros && sinCeros !== clean) entries.add(sinCeros);

      for (const key of entries) {
        if (!idx.has(key)) idx.set(key, []);
        idx.get(key).push({ rowNum, colNum });
      }
    });
  });

  return idx;
}

// ── Extraer datos de un bloque vertical dado el rowNum del DNI ────────────────

function extraerBloqueDesdeRow(sheet, dniRowNum, cols) {
  const cursos = [];
  let global = null;
  let leyendoCursos = false;
  let filasCursosSeguidas = 0;

  for (let rn = dniRowNum + 1; rn <= dniRowNum + 80; rn++) {
    const row = sheet.getRow(rn);
    let primeraNoVacia = null;
    const MAX_COL = Math.max(20, (cols.puntaje || 8) + 3);
    for (let c = 1; c <= MAX_COL; c++) {
      const v = cellStr(row.getCell(c));
      if (v) { primeraNoVacia = v; break; }
    }

    if (!primeraNoVacia) {
      if (leyendoCursos && filasCursosSeguidas > 0) {
        // fila vacía después de cursos = fin del bloque
        break;
      }
      continue;
    }

    const etiqueta = normalizar(primeraNoVacia);

    // Nuevo bloque de alumno: stop
    if (etiqueta === 'DNI' && rn > dniRowNum + 2) break;

    if (!leyendoCursos) {
      if (etiqueta === 'CURSOS') { leyendoCursos = true; continue; }
    } else {
      if (etiqueta === 'CURSOS') continue; // cabecera repetida

      if (etiqueta === 'GLOBAL' || etiqueta === 'TOTAL GENERAL' || etiqueta === 'TOTAL') {
        global = leerFilaScore(row, cols);
        break; // fin del bloque
      }

      // Es una fila de curso
      if (primeraNoVacia.trim()) {
        cursos.push({ curso: primeraNoVacia.trim(), ...leerFilaScore(row, cols) });
        filasCursosSeguidas++;
      }
    }
  }

  if (!global && cursos.length === 0) return null;

  // Calcular global a partir de cursos si falta
  if (!global && cursos.length > 0) {
    global = {
      total:    cursos.reduce((s, c) => s + (c.total || 0), 0),
      aciertos: cursos.reduce((s, c) => s + (c.aciertos || 0), 0),
      fallos:   cursos.reduce((s, c) => s + (c.fallos || 0), 0),
      blanco:   cursos.reduce((s, c) => s + (c.blanco || 0), 0),
      puntaje:  cursos.reduce((s, c) => s + (c.puntaje || 0), 0),
    };
  }

  return { global, cursos };
}

// ── Extraer datos de una fila tabular ─────────────────────────────────────────

function extraerFilaTabular(row, cols) {
  const score = leerFilaScore(row, cols);
  if (score.aciertos === 0 && score.fallos === 0 && score.puntaje === 0) return null;
  return { global: score, cursos: [] };
}

// ── Función principal: buscar notas por alumnos ───────────────────────────────

/**
 * @param {Buffer} buffer  — archivo Excel
 * @param {Array}  alumnos — [{ id, dni, codigo, nombres, apellidos }]
 * @returns {Promise<Array>} — [{ alumnoId, dni, nombres, apellidos, encontradoEnExcel, global, cursos }]
 */
async function buscarNotasPorAlumnos(buffer, alumnos) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Seleccionar hoja principal
  const hoja = findSheet(workbook, /estad[ií]stica\s*individual/i)
    || findSheet(workbook, /individual/i)
    || findSheet(workbook, /estad[ií]stica/i)
    || findSheet(workbook, /resultados/i)
    || workbook.worksheets[0];

  if (!hoja) throw new Error(
    `No se encontró ninguna hoja de notas. Hojas disponibles: ${workbook.worksheets.map(w => w.name).join(', ')}`
  );

  console.log('[buscarNotasPorAlumnos] usando hoja:', hoja.name, '| filas:', hoja.rowCount);

  // Detectar columnas de scores una sola vez
  const cols = detectarColumnas(hoja);
  console.log('[buscarNotasPorAlumnos] cols detectadas:', cols);

  // Pre-indexar todas las celdas
  const idx = preindexarCeldas(hoja);
  console.log('[buscarNotasPorAlumnos] celdas indexadas:', idx.size, 'claves únicas');

  const resultados = [];

  for (const alumno of alumnos) {
    const dniRaw  = String(alumno.dni    || '').replace(/\s/g, '');
    const codigoRaw = String(alumno.codigo || '').replace(/\s/g, '');

    // Candidatos: DNI, DNI sin ceros, código
    const candidatos = [];
    if (dniRaw)                          candidatos.push(dniRaw);
    const dniSinCeros = dniRaw.replace(/^0+/, '');
    if (dniSinCeros && dniSinCeros !== dniRaw) candidatos.push(dniSinCeros);
    if (codigoRaw)                       candidatos.push(codigoRaw);

    let datos = null;

    for (const clave of candidatos) {
      const hits = idx.get(clave) || [];
      for (const { rowNum, colNum } of hits) {
        const row = hoja.getRow(rowNum);

        // Verificar que la celda encontrada está en contexto de bloque
        // (la celda de la izquierda o de la fila anterior debe tener "DNI" o similar)
        let esContextoDni = false;

        // Revisar si en esa fila hay una celda con texto "DNI" antes de la celda encontrada
        for (let c = 1; c < colNum; c++) {
          const lab = normalizar(cellStr(row.getCell(c)) || '');
          if (lab === 'DNI' || lab === 'DNI ALUMNO') { esContextoDni = true; break; }
        }

        // También revisar si la propia celda es la única con valor en una "DNI row"
        if (!esContextoDni) {
          // Buscar en filas cercanas si hay un label "DNI"
          for (let dr = -3; dr <= 0; dr++) {
            const rn = rowNum + dr;
            if (rn < 1) continue;
            const r = hoja.getRow(rn);
            for (let c = 1; c <= 5; c++) {
              const lab = normalizar(cellStr(r.getCell(c)) || '');
              if (lab === 'DNI') { esContextoDni = true; break; }
            }
            if (esContextoDni) break;
          }
        }

        if (!esContextoDni) {
          // Aun así intentar extraer (puede ser formato tabular)
          const intento = extraerFilaTabular(row, cols);
          if (intento) { datos = intento; break; }
          continue;
        }

        const intento = extraerBloqueDesdeRow(hoja, rowNum, cols);
        if (intento) { datos = intento; break; }
      }
      if (datos) break;
    }

    resultados.push({
      alumnoId:          alumno.id,
      dni:               dniRaw,
      codigo:            codigoRaw,
      nombres:           alumno.nombres   || '',
      apellidos:         alumno.apellidos || '',
      encontradoEnExcel: !!datos,
      global:            datos?.global    || null,
      cursos:            datos?.cursos    || [],
    });
  }

  const encontrados = resultados.filter(r => r.encontradoEnExcel).length;
  console.log(`[buscarNotasPorAlumnos] encontrados: ${encontrados}/${alumnos.length}`);

  return resultados;
}

// ── Compatibilidad legacy ─────────────────────────────────────────────────────

async function parsearExcelResultados(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const hoja = findSheet(workbook, /estad[ií]stica\s*individual/i)
    || findSheet(workbook, /individual/i)
    || findSheet(workbook, /estad[ií]stica/i)
    || findSheet(workbook, /resultados/i);

  if (!hoja) throw new Error(
    `No se encontró la hoja ESTADÍSTICA INDIVIDUAL. Hojas: ${workbook.worksheets.map(w => w.name).join(', ')}`
  );

  const cols = detectarColumnas(hoja);

  // Buscar filas que tienen label "DNI" y leer el bloque
  const alumnos = [];
  hoja.eachRow((row, rowNum) => {
    const MAX_COL = 20;
    for (let c = 1; c <= MAX_COL; c++) {
      const v = normalizar(cellStr(row.getCell(c)) || '');
      if (v !== 'DNI') continue;

      // Leer el DNI de la celda siguiente no vacía
      let dniRaw = null;
      for (let dc = c + 1; dc <= c + 15; dc++) {
        const val = cellStr(row.getCell(dc));
        if (val) { dniRaw = val.replace(/\s/g, ''); break; }
      }
      if (!dniRaw || dniRaw === '0') continue;

      const datos = extraerBloqueDesdeRow(hoja, rowNum, cols);
      if (!datos) continue;

      alumnos.push({ dni: dniRaw, ...datos });
      break;
    }
  });

  const mapaExcel = new Map();
  for (const a of alumnos) {
    const key = a.dni.trim();
    if (key) mapaExcel.set(key, a);
    const sinCeros = key.replace(/^0+/, '');
    if (sinCeros && sinCeros !== key) mapaExcel.set(sinCeros, a);
  }

  return { alumnos, mapaExcel };
}

module.exports = { buscarNotasPorAlumnos, parsearExcelResultados };
