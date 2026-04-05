/**
 * reporte-sin-matricula.js
 *
 * Muestra en consola los ex-alumnos: alumnos que tuvieron matrícula en ciclos
 * anteriores pero NO están matriculados en el ciclo más reciente que ya inició.
 *
 * NO usa fecha_fin para determinar si un ciclo está activo (ese campo puede
 * estar mal configurado). Solo usa fecha_inicio <= hoy para saber qué ciclo(s)
 * ya comenzaron, y toma el más reciente de ellos.
 *
 * Si hay varios ciclos con la misma fecha_inicio (grupos simultáneos), los
 * considera todos como "activos".
 *
 * Uso:
 *   node reporte-sin-matricula.js
 */

require('dotenv').config();
const sequelize = require('./src/config/database');

const sep = '─'.repeat(76);
function line(label, val) {
  console.log(`  ${label.padEnd(36)} ${val}`);
}
function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

async function run() {
  await sequelize.authenticate();

  console.log('\n' + sep);
  console.log('  REPORTE DE EX-ALUMNOS — Intranet CEC');
  console.log(sep + '\n');

  // ── 1. Todos los ciclos con conteo de matriculados ─────────────────────────
  const [todosLosCiclos] = await sequelize.query(
    `SELECT c.id, c.nombres, c.fecha_inicio, c.fecha_fin,
            COUNT(m.id) AS total_matriculados
     FROM ciclo c
     LEFT JOIN matricula m ON m.ciclo_id = c.id
     GROUP BY c.id, c.nombres, c.fecha_inicio, c.fecha_fin
     ORDER BY c.fecha_inicio DESC`
  );

  if (!todosLosCiclos.length) {
    console.log('  ⚠️  No hay ciclos registrados.\n');
    await sequelize.close();
    return;
  }

  console.log('  CICLOS REGISTRADOS:\n');
  console.log(
    '  ' + 'ID'.padEnd(5) + 'NOMBRE'.padEnd(22) +
    'INICIO'.padEnd(14) + 'FIN'.padEnd(14) + 'MATRICULADOS'
  );
  console.log('  ' + '-'.repeat(65));
  todosLosCiclos.forEach(c => {
    console.log(
      '  ' +
      `[${c.id}]`.padEnd(5) +
      c.nombres.padEnd(22) +
      fmt(c.fecha_inicio).padEnd(14) +
      fmt(c.fecha_fin).padEnd(14) +
      c.total_matriculados
    );
  });
  console.log();

  // ── 2. Ciclo(s) de referencia ─────────────────────────────────────────────
  //
  //  Lógica: tomar el fecha_inicio más reciente que sea <= hoy.
  //  Si hay varios ciclos con ese mismo fecha_inicio (grupos paralelos),
  //  todos cuentan como "activos".
  //  Si ninguno ha comenzado todavía, usar el de fecha_inicio más próxima.
  //
  const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const ciclosIniciados = todosLosCiclos.filter(
    c => new Date(c.fecha_inicio) <= new Date(hoy)
  );

  const pool = ciclosIniciados.length ? ciclosIniciados : todosLosCiclos;

  // fecha_inicio más reciente dentro del pool
  const maxFechaStr = pool[0].fecha_inicio; // ya viene ordenado DESC
  const maxFecha    = new Date(maxFechaStr).toDateString();

  const ciclosActivos = pool.filter(
    c => new Date(c.fecha_inicio).toDateString() === maxFecha
  );

  if (!ciclosIniciados.length) {
    console.log('  ⚠️  Ningún ciclo ha iniciado aún. Usando el próximo como referencia:\n');
  } else {
    console.log('  Ciclo(s) más reciente(s) — usados como referencia:\n');
  }
  ciclosActivos.forEach(c =>
    console.log(`    → [${c.id}] ${c.nombres}  (inicio: ${fmt(c.fecha_inicio)}, ${c.total_matriculados} matriculados)`)
  );
  console.log();
  console.log('  ℹ️  Si los ciclos de referencia no son los correctos, revisa las');
  console.log('     fechas de inicio en la tabla ciclo de la BD.\n');
  console.log(sep + '\n');

  const idsCiclosActivos = ciclosActivos.map(c => c.id);
  const placeholders     = idsCiclosActivos.map(() => '?').join(', ');

  // ── 3. Ex-alumnos ──────────────────────────────────────────────────────────
  //   Tienen matrícula en algún ciclo anterior PERO no en ninguno de los activos.
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
       )                        AS ciclos_previos,
       MAX(DATE(c.fecha_inicio)) AS ultimo_inicio
     FROM alumno a
     JOIN matricula m ON m.alumno_id = a.id
     JOIN ciclo     c ON c.id        = m.ciclo_id
     WHERE NOT EXISTS (
       SELECT 1 FROM matricula m2
       WHERE m2.alumno_id = a.id
         AND m2.ciclo_id IN (${placeholders})
     )
     GROUP BY a.id, a.codigo, a.nombres, a.apellidos,
              a.email_alumno, a.celular, a.dni, a.suspendido
     ORDER BY ultimo_inicio DESC, a.apellidos, a.nombres`,
    { replacements: idsCiclosActivos }
  );

  // ── 4. Resumen ─────────────────────────────────────────────────────────────
  const [[{ totalAlumnos }]] = await sequelize.query(
    'SELECT COUNT(*) AS totalAlumnos FROM alumno'
  );
  const [[{ enActivos }]] = await sequelize.query(
    `SELECT COUNT(DISTINCT alumno_id) AS enActivos
     FROM matricula WHERE ciclo_id IN (${placeholders})`,
    { replacements: idsCiclosActivos }
  );
  const [[{ sinNinguna }]] = await sequelize.query(
    `SELECT COUNT(*) AS sinNinguna FROM alumno a
     WHERE NOT EXISTS (SELECT 1 FROM matricula m WHERE m.alumno_id = a.id)`
  );

  console.log('  RESUMEN:\n');
  line('Total de alumnos en el sistema:', totalAlumnos);
  line('Matriculados en ciclo(s) de referencia:', enActivos);
  line('Sin ninguna matrícula (nunca):', sinNinguna);
  line('EX-ALUMNOS (con historial, no en actual):', exAlumnos.length);
  console.log('\n' + sep + '\n');

  // ── 5. Listado de ex-alumnos ───────────────────────────────────────────────
  if (exAlumnos.length === 0) {
    console.log('  ✅ No se encontraron ex-alumnos. Todos tienen matrícula en el ciclo actual.\n');
  } else {
    const ref = ciclosActivos.map(c => c.nombres).join(' / ');
    console.log(`  EX-ALUMNOS — sin matrícula en: ${ref}  (${exAlumnos.length} alumno(s))\n`);

    const C = { cod: 12, nom: 34, cel: 14, ult: 26, susp: 5 };
    console.log(
      '  ' +
      'CÓDIGO'.padEnd(C.cod) +
      'APELLIDOS, Nombres'.padEnd(C.nom) +
      'CELULAR'.padEnd(C.cel) +
      'ÚLTIMO CICLO'.padEnd(C.ult) +
      'SUSP'
    );
    console.log('  ' + '-'.repeat(C.cod + C.nom + C.cel + C.ult + C.susp));

    exAlumnos.forEach(a => {
      const nombre = `${a.apellidos}, ${a.nombres}`.substring(0, C.nom - 2);
      const ultimo = (a.ciclos_previos || '—').split(' | ')[0].substring(0, C.ult - 2);
      const susp   = a.suspendido ? ' SÍ' : '  —';
      console.log(
        '  ' +
        (a.codigo  || '—').padEnd(C.cod) +
        nombre.padEnd(C.nom) +
        (a.celular || '—').padEnd(C.cel) +
        ultimo.padEnd(C.ult) +
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
