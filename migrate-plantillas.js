/**
 * migrate-plantillas.js — Migración para sistema de plantillas de examen
 *
 * Ejecutar: node migrate-plantillas.js
 *
 * Aplica:
 *  1. plantilla_examen  — tipos/plantillas de evaluación
 *  2. plantilla_seccion — secciones dentro de una plantilla (e.g. UNI: Habilidades, Ciencias…)
 *  3. plantilla_curso   — cursos/áreas dentro de una sección o plantilla
 *  4. examen            — agrega plantilla_id y config_cursos_json
 *  5. nota_curso        — agrega seccion_nombre
 */

'use strict';

require('dotenv').config();
const { sequelize } = require('./src/models');

const pasos = [
  // ── 1. plantilla_examen ─────────────────────────────────────────────────
  {
    nombre: 'plantilla_examen: CREATE TABLE',
    sql: `CREATE TABLE IF NOT EXISTS \`plantilla_examen\` (
            \`id\`              INT           NOT NULL AUTO_INCREMENT,
            \`nombre\`          VARCHAR(100)  NOT NULL,
            \`descripcion\`     TEXT          NULL DEFAULT NULL,
            \`tipo_calculo\`    ENUM('buenas_malas','nota_directa') NOT NULL DEFAULT 'buenas_malas'
                               COMMENT 'Forma de calcular la nota final',
            \`tiene_secciones\` TINYINT(1)    NOT NULL DEFAULT 0
                               COMMENT 'true = examen con secciones (p.ej. UNI)',
            \`activo\`          TINYINT(1)    NOT NULL DEFAULT 1,
            PRIMARY KEY (\`id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },

  // ── 2. plantilla_seccion ────────────────────────────────────────────────
  {
    nombre: 'plantilla_seccion: CREATE TABLE',
    sql: `CREATE TABLE IF NOT EXISTS \`plantilla_seccion\` (
            \`id\`           INT         NOT NULL AUTO_INCREMENT,
            \`plantilla_id\` INT         NOT NULL,
            \`nombre\`       VARCHAR(80) NOT NULL,
            \`orden\`        INT         NOT NULL DEFAULT 0,
            PRIMARY KEY (\`id\`),
            KEY \`idx_psec_plantilla\` (\`plantilla_id\`),
            CONSTRAINT \`fk_psec_plantilla\`
              FOREIGN KEY (\`plantilla_id\`) REFERENCES \`plantilla_examen\` (\`id\`)
              ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },

  // ── 3. plantilla_curso ──────────────────────────────────────────────────
  {
    nombre: 'plantilla_curso: CREATE TABLE',
    sql: `CREATE TABLE IF NOT EXISTS \`plantilla_curso\` (
            \`id\`                 INT          NOT NULL AUTO_INCREMENT,
            \`plantilla_id\`       INT          NOT NULL,
            \`seccion_id\`         INT          NULL DEFAULT NULL,
            \`nombre\`             VARCHAR(80)  NOT NULL,
            \`cantidad_preguntas\` INT          NULL DEFAULT NULL,
            \`puntaje_buena\`      DECIMAL(6,3) NOT NULL DEFAULT 4.000,
            \`puntaje_mala\`       DECIMAL(6,3) NOT NULL DEFAULT 1.000,
            \`orden\`              INT          NOT NULL DEFAULT 0,
            PRIMARY KEY (\`id\`),
            KEY \`idx_pcur_plantilla\` (\`plantilla_id\`),
            KEY \`idx_pcur_seccion\`   (\`seccion_id\`),
            CONSTRAINT \`fk_pcur_plantilla\`
              FOREIGN KEY (\`plantilla_id\`) REFERENCES \`plantilla_examen\` (\`id\`)
              ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT \`fk_pcur_seccion\`
              FOREIGN KEY (\`seccion_id\`) REFERENCES \`plantilla_seccion\` (\`id\`)
              ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },

  // ── 4. examen: nuevas columnas ──────────────────────────────────────────
  {
    nombre: 'examen: ADD COLUMN plantilla_id',
    sql: `ALTER TABLE \`examen\`
            ADD COLUMN IF NOT EXISTS \`plantilla_id\` INT NULL DEFAULT NULL
            COMMENT 'FK a plantilla_examen (null = examen sin plantilla)'`,
  },
  {
    nombre: 'examen: ADD COLUMN config_cursos_json',
    sql: `ALTER TABLE \`examen\`
            ADD COLUMN IF NOT EXISTS \`config_cursos_json\` TEXT NULL DEFAULT NULL
            COMMENT 'JSON con la config de cursos de este examen (sobreescribe la plantilla)'`,
  },

  // ── 5. nota_curso: nueva columna ────────────────────────────────────────
  {
    nombre: 'nota_curso: ADD COLUMN seccion_nombre',
    sql: `ALTER TABLE \`nota_curso\`
            ADD COLUMN IF NOT EXISTS \`seccion_nombre\` VARCHAR(80) NULL DEFAULT NULL
            COMMENT 'Sección del curso (p.ej. Habilidades, Ciencias) para exámenes UNI'`,
  },
];

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conectado a la BD\n');

    for (const paso of pasos) {
      try {
        await sequelize.query(paso.sql);
        console.log(`  ✓ ${paso.nombre}`);
      } catch (err) {
        if (err.original?.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
          console.log(`  · ${paso.nombre} (columna ya existía, omitido)`);
        } else {
          throw new Error(`Falló "${paso.nombre}": ${err.message}`);
        }
      }
    }

    console.log('\n✓ Migración de plantillas completada.');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error durante la migración:', err.message);
    process.exit(1);
  }
}

migrate();
