/**
 * migrar-bd.js
 * Ejecuta las migraciones pendientes sobre TiDB Cloud.
 * Uso: node migrar-bd.js
 */

require('dotenv').config();
const sequelize = require('./src/config/database');

const MIGRACIONES = [
  // ── Módulo Materiales ──────────────────────────────────────────────────────
  {
    id: 'material.tipo_archivo',
    sql: "ALTER TABLE `material` ADD COLUMN `tipo_archivo` VARCHAR(20) NULL DEFAULT NULL COMMENT 'pdf | imagen | otro' AFTER `url_archivo`",
  },
  // ── Módulo Exámenes ────────────────────────────────────────────────────────
  {
    id: 'examen.subtipo_examen',
    sql: "ALTER TABLE `examen` ADD COLUMN `subtipo_examen` VARCHAR(80) NULL DEFAULT NULL AFTER `tipo_examen`",
  },
  {
    id: 'examen.puntaje_pregunta_buena',
    sql: "ALTER TABLE `examen` ADD COLUMN `puntaje_pregunta_buena` DECIMAL(5,2) NOT NULL DEFAULT 4.00 AFTER `cantidad_preguntas`",
  },
  {
    id: 'examen.puntaje_pregunta_mala',
    sql: "ALTER TABLE `examen` ADD COLUMN `puntaje_pregunta_mala` DECIMAL(5,2) NOT NULL DEFAULT 1.00 AFTER `puntaje_pregunta_buena`",
  },
  // ── Módulo Notas ───────────────────────────────────────────────────────────
  {
    id: 'nota.buenas',
    sql: "ALTER TABLE `nota` ADD COLUMN `buenas` INT NULL DEFAULT NULL AFTER `valor`",
  },
  {
    id: 'nota.malas',
    sql: "ALTER TABLE `nota` ADD COLUMN `malas` INT NULL DEFAULT NULL AFTER `buenas`",
  },
  // ── Módulo Pagos: mes → numero_cuota ──────────────────────────────────────
  {
    id: 'concepto_pago.numero_cuota',
    sql: "ALTER TABLE `concepto_pago` CHANGE `mes` `numero_cuota` INT NULL DEFAULT NULL COMMENT 'Número de cuota (1, 2, 3...)'",
  },
  // ── Módulo Matrícula: área + carrera ──────────────────────────────────────
  {
    id: 'matricula.area',
    sql: "ALTER TABLE `matricula` ADD COLUMN `area` VARCHAR(1) NULL DEFAULT NULL COMMENT 'Área de postulación SM: A, B, C, D, E'",
  },
  {
    id: 'matricula.carrera_preferida',
    sql: "ALTER TABLE `matricula` ADD COLUMN `carrera_preferida` VARCHAR(200) NULL DEFAULT NULL COMMENT 'Carrera de interés del alumno'",
  },
  {
    id: 'matricula.universidad_meta',
    sql: "ALTER TABLE `matricula` ADD COLUMN `universidad_meta` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Universidad objetivo: San Marcos, UNI, Otra, Por definir'",
  },
];

async function run() {
  await sequelize.authenticate();
  console.log('✅ BD conectada\n');

  for (const m of MIGRACIONES) {
    try {
      await sequelize.query(m.sql);
      console.log(`  ✔ ${m.id}`);
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log(`  ⏭  ${m.id}  (ya existe, se omite)`);
      } else {
        console.error(`  ❌ ${m.id}: ${err.message}`);
      }
    }
  }

  console.log('\n🎉 Migraciones completadas.\n');
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
