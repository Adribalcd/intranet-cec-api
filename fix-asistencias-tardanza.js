/**
 * fix-asistencias-tardanza.js
 *
 * Corrige registros de asistencia que fueron marcados como 'Tardanza'
 * pero cuya hora local (America/Lima, UTC-5) está dentro de 07:00–08:20.
 *
 * Uso:
 *   node fix-asistencias-tardanza.js          <- diagnóstico: muestra todos los Tardanza y su hora local
 *   node fix-asistencias-tardanza.js --apply  <- aplica la corrección
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const TZ_LOCAL = 'America/Lima'; // UTC-5

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

// Convierte fecha JS a minutos desde medianoche en la zona local
function minutosLocales(fechaUTC) {
  const local = new Date(fechaUTC.toLocaleString('en-US', { timeZone: TZ_LOCAL }));
  return local.getHours() * 60 + local.getMinutes();
}

// Día de semana en zona local (0=Dom … 6=Sáb)
function diaLocal(fechaUTC) {
  const local = new Date(fechaUTC.toLocaleString('en-US', { timeZone: TZ_LOCAL }));
  return local.getDay();
}

const MIN_INICIO = 7 * 60;       // 07:00 → 420 min
const MIN_FIN    = 8 * 60 + 20;  // 08:20 → 500 min
const DIAS_ACTIVOS = [1, 2, 3, 4, 5, 6]; // Lun–Sáb

async function main() {
  await sequelize.authenticate();
  console.log('Conectado a la base de datos.\n');

  // Traer todos los Tardanza
  const [todos] = await sequelize.query(`
    SELECT id, alumno_id, fecha_hora, estado, observaciones
    FROM asistencia
    WHERE estado = 'Tardanza'
    ORDER BY fecha_hora DESC
  `);

  console.log(`Total de registros con estado 'Tardanza': ${todos.length}`);

  if (todos.length === 0) {
    console.log('No hay registros Tardanza en la tabla.');
    process.exit(0);
  }

  // Mostrar muestra con hora local para diagnóstico
  console.log('\nMuestra de registros Tardanza (hora local America/Lima):');
  todos.slice(0, 15).forEach(r => {
    const fecha = new Date(r.fecha_hora);
    const localStr = fecha.toLocaleString('es-PE', { timeZone: TZ_LOCAL });
    const mins = minutosLocales(fecha);
    const dentroVentana = DIAS_ACTIVOS.includes(diaLocal(fecha)) && mins >= MIN_INICIO && mins <= MIN_FIN;
    console.log(`  ID ${String(r.id).padEnd(6)} | ${localStr.padEnd(22)} | ${dentroVentana ? '✓ DEBE SER Presente' : '  fuera de ventana'}`);
  });
  if (todos.length > 15) console.log(`  ... y ${todos.length - 15} más.`);

  // Filtrar los que deben corregirse
  const aCorregir = todos.filter(r => {
    const fecha = new Date(r.fecha_hora);
    const mins = minutosLocales(fecha);
    const dia  = diaLocal(fecha);
    return DIAS_ACTIVOS.includes(dia) && mins >= MIN_INICIO && mins <= MIN_FIN;
  });

  console.log(`\nRegistros que deben cambiar a 'Presente' (07:00–08:20 hora Lima): ${aCorregir.length}`);

  if (aCorregir.length === 0) {
    console.log('Ningún Tardanza cae dentro de la ventana 07:00–08:20. Revisa la muestra de arriba para ver las horas reales.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] Para aplicar los cambios ejecuta:');
    console.log('  node fix-asistencias-tardanza.js --apply\n');
    process.exit(0);
  }

  // Aplicar
  const ids = aCorregir.map(r => r.id);
  await sequelize.query(`
    UPDATE asistencia
    SET estado = 'Presente', observaciones = NULL
    WHERE id IN (:ids)
  `, { replacements: { ids } });

  console.log(`\n[OK] ${ids.length} registros actualizados a 'Presente'.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
