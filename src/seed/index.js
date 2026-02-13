require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Admin, Alumno, Ciclo, Curso, HorarioCurso, Material, Examen, Nota, Asistencia, Matricula } = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Conexión establecida');

    // Desactivar FK checks para poder borrar tablas
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Tablas sincronizadas');

    const hash = await bcrypt.hash('123456', 10);

    // ===================== ADMIN =====================
    const admin = await Admin.create({
      usuario: 'admin',
      contrasena: hash,
    });
    console.log('Admin creado: admin / 123456');

    // ===================== CICLOS =====================
    const ciclo1 = await Ciclo.create({
      nombres: 'Ciclo 2026-I',
      fecha_inicio: new Date('2026-01-15'),
      fecha_fin: new Date('2026-06-30'),
    });

    const ciclo2 = await Ciclo.create({
      nombres: 'Ciclo 2025-II',
      fecha_inicio: new Date('2025-07-01'),
      fecha_fin: new Date('2025-12-15'),
    });
    console.log('2 ciclos creados');

    // ===================== ALUMNOS =====================
    const alumnos = await Alumno.bulkCreate([
      { codigo: '70001234', nombres: 'Carlos', apellidos: 'García López', email_alumno: 'carlos@email.com', contrasena: hash, celular: '987654321' },
      { codigo: '70005678', nombres: 'María', apellidos: 'Torres Díaz', email_alumno: 'maria@email.com', contrasena: hash, celular: '912345678' },
      { codigo: '70009012', nombres: 'José', apellidos: 'Ramírez Soto', email_alumno: 'jose@email.com', contrasena: hash, celular: '956781234' },
      { codigo: '70003456', nombres: 'Ana', apellidos: 'Mendoza Ruiz', email_alumno: 'ana@email.com', contrasena: hash, celular: '943218765' },
      { codigo: '70007890', nombres: 'Luis', apellidos: 'Vargas Peña', email_alumno: 'luis@email.com', contrasena: hash, celular: '978563412' },
    ]);
    console.log('5 alumnos creados (contraseña: 123456)');

    // ===================== CURSOS =====================
    const cursoMat = await Curso.create({ nombre: 'Matemáticas', profesor: 'Prof. Rodríguez', ciclo_id: ciclo1.id });
    const cursoFis = await Curso.create({ nombre: 'Física', profesor: 'Prof. Herrera', ciclo_id: ciclo1.id });
    const cursoQuim = await Curso.create({ nombre: 'Química', profesor: 'Prof. Castro', ciclo_id: ciclo1.id });
    const cursoLen = await Curso.create({ nombre: 'Lenguaje', profesor: 'Prof. Morales', ciclo_id: ciclo1.id });
    const cursoHist = await Curso.create({ nombre: 'Historia', profesor: 'Prof. Gutiérrez', ciclo_id: ciclo2.id });
    console.log('5 cursos creados');

    // ===================== HORARIOS =====================
    await HorarioCurso.bulkCreate([
      { curso_id: cursoMat.id, dia_semana: 'Lunes', hora_inicio: '08:00', hora_fin: '09:30' },
      { curso_id: cursoMat.id, dia_semana: 'Miércoles', hora_inicio: '08:00', hora_fin: '09:30' },
      { curso_id: cursoFis.id, dia_semana: 'Lunes', hora_inicio: '10:00', hora_fin: '11:30' },
      { curso_id: cursoFis.id, dia_semana: 'Jueves', hora_inicio: '10:00', hora_fin: '11:30' },
      { curso_id: cursoQuim.id, dia_semana: 'Martes', hora_inicio: '08:00', hora_fin: '09:30' },
      { curso_id: cursoQuim.id, dia_semana: 'Viernes', hora_inicio: '08:00', hora_fin: '09:30' },
      { curso_id: cursoLen.id, dia_semana: 'Martes', hora_inicio: '10:00', hora_fin: '11:30' },
      { curso_id: cursoLen.id, dia_semana: 'Jueves', hora_inicio: '08:00', hora_fin: '09:30' },
      { curso_id: cursoHist.id, dia_semana: 'Miércoles', hora_inicio: '10:00', hora_fin: '11:30' },
    ]);
    console.log('9 horarios creados');

    // ===================== MATRÍCULAS =====================
    const matriculasData = [];
    for (const alumno of alumnos) {
      matriculasData.push({ alumno_id: alumno.id, ciclo_id: ciclo1.id, fecha_registro: new Date('2026-01-10') });
    }
    // Primeros 3 alumnos también en ciclo anterior
    for (let i = 0; i < 3; i++) {
      matriculasData.push({ alumno_id: alumnos[i].id, ciclo_id: ciclo2.id, fecha_registro: new Date('2025-06-20') });
    }
    await Matricula.bulkCreate(matriculasData);
    console.log(`${matriculasData.length} matrículas creadas`);

    // ===================== MATERIALES =====================
    await Material.bulkCreate([
      { curso_id: cursoMat.id, semana: 1, nombre: 'Introducción al Álgebra', url_archivo: 'https://ejemplo.com/mat-s1.pdf' },
      { curso_id: cursoMat.id, semana: 1, nombre: 'Ejercicios Semana 1', url_archivo: 'https://ejemplo.com/mat-s1-ejercicios.pdf' },
      { curso_id: cursoMat.id, semana: 2, nombre: 'Ecuaciones Lineales', url_archivo: 'https://ejemplo.com/mat-s2.pdf' },
      { curso_id: cursoFis.id, semana: 1, nombre: 'Cinemática - Teoría', url_archivo: 'https://ejemplo.com/fis-s1.pdf' },
      { curso_id: cursoFis.id, semana: 2, nombre: 'MRU y MRUV', url_archivo: 'https://ejemplo.com/fis-s2.pdf' },
      { curso_id: cursoQuim.id, semana: 1, nombre: 'Tabla Periódica', url_archivo: 'https://ejemplo.com/quim-s1.pdf' },
      { curso_id: cursoLen.id, semana: 1, nombre: 'Ortografía General', url_archivo: 'https://ejemplo.com/len-s1.pdf' },
    ]);
    console.log('7 materiales creados');

    // ===================== EXÁMENES =====================
    const examen1 = await Examen.create({ ciclo_id: ciclo1.id, semana: 2, tipo_examen: 'Practica', fecha: '2026-01-27' });
    const examen2 = await Examen.create({ ciclo_id: ciclo1.id, semana: 4, tipo_examen: 'Parcial', fecha: '2026-02-10' });
    const examen3 = await Examen.create({ ciclo_id: ciclo2.id, semana: 8, tipo_examen: 'Final', fecha: '2025-09-15' });
    console.log('3 exámenes creados');

    // ===================== NOTAS =====================
    // Examen 1 - Práctica
    const notasExamen1 = [
      { examen_id: examen1.id, alumno_id: alumnos[0].id, valor: 18.50 },
      { examen_id: examen1.id, alumno_id: alumnos[1].id, valor: 16.00 },
      { examen_id: examen1.id, alumno_id: alumnos[2].id, valor: 19.00 },
      { examen_id: examen1.id, alumno_id: alumnos[3].id, valor: 14.50 },
      { examen_id: examen1.id, alumno_id: alumnos[4].id, valor: 17.00 },
    ];
    // Ordenar y asignar puesto
    notasExamen1.sort((a, b) => b.valor - a.valor);
    notasExamen1.forEach((n, i) => (n.puesto = i + 1));

    // Examen 2 - Parcial
    const notasExamen2 = [
      { examen_id: examen2.id, alumno_id: alumnos[0].id, valor: 15.00 },
      { examen_id: examen2.id, alumno_id: alumnos[1].id, valor: 19.50 },
      { examen_id: examen2.id, alumno_id: alumnos[2].id, valor: 13.00 },
      { examen_id: examen2.id, alumno_id: alumnos[3].id, valor: 17.50 },
      { examen_id: examen2.id, alumno_id: alumnos[4].id, valor: 16.50 },
    ];
    notasExamen2.sort((a, b) => b.valor - a.valor);
    notasExamen2.forEach((n, i) => (n.puesto = i + 1));

    // Examen 3 - Final (solo los 3 primeros alumnos del ciclo anterior)
    const notasExamen3 = [
      { examen_id: examen3.id, alumno_id: alumnos[0].id, valor: 17.00 },
      { examen_id: examen3.id, alumno_id: alumnos[1].id, valor: 18.00 },
      { examen_id: examen3.id, alumno_id: alumnos[2].id, valor: 15.50 },
    ];
    notasExamen3.sort((a, b) => b.valor - a.valor);
    notasExamen3.forEach((n, i) => (n.puesto = i + 1));

    await Nota.bulkCreate([...notasExamen1, ...notasExamen2, ...notasExamen3]);
    console.log('13 notas creadas con orden de mérito');

    // ===================== ASISTENCIA =====================
    const asistenciaData = [];
    const estados = ['Presente', 'Presente', 'Presente', 'Tardanza', 'Presente'];
    const fechas = ['2026-01-20', '2026-01-21', '2026-01-22', '2026-01-27', '2026-01-28'];

    for (const fecha of fechas) {
      for (let i = 0; i < alumnos.length; i++) {
        asistenciaData.push({
          alumno_id: alumnos[i].id,
          ciclo_id: ciclo1.id,
          fecha_hora: new Date(`${fecha}T08:00:00`),
          estado: estados[i],
          observaciones: estados[i] === 'Tardanza' ? 'Llegó 10 minutos tarde' : null,
        });
      }
    }

    // Un día inhabilitado
    for (const alumno of alumnos) {
      asistenciaData.push({
        alumno_id: alumno.id,
        ciclo_id: ciclo1.id,
        fecha_hora: new Date('2026-01-23T00:00:00'),
        estado: 'Inhabilitado',
        observaciones: 'Día inhabilitado por administración',
      });
    }

    await Asistencia.bulkCreate(asistenciaData);
    console.log(`${asistenciaData.length} registros de asistencia creados`);

    // ===================== RESUMEN =====================
    console.log('\n========== SEED COMPLETADO ==========');
    console.log('Admin:    admin / 123456');
    console.log('Alumnos:  (código / contraseña)');
    console.log('  - 70001234 / 123456  (Carlos García)');
    console.log('  - 70005678 / 123456  (María Torres)');
    console.log('  - 70009012 / 123456  (José Ramírez)');
    console.log('  - 70003456 / 123456  (Ana Mendoza)');
    console.log('  - 70007890 / 123456  (Luis Vargas)');
    console.log('======================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error en seed:', error);
    process.exit(1);
  }
}

seed();
