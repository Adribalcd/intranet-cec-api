const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');
const { Admin, Ciclo, Curso, HorarioCurso, Matricula, Alumno, Asistencia, Examen, Nota, Material } = require('../models');
const { generarToken } = require('../utils/tokenUtils');
const { sendCredentials } = require('../utils/emailService');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');

// URL base del backend (para construir URLs de fotos accesibles desde el frontend)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function buildFotoUrl(fotoUrl) {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith('http')) return fotoUrl;
  return `${BASE_URL}${fotoUrl}`;
}

// Configuración de multer para fotos
const storageFotos = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'fotos'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.codigo}${ext}`);
  },
});
const uploadFoto = multer({
  storage: storageFotos,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Multer para Excel
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ext === '.xlsx');
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ===================== AUTENTICACIÓN =====================

exports.login = async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;
    const admin = await Admin.findOne({ where: { usuario } });
    if (!admin) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const valid = await bcrypt.compare(contrasena, admin.contrasena);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = generarToken({ id: admin.id, rol: 'admin' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== CICLOS (CRUD) =====================

exports.getCiclos = async (req, res) => {
  try {
    const ciclos = await Ciclo.findAll();
    const resultado = ciclos.map((c) => {
      const inicio = new Date(c.fecha_inicio);
      const fin = new Date(c.fecha_fin);
      const diffMs = fin - inicio;
      const duracionMeses = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
      return { ...c.toJSON(), duracion_meses: duracionMeses };
    });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCiclo = async (req, res) => {
  try {
    const { nombre, fechaInicio, duracion, fechaFin } = req.body;
    let fin = fechaFin;
    if (!fin && fechaInicio && duracion) {
      const inicio = new Date(fechaInicio);
      inicio.setMonth(inicio.getMonth() + duracion);
      fin = inicio;
    }
    const ciclo = await Ciclo.create({
      nombres: nombre,
      fecha_inicio: fechaInicio,
      fecha_fin: fin,
    });
    res.status(201).json(ciclo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCiclo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, fechaInicio, duracion, fechaFin } = req.body;
    const ciclo = await Ciclo.findByPk(id);
    if (!ciclo) return res.status(404).json({ error: 'Ciclo no encontrado' });

    let fin = fechaFin;
    if (!fin && fechaInicio && duracion) {
      const inicio = new Date(fechaInicio);
      inicio.setMonth(inicio.getMonth() + duracion);
      fin = inicio;
    }

    await ciclo.update({
      nombres: nombre || ciclo.nombres,
      fecha_inicio: fechaInicio || ciclo.fecha_inicio,
      fecha_fin: fin || ciclo.fecha_fin,
    });
    res.json(ciclo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCiclo = async (req, res) => {
  try {
    const { id } = req.params;
    const ciclo = await Ciclo.findByPk(id);
    if (!ciclo) return res.status(404).json({ error: 'Ciclo no encontrado' });
    await ciclo.destroy();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== CURSOS (CRUD) =====================

exports.getCursos = async (req, res) => {
  try {
    const cursos = await Curso.findAll({ include: [Ciclo] });
    res.json(cursos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCurso = async (req, res) => {
  try {
    const { nombre, profesor, cicloId } = req.body;
    const curso = await Curso.create({
      nombre,
      profesor,
      ciclo_id: cicloId,
    });
    res.status(201).json(curso);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCurso = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, profesor, cicloId } = req.body;
    const curso = await Curso.findByPk(id);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    await curso.update({
      nombre: nombre || curso.nombre,
      profesor: profesor || curso.profesor,
      ciclo_id: cicloId || curso.ciclo_id,
    });
    res.json(curso);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCurso = async (req, res) => {
  try {
    const { id } = req.params;
    const curso = await Curso.findByPk(id);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });
    await curso.destroy();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== REGISTRO DE ALUMNO =====================

export const registrarAlumno = async (req, res) => {
  try {
    // 1. Recibimos los datos básicos, incluyendo DNI y Fecha de Nacimiento
    const { codigo, nombres, apellidos, email, celular, dni, fechaNacimiento } = req.body;

    // 2. GENERACIÓN DE LA CONTRASEÑA EN EL BACKEND
    // Formato: Año(YYYY) - Celular - DNI
    if (!fechaNacimiento || !celular || !dni) {
      return res.status(400).json({ 
        error: 'Faltan datos para generar la clave (Fecha de nacimiento, celular o DNI)' 
      });
    }

    const anio = fechaNacimiento.split('-')[0]; // Extrae '1995' de '1995-05-20'
    const contrasenaPlana = `${anio}-${celular}-${dni}`;

    // 3. Hash para seguridad en la Base de Datos
    const saltRounds = 10;
    const hash = await bcrypt.hash(contrasenaPlana, saltRounds);

    // 4. Crear registro en la DB
    const nuevoAlumno = await Alumno.create({
      codigo,
      nombres,
      apellidos,
      email_alumno: email,
      contrasena: hash, // Guardamos el hash
      celular: celular || null,
      dni: dni,
      fecha_nacimiento: fechaNacimiento
    });

    // 5. Configurar envío de correo con la contraseña PLANA (antes del hash)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
      }
    });

    await transporter.sendMail({
      from: '"Academia CEC - Intranet" <soporte@cec.com>',
      to: email,
      subject: '🔑 Tus accesos a la Intranet Académica',
      html: `
        <div style="font-family: Arial; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #0a9396;">Bienvenido(a) ${nombres}</h2>
          <p>Se ha generado tu cuenta exitosamente. Utiliza las siguientes credenciales:</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px;">
            <p><strong>Usuario:</strong> ${codigo}</p>
            <p><strong>Contraseña:</strong> ${contrasenaPlana}</p>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 15px;">
            Nota: Tu contraseña fue generada automáticamente siguiendo el formato: Año-Celular-DNI.
          </p>
        </div>
      `
    });

    return res.status(201).json({ 
      mensaje: 'Alumno registrado y correo enviado',
      alumno: nuevoAlumno 
    });

  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===================== MATRÍCULA =====================

exports.matriculaManual = async (req, res) => {
  try {
    const { codigoAlumno, cicloId } = req.body;

    const alumno = await Alumno.findOne({ where: { codigo: codigoAlumno } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    // Verificar si ya tiene matrícula en un ciclo vigente
    const hoy = new Date();
    const matriculaActiva = await Matricula.findOne({
      where: { alumno_id: alumno.id },
      include: [{
        model: Ciclo,
        where: { fecha_inicio: { [Op.lte]: hoy }, fecha_fin: { [Op.gte]: hoy } },
      }],
    });
    if (matriculaActiva) {
      return res.status(409).json({ error: `El alumno ya tiene matrícula activa en el ciclo "${matriculaActiva.Ciclo.nombres}"` });
    }

    const matricula = await Matricula.create({
      alumno_id: alumno.id,
      ciclo_id: cicloId,
      fecha_registro: new Date(),
    });

    res.status(201).json(matricula);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.matriculaMasiva = async (req, res) => {
  try {
    // Se espera un array de { codigoAlumno, cicloId } en el body
    const { registros } = req.body;
    if (!registros || !Array.isArray(registros)) {
      return res.status(400).json({ error: 'Se requiere un array de registros' });
    }

    // Buscar todos los alumnos por código
    const codigos = registros.map((r) => r.codigoAlumno);
    const alumnos = await Alumno.findAll({ where: { codigo: { [Op.in]: codigos } } });
    const alumnoMap = {};
    alumnos.forEach((a) => { alumnoMap[a.codigo] = a.id; });

    // Filtrar alumnos que ya tienen matrícula activa en un ciclo vigente
    const hoy = new Date();
    const alumnoIds = Object.values(alumnoMap);
    const matriculasActivas = await Matricula.findAll({
      where: { alumno_id: { [Op.in]: alumnoIds } },
      include: [{
        model: Ciclo,
        where: { fecha_inicio: { [Op.lte]: hoy }, fecha_fin: { [Op.gte]: hoy } },
      }],
    });
    const idsConMatriculaActiva = new Set(matriculasActivas.map((m) => m.alumno_id));

    const datos = registros
      .filter((r) => alumnoMap[r.codigoAlumno] && !idsConMatriculaActiva.has(alumnoMap[r.codigoAlumno]))
      .map((r) => ({
        alumno_id: alumnoMap[r.codigoAlumno],
        ciclo_id: r.cicloId,
        fecha_registro: new Date(),
      }));

    const omitidos = registros.length - datos.length;
    const matriculas = await Matricula.bulkCreate(datos);

    res.status(201).json({ ok: true, cantidad: matriculas.length, omitidos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== CAMBIAR CICLO DE ALUMNO =====================

exports.cambiarCicloAlumno = async (req, res) => {
  try {
    const { codigoAlumno, cicloIdAnterior, cicloIdNuevo } = req.body;

    if (!codigoAlumno || !cicloIdNuevo) {
      return res.status(400).json({ error: 'Se requiere codigoAlumno y cicloIdNuevo' });
    }

    const alumno = await Alumno.findOne({ where: { codigo: codigoAlumno } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const cicloNuevo = await Ciclo.findByPk(cicloIdNuevo);
    if (!cicloNuevo) return res.status(404).json({ error: 'Ciclo destino no encontrado' });

    // Si se indica ciclo anterior, desactivar esa matrícula específica
    if (cicloIdAnterior) {
      await Matricula.destroy({
        where: { alumno_id: alumno.id, ciclo_id: cicloIdAnterior },
      });
    }

    // Verificar si ya está matriculado en el ciclo nuevo
    const yaExiste = await Matricula.findOne({
      where: { alumno_id: alumno.id, ciclo_id: cicloIdNuevo },
    });
    if (yaExiste) {
      return res.status(409).json({ error: 'El alumno ya está matriculado en el ciclo destino' });
    }

    const matricula = await Matricula.create({
      alumno_id: alumno.id,
      ciclo_id: cicloIdNuevo,
      fecha_registro: new Date(),
    });

    res.status(201).json(matricula);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== ASISTENCIA =====================

exports.registrarAsistencia = async (req, res) => {
  try {
    const { dni } = req.body;

    const alumno = await Alumno.findOne({ where: { codigo: dni } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    // Buscar matrícula activa para obtener ciclo
    const matricula = await Matricula.findOne({
      where: { alumno_id: alumno.id },
      order: [['fecha_registro', 'DESC']],
    });

    if (!matricula) return res.status(400).json({ error: 'Alumno sin matrícula activa' });

    // Verificar registro único por día (ignora días inhabilitados)
    const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date(); hoyFin.setHours(23, 59, 59, 999);
    const existente = await Asistencia.findOne({
      where: {
        alumno_id: alumno.id,
        ciclo_id: matricula.ciclo_id,
        fecha_hora: { [Op.between]: [hoyInicio, hoyFin] },
        estado: { [Op.ne]: 'Inhabilitado' },
      },
    });
    if (existente) {
      return res.status(409).json({ error: 'El alumno ya tiene asistencia registrada hoy', estado: existente.estado });
    }

    const asistencia = await Asistencia.create({
      alumno_id: alumno.id,
      ciclo_id: matricula.ciclo_id,
      fecha_hora: new Date(),
      estado: 'Presente',
    });

    res.status(201).json(asistencia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.inhabilitarDia = async (req, res) => {
  try {
    const { cicloId, fecha } = req.body;

    // Obtener todos los alumnos matriculados en ese ciclo
    const matriculas = await Matricula.findAll({
      where: { ciclo_id: cicloId },
    });

    const registros = matriculas.map((m) => ({
      alumno_id: m.alumno_id,
      ciclo_id: cicloId,
      fecha_hora: new Date(fecha),
      estado: 'Inhabilitado',
      observaciones: 'Día inhabilitado por administración',
    }));

    await Asistencia.bulkCreate(registros);

    res.json({ ok: true, cantidad: registros.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== CALIFICACIONES / EXÁMENES =====================

exports.crearExamen = async (req, res) => {
  try {
    const { cicloId, semana, tipoExamen, fecha, cantidadPreguntas } = req.body;

    const examen = await Examen.create({
      ciclo_id: cicloId,
      semana,
      tipo_examen: tipoExamen,
      fecha,
      cantidad_preguntas: cantidadPreguntas || null,
    });

    res.status(201).json(examen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== EXÁMENES POR CICLO =====================

exports.getExamenesPorCiclo = async (req, res) => {
  try {
    const { cicloId } = req.params;
    const examenes = await Examen.findAll({
      where: { ciclo_id: cicloId },
      order: [['fecha', 'DESC']],
    });
    res.json(examenes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.registrarCalificaciones = async (req, res) => {
  try {
    const { examenId } = req.params;
    const calificaciones = req.body; // [ { codigoAlumno, nota } ]

    if (!Array.isArray(calificaciones)) {
      return res.status(400).json({ error: 'Se requiere un array de calificaciones' });
    }

    // Buscar alumnos por código
    const codigos = calificaciones.map((c) => c.codigoAlumno);
    const alumnos = await Alumno.findAll({ where: { codigo: { [Op.in]: codigos } } });
    const alumnoMap = {};
    alumnos.forEach((a) => { alumnoMap[a.codigo] = a.id; });

    // Ordenar por nota descendente para calcular puesto
    const ordenadas = [...calificaciones]
      .filter((c) => alumnoMap[c.codigoAlumno])
      .sort((a, b) => b.nota - a.nota);

    const notas = ordenadas.map((c, index) => ({
      examen_id: parseInt(examenId),
      alumno_id: alumnoMap[c.codigoAlumno],
      valor: c.nota,
      puesto: index + 1,
    }));

    // Eliminar notas previas del examen si existen
    await Nota.destroy({ where: { examen_id: examenId } });

    await Nota.bulkCreate(notas);

    res.json({ ok: true, cantidad: notas.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== CONSULTAR ALUMNO POR CÓDIGO =====================

exports.getAlumnoByCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    const alumno = await Alumno.findOne({
      where: { codigo },
      attributes: { exclude: ['contrasena'] },
      include: [{ model: Matricula, include: [Ciclo] }],
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const data = alumno.toJSON();
    data.foto_url = buildFotoUrl(data.foto_url);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== SUBIR FOTO DE ALUMNO =====================

exports.uploadFotoMiddleware = uploadFoto.single('foto');

exports.subirFotoAlumno = async (req, res) => {
  try {
    const { codigo } = req.params;
    const alumno = await Alumno.findOne({ where: { codigo } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen' });

    const fotoPath = `/uploads/fotos/${req.file.filename}`;
    await alumno.update({ foto_url: fotoPath });

    res.json({ ok: true, foto_url: buildFotoUrl(fotoPath) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== ALUMNOS MATRICULADOS EN CICLO VIGENTE =====================

exports.alumnosCicloVigente = async (req, res) => {
  try {
    const hoy = new Date();
    const ciclo = await Ciclo.findOne({
      where: {
        fecha_inicio: { [Op.lte]: hoy },
        fecha_fin: { [Op.gte]: hoy },
      },
    });
    if (!ciclo) return res.status(404).json({ error: 'No hay ciclo vigente' });

    const matriculas = await Matricula.findAll({
      where: { ciclo_id: ciclo.id },
      include: [{
        model: Alumno,
        attributes: { exclude: ['contrasena'] },
      }],
    });

    const alumnos = matriculas.map((m) => {
      const a = m.Alumno.toJSON();
      a.foto_url = buildFotoUrl(a.foto_url);
      return a;
    });

    res.json({ ciclo, alumnos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== DESCARGAR QR DEL ALUMNO =====================

exports.descargarQR = async (req, res) => {
  try {
    const { codigo } = req.params;
    const alumno = await Alumno.findOne({ where: { codigo } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const qrBuffer = await QRCode.toBuffer(codigo, { type: 'png', width: 300 });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename=qr_${codigo}.png`);
    res.send(qrBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== LISTADO DE ASISTENCIA POR DÍA Y CICLO =====================

exports.listadoAsistencia = async (req, res) => {
  try {
    const { cicloId, fecha } = req.query;
    if (!cicloId || !fecha) {
      return res.status(400).json({ error: 'Se requiere cicloId y fecha' });
    }

    const inicioDia = new Date(`${fecha}T00:00:00`);
    const finDia = new Date(`${fecha}T23:59:59`);

    // Obtener todos los alumnos matriculados en el ciclo
    const matriculas = await Matricula.findAll({
      where: { ciclo_id: cicloId },
      include: [{
        model: Alumno,
        attributes: ['id', 'codigo', 'nombres', 'apellidos'],
      }],
    });

    // Obtener registros de asistencia del día
    const asistencias = await Asistencia.findAll({
      where: {
        ciclo_id: cicloId,
        fecha_hora: { [Op.between]: [inicioDia, finDia] },
      },
    });

    const asistenciaMap = {};
    asistencias.forEach((a) => {
      asistenciaMap[a.alumno_id] = { estado: a.estado, observaciones: a.observaciones };
    });

    const listado = matriculas.map((m) => ({
      codigo: m.Alumno.codigo,
      nombres: m.Alumno.nombres,
      apellidos: m.Alumno.apellidos,
      estado: asistenciaMap[m.Alumno.id]?.estado || 'Sin registro',
      observaciones: asistenciaMap[m.Alumno.id]?.observaciones || '',
    }));

    res.json({ fecha, cicloId: parseInt(cicloId), listado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== DESCARGAR PLANTILLA EXCEL DE NOTAS =====================

exports.descargarPlantillaNotas = async (req, res) => {
  try {
    const { examenId } = req.params;

    const examen = await Examen.findByPk(examenId, { include: [Ciclo] });
    if (!examen) return res.status(404).json({ error: 'Examen no encontrado' });

    // Alumnos matriculados en el ciclo del examen
    const matriculas = await Matricula.findAll({
      where: { ciclo_id: examen.ciclo_id },
      include: [{
        model: Alumno,
        attributes: ['codigo', 'nombres', 'apellidos'],
      }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Notas');

    sheet.columns = [
      { header: 'CODIGO', key: 'codigo', width: 15 },
      { header: 'NOMBRE_COMPLETO', key: 'nombre', width: 40 },
      { header: 'NOTA', key: 'nota', width: 10 },
    ];

    // Estilo del header
    sheet.getRow(1).font = { bold: true };

    matriculas.forEach((m) => {
      sheet.addRow({
        codigo: m.Alumno.codigo,
        nombre: `${m.Alumno.apellidos}, ${m.Alumno.nombres}`,
        nota: '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=plantilla_notas_examen_${examenId}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== HORARIO DE CURSOS (CRUD) =====================

exports.getHorarios = async (req, res) => {
  try {
    const { cicloId } = req.query;
    const cursoWhere = cicloId ? { ciclo_id: parseInt(cicloId) } : {};

    const horarios = await HorarioCurso.findAll({
      include: [{
        model: Curso,
        where: Object.keys(cursoWhere).length ? cursoWhere : undefined,
        attributes: ['id', 'nombre', 'profesor', 'ciclo_id'],
        include: [{ model: Ciclo, attributes: ['id', 'nombres'] }],
      }],
      order: [['dia_semana', 'ASC'], ['hora_inicio', 'ASC']],
    });

    res.json(horarios.map((h) => ({
      id: h.id,
      cursoId: h.curso_id,
      cursoNombre: h.Curso?.nombre,
      cicloId: h.Curso?.ciclo_id,
      cicloNombre: h.Curso?.Ciclo?.nombres,
      diaSemana: h.dia_semana,
      horaInicio: h.hora_inicio,
      horaFin: h.hora_fin,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createHorario = async (req, res) => {
  try {
    const { cursoId, diaSemana, horaInicio, horaFin } = req.body;
    if (!cursoId || !diaSemana || !horaInicio || !horaFin) {
      return res.status(400).json({ error: 'Se requiere cursoId, diaSemana, horaInicio, horaFin' });
    }

    const horario = await HorarioCurso.create({
      curso_id: cursoId,
      dia_semana: diaSemana,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    });

    res.status(201).json(horario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateHorario = async (req, res) => {
  try {
    const { id } = req.params;
    const { diaSemana, horaInicio, horaFin } = req.body;

    const horario = await HorarioCurso.findByPk(id);
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

    await horario.update({
      dia_semana: diaSemana || horario.dia_semana,
      hora_inicio: horaInicio || horario.hora_inicio,
      hora_fin: horaFin || horario.hora_fin,
    });

    res.json(horario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteHorario = async (req, res) => {
  try {
    const { id } = req.params;
    const horario = await HorarioCurso.findByPk(id);
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
    await horario.destroy();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== SUBIR EXCEL CON NOTAS =====================

exports.uploadExcelMiddleware = uploadExcel.single('archivo');

exports.subirNotasExcel = async (req, res) => {
  try {
    const { examenId } = req.params;

    const examen = await Examen.findByPk(examenId);
    if (!examen) return res.status(404).json({ error: 'Examen no encontrado' });

    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo Excel' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const calificaciones = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // saltar header
      const codigo = row.getCell(1).value?.toString().trim();
      const nota = parseFloat(row.getCell(3).value);
      if (codigo && !isNaN(nota)) {
        calificaciones.push({ codigo, nota });
      }
    });

    if (calificaciones.length === 0) {
      return res.status(400).json({ error: 'No se encontraron notas válidas en el archivo' });
    }

    // Buscar alumnos por código
    const codigos = calificaciones.map((c) => c.codigo);
    const alumnos = await Alumno.findAll({ where: { codigo: { [Op.in]: codigos } } });
    const alumnoMap = {};
    alumnos.forEach((a) => { alumnoMap[a.codigo] = a.id; });

    // Armar notas con ranking
    const notasValidas = calificaciones
      .filter((c) => alumnoMap[c.codigo])
      .sort((a, b) => b.nota - a.nota)
      .map((c, index) => ({
        examen_id: parseInt(examenId),
        alumno_id: alumnoMap[c.codigo],
        valor: c.nota,
        puesto: index + 1,
      }));

    // Eliminar notas previas y registrar nuevas
    await Nota.destroy({ where: { examen_id: examenId } });
    await Nota.bulkCreate(notasValidas);

    res.json({ ok: true, cantidad: notasValidas.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== MATRÍCULA MASIVA POR EXCEL =====================

exports.uploadExcelMatriculaMiddleware = uploadExcel.single('archivo');

/** Genera plantilla Excel para matrícula masiva */
exports.plantillaMasivaExcel = async (_req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Matricula');

    sheet.columns = [
      { header: 'DNI', key: 'dni', width: 14 },
      { header: 'Nombres', key: 'nombres', width: 25 },
      { header: 'Apellidos', key: 'apellidos', width: 25 },
      { header: 'FechaNacimiento', key: 'fechaNacimiento', width: 18 },
      { header: 'Celular', key: 'celular', width: 14 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'CicloId', key: 'cicloId', width: 10 },
    ];

    // Fila de instrucciones
    sheet.getRow(1).font = { bold: true };
    sheet.addRow(['12345678', 'Juan Carlos', 'Pérez García', '2005-03-15', '999888777', 'apoderado@email.com', '1']);
    sheet.addRow(['87654321', 'María', 'López Ríos', '2006-07-20', '987654321', '', '1']);
    sheet.addRow(['11223344', '', '', '', '', '', '1']); // Solo DNI (alumno ya existe)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_matricula_masiva.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Procesa Excel de matrícula masiva con creación automática de alumnos */
exports.matriculaMasivaExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo Excel' });

    const cicloIdDefault = req.body.cicloId ? parseInt(req.body.cicloId) : null;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const filas = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // saltar header
      const dni        = row.getCell(1).value?.toString().trim();
      const nombres    = row.getCell(2).value?.toString().trim() || '';
      const apellidos  = row.getCell(3).value?.toString().trim() || '';
      const fechaNac   = row.getCell(4).value?.toString().trim() || '';
      const celular    = row.getCell(5).value?.toString().trim() || '';
      const email      = row.getCell(6).value?.toString().trim() || '';
      const cicloId    = row.getCell(7).value ? parseInt(row.getCell(7).value) : cicloIdDefault;
      if (dni) filas.push({ rowNum, dni, nombres, apellidos, fechaNac, celular, email, cicloId });
    });

    if (filas.length === 0) return res.status(400).json({ error: 'No se encontraron filas válidas' });

    let creados = 0, matriculados = 0;
    const errores = [];

    for (const fila of filas) {
      try {
        const { rowNum, dni, nombres, apellidos, fechaNac, celular, email, cicloId } = fila;

        if (!cicloId) { errores.push(`Fila ${rowNum}: CicloId no especificado`); continue; }

        // Buscar alumno por código (código = DNI)
        let alumno = await Alumno.findOne({ where: { codigo: dni } });

        if (!alumno) {
          // Intentar por dni como campo adicional si lo hubiera (aquí usamos codigo=dni)
          if (!nombres || !apellidos) {
            errores.push(`Fila ${rowNum}: Alumno con DNI ${dni} no existe y faltan datos (Nombres, Apellidos)`);
            continue;
          }

          // Generar password: añoNacimiento-celular-dni
          const anioBirth = fechaNac ? new Date(fechaNac).getFullYear() : new Date().getFullYear();
          const passwordRaw = `${anioBirth}-${celular || dni}-${dni}`;
          const hash = await bcrypt.hash(passwordRaw, 10);

          // Código generado = DNI
          const existeEmail = email ? await Alumno.findOne({ where: { email_alumno: email } }) : null;
          const emailFinal = email && !existeEmail ? email : `${dni}@cec.edu.pe`;

          alumno = await Alumno.create({
            codigo: dni,
            nombres,
            apellidos,
            email_alumno: emailFinal,
            contrasena: hash,
            celular: celular || null,
          });

          creados++;

          // Enviar credenciales (stub si no hay SMTP)
          sendCredentials(emailFinal, nombres, dni, passwordRaw).catch(() => {});
        }

        // Matricular en ciclo (ignorar si ya existe)
        const yaMatriculado = await Matricula.findOne({
          where: { alumno_id: alumno.id, ciclo_id: cicloId },
        });

        if (!yaMatriculado) {
          await Matricula.create({
            alumno_id: alumno.id,
            ciclo_id: cicloId,
            fecha_registro: new Date(),
          });
          matriculados++;
        }
      } catch (err) {
        errores.push(`Fila ${fila.rowNum}: ${err.message}`);
      }
    }

    res.json({ ok: true, creados, matriculados, errores });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== CIERRE DE DÍA (marcar FALTO a ausentes) =====================

exports.cierreDia = async (req, res) => {
  try {
    const { cicloId, fecha } = req.body;
    if (!cicloId) return res.status(400).json({ error: 'Se requiere cicloId' });

    const fechaTarget = fecha ? new Date(fecha) : new Date();
    const inicioDia = new Date(fechaTarget); inicioDia.setHours(0, 0, 0, 0);
    const finDia    = new Date(fechaTarget); finDia.setHours(23, 59, 59, 999);
    const fechaStr  = fechaTarget.toISOString().split('T')[0];

    // Verificar si el día está inhabilitado
    const diaInhabilitado = await Asistencia.findOne({
      where: {
        ciclo_id: cicloId,
        fecha_hora: { [Op.between]: [inicioDia, finDia] },
        estado: 'Inhabilitado',
      },
    });
    if (diaInhabilitado) {
      return res.json({ ok: true, marcados: 0, mensaje: 'El día está inhabilitado, no se aplica cierre.' });
    }

    // Alumnos matriculados en el ciclo
    const matriculas = await Matricula.findAll({ where: { ciclo_id: cicloId } });
    const alumnoIds = matriculas.map((m) => m.alumno_id);

    // Quiénes ya tienen registro hoy
    const conRegistro = await Asistencia.findAll({
      where: {
        alumno_id: { [Op.in]: alumnoIds },
        ciclo_id: cicloId,
        fecha_hora: { [Op.between]: [inicioDia, finDia] },
      },
      attributes: ['alumno_id'],
    });
    const idsConRegistro = new Set(conRegistro.map((a) => a.alumno_id));

    // Insertar FALTO para los que no tienen registro
    const ausentesIds = alumnoIds.filter((id) => !idsConRegistro.has(id));

    if (ausentesIds.length > 0) {
      const registrosFalto = ausentesIds.map((alumno_id) => ({
        alumno_id,
        ciclo_id: parseInt(cicloId),
        fecha_hora: fechaTarget,
        estado: 'FALTO',
        observaciones: `Cierre de día ${fechaStr}`,
      }));
      await Asistencia.bulkCreate(registrosFalto);
    }

    res.json({ ok: true, marcados: ausentesIds.length, fecha: fechaStr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== REPORTES EXCEL =====================

/** Reporte: Alumnos por ciclo */
exports.reporteAlumnosCiclo = async (req, res) => {
  try {
    const { cicloId } = req.query;
    if (!cicloId) return res.status(400).json({ error: 'Se requiere cicloId' });

    const ciclo = await Ciclo.findByPk(cicloId);
    if (!ciclo) return res.status(404).json({ error: 'Ciclo no encontrado' });

    const matriculas = await Matricula.findAll({
      where: { ciclo_id: cicloId },
      include: [{ model: Alumno, attributes: { exclude: ['contrasena'] } }],
      order: [[Alumno, 'apellidos', 'ASC']],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Alumnos');

    sheet.columns = [
      { header: 'N°',        key: 'num',      width: 6 },
      { header: 'CÓDIGO',    key: 'codigo',   width: 15 },
      { header: 'APELLIDOS', key: 'apellidos',width: 28 },
      { header: 'NOMBRES',   key: 'nombres',  width: 25 },
      { header: 'EMAIL',     key: 'email',    width: 32 },
      { header: 'CELULAR',   key: 'celular',  width: 14 },
      { header: 'F. REGISTRO', key: 'fecha', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D4F5C' } };
    headerRow.alignment = { horizontal: 'center' };

    matriculas.forEach((m, i) => {
      const a = m.Alumno;
      sheet.addRow({
        num: i + 1,
        codigo: a.codigo,
        apellidos: a.apellidos,
        nombres: a.nombres,
        email: a.email_alumno || '',
        celular: a.celular || '',
        fecha: m.fecha_registro || '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=alumnos_ciclo_${cicloId}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Reporte: Orden de mérito por examen */
exports.reporteOrdenMerito = async (req, res) => {
  try {
    const { examenId } = req.query;
    if (!examenId) return res.status(400).json({ error: 'Se requiere examenId' });

    const examen = await Examen.findByPk(examenId);
    if (!examen) return res.status(404).json({ error: 'Examen no encontrado' });

    const notas = await Nota.findAll({
      where: { examen_id: examenId },
      include: [{ model: Alumno, attributes: ['codigo', 'nombres', 'apellidos'] }],
      order: [['puesto', 'ASC']],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orden de Mérito');

    sheet.columns = [
      { header: 'PUESTO',    key: 'puesto',   width: 10 },
      { header: 'CÓDIGO',    key: 'codigo',   width: 15 },
      { header: 'APELLIDOS', key: 'apellidos',width: 28 },
      { header: 'NOMBRES',   key: 'nombres',  width: 25 },
      { header: 'NOTA',      key: 'nota',     width: 10 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A9396' } };
    headerRow.alignment = { horizontal: 'center' };

    notas.forEach((n) => {
      const row = sheet.addRow({
        puesto: n.puesto,
        codigo: n.Alumno?.codigo || '',
        apellidos: n.Alumno?.apellidos || '',
        nombres: n.Alumno?.nombres || '',
        nota: parseFloat(n.valor),
      });
      if (n.puesto === 1) row.font = { bold: true, color: { argb: 'FF78350F' } };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=orden_merito_examen_${examenId}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== MATERIALES POR CURSO (con url_drive) =====================

exports.getMaterialesPorCurso = async (req, res) => {
  try {
    const { cursoId } = req.params;
    const materiales = await Material.findAll({
      where: { curso_id: cursoId },
      order: [['semana', 'ASC']],
    });
    res.json(materiales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.upsertMaterial = async (req, res) => {
  try {
    const { cursoId } = req.params;
    const { semana, nombre, urlDrive, urlArchivo } = req.body;

    if (!semana || !nombre) {
      return res.status(400).json({ error: 'Se requiere semana y nombre' });
    }

    const [material, created] = await Material.findOrCreate({
      where: { curso_id: cursoId, semana: parseInt(semana) },
      defaults: {
        nombre,
        url_drive: urlDrive || null,
        url_archivo: urlArchivo || null,
      },
    });

    if (!created) {
      await material.update({
        nombre: nombre || material.nombre,
        url_drive: urlDrive !== undefined ? urlDrive : material.url_drive,
        url_archivo: urlArchivo !== undefined ? urlArchivo : material.url_archivo,
      });
    }

    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
