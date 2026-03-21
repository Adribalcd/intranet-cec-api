/**
 * generar-conceptos.js
 *
 * Elimina los conceptos de pago existentes de cada ciclo y los recrea
 * con la nueva estructura (numero_cuota en lugar de mes/anio).
 *
 * Ciclos objetivo:
 *   - Anual Escolar       → 9 cuotas  (Mar–Nov 2026, día 15)
 *   - Anual San Marcos    → 9 cuotas  (Mar–Nov 2026, día 15)
 *   - Anual Uni           → 6 cuotas  (Mar–Ago 2026, día 15)
 *   - Semestral San Marcos → 6 cuotas (Mar–Ago 2026, día 15)
 *
 * Uso: node generar-conceptos.js
 */

require('dotenv').config();
const sequelize        = require('./src/config/database');
const Ciclo            = require('./src/models/ciclo');
const ConceptoPago     = require('./src/models/concepto_pago');
const Pago             = require('./src/models/pago');
const ConfigPagosCiclo = require('./src/models/config_pagos_ciclo');

// Vencimiento: día 15 del mes correspondiente (mesOffset=0 → marzo 2026)
function fechaVencimiento(mesOffset) {
  const startMonth = 3; // marzo
  let m = startMonth + mesOffset;
  let y = 2026;
  if (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}-15`;
}

// Definición de ciclos a procesar
// escolaridad: null = no aplica para ese ciclo
// escolaridad: { cuotas: N, monto: X } = N cuotas de S/ X, vencimiento mes a mes desde marzo
const CICLOS_CONFIG = [
  {
    nombre:           'Anual Escolar',
    cuotas:           9,
    montoMatricula:   100.00,
    montoMensualidad: 400.00,
    escolaridad:      { cuotas: 10, monto: 70.00 },  // mar–dic 2026
  },
  {
    nombre:           'Anual San Marcos',
    cuotas:           9,
    montoMatricula:   100.00,
    montoMensualidad: 370.00,
    escolaridad:      null,
  },
  {
    nombre:           'Anual Uni',
    cuotas:           6,
    montoMatricula:   100.00,
    montoMensualidad: 370.00,
    escolaridad:      null,
  },
  {
    nombre:           'Semestral San Marcos',
    cuotas:           6,
    montoMatricula:   100.00,
    montoMensualidad: 370.00,
    escolaridad:      null,
  },
];

// Config de cuentas bancarias (ajusta según datos reales)
const CUENTAS = {
  bcp_cuenta:       null,
  bcp_cci:          null,
  bbva_cuenta:      null,
  bbva_cci:         null,
  interbank_cuenta: null,
  interbank_cci:    null,
  yape_numero:      null,
  whatsapp_numero:  null, // Ej: '51924513040'
};

async function run() {
  await sequelize.authenticate();
  console.log('✅ DB conectada\n');

  for (const cfg of CICLOS_CONFIG) {
    console.log(`\n── Procesando: "${cfg.nombre}" (${cfg.cuotas} cuotas) ──`);

    const ciclo = await Ciclo.findOne({ where: { nombres: cfg.nombre } });
    if (!ciclo) {
      console.log(`  ⚠️  Ciclo no encontrado, saltando.`);
      continue;
    }
    console.log(`  Ciclo ID: ${ciclo.id}`);

    // ── Eliminar pagos y conceptos existentes ─────────────────
    const conceptosExistentes = await ConceptoPago.findAll({
      where: { ciclo_id: ciclo.id },
      attributes: ['id'],
    });
    const ids = conceptosExistentes.map(c => c.id);
    if (ids.length > 0) {
      const pagosEliminados = await Pago.destroy({ where: { concepto_id: ids } });
      const conceptosEliminados = await ConceptoPago.destroy({ where: { ciclo_id: ciclo.id } });
      console.log(`  🗑️  ${conceptosEliminados} concepto(s) y ${pagosEliminados} pago(s) eliminados.`);
    } else {
      console.log(`  ℹ️  Sin conceptos previos.`);
    }

    // ── Crear matrícula ────────────────────────────────────────
    await ConceptoPago.create({
      ciclo_id:            ciclo.id,
      tipo:                'matricula',
      descripcion:         `Matrícula ${cfg.nombre} 2026`,
      numero_cuota:        null,
      monto_opcion_1:      cfg.montoMatricula,
      etiqueta_opcion_1:   'Regular',
      fecha_vencimiento:   '2026-03-15',
      orden:               0,
      permite_pago_online: false,
    });
    console.log(`  ✔ Matrícula  S/ ${cfg.montoMatricula}  vence 2026-03-15`);

    // ── Crear cuotas de escolaridad (si aplica) ────────────────
    if (cfg.escolaridad) {
      for (let i = 0; i < cfg.escolaridad.cuotas; i++) {
        const numeroCuota = i + 1;
        const vence = fechaVencimiento(i); // i=0→2026-03-15 … i=9→2026-12-15
        await ConceptoPago.create({
          ciclo_id:            ciclo.id,
          tipo:                'escolaridad',
          descripcion:         `Escolaridad Cuota ${numeroCuota}`,
          numero_cuota:        numeroCuota,
          monto_opcion_1:      cfg.escolaridad.monto,
          etiqueta_opcion_1:   'Regular',
          fecha_vencimiento:   vence,
          orden:               20 + numeroCuota,   // después de mensualidades (orden 2..10)
          permite_pago_online: false,
        });
        console.log(`  ✔ Escolaridad Cuota ${numeroCuota}  S/ ${cfg.escolaridad.monto}  vence ${vence}`);
      }
    }

    // ── Crear cuotas ───────────────────────────────────────────
    for (let i = 0; i < cfg.cuotas; i++) {
      const numeroCuota = i + 1;
      const vence       = fechaVencimiento(i);
      await ConceptoPago.create({
        ciclo_id:            ciclo.id,
        tipo:                'mensualidad',
        descripcion:         `Pensión Cuota ${numeroCuota} — ${cfg.nombre}`,
        numero_cuota:        numeroCuota,
        monto_opcion_1:      cfg.montoMensualidad,
        etiqueta_opcion_1:   'Regular',
        fecha_vencimiento:   vence,
        orden:               numeroCuota + 1,
        permite_pago_online: false,
      });
      console.log(`  ✔ Cuota ${numeroCuota}  vence ${vence}`);
    }

    // ── Config de pagos del ciclo ──────────────────────────────
    const [config, created] = await ConfigPagosCiclo.findOrCreate({
      where:    { ciclo_id: ciclo.id },
      defaults: {
        pagos_visible:         true,
        permite_transferencia: false,
        permite_yape_plin:     false,
        ...CUENTAS,
      },
    });

    if (created) {
      console.log(`  ✔ Config creada (pagos_visible=true)`);
    } else {
      await config.update({ pagos_visible: true });
      console.log(`  ℹ️  Config ya existía (sin cambios en cuentas bancarias)`);
    }
  }

  console.log('\n🎉 Listo.\n');
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
