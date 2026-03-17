/**
 * limpiar-alumnos.js
 *
 * ⚠️  ELIMINA todos los registros de las tablas:
 *     asistencia → nota → matricula → alumno
 *     (en orden para respetar foreign keys)
 *
 * Uso: node limpiar-alumnos.js
 */

require('dotenv').config();
const sequelize = require('./src/config/database');

async function run() {
  await sequelize.authenticate();
  console.log('✅ BD conectada\n');

  console.log('⚠️  Se eliminarán TODOS los alumnos, matrículas, asistencias y notas.');
  console.log('   Tienes 5 segundos para cancelar (Ctrl+C)...\n');
  await new Promise(r => setTimeout(r, 5000));

  // Desactivar checks de FK temporalmente para truncar sin orden
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

  const tablas = ['asistencia', 'nota', 'pago', 'matricula', 'alumno'];
  for (const tabla of tablas) {
    const [, meta] = await sequelize.query(`DELETE FROM \`${tabla}\``);
    const filas = meta?.affectedRows ?? '?';
    console.log(`  🗑️  ${tabla}: ${filas} fila(s) eliminada(s)`);
  }

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n✅ Listo. Tablas vaciadas.\n');
  await sequelize.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
