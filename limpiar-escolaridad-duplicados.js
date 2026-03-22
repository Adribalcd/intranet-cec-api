/**
 * limpiar-escolaridad-duplicados.js
 *
 * Busca TODOS los conceptos con tipo='escolaridad' en CUALQUIER ciclo,
 * agrupa por (ciclo_id + numero_cuota) y elimina duplicados.
 * Conserva el que tenga pagos; si ninguno tiene, conserva el de menor ID.
 * Los pagos del duplicado eliminado se reasignan al que se conserva.
 *
 * Uso: node limpiar-escolaridad-duplicados.js
 */

require('dotenv').config();
const sequelize    = require('./src/config/database');
const Ciclo        = require('./src/models/ciclo');
const ConceptoPago = require('./src/models/concepto_pago');
const Pago         = require('./src/models/pago');

async function run() {
  await sequelize.authenticate();
  console.log('✅ DB conectada\n');

  // Buscar TODOS los conceptos de tipo escolaridad, en cualquier ciclo
  const conceptos = await ConceptoPago.findAll({
    where: { tipo: 'escolaridad' },
    order: [['ciclo_id', 'ASC'], ['numero_cuota', 'ASC'], ['id', 'ASC']],
  });

  console.log(`Total conceptos tipo "escolaridad" encontrados: ${conceptos.length}`);

  if (conceptos.length === 0) {
    console.log('No hay conceptos de escolaridad en la BD.');
    await sequelize.close();
    return;
  }

  // Mostrar distribución por ciclo
  const porCiclo = {};
  for (const c of conceptos) {
    if (!porCiclo[c.ciclo_id]) porCiclo[c.ciclo_id] = [];
    porCiclo[c.ciclo_id].push(c);
  }
  for (const [cicloId, items] of Object.entries(porCiclo)) {
    console.log(`  Ciclo ID ${cicloId}: ${items.length} conceptos`);
  }

  // Agrupar por ciclo_id + numero_cuota para detectar duplicados
  const grupos = {};
  for (const c of conceptos) {
    const key = `${c.ciclo_id}_${c.numero_cuota ?? 'null'}_${c.descripcion}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  }

  const ids = conceptos.map(c => c.id);
  const pagos = await Pago.findAll({ where: { concepto_id: ids } });
  const conceptosConPago = new Set(pagos.map(p => p.concepto_id));

  let eliminados = 0;
  for (const [key, grupo] of Object.entries(grupos)) {
    if (grupo.length <= 1) continue;

    console.log(`\nDuplicado "${grupo[0].descripcion}" (ciclo_id=${grupo[0].ciclo_id}): ${grupo.length} registros`);

    const conservar = grupo.find(c => conceptosConPago.has(c.id)) || grupo[0];
    const eliminar  = grupo.filter(c => c.id !== conservar.id);

    console.log(`  → Conservando ID ${conservar.id}`);

    for (const c of eliminar) {
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
