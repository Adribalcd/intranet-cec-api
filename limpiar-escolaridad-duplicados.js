/**
 * limpiar-escolaridad-duplicados.js
 *
 * Elimina todos los conceptos tipo='escolaridad' que estén en ciclos
 * que NO son "Escolaridad 2026". Los pagos asociados también se eliminan.
 * Luego deduplica los conceptos de escolaridad dentro del ciclo correcto.
 *
 * Uso: node limpiar-escolaridad-duplicados.js
 */

require('dotenv').config();
const sequelize    = require('./src/config/database');
const Ciclo        = require('./src/models/ciclo');
const ConceptoPago = require('./src/models/concepto_pago');
const Pago         = require('./src/models/pago');

const NOMBRE_CICLO_ESC = 'Escolaridad 2026';

async function run() {
  await sequelize.authenticate();
  console.log('✅ DB conectada\n');

  // Buscar el ciclo correcto de escolaridad
  const cicloEsc = await Ciclo.findOne({ where: { nombres: NOMBRE_CICLO_ESC } });
  console.log(cicloEsc
    ? `Ciclo "${NOMBRE_CICLO_ESC}" encontrado (ID: ${cicloEsc.id})`
    : `⚠️  Ciclo "${NOMBRE_CICLO_ESC}" NO existe aún en la BD`
  );

  // ── 1. Eliminar conceptos escolaridad en ciclos INCORRECTOS ──────────────
  const mal = await ConceptoPago.findAll({
    where: {
      tipo: 'escolaridad',
      ...(cicloEsc ? { ciclo_id: { [require('sequelize').Op.ne]: cicloEsc.id } } : {}),
    },
  });

  if (mal.length > 0) {
    console.log(`\nConceptos escolaridad en ciclos incorrectos: ${mal.length}`);
    const idsMal = mal.map(c => c.id);
    const pagosEliminados = await Pago.destroy({ where: { concepto_id: idsMal } });
    const conceptosEliminados = await ConceptoPago.destroy({ where: { id: idsMal } });
    console.log(`  → ${conceptosEliminados} concepto(s) eliminados, ${pagosEliminados} pago(s) eliminados`);
  } else {
    console.log('\nNo hay conceptos escolaridad en ciclos incorrectos. ✓');
  }

  // ── 2. Deduplicar los del ciclo correcto ────────────────────────────────
  if (!cicloEsc) {
    console.log('\nNo existe el ciclo correcto, nada más que hacer.');
    console.log('Ejecuta "node generar-escolaridad.js" para crearlo.\n');
    await sequelize.close();
    return;
  }

  const conceptos = await ConceptoPago.findAll({
    where: { ciclo_id: cicloEsc.id },
    order: [['numero_cuota', 'ASC'], ['id', 'ASC']],
  });
  console.log(`\nConceptos en "${NOMBRE_CICLO_ESC}": ${conceptos.length}`);

  const grupos = {};
  for (const c of conceptos) {
    const key = c.numero_cuota ?? c.descripcion;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(c);
  }

  const ids = conceptos.map(c => c.id);
  const pagos = ids.length ? await Pago.findAll({ where: { concepto_id: ids } }) : [];
  const conPago = new Set(pagos.map(p => p.concepto_id));

  let eliminados = 0;
  for (const grupo of Object.values(grupos)) {
    if (grupo.length <= 1) continue;
    const conservar = grupo.find(c => conPago.has(c.id)) || grupo[0];
    const eliminar  = grupo.filter(c => c.id !== conservar.id);
    console.log(`  Cuota duplicada: conservando ID ${conservar.id}, eliminando ${eliminar.map(c => c.id).join(', ')}`);
    for (const c of eliminar) {
      const pp = pagos.filter(p => p.concepto_id === c.id);
      if (pp.length) await Pago.update({ concepto_id: conservar.id }, { where: { concepto_id: c.id } });
      await c.destroy();
      eliminados++;
    }
  }

  if (eliminados === 0) console.log('  Sin duplicados en el ciclo correcto. ✓');

  console.log('\n🎉 Listo.\n');
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
