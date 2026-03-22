/**
 * limpiar-escolaridad-duplicados.js
 *
 * Elimina conceptos de pago duplicados del ciclo "Escolaridad 2026".
 * Conserva siempre el concepto que tenga pagos registrados.
 * Si ninguno tiene pagos, conserva el de menor ID.
 *
 * Uso: node limpiar-escolaridad-duplicados.js
 */

require('dotenv').config();
const sequelize    = require('./src/config/database');
const Ciclo        = require('./src/models/ciclo');
const ConceptoPago = require('./src/models/concepto_pago');
const Pago         = require('./src/models/pago');

const NOMBRE_CICLO = 'Escolaridad 2026';

async function run() {
  await sequelize.authenticate();
  console.log('✅ DB conectada\n');

  const ciclo = await Ciclo.findOne({ where: { nombres: NOMBRE_CICLO } });
  if (!ciclo) { console.log('⚠️  Ciclo no encontrado.'); return; }
  console.log(`Ciclo ID: ${ciclo.id}\n`);

  const conceptos = await ConceptoPago.findAll({
    where: { ciclo_id: ciclo.id },
    order: [['numero_cuota', 'ASC'], ['id', 'ASC']],
  });
  console.log(`Total conceptos encontrados: ${conceptos.length}`);

  // Agrupar por numero_cuota
  const grupos = {};
  for (const c of conceptos) {
    const key = c.numero_cuota ?? `sin_cuota_${c.id}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  }

  let eliminados = 0;
  for (const [cuota, grupo] of Object.entries(grupos)) {
    if (grupo.length <= 1) continue;

    console.log(`\nCuota ${cuota}: ${grupo.length} duplicados`);

    // Ver cuál tiene pagos
    const ids = grupo.map(c => c.id);
    const pagos = await Pago.findAll({ where: { concepto_id: ids } });
    const conceptosConPago = new Set(pagos.map(p => p.concepto_id));

    // Elegir el que conservar: el que tiene pagos (o si ninguno tiene, el de menor ID)
    let conservar = grupo.find(c => conceptosConPago.has(c.id)) || grupo[0];
    const eliminar = grupo.filter(c => c.id !== conservar.id);

    console.log(`  → Conservando ID ${conservar.id} (${conceptosConPago.has(conservar.id) ? 'tiene pagos' : 'sin pagos'})`);

    for (const c of eliminar) {
      // Reasignar pagos al concepto conservado antes de eliminar
      const pagosDelEliminado = pagos.filter(p => p.concepto_id === c.id);
      if (pagosDelEliminado.length > 0) {
        await Pago.update({ concepto_id: conservar.id }, { where: { concepto_id: c.id } });
        console.log(`  → ${pagosDelEliminado.length} pago(s) reasignados de ID ${c.id} → ID ${conservar.id}`);
      }
      await c.destroy();
      console.log(`  → Eliminado ID ${c.id}`);
      eliminados++;
    }
  }

  console.log(`\n🎉 Listo. ${eliminados} concepto(s) duplicado(s) eliminados.\n`);
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
