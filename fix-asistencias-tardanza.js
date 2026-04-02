/**
 * fix-asistencias-tardanza.js
 *
 * Corrige registros de asistencia que fueron marcados como 'Tardanza'
 * pero cuya hora real está dentro del rango 07:00–08:20 (ventana puntual).
 *
 * Uso:
 *   node fix-asistencias-tardanza.js          <- muestra cuántos afecta (dry-run)
 *   node fix-asistencias-tardanza.js --apply  <- aplica los cambios
 */

require('dotenv').config();
const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE,
  process.env.DB_USERNAME,
  process.env.PASSWORD,
  {
    host: process.env.DB_HOST || process.env.HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: { ssl: { rejectUnauthorized: true } },
  }
);

const APPLY = process.argv.includes('--apply');

async function main() {
  await sequelize.authenticate();
  console.log('Conectado a la base de datos.');

  // Hora de inicio y fin de la ventana puntual (en minutos desde medianoche)
  // 07:00 = 420, 08:20 = 500
  const MIN_INICIO = 7 * 60;      // 420
  const MIN_FIN    = 8 * 60 + 20; // 500

  // Usamos SQL directo para filtrar por hora dentro de fecha_hora
  const [registros] = await sequelize.query(`
    SELECT id, alumno_id, fecha_hora, estado, observaciones
    FROM asistencias
    WHERE estado = 'Tardanza'
      AND DAYOFWEEK(fecha_hora) BETWEEN 2 AND 7
      AND (HOUR(fecha_hora) * 60 + MINUTE(fecha_hora)) >= :minInicio
      AND (HOUR(fecha_hora) * 60 + MINUTE(fecha_hora)) <= :minFin
    ORDER BY fecha_hora DESC
  `, {
    replacements: { minInicio: MIN_INICIO, minFin: MIN_FIN },
  });

  console.log(`\nRegistros afectados (Tardanza dentro de 07:00–08:20): ${registros.length}`);

  if (registros.length === 0) {
    console.log('No hay registros que corregir.');
    process.exit(0);
  }

  // Mostrar muestra
  const muestra = registros.slice(0, 10);
  console.log('\nMuestra (máx 10):');
  muestra.forEach(r => {
    console.log(`  ID ${r.id} | alumno_id ${r.alumno_id} | ${r.fecha_hora}`);
  });
  if (registros.length > 10) console.log(`  ... y ${registros.length - 10} más.`);

  if (!APPLY) {
    console.log('\n[DRY-RUN] Para aplicar los cambios ejecuta:');
    console.log('  node fix-asistencias-tardanza.js --apply\n');
    process.exit(0);
  }

  // Aplicar corrección
  const ids = registros.map(r => r.id);
  const [rowsUpdated] = await sequelize.query(`
    UPDATE asistencias
    SET estado = 'Presente',
        observaciones = NULL
    WHERE id IN (:ids)
  `, { replacements: { ids } });

  console.log(`\n[OK] ${rowsUpdated} registros actualizados a 'Presente'.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
