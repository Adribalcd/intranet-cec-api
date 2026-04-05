/**
 * migracion-turno-tarde.js
 *
 * Agrega las columnas necesarias para turno tarde en asistencia y ciclo.
 * Es seguro ejecutarlo más de una vez (ignora si la columna ya existe).
 *
 * Uso:
 *   node migracion-turno-tarde.js
 */

require('dotenv').config();
const sequelize = require('./src/config/database');

const sep = '─'.repeat(60);

async function agregarColumna(tabla, columna, definicion) {
  try {
    await sequelize.query(`ALTER TABLE \`${tabla}\` ADD COLUMN ${definicion}`);
    console.log(`  ✅  ${tabla}.${columna} — agregada`);
  } catch (err) {
    if (err.original?.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
      console.log(`  ⏭️   ${tabla}.${columna} — ya existe, omitida`);
    } else {
      console.error(`  ❌  ${tabla}.${columna} — ERROR: ${err.message}`);
      throw err;
    }
  }
}

async function run() {
  await sequelize.authenticate();

  console.log('\n' + sep);
  console.log('  MIGRACIÓN: turno tarde — Intranet CEC');
  console.log(sep + '\n');

  // ── Tabla: asistencia ────────────────────────────────────────
  console.log('  Tabla: asistencia\n');

  await agregarColumna(
    'asistencia', 'turno',
    "`turno` VARCHAR(10) NOT NULL DEFAULT 'mañana' AFTER `observaciones`"
  );

  // ── Tabla: ciclo ─────────────────────────────────────────────
  console.log('\n  Tabla: ciclo\n');

  await agregarColumna(
    'ciclo', 'tiene_tarde',
    '`tiene_tarde` TINYINT(1) NOT NULL DEFAULT 0 AFTER `fecha_fin`'
  );
  await agregarColumna(
    'ciclo', 'hora_tarde_inicio',
    '`hora_tarde_inicio` VARCHAR(8) NULL AFTER `tiene_tarde`'
  );
  await agregarColumna(
    'ciclo', 'hora_tarde_puntual',
    '`hora_tarde_puntual` VARCHAR(8) NULL AFTER `hora_tarde_inicio`'
  );

  // ── Verificación ─────────────────────────────────────────────
  console.log('\n' + sep);
  console.log('  Verificación:\n');

  const [[asistCols]] = await sequelize.query(
    "SHOW COLUMNS FROM asistencia LIKE 'turno'"
  );
  const [[cicloCols1]] = await sequelize.query(
    "SHOW COLUMNS FROM ciclo LIKE 'tiene_tarde'"
  );
  const [[cicloCols2]] = await sequelize.query(
    "SHOW COLUMNS FROM ciclo LIKE 'hora_tarde_inicio'"
  );
  const [[cicloCols3]] = await sequelize.query(
    "SHOW COLUMNS FROM ciclo LIKE 'hora_tarde_puntual'"
  );

  console.log(`  asistencia.turno           ${asistCols ? '✅' : '❌'}`);
  console.log(`  ciclo.tiene_tarde          ${cicloCols1 ? '✅' : '❌'}`);
  console.log(`  ciclo.hora_tarde_inicio    ${cicloCols2 ? '✅' : '❌'}`);
  console.log(`  ciclo.hora_tarde_puntual   ${cicloCols3 ? '✅' : '❌'}`);

  console.log('\n' + sep);
  console.log('  Migración completada.\n');

  await sequelize.close();
}

run().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
