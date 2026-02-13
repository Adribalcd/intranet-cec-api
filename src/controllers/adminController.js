const bcrypt = require('bcryptjs');
const { Admin, Ciclo, Curso, Matricula, Alumno, Asistencia, Examen, Nota } = require('../models');
const { generarToken } = require('../utils/tokenUtils');
const { Op } = require('sequelize');

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
    res.json(ciclos);
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
    const { alumnoId, cursoId, cicloId } = req.body;

    const alumno = await Alumno.findByPk(alumnoId);
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const matricula = await Matricula.create({
      alumno_id: alumnoId,
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
    // Se espera un array de { alumnoId, cicloId } en el body
    const { registros } = req.body;
    if (!registros || !Array.isArray(registros)) {
      return res.status(400).json({ error: 'Se requiere un array de registros' });
    }

    const matriculas = await Matricula.bulkCreate(
      registros.map((r) => ({
        alumno_id: r.alumnoId,
        ciclo_id: r.cicloId,
        fecha_registro: new Date(),
      }))
    );

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
    const calificaciones = req.body; // [ { alumnoId, nota } ]

    if (!Array.isArray(calificaciones)) {
      return res.status(400).json({ error: 'Se requiere un array de calificaciones' });
    }

    // Ordenar por nota descendente para calcular puesto
    const ordenadas = [...calificaciones].sort((a, b) => b.nota - a.nota);

    const notas = ordenadas.map((c, index) => ({
      examen_id: parseInt(examenId),
      alumno_id: c.alumnoId,
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
