/**
 * reporte-sin-matricula.js
 *
 * Muestra en consola los ex-alumnos: alumnos que tuvieron matrícula en ciclos
 * anteriores pero NO están matriculados en ninguno de los ciclos actualmente
 * en curso (determinado por fecha_inicio <= hoy <= fecha_fin).
 *
 * Si no hay ciclos activos por fecha, usa el más reciente como referencia.
 *
 * Uso:
 *   node reporte-sin-matricula.js
 */

require('dotenv').config();
const sequelize = require('./src/config/database');

const sep  = '─'.repeat(76);
function line(label, val) {
  console.log(`  ${label.padEnd(36)} ${val}`);
}
function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function run() {
  await sequelize.authenticate();

  console.log('\n' + sep);
  console.log('  REPORTE DE EX-ALUMNOS — Intranet CEC');
  console.log(sep + '\n');

  // ── 1. Todos los ciclos ────────────────────────────────────────────────────
  const [todosLosCiclos] = await sequelize.query(
    `SELECT id, nombres, fecha_inicio, fecha_fin,
            CURDATE() BETWEEN DATE(fecha_inicio) AND DATE(fecha_fin) AS activo
     FROM ciclo
     ORDER BY fecha_inicio DESC`
  );

  if (!todosLosCiclos.length) {
    console.log('  ⚠️  No hay ciclos registrados.\n');
    await sequelize.close();
    return;
  }

  console.log('  CICLOS REGISTRADOS:\n');
  todosLosCiclos.forEach(c => {
    const estado = Number(c.activo) ? '● ACTIVO ' : '○ pasado ';
    console.log(`    ${estado} [${c.id}] ${c.nombres}  (${fmt(c.fecha_inicio)} – ${fmt(c.fecha_fin)})`);
  });
  console.log();

  // ── 2. Ciclos activos por fecha ────────────────────────────────────────────
  let ciclosActivos = todosLosCiclos.filter(c => Number(c.activo) === 1);

  if (!ciclosActivos.length) {
    // Ningún ciclo tiene fecha activa → usar el más reciente como referencia
    ciclosActivos = [todosLosCiclos[0]];
    console.log(`  ⚠️  No hay ciclo con fecha activa hoy. Usando el más reciente como referencia:\n`);
  } else {
    console.log(`  Ciclos activos detectados (${ciclosActivos.length}):\n`);
  }

  ciclosActivos.forEach(c =>
    console.log(`    → [${c.id}] ${c.nombres}`)
  );
  console.log();
  console.log(sep + '\n');

  const idsCiclosActivos = ciclosActivos.map(c => c.id);

  // ── 3. Ex-alumnos: tienen historial pero NO están en ningún ciclo activo ──
  //
  //    Condición:
  //      a) Tienen al menos UNA matrícula en algún ciclo anterior  (JOIN matricula)
  //      b) NO tienen matrícula en ninguno de los ciclos activos   (NOT EXISTS)
  //
  const placeholders = idsCiclosActivos.map(() => '?').join(', ');

  const [exAlumnos] = await sequelize.query(
    `SELECT
       a.id,
       a.codigo,
       a.nombres,
       a.apellidos,
       a.email_alumno,
       a.celular,
       a.dni,
       a.suspendido,
       GROUP_CONCAT(
         c.nombres
         ORDER BY c.fecha_inicio DESC
         SEPARATOR ' | '
       ) AS ciclos_previos,
       MAX(c.fecha_inicio)          AS ultimo_ciclo_fecha,
       MAX(DATE(c.fecha_fin))       AS ultimo_ciclo_fin
     FROM alumno a
     JOIN matricula m ON m.alumno_id = a.id
     JOIN ciclo     c ON c.id = m.ciclo_id
     WHERE NOT EXISTS (
       SELECT 1 FROM matricula m2
       WHERE m2.alumno_id = a.id
         AND m2.ciclo_id IN (${placeholders})
     )
     GROUP BY a.id, a.codigo, a.nombres, a.apellidos,
              a.email_alumno, a.celular, a.dni, a.suspendido
     ORDER BY ultimo_ciclo_fecha DESC, a.apellidos, a.nombres`,
    { replacements: idsCiclosActivos }
  );

  // ── 4. Resumen ─────────────────────────────────────────────────────────────
  const [[{ totalAlumnos }]] = await sequelize.query(
    'SELECT COUNT(*) AS totalAlumnos FROM alumno'
  );
  const [[{ enActivos }]] = await sequelize.query(
    `SELECT COUNT(DISTINCT alumno_id) AS enActivos
     FROM matricula
     WHERE ciclo_id IN (${placeholders})`,
    { replacements: idsCiclosActivos }
  );

  console.log('  RESUMEN:\n');
  line('Total de alumnos en el sistema:', totalAlumnos);
  line('Matriculados en ciclo(s) activo(s):', enActivos);
  line('EX-ALUMNOS encontrados:', exAlumnos.length);
  console.log('\n' + sep + '\n');

  // ── 5. Listado ─────────────────────────────────────────────────────────────
  if (exAlumnos.length === 0) {
    console.log('  ✅ No se encontraron ex-alumnos. Todos tienen matrícula activa.\n');
  } else {
    const nombresActivos = ciclosActivos.map(c => c.nombres).join(' / ');
    console.log(`  EX-ALUMNOS (sin matrícula en: ${nombresActivos})\n`);

    const COL = { cod: 12, nom: 34, cel: 14, ult: 26, susp: 5 };
    console.log(
      '  ' +
      'CÓDIGO'.padEnd(COL.cod) +
      'APELLIDOS, Nombres'.padEnd(COL.nom) +
      'CELULAR'.padEnd(COL.cel) +
      'ÚLTIMO CICLO'.padEnd(COL.ult) +
      'SUSP'
    );
    console.log('  ' + '-'.repeat(COL.cod + COL.nom + COL.cel + COL.ult + COL.susp));

    exAlumnos.forEach(a => {
      const nombre = `${a.apellidos}, ${a.nombres}`.substring(0, COL.nom - 2);
      const ultimo = (a.ciclos_previos || '—').split(' | ')[0].substring(0, COL.ult - 2);
      const susp   = a.suspendido ? ' SÍ' : '  —';
      console.log(
        '  ' +
        (a.codigo  || '—').padEnd(COL.cod) +
        nombre.padEnd(COL.nom) +
        (a.celular || '—').padEnd(COL.cel) +
        ultimo.padEnd(COL.ult) +
        susp
      );
    });
    console.log();
  }

  console.log(sep);
  console.log('  Generado el', new Date().toLocaleString('es-PE'));
  console.log(sep + '\n');

  await sequelize.close();
}

run().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
