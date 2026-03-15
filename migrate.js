/**
 * migrate.js — Migración BD para feature/excel-simulacro
 *
 * Ejecutar: node migrate.js
 *
 * Aplica los cambios necesarios sobre la BD existente:
 *  1. examen  → amplía precisión de puntajes a 3 decimales, agrega area y ponderaciones_json
 *  2. nota    → agrega nc, area, carrera, aula
 *  3. nota_curso → crea la tabla nueva (detalle por curso de simulacros OMR)
 */

'use strict';

require('dotenv').config();
const { sequelize } = require('./src/models');

const pasos = [
  // ── 1. examen ────────────────────────────────────────────────────────────
  {
    nombre: 'examen: DECIMAL(5,2) → (5,3) en puntaje_pregunta_buena',
    sql: `ALTER TABLE \`examen\`
            MODIFY COLUMN \`puntaje_pregunta_buena\` DECIMAL(5,3) NOT NULL DEFAULT 4.000`,
  },
  {
    nombre: 'examen: DECIMAL(5,2) → (5,3) en puntaje_pregunta_mala',
    sql: `ALTER TABLE \`examen\`
            MODIFY COLUMN \`puntaje_pregunta_mala\` DECIMAL(5,3) NOT NULL DEFAULT 1.000`,
  },
  {
    nombre: 'examen: ADD COLUMN area',
    sql: `ALTER TABLE \`examen\`
            ADD COLUMN IF NOT EXISTS \`area\` CHAR(1) NULL DEFAULT NULL
            COMMENT 'Área OMR del simulacro: A, B, C, D o E'`,
  },
  {
    nombre: 'examen: ADD COLUMN ponderaciones_json',
    sql: `ALTER TABLE \`examen\`
            ADD COLUMN IF NOT EXISTS \`ponderaciones_json\` TEXT NULL DEFAULT NULL
            COMMENT 'JSON con la matriz P1-P10 por área'`,
  },

  // ── 2. nota ──────────────────────────────────────────────────────────────
  {
    nombre: 'nota: ADD COLUMN nc',
    sql: `ALTER TABLE \`nota\`
            ADD COLUMN IF NOT EXISTS \`nc\` INT NULL DEFAULT NULL
            COMMENT 'Preguntas no contestadas (simulacro OMR)'`,
  },
  {
    nombre: 'nota: ADD COLUMN area',
    sql: `ALTER TABLE \`nota\`
            ADD COLUMN IF NOT EXISTS \`area\` CHAR(1) NULL DEFAULT NULL
            COMMENT 'Área OMR del alumno en ese examen'`,
  },
  {
    nombre: 'nota: ADD COLUMN carrera',
    sql: `ALTER TABLE \`nota\`
            ADD COLUMN IF NOT EXISTS \`carrera\` VARCHAR(80) NULL DEFAULT NULL
            COMMENT 'Carrera del alumno según Excel OMR'`,
  },
  {
    nombre: 'nota: ADD COLUMN aula',
    sql: `ALTER TABLE \`nota\`
            ADD COLUMN IF NOT EXISTS \`aula\` VARCHAR(30) NULL DEFAULT NULL
            COMMENT 'Aula del alumno según Excel OMR'`,
  },

  // ── 3. alumno / pago / config_pagos_ciclo / concepto_pago ───────────────
  {
    nombre: 'alumno: ADD COLUMN es_escolar',
    sql: `ALTER TABLE \`alumno\`
            ADD COLUMN IF NOT EXISTS \`es_escolar\` TINYINT(1) NOT NULL DEFAULT 0
            COMMENT 'true = modalidad escolaridad (10 cuotas × S/70)'`,
  },
  {
    nombre: 'pago: ADD COLUMN codigo_recibo',
    sql: `ALTER TABLE \`pago\`
            ADD COLUMN IF NOT EXISTS \`codigo_recibo\` VARCHAR(60) NULL DEFAULT NULL
            COMMENT 'Código o número de recibo físico'`,
  },
  {
    nombre: 'concepto_pago: ALTER ENUM tipo ADD escolaridad',
    sql: `ALTER TABLE \`concepto_pago\`
            MODIFY COLUMN \`tipo\` ENUM('mensualidad','matricula','materiales','escolaridad','otro')
            NOT NULL DEFAULT 'mensualidad'`,
  },
  {
    nombre: 'config_pagos_ciclo: ADD COLUMN whatsapp_numero',
    sql: `ALTER TABLE \`config_pagos_ciclo\`
            ADD COLUMN IF NOT EXISTS \`whatsapp_numero\` VARCHAR(20) NULL DEFAULT NULL
            COMMENT 'Número WhatsApp contacto pagos (sin +)'`,
  },

  // ── 4. nota_curso (nueva) ────────────────────────────────────────────────
  {
    nombre: 'nota_curso: CREATE TABLE',
    sql: `CREATE TABLE IF NOT EXISTS \`nota_curso\` (
            \`id\`           INT           NOT NULL AUTO_INCREMENT,
            \`nota_id\`      INT           NOT NULL,
            \`curso_nombre\` VARCHAR(80)   NOT NULL,
            \`buenas\`       INT           NOT NULL DEFAULT 0,
            \`malas\`        INT           NOT NULL DEFAULT 0,
            \`nc\`           INT           NOT NULL DEFAULT 0,
            \`puntaje\`      DECIMAL(10,3) NULL     DEFAULT NULL,
            PRIMARY KEY (\`id\`),
            KEY \`idx_nota_curso_nota_id\` (\`nota_id\`),
            CONSTRAINT \`fk_nota_curso_nota\`
              FOREIGN KEY (\`nota_id\`) REFERENCES \`nota\` (\`id\`)
              ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
        // MySQL lanza error 1060 si la columna ya existe en versiones antiguas
        // que no soportan IF NOT EXISTS en ALTER TABLE
        if (err.original?.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
          console.log(`  · ${paso.nombre} (columna ya existía, omitido)`);
        } else {
          throw new Error(`Falló "${paso.nombre}": ${err.message}`);
        }
      }
    }

    console.log('\n✓ Migración completada.');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error durante la migración:', err.message);
    process.exit(1);
  }
}

migrate();
