const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');
const { Admin, Ciclo, Curso, Matricula, Alumno, Asistencia, Examen, Nota } = require('../models');
const { generarToken } = require('../utils/tokenUtils');
const { Op } = require('sequelize');

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

// ===================== MATRÍCULA =====================

exports.matriculaManual = async (req, res) => {
  try {
    const { codigoAlumno, cicloId } = req.body;

    const alumno = await Alumno.findOne({ where: { codigo: codigoAlumno } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

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

    const datos = registros
      .filter((r) => alumnoMap[r.codigoAlumno])
      .map((r) => ({
        alumno_id: alumnoMap[r.codigoAlumno],
        ciclo_id: r.cicloId,
        fecha_registro: new Date(),
      }));

    const matriculas = await Matricula.bulkCreate(datos);

    res.status(201).json({ ok: true, cantidad: matriculas.length });
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
    const { cicloId, semana, tipoExamen, fecha } = req.body;

    const examen = await Examen.create({
      ciclo_id: cicloId,
      semana,
      tipo_examen: tipoExamen,
      fecha,
    });

    res.status(201).json({ examenId: examen.id });
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
