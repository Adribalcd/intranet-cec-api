'use strict';

/**
 * parsearExcelResultados.js
 *
 * Lee la PRIMERA HOJA del Excel, que tiene formato tabular:
 *   - Fila 1 (header): DNI | R1 | R2 | ... | DNI | APELLIDOS Y NOMBRES | ÁREA | ... | CURSO_A | CURSO_B | ... | PUNTAJE
 *   - Fila 2 (sub-header): (vacio/CLAVES) | A|B|C|D... | (vacio) | ... | B | M | NC | PUNTAJE | B | M | NC | PUNTAJE | ...
 *   - Fila 3+: datos de alumnos
 *
 * Busca cada alumno matriculado por DNI y extrae sus puntajes por curso y respuestas.
 *
 * Exporta:
 *   buscarNotasPorAlumnos(buffer, alumnos) → Array de resultados por alumno
 *   parsearExcelResultados(buffer)         → compatibilidad legacy (vacío)
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
      if (typeof r === 'number') return String(Math.round(r * 1e9) / 1e9).trim() || null;
      return String(r).trim() || null;
    }
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('').trim() || null;
    return null;
  }
  return String(v).trim() || null;
}

function cellNum(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v.error) return null;
    if ('result' in v) {
      const r = v.result;
      if (r === null || r === undefined || (typeof r === 'object')) return null;
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

// ── Leer fila completa como mapa colNum → valor ───────────────────────────────

function leerFilaMap(row) {
  const map = new Map();
  row.eachCell({ includeEmpty: false }, (cell, colNum) => {
    const v = cellStr(cell);
    if (v !== null) map.set(colNum, v);
  });
  return map;
}

// ── Detectar estructura de columnas de la hoja ────────────────────────────────

/**
 * Devuelve:
 *  {
 *    dniCol: number,          ← columna del DNI en la tabla de puntajes
 *    dataStartRow: number,    ← primera fila con datos de alumnos
 *    cursos: [{ nombre, colB, colM, colNC, colPuntaje }],
 *    totalPuntajeCol: number | null,
 *    respuestasLayout: [{ n, col }], ← mapeo de R1, R2...
 *  }
 */
