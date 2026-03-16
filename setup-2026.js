/**
 * setup-2026.js — Datos iniciales para el ciclo académico 2026
 *
 * Ejecutar: node setup-2026.js
 *
 * NO destruye datos existentes. Solo inserta:
 *  1. 3 ciclos 2026 (Anual SM, Semestral SM, UNI)
 *  2. Conceptos de pago por ciclo
 *  3. Config de pagos por ciclo
 *  4. 3 usuarios admin con distintos roles
 */

'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Admin, Ciclo, Curso, HorarioCurso, ConceptoPago, ConfigPagosCiclo } = require('./src/models');

// ── Cursos ───────────────────────────────────────────────────────────────────
const CURSOS_18 = [
  { nombre: 'Aritmética',           profesor: 'Dr. Alfredo Quispe Huanca',   horarios: [{ dia: 'Lunes', ini: '07:00', fin: '09:00' }, { dia: 'Jueves', ini: '07:00', fin: '09:00' }] },
  { nombre: 'Álgebra',              profesor: 'Mg. Roberto Sánchez Vega',    horarios: [{ dia: 'Martes', ini: '07:00', fin: '09:00' }, { dia: 'Viernes', ini: '07:00', fin: '09:00' }] },
  { nombre: 'Geometría',            profesor: 'Dr. Alfredo Quispe Huanca',   horarios: [{ dia: 'Miércoles', ini: '07:00', fin: '09:00' }, { dia: 'Sábado', ini: '07:00', fin: '09:00' }] },
  { nombre: 'Trigonometría',        profesor: 'Mg. Roberto Sánchez Vega',    horarios: [{ dia: 'Lunes', ini: '09:00', fin: '11:00' }] },
  { nombre: 'Razonamiento Matemático', profesor: 'Lic. Marco Ruiz Palomino', horarios: [{ dia: 'Viernes', ini: '09:00', fin: '11:00' }] },
  { nombre: 'Física',               profesor: 'Mg. César Gutiérrez Llanos',  horarios: [{ dia: 'Martes', ini: '09:00', fin: '11:00' }, { dia: 'Jueves', ini: '09:00', fin: '11:00' }] },
  { nombre: 'Química',              profesor: 'Lic. Carmen Flores Ríos',     horarios: [{ dia: 'Miércoles', ini: '09:00', fin: '11:00' }, { dia: 'Sábado', ini: '09:00', fin: '11:00' }] },
  { nombre: 'Biología',             profesor: 'Lic. Patricia Mendoza Luna',  horarios: [{ dia: 'Lunes', ini: '11:00', fin: '13:00' }, { dia: 'Jueves', ini: '11:00', fin: '13:00' }] },
  { nombre: 'Lenguaje',             profesor: 'Mg. Eduardo Castro Paredes',  horarios: [{ dia: 'Martes', ini: '11:00', fin: '13:00' }, { dia: 'Viernes', ini: '11:00', fin: '13:00' }] },
  { nombre: 'Literatura',           profesor: 'Lic. Gloria Vargas Inga',     horarios: [{ dia: 'Miércoles', ini: '11:00', fin: '13:00' }] },
  { nombre: 'Razonamiento Verbal',  profesor: 'Mg. Eduardo Castro Paredes',  horarios: [{ dia: 'Sábado', ini: '11:00', fin: '13:00' }] },
  { nombre: 'Historia del Perú',    profesor: 'Dr. Víctor Morales Salinas',  horarios: [{ dia: 'Lunes', ini: '13:00', fin: '14:30' }, { dia: 'Miércoles', ini: '13:00', fin: '14:30' }] },
  { nombre: 'Historia Universal',   profesor: 'Dr. Víctor Morales Salinas',  horarios: [{ dia: 'Martes', ini: '13:00', fin: '14:30' }, { dia: 'Jueves', ini: '13:00', fin: '14:30' }] },
  { nombre: 'Geografía',            profesor: 'Lic. Silvia Condori Mamani',  horarios: [{ dia: 'Viernes', ini: '13:00', fin: '14:30' }] },
  { nombre: 'Economía',             profesor: 'Lic. Nancy Peralta Díaz',     horarios: [{ dia: 'Sábado', ini: '13:00', fin: '14:30' }] },
  { nombre: 'Filosofía',            profesor: 'Mg. Raúl Huamán Cárdenas',   horarios: [{ dia: 'Lunes', ini: '14:30', fin: '16:00' }] },
  { nombre: 'Cívica',               profesor: 'Lic. Ana María Salcedo Ruiz', horarios: [{ dia: 'Martes', ini: '14:30', fin: '16:00' }] },
  { nombre: 'Psicología',           profesor: 'Mg. Beatriz Ccopa Mamani',    horarios: [{ dia: 'Miércoles', ini: '14:30', fin: '16:00' }] },
];

// UNI enfocado en ciencias/matemáticas (12 cursos)
const CURSOS_UNI_IDX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 14, 16];

