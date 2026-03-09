/**
 * Seeder completo — Intranet CEC Camargo
 * Academia preuniversitaria (estilo ADUNI / Cesar Vallejo)
 *
 * Ejecutar: node src/seeders/seed.js
 * Limpia TODAS las tablas y recrea datos de prueba realistas.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const {
  sequelize,
  Admin, Alumno, Ciclo, Curso, HorarioCurso,
  Matricula, Examen, Nota, Asistencia, Material,
} = require('../models');

// ── Utilidades ────────────────────────────────────────────────
const rnd  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Escala 0–2000: buena = +20 pts, mala = -1.125 pts
function calcNota(buenas, malas) {
  const raw = buenas * 20 - malas * 1.125;
  return Math.max(0, Math.min(2000, parseFloat(raw.toFixed(3))));
}

// ── Datos de alumnos ──────────────────────────────────────────
const NOMBRES = [
  'Carlos', 'María', 'José', 'Ana', 'Luis', 'Rosa', 'Diego', 'Sofía',
  'Andrés', 'Valentina', 'Miguel', 'Camila', 'Sebastián', 'Lucía',
  'Fernando', 'Isabella', 'Ricardo', 'Daniela', 'Jorge', 'Gabriela',
  'Óscar', 'Paola', 'Renato', 'Xiomara', 'Franco',
];
const APELLIDOS = [
  'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez',
  'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez',
  'Díaz', 'Reyes', 'Cruz', 'Morales', 'Ortiz', 'Gutiérrez', 'Chávez', 'Ramos',
  'Quispe', 'Mamani', 'Ccopa', 'Huamán', 'Condori',
];

// ── 18 Cursos preuniversitarios ───────────────────────────────
const CURSOS_18 = [
  // Matemáticas (5)
  {
    nombre: 'Aritmética', profesor: 'Dr. Alfredo Quispe Huanca',
    horarios: [{ dia: 'Lunes', ini: '07:00', fin: '09:00' }, { dia: 'Jueves', ini: '07:00', fin: '09:00' }],
  },
  {
    nombre: 'Álgebra', profesor: 'Mg. Roberto Sánchez Vega',
    horarios: [{ dia: 'Martes', ini: '07:00', fin: '09:00' }, { dia: 'Viernes', ini: '07:00', fin: '09:00' }],
  },
  {
    nombre: 'Geometría', profesor: 'Dr. Alfredo Quispe Huanca',
    horarios: [{ dia: 'Miércoles', ini: '07:00', fin: '09:00' }, { dia: 'Sábado', ini: '07:00', fin: '09:00' }],
  },
  {
    nombre: 'Trigonometría', profesor: 'Mg. Roberto Sánchez Vega',
    horarios: [{ dia: 'Lunes', ini: '09:00', fin: '11:00' }],
  },
  {
    nombre: 'Razonamiento Matemático', profesor: 'Lic. Marco Ruiz Palomino',
    horarios: [{ dia: 'Viernes', ini: '09:00', fin: '11:00' }],
  },
  // Ciencias (3)
  {
    nombre: 'Física', profesor: 'Mg. César Gutiérrez Llanos',
    horarios: [{ dia: 'Martes', ini: '09:00', fin: '11:00' }, { dia: 'Jueves', ini: '09:00', fin: '11:00' }],
  },
  {
    nombre: 'Química', profesor: 'Lic. Carmen Flores Ríos',
    horarios: [{ dia: 'Miércoles', ini: '09:00', fin: '11:00' }, { dia: 'Sábado', ini: '09:00', fin: '11:00' }],
  },
  {
    nombre: 'Biología', profesor: 'Lic. Patricia Mendoza Luna',
    horarios: [{ dia: 'Lunes', ini: '11:00', fin: '13:00' }, { dia: 'Jueves', ini: '11:00', fin: '13:00' }],
  },
  // Letras (3)
  {
    nombre: 'Lenguaje', profesor: 'Mg. Eduardo Castro Paredes',
    horarios: [{ dia: 'Martes', ini: '11:00', fin: '13:00' }, { dia: 'Viernes', ini: '11:00', fin: '13:00' }],
  },
  {
    nombre: 'Literatura', profesor: 'Lic. Gloria Vargas Inga',
    horarios: [{ dia: 'Miércoles', ini: '11:00', fin: '13:00' }],
  },
  {
    nombre: 'Razonamiento Verbal', profesor: 'Mg. Eduardo Castro Paredes',
    horarios: [{ dia: 'Sábado', ini: '11:00', fin: '13:00' }],
  },
  // Historia y Sociales (5)
  {
    nombre: 'Historia del Perú', profesor: 'Dr. Víctor Morales Salinas',
    horarios: [{ dia: 'Lunes', ini: '13:00', fin: '14:30' }, { dia: 'Miércoles', ini: '13:00', fin: '14:30' }],
  },
  {
    nombre: 'Historia Universal', profesor: 'Dr. Víctor Morales Salinas',
    horarios: [{ dia: 'Martes', ini: '13:00', fin: '14:30' }, { dia: 'Jueves', ini: '13:00', fin: '14:30' }],
  },
  {
    nombre: 'Geografía', profesor: 'Lic. Silvia Condori Mamani',
    horarios: [{ dia: 'Viernes', ini: '13:00', fin: '14:30' }],
  },
  {
    nombre: 'Economía', profesor: 'Lic. Nancy Peralta Díaz',
    horarios: [{ dia: 'Sábado', ini: '13:00', fin: '14:30' }],
  },
  {
    nombre: 'Filosofía', profesor: 'Mg. Raúl Huamán Cárdenas',
    horarios: [{ dia: 'Lunes', ini: '14:30', fin: '16:00' }],
  },
  // Otros (2)
  {
    nombre: 'Cívica', profesor: 'Lic. Ana María Salcedo Ruiz',
    horarios: [{ dia: 'Martes', ini: '14:30', fin: '16:00' }],
  },
  {
    nombre: 'Psicología', profesor: 'Mg. Beatriz Ccopa Mamani',
    horarios: [{ dia: 'Miércoles', ini: '14:30', fin: '16:00' }],
  },
];

// Subset de 10 cursos para ciclos intensivos/vacacional
const CURSOS_10_IDX = [0, 1, 2, 5, 6, 7, 8, 9, 11, 12]; // Arit, Álg, Geom, Fís, Quím, Bio, Leng, Lit, HistPE, HistUniv

// Subset de 6 cursos para vacacional
const CURSOS_6_IDX  = [0, 1, 5, 6, 7, 8]; // Arit, Álg, Fís, Quím, Bio, Leng

const ESTADOS_ASISTENCIA = ['Presente', 'Presente', 'Presente', 'Tardanza', 'Falta'];

// ── SEED ─────────────────────────────────────────────────────
async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conectado a MySQL\n');

    // ──────────────────────────────────────────────────────────
    // 0. LIMPIAR TODAS LAS TABLAS (orden correcto para FK)
    // ──────────────────────────────────────────────────────────
    console.log('🗑  Eliminando todos los registros...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    const TABLAS = [
      'nota', 'asistencia', 'material', 'examen',
      'matricula', 'horario_curso', 'curso',
      'alumno', 'ciclo', 'admin',
    ];
    for (const tabla of TABLAS) {
      await sequelize.query(`TRUNCATE TABLE \`${tabla}\``);
      console.log(`   TRUNCATE ${tabla}`);
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    // Ampliar columna valor para escala 0–2000 (DECIMAL 7,3)
    await sequelize.query('ALTER TABLE `nota` MODIFY COLUMN `valor` DECIMAL(7,3)');
    console.log('✓ Todas las tablas vaciadas\n');

    // ──────────────────────────────────────────────────────────
    // 1. ADMIN
    // ──────────────────────────────────────────────────────────
    const ADMIN_USER = 'admin_cecamargo_secure_2026';
    const ADMIN_PASS = 'K8#zP2$mQ9!vL5*nR4^xJ1@bW7&tY3';
    const adminHash = await bcrypt.hash(ADMIN_PASS, 12);
    await Admin.create({ usuario: ADMIN_USER, contrasena: adminHash });
    console.log(`✓ Admin creado  →  usuario: ${ADMIN_USER}  |  contraseña: ${ADMIN_PASS}`);

    // ──────────────────────────────────────────────────────────
    // 2. CICLOS
    // ──────────────────────────────────────────────────────────
    const ciclos = await Ciclo.bulkCreate([
      { nombres: 'Ciclo Anual SM 2025',        fecha_inicio: '2025-03-01', fecha_fin: '2025-11-30' },
      { nombres: 'Ciclo Intensivo I - 2025',   fecha_inicio: '2025-03-03', fecha_fin: '2025-05-30' },
      { nombres: 'Ciclo Intensivo II - 2025',  fecha_inicio: '2025-06-02', fecha_fin: '2025-08-29' },
      { nombres: 'Ciclo Vacacional - 2026',    fecha_inicio: '2026-01-05', fecha_fin: '2026-02-27' },
    ]);
    const [cicloAnual, cicloInt1, cicloInt2, cicloVac] = ciclos;
    console.log(`✓ ${ciclos.length} ciclos creados`);

    // ──────────────────────────────────────────────────────────
    // 3. CURSOS + HORARIOS
    //    Anual SM: 18 cursos | Intensivos: 10 | Vacacional: 6
    // ──────────────────────────────────────────────────────────
    async function crearCursos(ciclo, indices) {
      const lista = indices === null
        ? CURSOS_18                          // todos
        : indices.map(i => CURSOS_18[i]);   // subset

      const creados = [];
      for (const cc of lista) {
        const c = await Curso.create({
          nombre:   cc.nombre,
          profesor: cc.profesor,
          ciclo_id: ciclo.id,
        });
        for (const h of cc.horarios) {
          await HorarioCurso.create({
            curso_id:    c.id,
            dia_semana:  h.dia,
            hora_inicio: h.ini,
            hora_fin:    h.fin,
          });
        }
        creados.push(c);
      }
      return creados;
    }

    const cursosAnual = await crearCursos(cicloAnual, null);           // 18 cursos
    const cursosInt1  = await crearCursos(cicloInt1,  CURSOS_10_IDX);  // 10 cursos
    const cursosInt2  = await crearCursos(cicloInt2,  CURSOS_10_IDX);  // 10 cursos
    const cursosVac   = await crearCursos(cicloVac,   CURSOS_6_IDX);   //  6 cursos
    const totalCursos = cursosAnual.length + cursosInt1.length + cursosInt2.length + cursosVac.length;
    console.log(`✓ ${totalCursos} cursos + horarios creados (Anual: 18 | Int I: 10 | Int II: 10 | Vac: 6)`);

    // ──────────────────────────────────────────────────────────
    // 4. ALUMNOS (25)
    // ──────────────────────────────────────────────────────────
    const alumnos = [];
    for (let i = 1; i <= 25; i++) {
      const nombres   = NOMBRES[i - 1];
      const apellidos = `${APELLIDOS[rnd(0, 12)]} ${APELLIDOS[rnd(13, 24)]}`;
      const dni       = String(40000000 + i * 1337);
      const codigo    = dni;
      const celular   = `9${rnd(10, 99)}${rnd(100000, 999999)}`;
      const anio      = 2000 + ((i - 1) % 7); // determinístico: 2000-2006 ciclando
      const mes       = String(rnd(1, 12)).padStart(2, '0');
      const dia       = String(rnd(1, 28)).padStart(2, '0');
      const email     = `${nombres.toLowerCase().replace(/[áéíóú]/g, c => ({ á:'a',é:'e',í:'i',ó:'o',ú:'u' })[c] || c)}.${apellidos.split(' ')[0].toLowerCase().replace(/[áéíóú]/g, c => ({ á:'a',é:'e',í:'i',ó:'o',ú:'u' })[c] || c)}${i}@gmail.com`;
      const passRaw   = `Cec${anio}*${dni.slice(-4)}`;
      const hash      = await bcrypt.hash(passRaw, 10);

      const alumno = await Alumno.create({
        codigo,
        nombres,
        apellidos,
        email_alumno:    email,
        contrasena:      hash,
        celular,
        dni,
        fecha_nacimiento: `${anio}-${mes}-${dia}`,
        foto_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nombres + ' ' + apellidos)}`,
      });
      alumnos.push({ alumno, passRaw });
    }
    console.log(`✓ ${alumnos.length} alumnos creados`);

    // ──────────────────────────────────────────────────────────
    // 5. MATRÍCULAS
    //    Todos (25) → Anual SM
    //    Primeros 15 → Intensivo I
    //    Alumnos 8-20 → Intensivo II
    //    Últimos 6 → Vacacional
    // ──────────────────────────────────────────────────────────
    for (const { alumno } of alumnos) {
      await Matricula.create({ alumno_id: alumno.id, ciclo_id: cicloAnual.id, fecha_registro: '2025-02-28' });
    }
    for (const { alumno } of alumnos.slice(0, 15)) {
      await Matricula.create({ alumno_id: alumno.id, ciclo_id: cicloInt1.id, fecha_registro: '2025-03-01' });
    }
    for (const { alumno } of alumnos.slice(7, 20)) {
      await Matricula.create({ alumno_id: alumno.id, ciclo_id: cicloInt2.id, fecha_registro: '2025-05-30' });
    }
    for (const { alumno } of alumnos.slice(19, 25)) {
      await Matricula.create({ alumno_id: alumno.id, ciclo_id: cicloVac.id, fecha_registro: '2025-12-10' });
    }
    console.log('✓ Matrículas creadas');

    // ──────────────────────────────────────────────────────────
    // 6. EXÁMENES — Anual SM: 12 semanas × 4 tipos
    //              Intensivo I: 8 semanas × 4 tipos
    // ──────────────────────────────────────────────────────────
    const tiposExamen = [
      { tipo: 'Simulacro', subtipo: null,          preguntas: 100, buena: 20, mala: 1.125 },
      { tipo: 'Práctica',  subtipo: 'Matemática',  preguntas: 25,  buena: 20, mala: 1.125 },
      { tipo: 'Práctica',  subtipo: 'Ciencias',    preguntas: 30,  buena: 20, mala: 1.125 },
      { tipo: 'Práctica',  subtipo: 'Letras',      preguntas: 20,  buena: 20, mala: 1.125 },
    ];

    async function crearExamenes(ciclo, nSemanas, baseDate) {
      const lista = [];
      for (let s = 1; s <= nSemanas; s++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (s - 1) * 7);
        const fecha = d.toISOString().split('T')[0];
        for (const t of tiposExamen) {
          const ex = await Examen.create({
            ciclo_id:               ciclo.id,
            semana:                 s,
            tipo_examen:            t.tipo,
            subtipo_examen:         t.subtipo,
            fecha,
            cantidad_preguntas:     t.preguntas,
            puntaje_pregunta_buena: t.buena,
            puntaje_pregunta_mala:  t.mala,
          });
          lista.push(ex);
        }
      }
      return lista;
    }

    const examenesAnual = await crearExamenes(cicloAnual, 12, '2025-03-08');
    const examenesInt1  = await crearExamenes(cicloInt1,   8, '2025-03-08');
    const totalExamenes = examenesAnual.length + examenesInt1.length;
    console.log(`✓ ${totalExamenes} exámenes creados (Anual: ${examenesAnual.length} | Int I: ${examenesInt1.length})`);

    // ──────────────────────────────────────────────────────────
    // 7. NOTAS
    // ──────────────────────────────────────────────────────────
    async function crearNotas(examenes, alumnosList) {
      let total = 0;
      for (const examen of examenes) {
        const q = examen.cantidad_preguntas;
        const filas = [];
        for (const { alumno } of alumnosList) {
          const buenas = rnd(Math.floor(q * 0.3), Math.floor(q * 0.95));
          const malas  = rnd(0, Math.floor((q - buenas) * 0.5));
          const valor  = calcNota(buenas, malas);
          filas.push({ examen_id: examen.id, alumno_id: alumno.id, valor, buenas, malas, puesto: 0 });
        }
        filas.sort((a, b) => b.valor - a.valor);
        filas.forEach((n, idx) => { n.puesto = idx + 1; });
        await Nota.bulkCreate(filas);
        total += filas.length;
      }
      return total;
    }

    const notasAnual = await crearNotas(examenesAnual, alumnos);                      // 25 alumnos
    const notasInt1  = await crearNotas(examenesInt1,  alumnos.slice(0, 15));         // 15 alumnos
    console.log(`✓ ${notasAnual + notasInt1} notas creadas`);

    // ──────────────────────────────────────────────────────────
    // 8. ASISTENCIA — últimas 6 semanas, Lunes-Sábado
    //    Para el ciclo Anual SM con los 25 alumnos
    // ──────────────────────────────────────────────────────────
    const hoy = new Date('2025-06-20');
    let totalAsistencias = 0;
    for (let semana = 0; semana < 6; semana++) {
      for (let diaOff = 0; diaOff < 6; diaOff++) {  // 0=Lun … 5=Sáb
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - semana * 7 - diaOff);
        const fechaStr = fecha.toISOString().split('T')[0];

        for (const { alumno } of alumnos) {
          const estado = pick(ESTADOS_ASISTENCIA);
          const hora = estado === 'Presente'
            ? `${fechaStr}T07:${String(rnd(0, 14)).padStart(2, '0')}:00.000Z`
            : estado === 'Tardanza'
            ? `${fechaStr}T08:${String(rnd(16, 55)).padStart(2, '0')}:00.000Z`
            : null;

          await Asistencia.create({
            alumno_id:    alumno.id,
            ciclo_id:     cicloAnual.id,
            fecha_hora:   hora || `${fechaStr}T07:00:00.000Z`,
            estado,
            observaciones: estado === 'Falta'    ? 'Sin justificación'
                          : estado === 'Tardanza' ? 'Llegó tarde'
                          : null,
          });
          totalAsistencias++;
        }
      }
    }
    console.log(`✓ ${totalAsistencias} asistencias creadas`);

    // ──────────────────────────────────────────────────────────
    // 9. MATERIALES — distribuidos en varios cursos del Anual SM
    // ──────────────────────────────────────────────────────────
    const matSeed = [
      { cursoIdx: 0,  semana: 1, nombre: 'Introducción a la Aritmética',          tipo: 'pdf' },
      { cursoIdx: 0,  semana: 2, nombre: 'Números Enteros y Operaciones',          tipo: 'pdf' },
      { cursoIdx: 1,  semana: 1, nombre: 'Álgebra Básica — Expresiones',           tipo: 'pdf' },
      { cursoIdx: 1,  semana: 3, nombre: 'Factorización y Productos Notables',     tipo: 'pdf' },
      { cursoIdx: 2,  semana: 1, nombre: 'Geometría Plana — Figuras Básicas',      tipo: 'pdf' },
      { cursoIdx: 3,  semana: 2, nombre: 'Razones Trigonométricas',                tipo: 'pdf' },
      { cursoIdx: 4,  semana: 1, nombre: 'Técnicas de Razonamiento Matemático',    tipo: 'pdf' },
      { cursoIdx: 5,  semana: 1, nombre: 'Cinemática — Formulario y Ejercicios',   tipo: 'pdf' },
      { cursoIdx: 5,  semana: 2, nombre: 'Dinámica de Newton',                     tipo: 'pdf' },
      { cursoIdx: 6,  semana: 1, nombre: 'Tabla Periódica y Configuración',        tipo: 'pdf' },
      { cursoIdx: 6,  semana: 2, nombre: 'Estequiometría Básica',                  tipo: 'pdf' },
      { cursoIdx: 7,  semana: 1, nombre: 'Biología Celular — Apuntes',             tipo: 'pdf' },
      { cursoIdx: 8,  semana: 1, nombre: 'Comprensión Lectora — Estrategias',      tipo: 'pdf' },
      { cursoIdx: 8,  semana: 2, nombre: 'Tipos de Texto y Conectores',            tipo: 'pdf' },
      { cursoIdx: 9,  semana: 1, nombre: 'Literatura Peruana — Resumen',           tipo: 'pdf' },
      { cursoIdx: 10, semana: 1, nombre: 'Sinonimia y Antonimia',                  tipo: 'pdf' },
      { cursoIdx: 11, semana: 1, nombre: 'Historia del Perú Prehispánico',         tipo: 'pdf' },
      { cursoIdx: 12, semana: 1, nombre: 'Edad Antigua — Mesopotamia y Egipto',    tipo: 'pdf' },
      { cursoIdx: 13, semana: 1, nombre: 'Geografía del Perú — Regiones',          tipo: 'pdf' },
      { cursoIdx: 14, semana: 1, nombre: 'Macroeconomía Básica',                   tipo: 'pdf' },
      { cursoIdx: 15, semana: 1, nombre: 'Introducción a la Filosofía',            tipo: 'pdf' },
      { cursoIdx: 16, semana: 1, nombre: 'Ciudadanía y Derechos Constitucionales', tipo: 'pdf' },
      { cursoIdx: 17, semana: 1, nombre: 'Psicología General — Introducción',      tipo: 'pdf' },
    ];

    for (const mat of matSeed) {
      await Material.create({
        curso_id:     cursosAnual[mat.cursoIdx].id,
        semana:       mat.semana,
        nombre:       mat.nombre,
        url_archivo:  null,
        tipo_archivo: mat.tipo,
        url_drive:    null,
      });
    }
    console.log(`✓ ${matSeed.length} materiales creados`);

    // ──────────────────────────────────────────────────────────
    // RESUMEN
    // ──────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  SEED COMPLETADO — Intranet CEC Camargo');
    console.log('════════════════════════════════════════════════════════');
    console.log('\n🔐 CREDENCIALES ADMIN:');
    console.log(`   Usuario   : ${ADMIN_USER}`);
    console.log(`   Contraseña: ${ADMIN_PASS}`);
    console.log('\n👨‍🎓 ALUMNOS (código = DNI):');
    for (const { alumno, passRaw } of alumnos) {
      console.log(`   ${alumno.codigo}  |  ${alumno.nombres} ${alumno.apellidos}  |  pass: ${passRaw}`);
    }
    console.log('\n📚 CICLOS:');
    for (const c of ciclos) {
      console.log(`   [${c.id}] ${c.nombres}`);
    }
    console.log('\n📖 CURSOS POR CICLO:');
    console.log(`   Ciclo Anual SM 2025       : ${cursosAnual.length} cursos`);
    console.log(`   Ciclo Intensivo I - 2025  : ${cursosInt1.length} cursos`);
    console.log(`   Ciclo Intensivo II - 2025 : ${cursosInt2.length} cursos`);
    console.log(`   Ciclo Vacacional - 2026   : ${cursosVac.length} cursos`);
    console.log('\n🎯 RESUMEN TOTAL:');
    console.log(`   Alumnos     : ${alumnos.length}`);
    console.log(`   Exámenes    : ${totalExamenes}`);
    console.log(`   Notas       : ${notasAnual + notasInt1}`);
    console.log(`   Asistencias : ${totalAsistencias}`);
    console.log(`   Materiales  : ${matSeed.length}`);
    console.log('════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('\n💥 Error en seed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