function detectarEstructura(sheet) {
  // Buscar la fila sub-header: tiene "PUNTAJE" (texto) Y varios "B" Y varios "M"
  // Pero en el rango de columnas de score (no en las columnas de respuesta)
  let subHeaderRowNum = null;
  const candidatos = [];

  sheet.eachRow((row, rowNum) => {
    if (rowNum > 30) return;
    const cells = leerFilaMap(row);
    let countPuntaje = 0, countB = 0, countM = 0;
    let maxCol = 0;

    for (const [col, val] of cells) {
      const vn = normalizar(val);
      if (vn === 'PUNTAJE' || vn === 'PUNTOS') countPuntaje++;
      if (val.trim() === 'B') countB++;
      if (val.trim() === 'M') countM++;
      if (col > maxCol) maxCol = col;
    }

    // Sub-header: tiene al menos 1 "PUNTAJE" + al menos 3 "B" + al menos 3 "M"
    if (countPuntaje >= 1 && countB >= 3 && countM >= 3) {
      candidatos.push({ rowNum, countPuntaje, countB, countM, cells });
    }
  });

  // Elegir el candidato con más PUNTAJE + B + M
  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => (b.countPuntaje + b.countB + b.countM) - (a.countPuntaje + a.countB + a.countM));
  const subHeader = candidatos[0];
  subHeaderRowNum = subHeader.rowNum;

  const cells = subHeader.cells;

  // Fila encima: puede contener "R1", "R2", "R3"... o nombres de cursos
  const rowArriba = sheet.getRow(subHeaderRowNum - 1);
  const cellsArriba = leerFilaMap(rowArriba);

  // Detectar layout de respuestas (R1, R2...)
  // Suelen estar al principio, antes del primer nombre de curso o primer DNI
  const respuestasLayout = [];
  for (const [col, val] of cellsArriba) {
    const vn = normalizar(val);
    if (vn.startsWith('R') && !isNaN(parseInt(vn.substring(1)))) {
      respuestasLayout.push({ n: parseInt(vn.substring(1)), col });
    }
  }

  // Encontrar el primer "B" en el sub-header (en la sección de scores)
  // Para distinguir del lado de respuestas (R1,R2..) usamos: el lado de scores tiene PUNTAJE
  // Hallamos el rango de columnas de la sección de scores:
  // La sección de scores empieza donde aparece "DNI" por segunda vez,
  // o donde aparece "APELLIDOS Y NOMBRES"
  let scoreSectionStart = 1;
  let dniCol = null;
  let dniOccurrences = [];

  for (const [col, val] of cells) {
    if (normalizar(val) === 'DNI') dniOccurrences.push(col);
    if (normalizar(val) === 'APELLIDOS Y NOMBRES' || normalizar(val) === 'APELLIDOS') {
      scoreSectionStart = col;
    }
  }
  // También buscar DNI en la fila de arriba
  for (const [col, val] of cellsArriba) {
    if (normalizar(val) === 'DNI') dniOccurrences.push(col);
    if ((normalizar(val) === 'APELLIDOS Y NOMBRES' || normalizar(val) === 'APELLIDOS') && col < scoreSectionStart) {
      scoreSectionStart = col;
    }
  }

  // El DNI de la sección de scores es el que está más cerca de scoreSectionStart
  if (dniOccurrences.length === 0) {
    // Ningún "DNI" label: usar columna 1 por defecto
    dniCol = 1;
  } else if (dniOccurrences.length === 1) {
    dniCol = dniOccurrences[0];
  } else {
    // Múltiples DNI: el primero suele ser el de respuestas, el segundo el de scores
    // Usar el primero (ya que el DNI es el mismo en ambos)
    dniCol = dniOccurrences[0];
  }

  // Construir mapa de cursos: iterar el sub-header buscando grupos B-M-[NC]-PUNTAJE
  const cursosDetectados = [];
  const colOrdenadas = [...cells.keys()].sort((a, b) => a - b);

  let pendingB = null, pendingM = null, pendingNC = null;

  for (const col of colOrdenadas) {
    const val = cells.get(col) || '';
    const vn = normalizar(val);

    if (val.trim() === 'B') { pendingB = col; pendingM = null; pendingNC = null; continue; }
    if (val.trim() === 'M') { pendingM = col; continue; }
    if (vn === 'NC' || vn === 'N C' || vn === 'NB' || vn === 'BLANCO' || vn === 'OMITIDAS') { pendingNC = col; continue; }

    if ((vn === 'PUNTAJE' || vn === 'PUNTOS') && pendingB !== null) {
      // Encontramos el cierre de un grupo de curso
      // Buscar nombre del curso: es la celda no vacía justo ANTES del pendingB en la fila de arriba
      let cursoNombre = null;
      for (let c = pendingB; c >= Math.max(1, pendingB - 8); c--) {
        const vArriba = cellsArriba.get(c);
        if (vArriba) { cursoNombre = vArriba.trim(); break; }
        // También puede estar en la misma fila (si la fila de arriba no tiene nada)
        const vMismo = cells.get(c);
        if (vMismo && vMismo.trim() !== 'B' && vMismo.trim() !== 'M' && normalizar(vMismo) !== 'NC') {
          cursoNombre = vMismo.trim(); break;
        }
      }
      cursosDetectados.push({
        nombre:     cursoNombre || `Curso ${cursosDetectados.length + 1}`,
        colB:       pendingB,
        colM:       pendingM,
        colNC:      pendingNC,
        colPuntaje: col,
      });
      pendingB = null; pendingM = null; pendingNC = null;
      continue;
    }

    if ((vn === 'PUNTAJE' || vn === 'PUNTOS') && pendingB === null) {
      // PUNTAJE suelto (total o sub-total)
      // Si ya hay cursos detectados → es el total final
      if (cursosDetectados.length > 0) {
        // Guardar como totalPuntajeCol (lo asignamos después)
      }
    }
  }

  // Buscar columna de PUNTAJE total: la última columna con texto "PUNTAJE"
  let totalPuntajeCol = null;
  for (const col of [...colOrdenadas].reverse()) {
    const vn = normalizar(cells.get(col) || '');
    if (vn === 'PUNTAJE' || vn === 'PUNTOS') {
      // Verificar que NO es el puntaje de un curso (que ya está en cursosDetectados)
      const esDeCurso = cursosDetectados.some(c => c.colPuntaje === col);
      if (!esDeCurso) { totalPuntajeCol = col; break; }
    }
  }
  // Si todas son de cursos, usar el último curso como referencia para total
  if (!totalPuntajeCol && cursosDetectados.length > 0) {
    totalPuntajeCol = cursosDetectados[cursosDetectados.length - 1].colPuntaje;
  }

  console.log('[detectarEstructura] subHeaderRow:', subHeaderRowNum,
    '| dniCol:', dniCol, '| cursos:', cursosDetectados.map(c => c.nombre),
    '| totalPuntajeCol:', totalPuntajeCol);

  return {
    dniCol,
    dataStartRow: subHeaderRowNum + 1,
    cursos: cursosDetectados,
    totalPuntajeCol,
    respuestasLayout,
  };
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer   — archivo Excel (.xlsx)
 * @param {Array}  alumnos  — [{ id, dni, codigo, nombres, apellidos }]
 * @returns {Promise<Array>}
 */
