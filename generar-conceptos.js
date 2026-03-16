/**
 * generar-conceptos.js
 *
 * Genera los conceptos de pago y configs para los ciclos existentes.
 * NO crea ciclos ni cursos nuevos — solo busca los ciclos por nombre exacto.
 *
 * Ciclos objetivo:
 *   - Anual Escolar     → 9 cuotas  Mar-Nov 2026
 *   - Anual San Marcos  → 9 cuotas  Mar-Nov 2026
 *   - Anual Uni         → 6 cuotas  Mar-Ago 2026
 *   - Semestral San Marcos → 6 cuotas Mar-Ago 2026
 *
 * Vencimiento: día 15 de cada mes (primer vencimiento 15/03/2026)
 * pago online: DESHABILITADO en todos los conceptos
 *
 * Uso: node generar-conceptos.js
 */

require('dotenv').config();
const sequelize = require('./src/config/database');
const Ciclo          = require('./src/models/ciclo');
const ConceptoPago   = require('./src/models/concepto_pago');
const ConfigPagosCiclo = require('./src/models/config_pagos_ciclo');

// Meses desde marzo 2026
function fechaVencimiento(mesOffset) {
  // mesOffset = 0 → marzo 2026 (mes 3)
  const startMonth = 3; // marzo
  const startYear  = 2026;
  let m = startMonth + mesOffset;
  let y = startYear;
  if (m > 12) { m -= 12; y += 1; }
  const dd = String(m).padStart(2, '0');
  return `${y}-${dd}-15`;
}

function mesAnio(mesOffset) {
  const startMonth = 3;
  let m = startMonth + mesOffset;
  let y = 2026;
  if (m > 12) { m -= 12; y += 1; }
  return { mes: m, anio: y };
}

const NOMBRES_MES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Definición de ciclos a procesar
const CICLOS_CONFIG = [
  {
    nombre: 'Anual Escolar',
    cuotas: 9,
    montoMensualidad: 370.00,
    montoMatricula: 100.00,
  },
  {
    nombre: 'Anual San Marcos',
    cuotas: 9,
    montoMensualidad: 370.00,
    montoMatricula: 100.00,
  },
  {
    nombre: 'Anual Uni',
    cuotas: 6,
    montoMensualidad: 370.00,
    montoMatricula: 100.00,
  },
  {
    nombre: 'Semestral San Marcos',
    cuotas: 6,
    montoMensualidad: 370.00,
    montoMatricula: 100.00,
  },
];

// Config de cuentas bancarias (ajusta según datos reales del academy)
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

    // Buscar ciclo
    const ciclo = await Ciclo.findOne({ where: { nombres: cfg.nombre } });
    if (!ciclo) {
      console.log(`  ⚠️  Ciclo no encontrado, saltando.`);
      continue;
    }
    console.log(`  Ciclo ID: ${ciclo.id}`);

    // ── Conceptos de pago ──────────────────────────────────────
    // Verificar si ya existen conceptos para no duplicar
    const existentes = await ConceptoPago.count({ where: { ciclo_id: ciclo.id } });
    if (existentes > 0) {
      console.log(`  ℹ️  Ya existen ${existentes} conceptos → saltando creación de conceptos.`);
    } else {
      // 1. Matrícula
      await ConceptoPago.create({
        ciclo_id:          ciclo.id,
        tipo:              'matricula',
        descripcion:       `Matrícula ${cfg.nombre} 2026`,
        mes:               3,
        anio:              2026,
        monto_opcion_1:    cfg.montoMatricula,
        etiqueta_opcion_1: 'Regular',
        fecha_vencimiento: '2026-03-15',
        orden:             0,
        permite_pago_online: false,
      });
      console.log(`  ✔ Matrícula creada (S/ ${cfg.montoMatricula})`);

      // 2. Mensualidades
      for (let i = 0; i < cfg.cuotas; i++) {
        const { mes, anio } = mesAnio(i);
        const vence = fechaVencimiento(i);
        const nombreMes = NOMBRES_MES[mes];
        await ConceptoPago.create({
          ciclo_id:          ciclo.id,
          tipo:              'mensualidad',
          descripcion:       `Mensualidad ${nombreMes} ${anio} — ${cfg.nombre}`,
          mes,
          anio,
          monto_opcion_1:    cfg.montoMensualidad,
          etiqueta_opcion_1: 'Regular',
          fecha_vencimiento: vence,
          orden:             i + 1,
          permite_pago_online: false,
        });
        console.log(`  ✔ Cuota ${i + 1}: ${nombreMes} ${anio}  vence ${vence}`);
      }
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
      console.log(`  ✔ Config creada (pagos_visible=true, pago online=false)`);
    } else {
      // Solo actualiza los flags de control, no sobreescribe cuentas bancarias
      await config.update({
        pagos_visible:         true,
        permite_transferencia: false,
        permite_yape_plin:     false,
      });
      console.log(`  ℹ️  Config actualizada (pagos_visible=true, pago online=false)`);
    }
  }

  console.log('\n🎉 Listo. Ejecuta la app normalmente.\n');
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
