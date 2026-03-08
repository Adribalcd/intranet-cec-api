/**
 * Seeder completo — Intranet CEC Camargo
 * Academia preuniversitaria estilo ADUNI/Cesar Vallejo
 *
 * Ejecutar: node src/seeders/seed.js
 * Limpia y recrea todos los datos de prueba.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Admin, Alumno, Ciclo, Curso, HorarioCurso, Matricula, Examen, Nota, Asistencia, Material } = require('../models');

// ── Utilidades ────────────────────────────────────────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function calcNota(buenas, malas, total) {
  const raw = (buenas * 4 - malas * 1) / (total * 4) * 20;
  return Math.max(0, Math.min(20, parseFloat(raw.toFixed(2))));
}

// ── Datos base ────────────────────────────────────────────────
const NOMBRES = ['Carlos', 'María', 'José', 'Ana', 'Luis', 'Rosa', 'Diego', 'Sofía', 'Andrés', 'Valentina', 'Miguel', 'Camila', 'Sebastián', 'Lucía', 'Fernando', 'Isabella', 'Ricardo', 'Daniela', 'Jorge', 'Gabriela'];
const APELLIDOS = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Cruz', 'Morales', 'Ortiz', 'Gutierrez', 'Chávez', 'Ramos'];

const CURSOS_CONFIG = [
  { nombre: 'Matemática', profesor: 'Dr. Alfredo Quispe Huanca' },
  { nombre: 'Física', profesor: 'Mg. Roberto Sánchez Vega' },
  { nombre: 'Química', profesor: 'Lic. Carmen Flores Ríos' },
  { nombre: 'Biología', profesor: 'Lic. Patricia Mendoza Luna' },
  { nombre: 'Lenguaje', profesor: 'Mg. Eduardo Castro Paredes' },
  { nombre: 'Literatura', profesor: 'Lic. Gloria Vargas Inga' },
  { nombre: 'Historia', profesor: 'Dr. Víctor Morales Salinas' },
  { nombre: 'Geografía', profesor: 'Lic. Silvia Condori Mamani' },
  { nombre: 'Filosofía', profesor: 'Mg. Raúl Huamán Cárdenas' },
  { nombre: 'Economía', profesor: 'Lic. Nancy Peralta Díaz' },
];

const HORARIOS = {
  'Matemática':  [{ dia: 'Lunes',    ini: '07:00', fin: '09:00' }, { dia: 'Miércoles', ini: '07:00', fin: '09:00' }, { dia: 'Viernes', ini: '07:00', fin: '09:00' }],
  'Física':      [{ dia: 'Lunes',    ini: '09:00', fin: '11:00' }, { dia: 'Miércoles', ini: '09:00', fin: '11:00' }],
  'Química':     [{ dia: 'Martes',   ini: '07:00', fin: '09:00' }, { dia: 'Jueves',    ini: '07:00', fin: '09:00' }],
  'Biología':    [{ dia: 'Martes',   ini: '09:00', fin: '11:00' }, { dia: 'Jueves',    ini: '09:00', fin: '11:00' }],
  'Lenguaje':    [{ dia: 'Lunes',    ini: '11:00', fin: '13:00' }, { dia: 'Viernes',   ini: '09:00', fin: '11:00' }],
  'Literatura':  [{ dia: 'Martes',   ini: '11:00', fin: '13:00' }],
  'Historia':    [{ dia: 'Miércoles',ini: '11:00', fin: '13:00' }, { dia: 'Sábado',    ini: '07:00', fin: '09:00' }],
  'Geografía':   [{ dia: 'Jueves',   ini: '11:00', fin: '13:00' }],
  'Filosofía':   [{ dia: 'Viernes',  ini: '11:00', fin: '13:00' }],
  'Economía':    [{ dia: 'Sábado',   ini: '09:00', fin: '11:00' }],
};

const ESTADOS_ASISTENCIA = ['Presente', 'Presente', 'Presente', 'Tardanza', 'Falta'];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conectado a MySQL');

    // Limpiar en orden correcto (FK)
    console.log('🗑  Limpiando tablas...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const M of [Nota, Asistencia, Material, Examen, Matricula, HorarioCurso, Curso, Alumno, Ciclo, Admin]) {
      await M.destroy({ where: {}, truncate: true });
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Tablas limpias');

    // ── 1. Admin ──────────────────────────────────────────────
    const adminHash = await bcrypt.hash('CEC@dm1n#2025!', 10);
    await Admin.create({ usuario: 'admin.cec', contrasena: adminHash });
    console.log('✓ Admin creado  →  usuario: admin.cec  |  contraseña: CEC@dm1n#2025!');

    // ── 2. Ciclos ─────────────────────────────────────────────
    const ciclos = await Ciclo.bulkCreate([
      { nombres: 'Ciclo Intensivo I - 2025',   fecha_inicio: '2025-03-01', fecha_fin: '2025-05-31' },
      { nombres: 'Ciclo Intensivo II - 2025',  fecha_inicio: '2025-06-02', fecha_fin: '2025-08-29' },
      { nombres: 'Ciclo Vacacional - 2026',    fecha_inicio: '2026-01-05', fecha_fin: '2026-02-28' },
    ]);
    console.log(`✓ ${ciclos.length} ciclos creados`);

    const cicloActivo = ciclos[0]; // Ciclo I será el principal

    // ── 3. Cursos + horarios ──────────────────────────────────
    const cursos = [];
    for (const cc of CURSOS_CONFIG) {
      const curso = await Curso.create({ nombre: cc.nombre, profesor: cc.profesor, ciclo_id: cicloActivo.id });
      cursos.push(curso);
      const bloques = HORARIOS[cc.nombre] || [];
      for (const b of bloques) {
        await HorarioCurso.create({ curso_id: curso.id, dia_semana: b.dia, hora_inicio: b.ini, hora_fin: b.fin });
      }
    }
    // También crear cursos para ciclo 2 (subset)
    const cursosC2 = [];
    for (const cc of CURSOS_CONFIG.slice(0, 6)) {
      const c = await Curso.create({ nombre: cc.nombre, profesor: cc.profesor, ciclo_id: ciclos[1].id });
      cursosC2.push(c);
      const bloques = HORARIOS[cc.nombre] || [];
      for (const b of bloques) {
        await HorarioCurso.create({ curso_id: c.id, dia_semana: b.dia, hora_inicio: b.ini, hora_fin: b.fin });
      }
    }
    console.log(`✓ ${cursos.length + cursosC2.length} cursos + horarios creados`);

    // ── 4. Alumnos (20) ───────────────────────────────────────
    const alumnos = [];
    for (let i = 1; i <= 20; i++) {
      const nombres   = NOMBRES[i - 1];
      const apellidos = `${APELLIDOS[rnd(0, 9)]} ${APELLIDOS[rnd(10, 19)]}`;
      const codigo    = `CEC${String(i).padStart(3, '0')}`;
      const dni       = String(40000000 + i * 1337);
      const celular   = `9${rnd(10, 99)}${rnd(100000, 999999)}`;
      const anio      = rnd(2000, 2006);
      const mes       = String(rnd(1, 12)).padStart(2, '0');
      const dia       = String(rnd(1, 28)).padStart(2, '0');
      const fechaNac  = `${anio}-${mes}-${dia}`;
      const email     = `${nombres.toLowerCase()}.${apellidos.split(' ')[0].toLowerCase()}${i}@gmail.com`;
      const passRaw   = `${anio}-${celular}-${dni}`;
      const hash      = await bcrypt.hash(passRaw, 10);

      const alumno = await Alumno.create({
        codigo,
        nombres,
        apellidos,
        email_alumno: email,
        contrasena: hash,
        celular,
        dni,
        fecha_nacimiento: fechaNac,
        foto_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nombres + ' ' + apellidos)}`,
      });
      alumnos.push({ alumno, passRaw });
    }
    console.log(`✓ ${alumnos.length} alumnos creados`);

    // ── 5. Matrículas ─────────────────────────────────────────
    // 20 alumnos → ciclo 1, primeros 8 → también ciclo 2
    for (const { alumno } of alumnos) {
      await Matricula.create({ alumno_id: alumno.id, ciclo_id: cicloActivo.id, fecha_registro: '2025-02-28' });
    }
    for (const { alumno } of alumnos.slice(0, 8)) {
      await Matricula.create({ alumno_id: alumno.id, ciclo_id: ciclos[1].id, fecha_registro: '2025-05-30' });
    }
    console.log('✓ Matrículas creadas');

    // ── 6. Exámenes (8 semanas) ────────────────────────────────
    const tiposExamen = [
      { tipo: 'Simulacro', subtipo: null, preguntas: 100, buena: 4, mala: 1 },
      { tipo: 'Práctica',  subtipo: 'Matemática', preguntas: 25, buena: 4, mala: 1 },
      { tipo: 'Práctica',  subtipo: 'Ciencias',   preguntas: 30, buena: 4, mala: 1 },
      { tipo: 'Práctica',  subtipo: 'Letras',      preguntas: 20, buena: 4, mala: 1 },
    ];

    const examenes = [];
    for (let semana = 1; semana <= 8; semana++) {
      const baseDate = new Date('2025-03-01');
      baseDate.setDate(baseDate.getDate() + (semana - 1) * 7);
      const fecha = baseDate.toISOString().split('T')[0];

      for (const t of tiposExamen) {
        const ex = await Examen.create({
          ciclo_id:               cicloActivo.id,
          semana,
          tipo_examen:            t.tipo,
          subtipo_examen:         t.subtipo,
          fecha,
          cantidad_preguntas:     t.preguntas,
          puntaje_pregunta_buena: t.buena,
          puntaje_pregunta_mala:  t.mala,
        });
        examenes.push(ex);
      }
    }
    console.log(`✓ ${examenes.length} exámenes creados`);

    // ── 7. Notas ──────────────────────────────────────────────
    for (const examen of examenes) {
      const total = examen.cantidad_preguntas;
      const notasExamen = [];

      for (const { alumno } of alumnos) {
        const buenas = rnd(Math.floor(total * 0.3), Math.floor(total * 0.95));
        const malas  = rnd(0, Math.floor((total - buenas) * 0.5));
        const valor  = calcNota(buenas, malas, total);
        notasExamen.push({ examen_id: examen.id, alumno_id: alumno.id, valor, buenas, malas, puesto: 0 });
      }

      // Calcular puestos
      notasExamen.sort((a, b) => b.valor - a.valor);
      notasExamen.forEach((n, idx) => { n.puesto = idx + 1; });
      await Nota.bulkCreate(notasExamen);
    }
    console.log('✓ Notas creadas');

    // ── 8. Asistencia (últimas 4 semanas, lunes-sábado) ───────
    const hoy = new Date('2025-04-15');
    for (let semana = 0; semana < 4; semana++) {
      for (let diaOffset = 0; diaOffset < 6; diaOffset++) { // Lun=0 .. Sáb=5
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - semana * 7 - diaOffset);

        for (const { alumno } of alumnos) {
          const estado = pick(ESTADOS_ASISTENCIA);
          const hora = estado === 'Tardanza'
            ? `${fecha.toISOString().split('T')[0]}T08:${rnd(16, 45)}:00.000Z`
            : estado === 'Presente'
            ? `${fecha.toISOString().split('T')[0]}T07:${rnd(0, 59).toString().padStart(2,'0')}:00.000Z`
            : null;

          await Asistencia.create({
            alumno_id:   alumno.id,
            ciclo_id:    cicloActivo.id,
            fecha_hora:  hora || fecha,
            estado,
            observaciones: estado === 'Falta' ? 'Sin justificación' : estado === 'Tardanza' ? 'Llegó tarde' : null,
          });
        }
      }
    }
    console.log('✓ Asistencias creadas');

    // ── 9. Materiales ─────────────────────────────────────────
    const materialesSeed = [
      { semana: 1, nombre: 'Introducción a la Aritmética', tipo: 'pdf',    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1' },
      { semana: 1, nombre: 'Guía de Álgebra Básica',       tipo: 'pdf',    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF2' },
      { semana: 2, nombre: 'Movimiento Uniforme - Física',  tipo: 'pdf',    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF3' },
      { semana: 2, nombre: 'Tabla Periódica Actualizada',   tipo: 'imagen', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Simple_Periodic_Table_Chart-blocks.svg/1200px-Simple_Periodic_Table_Chart-blocks.svg.png' },
      { semana: 3, nombre: 'Resumen Literatura Peruana',    tipo: 'pdf',    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF4' },
      { semana: 3, nombre: 'Línea de Tiempo Historia Perú', tipo: 'imagen', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Flag_of_Peru.svg/800px-Flag_of_Peru.svg.png' },
      { semana: 4, nombre: 'Geometría Analítica',           tipo: 'pdf',    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF5' },
      { semana: 4, nombre: 'Biología Celular - Apuntes',    tipo: 'pdf',    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF6' },
    ];

    for (const mat of materialesSeed) {
      // Asociar al primer curso de cada área
      const cursoTarget = cursos[0]; // Matemática por default, en producción se puede variar
      await Material.create({
        curso_id:     cursoTarget.id,
        semana:       mat.semana,
        nombre:       mat.nombre,
        url_archivo:  mat.url,
        tipo_archivo: mat.tipo,
        url_drive:    null,
      });
    }
    // Materiales distribuidos en más cursos
    await Material.create({ curso_id: cursos[1].id, semana: 1, nombre: 'Cinemática - Formulario', url_archivo: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF7', tipo_archivo: 'pdf' });
    await Material.create({ curso_id: cursos[2].id, semana: 1, nombre: 'Estequiometría Básica',   url_archivo: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF8', tipo_archivo: 'pdf' });
    await Material.create({ curso_id: cursos[4].id, semana: 2, nombre: 'Comprensión Lectora - Estrategias', url_archivo: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF9', tipo_archivo: 'pdf' });
    console.log('✓ Materiales creados');

    // ── Resumen ────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════');
    console.log('  SEED COMPLETADO — Intranet CEC Camargo');
    console.log('════════════════════════════════════════════════════');
    console.log('\n🔐 CREDENCIALES ADMIN:');
    console.log('   Usuario   : admin.cec');
    console.log('   Contraseña: CEC@dm1n#2025!');
    console.log('\n👨‍🎓 ALUMNOS DE PRUEBA (primeros 5):');
    for (const { alumno, passRaw } of alumnos.slice(0, 5)) {
      console.log(`   ${alumno.codigo}  |  ${alumno.nombres} ${alumno.apellidos}  |  pass: ${passRaw}`);
    }
    console.log('\n📚 CICLOS:');
    for (const c of ciclos) {
      console.log(`   [${c.id}] ${c.nombres}`);
    }
    console.log('\n🎯 DATOS CREADOS:');
    console.log(`   Ciclos: ${ciclos.length} | Cursos: ${cursos.length + cursosC2.length} | Alumnos: ${alumnos.length}`);
    console.log(`   Exámenes: ${examenes.length} | Notas: ${examenes.length * alumnos.length}`);
    console.log(`   Materiales: ${materialesSeed.length + 3} | Asistencias: ${4 * 6 * alumnos.length}`);
    console.log('════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('💥 Error en seed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