async function buscarNotasPorAlumnos(buffer, alumnos) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Siempre usar la primera hoja
  const hoja = workbook.worksheets[0];
  if (!hoja) throw new Error('El Excel no tiene hojas.');

  console.log('[buscarNotasPorAlumnos] hoja:', hoja.name,
    '| filas:', hoja.rowCount, '| cols:', hoja.columnCount);

  // Detectar estructura
  const estructura = detectarEstructura(hoja);
  if (!estructura) {
    throw new Error(
      'No se detectó la estructura de columnas en la hoja "' + hoja.name + '". ' +
      'Verifica que el Excel tenga columnas B, M y PUNTAJE en los encabezados.'
    );
  }

  const { dniCol, dataStartRow, cursos, totalPuntajeCol, respuestasLayout } = estructura;

  // Construir índice DNI → rowNum escaneando la columna DNI
  const dniRowMap = new Map();

  hoja.eachRow((row, rowNum) => {
    if (rowNum < dataStartRow) return;
    const dniVal = cellStr(row.getCell(dniCol));
    if (!dniVal) return;
    const dniClean = String(dniVal).replace(/\s/g, '');
    // Solo indexar valores que parecen DNIs (6-9 dígitos) o códigos alfanuméricos
    if (dniClean.length >= 6) {
      dniRowMap.set(dniClean, rowNum);
      const sinCeros = dniClean.replace(/^0+/, '');
      if (sinCeros !== dniClean) dniRowMap.set(sinCeros, rowNum);
    }
  });

  console.log('[buscarNotasPorAlumnos] dniRowMap.size:', dniRowMap.size,
    '| primeras claves:', [...dniRowMap.keys()].slice(0, 5));

  // Para cada alumno matriculado, buscar su fila y extraer scores
  const resultados = [];

  for (const alumno of alumnos) {
    const dniTarget = String(alumno.dni || '').replace(/\s/g, '');
    const dniSinCeros = dniTarget.replace(/^0+/, '');
    const codigoTarget = String(alumno.codigo || '').replace(/\s/g, '');

    const rowNum = dniRowMap.get(dniTarget)
      || dniRowMap.get(dniSinCeros)
      || (codigoTarget ? dniRowMap.get(codigoTarget) : undefined)
      || null;

    if (!rowNum) {
      resultados.push({
        alumnoId:          alumno.id,
        dni:               dniTarget,
        codigo:            codigoTarget,
        nombres:           alumno.nombres   || '',
        apellidos:         alumno.apellidos || '',
        encontradoEnExcel: false,
        global:            null,
        cursos:            [],
      });
      continue;
    }

    const row = hoja.getRow(rowNum);

    // Mapear respuestas R1, R2... por posición
    const totalRespuestas = new Map();
    for (const r of respuestasLayout) {
      const resp = cellStr(row.getCell(r.col));
      if (resp) totalRespuestas.set(r.n, resp);
    }

    // Extraer puntaje por curso
    let pregContador = 1;
    const cursosData = cursos.map(c => {
      // Intentar extraer las respuestas de este curso basándonos en la cantidad de preguntas (B+M+NC)
      const aciertos = c.colB   ? (cellInt(row.getCell(c.colB))      ?? 0) : 0;
      const fallos   = c.colM   ? (cellInt(row.getCell(c.colM))      ?? 0) : 0;
      const blanco   = c.colNC  ? (cellInt(row.getCell(c.colNC))     ?? 0) : 0;
      const cantC    = aciertos + fallos + blanco;
      
      const respsCurso = [];
      for (let i = 0; i < cantC; i++) {
        if (totalRespuestas.has(pregContador)) {
          respsCurso.push(totalRespuestas.get(pregContador));
        } else {
          respsCurso.push(null);
        }
        pregContador++;
      }

      return {
        curso:      c.nombre,
        aciertos,
        fallos,
        blanco,
        puntaje:    c.colPuntaje ? (cellNum(row.getCell(c.colPuntaje)) ?? 0) : 0,
        respuestas: respsCurso.join(''),
      };
    });

    // Puntaje total
    const puntajeTotal = totalPuntajeCol
      ? (cellNum(row.getCell(totalPuntajeCol)) ?? cursosData.reduce((s, c) => s + c.puntaje, 0))
      : cursosData.reduce((s, c) => s + c.puntaje, 0);

    const global = {
      total:    cursosData.reduce((s, c) => s + c.aciertos + c.fallos + c.blanco, 0),
      aciertos: cursosData.reduce((s, c) => s + c.aciertos, 0),
      fallos:   cursosData.reduce((s, c) => s + c.fallos, 0),
      blanco:   cursosData.reduce((s, c) => s + c.blanco, 0),
      puntaje:  puntajeTotal,
    };

    resultados.push({
      alumnoId:          alumno.id,
      dni:               dniTarget,
      codigo:            codigoTarget,
      nombres:           alumno.nombres   || '',
      apellidos:         alumno.apellidos || '',
      encontradoEnExcel: true,
      global,
      cursos:            cursosData,
    });
  }

  const encontrados = resultados.filter(r => r.encontradoEnExcel).length;
  console.log(`[buscarNotasPorAlumnos] encontrados: ${encontrados}/${alumnos.length}`);

  return resultados;
}

// ── Compatibilidad legacy ─────────────────────────────────────────────────────

async function parsearExcelResultados(_buffer) {
  // Stub: el nuevo flujo usa buscarNotasPorAlumnos + previewExcelResultados
  return { alumnos: [], mapaExcel: new Map() };
}

module.exports = { buscarNotasPorAlumnos, parsearExcelResultados };