async function crearCursos(ciclo, indices) {
  const lista = indices === null ? CURSOS_18 : indices.map(i => CURSOS_18[i]);
  for (const cc of lista) {
    const c = await Curso.create({ nombre: cc.nombre, profesor: cc.profesor, ciclo_id: ciclo.id });
    for (const h of cc.horarios) {
      await HorarioCurso.create({ curso_id: c.id, dia_semana: h.dia, hora_inicio: h.ini, hora_fin: h.fin });
    }
  }
  return lista.length;
}

async function setup() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conectado a la BD\n');

    // ──────────────────────────────────────────────────────────────────────────
    // 1. CICLOS 2026
    // ──────────────────────────────────────────────────────────────────────────
    console.log('📅 Creando ciclos 2026...');
    const cicloAnualSM = await Ciclo.create({
      nombres:      'Ciclo Anual SM 2026',
      fecha_inicio: '2026-03-16',
      fecha_fin:    '2026-11-30',
    });
    const cicloSemestralSM = await Ciclo.create({
      nombres:      'Ciclo Semestral San Marcos 2026',
      fecha_inicio: '2026-03-16',
      fecha_fin:    '2026-11-30',
    });
    const cicloUNI = await Ciclo.create({
      nombres:      'Ciclo UNI 2026',
      fecha_inicio: '2026-03-16',
      fecha_fin:    '2026-08-31',
    });
    console.log(`  ✓ [${cicloAnualSM.id}] ${cicloAnualSM.nombres}`);
    console.log(`  ✓ [${cicloSemestralSM.id}] ${cicloSemestralSM.nombres}`);
    console.log(`  ✓ [${cicloUNI.id}] ${cicloUNI.nombres}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. CURSOS POR CICLO
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📚 Creando cursos...');
    const nAnualSM      = await crearCursos(cicloAnualSM, null);        // 18 cursos
    const nSemestralSM  = await crearCursos(cicloSemestralSM, null);    // 18 cursos
    const nUNI          = await crearCursos(cicloUNI, CURSOS_UNI_IDX);  // 12 cursos
    console.log(`  ✓ Anual SM: ${nAnualSM} | Semestral SM: ${nSemestralSM} | UNI: ${nUNI} cursos`);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. CONCEPTOS DE PAGO
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n💰 Creando conceptos de pago...');

    // ── Anual SM 2026: matrícula + 9 mensualidades (Mar-Nov) ─────────────────
    await ConceptoPago.create({
      ciclo_id: cicloAnualSM.id, tipo: 'matricula', descripcion: 'Matrícula Anual SM 2026',
      monto_opcion_1: 50, etiqueta_opcion_1: 'Tarifa regular',
      monto_opcion_2: 40, etiqueta_opcion_2: 'Tarifa especial',
      fecha_vencimiento: '2026-03-25', orden: 0,
    });
    for (let i = 0; i < 9; i++) {
      const mes = 3 + i; // Mar(3) a Nov(11)
      const mesVence = mes + 1 > 12 ? 1 : mes + 1;
      const anioVence = mes + 1 > 12 ? 2027 : 2026;
      const mesNombre = new Date(2026, mes - 1, 1).toLocaleString('es-PE', { month: 'long' });
      await ConceptoPago.create({
        ciclo_id: cicloAnualSM.id, tipo: 'mensualidad',
        descripcion: `Pensión ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} 2026`,
        mes, anio: 2026,
        monto_opcion_1: 350, etiqueta_opcion_1: 'Tarifa regular',
        monto_opcion_2: 300, etiqueta_opcion_2: 'Tarifa especial',
        fecha_vencimiento: `${anioVence}-${String(mesVence).padStart(2, '0')}-05`,
        orden: i + 1,
      });
    }
    console.log(`  ✓ Anual SM 2026: matrícula + 9 mensualidades`);

    // ── Semestral San Marcos 2026: matrícula + 9 cuotas (Mar-Nov) ─────────────
    await ConceptoPago.create({
      ciclo_id: cicloSemestralSM.id, tipo: 'matricula', descripcion: 'Matrícula Semestral SM 2026',
      monto_opcion_1: 50, etiqueta_opcion_1: 'Tarifa regular',
      fecha_vencimiento: '2026-03-25', orden: 0,
    });
    for (let i = 0; i < 9; i++) {
      const mes = 3 + i;
      const mesVence = mes + 1 > 12 ? 1 : mes + 1;
      const anioVence = mes + 1 > 12 ? 2027 : 2026;
      const mesNombre = new Date(2026, mes - 1, 1).toLocaleString('es-PE', { month: 'long' });
      await ConceptoPago.create({
        ciclo_id: cicloSemestralSM.id, tipo: 'mensualidad',
        descripcion: `Cuota ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} SM 2026`,
        mes, anio: 2026,
        monto_opcion_1: 330, etiqueta_opcion_1: 'Tarifa regular',
        monto_opcion_2: 290, etiqueta_opcion_2: 'Tarifa especial',
        fecha_vencimiento: `${anioVence}-${String(mesVence).padStart(2, '0')}-05`,
        orden: i + 1,
      });
    }
    console.log(`  ✓ Semestral San Marcos 2026: matrícula + 9 cuotas`);

    // ── Ciclo UNI 2026: matrícula + 6 cuotas (Mar-Ago) ────────────────────────
    await ConceptoPago.create({
      ciclo_id: cicloUNI.id, tipo: 'matricula', descripcion: 'Matrícula Ciclo UNI 2026',
      monto_opcion_1: 50, etiqueta_opcion_1: 'Tarifa regular',
      fecha_vencimiento: '2026-03-25', orden: 0,
    });
    for (let i = 0; i < 6; i++) {
      const mes = 3 + i; // Mar(3) a Ago(8)
      const mesVence = mes + 1;
      const mesNombre = new Date(2026, mes - 1, 1).toLocaleString('es-PE', { month: 'long' });
      await ConceptoPago.create({
        ciclo_id: cicloUNI.id, tipo: 'mensualidad',
        descripcion: `Cuota ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} UNI 2026`,
        mes, anio: 2026,
        monto_opcion_1: 370, etiqueta_opcion_1: 'Tarifa regular',
        monto_opcion_2: 320, etiqueta_opcion_2: 'Tarifa especial',
        fecha_vencimiento: `2026-${String(mesVence).padStart(2, '0')}-05`,
        orden: i + 1,
      });
    }
    console.log(`  ✓ Ciclo UNI 2026: matrícula + 6 cuotas`);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. CONFIG DE PAGOS POR CICLO
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n⚙️  Creando config de pagos...');
    const configBase = {
      pagos_visible:         true,
      permite_transferencia: false,
      permite_yape_plin:     false,
      yape_numero:           null,
      plin_numero:           null,
      whatsapp_numero:       '51924513040',
    };
    await ConfigPagosCiclo.create({ ...configBase, ciclo_id: cicloAnualSM.id });
    await ConfigPagosCiclo.create({ ...configBase, ciclo_id: cicloSemestralSM.id });
    await ConfigPagosCiclo.create({ ...configBase, ciclo_id: cicloUNI.id });
    console.log('  ✓ Config creada para los 3 ciclos (solo WhatsApp, sin pago online)');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. USUARIOS ADMIN
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n👤 Creando usuarios admin...');

    const USUARIOS = [
      { usuario: 'admin',     contrasena: 'cec@Adm!n#7x2026',   nombre: 'Administrador General', rol: 'general'   },
      { usuario: 'academico', contrasena: 'cec@Ac4d!3m#2026',   nombre: 'Coordinador Académico', rol: 'academico' },
      { usuario: 'pagos',     contrasena: 'cec@P4g0s#x!2026',   nombre: 'Responsable de Pagos',  rol: 'pagos'     },
    ];

    const resultados = [];
    for (const u of USUARIOS) {
      // Omitir si ya existe
      const existe = await Admin.findOne({ where: { usuario: u.usuario } });
      if (existe) {
        console.log(`  · ${u.usuario} ya existe — omitido`);
        resultados.push({ ...u, omitido: true });
        continue;
      }
      const hash = await bcrypt.hash(u.contrasena, 12);
      await Admin.create({ usuario: u.usuario, contrasena: hash, nombre: u.nombre, rol: u.rol });
      console.log(`  ✓ ${u.usuario} (${u.rol})`);
      resultados.push({ ...u, omitido: false });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RESUMEN
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  SETUP 2026 COMPLETADO — Intranet CEC Camargo');
    console.log('════════════════════════════════════════════════════════');
    console.log('\n📅 CICLOS CREADOS:');
    console.log(`   [${cicloAnualSM.id}]     ${cicloAnualSM.nombres}         (18 cursos, 9 mensualidades)`);
    console.log(`   [${cicloSemestralSM.id}]     ${cicloSemestralSM.nombres}  (18 cursos, 9 cuotas)`);
    console.log(`   [${cicloUNI.id}]     ${cicloUNI.nombres}              (12 cursos, 6 cuotas)`);
    console.log('\n👤 USUARIOS ADMIN:');
    for (const u of resultados) {
      if (!u.omitido) {
        console.log(`   ${u.rol.padEnd(10)}  usuario: ${u.usuario.padEnd(15)}  contraseña: ${u.contrasena}`);
      }
    }
    console.log('\n📝 NOTAS:');
    console.log('   - Config de pagos: WhatsApp activo, pago online desactivado por defecto.');
    console.log('   - Para activar pagos online: ir a Admin > Pagos > Configuración del ciclo.');
    console.log('   - Cambia las contraseñas en producción.');
    console.log('════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error en setup:', err.message);
    console.error(err);
    process.exit(1);
  }
}

setup();
