/**
 * limpiar-examenes.js
 *
 * Elimina TODOS los exámenes del sistema junto con sus notas y detalle por curso.
 * Orden: nota_curso → nota → examen
 *
 * Uso: node limpiar-examenes.js
 */

require('dotenv').config();
const sequelize  = require('./src/config/database');
const Examen     = require('./src/models/examen');
const Nota       = require('./src/models/nota');
const NotaCurso  = require('./src/models/nota_curso');

async function run() {
  await sequelize.authenticate();
  console.log('✅ DB conectada\n');

  const totalExamenes = await Examen.count();
  const totalNotas    = await Nota.count();
  const totalCursos   = await NotaCurso.count();

  console.log(`Registros encontrados:`);
  console.log(`  Exámenes  : ${totalExamenes}`);
  console.log(`  Notas     : ${totalNotas}`);
  console.log(`  NotaCurso : ${totalCursos}\n`);

  if (totalExamenes === 0 && totalNotas === 0 && totalCursos === 0) {
    console.log('ℹ️  La base de datos ya está limpia. Nada que eliminar.');
    await sequelize.close();
    return;
  }

  // Eliminar en orden para respetar FK
  const nc = await NotaCurso.destroy({ where: {} });
  console.log(`🗑️  NotaCurso eliminados : ${nc}`);

  const n = await Nota.destroy({ where: {} });
  console.log(`🗑️  Notas eliminadas     : ${n}`);

  const e = await Examen.destroy({ where: {} });
  console.log(`🗑️  Exámenes eliminados  : ${e}`);

  console.log('\n✅ Listo. Base de datos de exámenes limpia.\n');
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
