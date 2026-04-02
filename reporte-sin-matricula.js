/**
 * reporte-sin-matricula.js
 *
 * Genera un reporte de alumnos que NO están matriculados en ningún ciclo
 * activo o que nunca han tenido matrícula — los que aparecen como "ex-alumnos".
 *
 * Uso:
 *   node reporte-sin-matricula.js              → solo consola
 *   node reporte-sin-matricula.js --csv        → también guarda reporte.csv
 *   node reporte-sin-matricula.js --ciclo 3    → revisa contra un ciclo específico
 */

require('dotenv').config();
const sequelize = require('./src/config/database');
const fs = require('fs');
const path = require('path');

// ── argumentos ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const exportCsv = args.includes('--csv');
const cicloIdx  = args.indexOf('--ciclo');
const cicloFijo = cicloIdx !== -1 ? parseInt(args[cicloIdx + 1]) : null;

// ── helpers ──────────────────────────────────────────────────────────────────
const sep  = '─'.repeat(72);
const line = (label, val) => console.log(`  ${label.padEnd(30)} ${val}`);

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── principal ────────────────────────────────────────────────────────────────
async function run() {
  await sequelize.authenticate();
  console.log('\n' + sep);
  console.log('  REPORTE: ALUMNOS SIN MATRÍCULA ACTIVA — Intranet CEC');
  console.log(sep + '\n');

  // 1. Ciclos disponibles
  const [ciclos] = await sequelize.query(
    `SELECT id, nombres, fecha_inicio, fecha_fin
     FROM ciclo
     ORDER BY fecha_inicio DESC`
  );

  if (!ciclos.length) {
    console.log('  ⚠️  No hay ciclos registrados en la base de datos.\n');
    await sequelize.close();
    return;
  }

  console.log('  CICLOS REGISTRADOS:');
  ciclos.forEach((c, i) => {
    const marker = i === 0 ? ' ← más reciente' : '';
    console.log(`    [${c.id}] ${c.nombres}  (${formatDate(c.fecha_inicio)} – ${formatDate(c.fecha_fin)})${marker}`);
  });
  console.log();

  // 2. Determinar ciclo de referencia
  const cicloActivo = cicloFijo
    ? ciclos.find(c => c.id === cicloFijo)
    : ciclos[0]; // el más reciente por fecha_inicio

  if (!cicloActivo) {
    console.log(`  ❌ No se encontró el ciclo con id=${cicloFijo}\n`);
    await sequelize.close();
    return;
  }

  console.log(`  CICLO DE REFERENCIA: [${cicloActivo.id}] ${cicloActivo.nombres}\n`);
  console.log(sep + '\n');

  // 3. Alumnos sin NINGUNA matrícula (nunca matriculados)
  const [sinNingunaMatricula] = await sequelize.query(
    `SELECT a.id, a.codigo, a.nombres, a.apellidos, a.email_alumno,
            a.celular, a.suspendido, a.es_escolar,
            a.dni
     FROM alumno a
     WHERE NOT EXISTS (
       SELECT 1 FROM matricula m WHERE m.alumno_id = a.id
     )
     ORDER BY a.apellidos, a.nombres`
  );

  // 4. Alumnos matriculados en ciclos anteriores pero NO en el ciclo activo
  const [sinCicloActual] = await sequelize.query(
    `SELECT a.id, a.codigo, a.nombres, a.apellidos, a.email_alumno,
            a.celular, a.suspendido, a.es_escolar, a.dni,
            GROUP_CONCAT(c.nombres ORDER BY c.fecha_inicio DESC SEPARATOR ' | ') AS ciclos_previos,
            MAX(c.fecha_inicio) AS ultimo_ciclo_fecha
     FROM alumno a
     JOIN matricula m  ON m.alumno_id = a.id
     JOIN ciclo c      ON c.id = m.ciclo_id
     WHERE NOT EXISTS (
       SELECT 1 FROM matricula m2
       WHERE m2.alumno_id = a.id AND m2.ciclo_id = :cicloId
     )
     GROUP BY a.id, a.codigo, a.nombres, a.apellidos,
              a.email_alumno, a.celular, a.suspendido, a.es_escolar, a.dni
     ORDER BY ultimo_ciclo_fecha DESC, a.apellidos`,
    { replacements: { cicloId: cicloActivo.id } }
  );

  // 5. Resumen general
  const [[ { total } ]] = await sequelize.query('SELECT COUNT(*) AS total FROM alumno');
  const [[ { enCicloActual } ]] = await sequelize.query(
    'SELECT COUNT(*) AS enCicloActual FROM matricula WHERE ciclo_id = :cicloId',
    { replacements: { cicloId: cicloActivo.id } }
  );

  console.log('  RESUMEN GENERAL:');
  line('Total de alumnos registrados:', total);
  line(`Matriculados en [${cicloActivo.nombres}]:`, enCicloActual);
  line('Sin ninguna matrícula (nunca):', sinNingunaMatricula.length);
  line('Con matrícula anterior pero no actual:', sinCicloActual.length);
  line('TOTAL sin ciclo actual:', sinNingunaMatricula.length + sinCicloActual.length);
  console.log('\n' + sep + '\n');

  // 6. Tabla: nunca matriculados
  if (sinNingunaMatricula.length === 0) {
    console.log('  ✅ No hay alumnos sin ninguna matrícula.\n');
  } else {
    console.log(`  ⚠️  ALUMNOS SIN NINGUNA MATRÍCULA (${sinNingunaMatricula.length}):\n`);
    console.log(
      '  ' +
      'CÓDIGO'.padEnd(12) +
      'APELLIDOS Y NOMBRES'.padEnd(32) +
      'EMAIL'.padEnd(34) +
      'CELULAR'.padEnd(12) +
      'SUSP.'
    );
    console.log('  ' + '-'.repeat(98));
    sinNingunaMatricula.forEach(a => {
      const nombre = `${a.apellidos}, ${a.nombres}`.substring(0, 30);
      const susp   = a.suspendido ? '  SÍ' : '  —';
      console.log(
        '  ' +
        (a.codigo || '—').padEnd(12) +
        nombre.padEnd(32) +
        (a.email_alumno || '—').padEnd(34) +
        (a.celular || '—').padEnd(12) +
        susp
      );
    });
    console.log();
  }

  // 7. Tabla: ex-alumnos (tenían matrícula pero no en el ciclo actual)
  console.log(sep + '\n');
  if (sinCicloActual.length === 0) {
    console.log(`  ✅ Todos los alumnos con historial están matriculados en [${cicloActivo.nombres}].\n`);
  } else {
    console.log(`  📋 EX-ALUMNOS: matriculados antes pero NO en [${cicloActivo.nombres}] (${sinCicloActual.length}):\n`);
    console.log(
      '  ' +
      'CÓDIGO'.padEnd(12) +
      'APELLIDOS Y NOMBRES'.padEnd(32) +
      'ÚLTIMO CICLO'.padEnd(22) +
      'CELULAR'.padEnd(14) +
      'SUSP.'
    );
    console.log('  ' + '-'.repeat(90));
    sinCicloActual.forEach(a => {
      const nombre  = `${a.apellidos}, ${a.nombres}`.substring(0, 30);
      const ultimo  = (a.ciclos_previos || '—').split(' | ')[0].substring(0, 20);
      const susp    = a.suspendido ? '  SÍ' : '  —';
      console.log(
        '  ' +
        (a.codigo || '—').padEnd(12) +
        nombre.padEnd(32) +
        ultimo.padEnd(22) +
        (a.celular || '—').padEnd(14) +
        susp
      );
    });
    console.log();
  }

  // 8. Export CSV
  if (exportCsv) {
    const csvPath = path.join(__dirname, 'reporte-sin-matricula.csv');
    const encabezado = 'tipo,id,codigo,apellidos,nombres,email,celular,dni,suspendido,ciclos_previos\n';

    const filasSinMatricula = sinNingunaMatricula.map(a =>
      `SIN_MATRICULA,${a.id},"${a.codigo}","${a.apellidos}","${a.nombres}","${a.email_alumno}","${a.celular || ''}","${a.dni || ''}",${a.suspendido ? 'SI' : 'NO'},`
    );
    const filasExAlumnos = sinCicloActual.map(a =>
      `EX_ALUMNO,${a.id},"${a.codigo}","${a.apellidos}","${a.nombres}","${a.email_alumno}","${a.celular || ''}","${a.dni || ''}",${a.suspendido ? 'SI' : 'NO'},"${(a.ciclos_previos || '').replace(/"/g, '""')}"`
    );

    fs.writeFileSync(csvPath, encabezado + [...filasSinMatricula, ...filasExAlumnos].join('\n') + '\n', 'utf8');
    console.log(`  💾 CSV guardado en: ${csvPath}\n`);
  }

  console.log(sep);
  console.log('  Reporte generado el', new Date().toLocaleString('es-PE'));
  console.log(sep + '\n');

  await sequelize.close();
}

run().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
