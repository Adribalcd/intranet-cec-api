/**
 * generar-escolaridad.js
 *
 * Crea (o recrea) el ciclo especial "Escolaridad 2026" con sus 10 cuotas.
 * Este ciclo es independiente de los ciclos académicos. Lo ven únicamente
 * los alumnos con es_escolar = true.
 *
 * Cuotas: 10 × S/ 70.00  — vencimiento del 15-mar-2026 al 15-dic-2026.
 *
 * Uso: node generar-escolaridad.js
 */

require('dotenv').config();
const sequelize        = require('./src/config/database');
const Ciclo            = require('./src/models/ciclo');
const ConceptoPago     = require('./src/models/concepto_pago');
const Pago             = require('./src/models/pago');
const ConfigPagosCiclo = require('./src/models/config_pagos_ciclo');

const NOMBRE_CICLO = 'Escolaridad 2026';
const CUOTAS       = 10;
const MONTO_CUOTA  = 70.00;

function fechaVencimiento(mesOffset) {
  const startMonth = 3; // marzo
  let m = startMonth + mesOffset;
  let y = 2026;
  if (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}-15`;
}

async function run() {
  await sequelize.authenticate();
  console.log('✅ DB conectada\n');

  // ── Buscar o crear el ciclo especial ─────────────────────────
  let ciclo = await Ciclo.findOne({ where: { nombres: NOMBRE_CICLO } });

  if (ciclo) {
    console.log(`ℹ️  Ciclo "${NOMBRE_CICLO}" ya existe (ID: ${ciclo.id}). Recreando conceptos…`);

    // Eliminar pagos y conceptos previos
    const conceptos = await ConceptoPago.findAll({ where: { ciclo_id: ciclo.id }, attributes: ['id'] });
    const ids = conceptos.map(c => c.id);
    if (ids.length) {
      const pagosEliminados = await Pago.destroy({ where: { concepto_id: ids } });
      const conceptosEliminados = await ConceptoPago.destroy({ where: { ciclo_id: ciclo.id } });
      console.log(`  🗑️  ${conceptosEliminados} concepto(s) y ${pagosEliminados} pago(s) eliminados.`);
    }
  } else {
    ciclo = await Ciclo.create({
      nombres:      NOMBRE_CICLO,
      fecha_inicio: '2026-03-01',
      fecha_fin:    '2026-12-31',
    });
    console.log(`  ✔ Ciclo "${NOMBRE_CICLO}" creado (ID: ${ciclo.id})`);
  }

  // ── Crear las 10 cuotas ───────────────────────────────────────
  for (let i = 0; i < CUOTAS; i++) {
    const numeroCuota = i + 1;
    const vence = fechaVencimiento(i);
    await ConceptoPago.create({
      ciclo_id:            ciclo.id,
      tipo:                'escolaridad',
      descripcion:         `Escolaridad Cuota ${numeroCuota}`,
      numero_cuota:        numeroCuota,
      monto_opcion_1:      MONTO_CUOTA,
      etiqueta_opcion_1:   'Regular',
      fecha_vencimiento:   vence,
      orden:               numeroCuota,
      permite_pago_online: false,
    });
    console.log(`  ✔ Cuota ${numeroCuota}  S/ ${MONTO_CUOTA}  vence ${vence}`);
  }

  // ── Config del ciclo (visible = true para que el API lo retorne) ──
  await ConfigPagosCiclo.upsert({
    ciclo_id:              ciclo.id,
    pagos_visible:         true,
    permite_transferencia: false,
    permite_yape_plin:     false,
  });
  console.log(`  ✔ Config del ciclo lista (pagos_visible = true)`);

  console.log(`\n🎉 Listo. ID ciclo escolaridad: ${ciclo.id}\n`);
  console.log(`Guarda este ID en ESCOLARIDAD_CICLO_ID del .env si quieres usarlo directamente.`);
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
