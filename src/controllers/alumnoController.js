const bcrypt = require('bcryptjs');
const { Alumno, Matricula, Curso, Ciclo, HorarioCurso, Asistencia, Nota, Examen, Material } = require('../models');
const { generarToken, invalidarToken } = require('../utils/tokenUtils');

// POST /api/alumno/login
exports.login = async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;
    const alumno = await Alumno.findOne({
      where: { codigo: usuario },
    });
    if (!alumno) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const valid = await bcrypt.compare(contrasena, alumno.contrasena);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = generarToken({ id: alumno.id, rol: 'alumno' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/perfil
exports.perfil = async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.usuario.id, {
      attributes: ['nombres', 'apellidos', 'foto_url'],
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    // Obtener ciclo actual a través de matrícula
    const matricula = await Matricula.findOne({
      where: { alumno_id: req.usuario.id },
      include: [{ model: Ciclo, attributes: ['nombres'] }],
      order: [['fecha_registro', 'DESC']],
    });

    res.json({
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      ciclo: matricula?.Ciclo?.nombres || null,
      fotoUrl: alumno.foto_url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/horario
exports.horario = async (req, res) => {
  try {
    const matriculas = await Matricula.findAll({
      where: { alumno_id: req.usuario.id },
      attributes: ['ciclo_id'],
    });
    const cicloIds = matriculas.map((m) => m.ciclo_id);

    const cursos = await Curso.findAll({
      where: { ciclo_id: cicloIds },
      include: [{ model: HorarioCurso }],
    });

    const horario = [];
    cursos.forEach((curso) => {
      curso.HorarioCursos.forEach((h) => {
        horario.push({
          curso: curso.nombre,
          profesor: curso.profesor,
          dia: h.dia_semana,
          hora: `${h.hora_inicio} - ${h.hora_fin}`,
          horaInicio: h.hora_inicio,
          horaFin: h.hora_fin,
        });
      });
    });

    res.json(horario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/asistencia
exports.asistencia = async (req, res) => {
  try {
    const registros = await Asistencia.findAll({
      where: { alumno_id: req.usuario.id },
      order: [['fecha_hora', 'DESC']],
    });

    res.json(
      registros.map((r) => ({
        fecha: r.fecha_hora,
        estado: r.estado,
        hora: r.fecha_hora,
        observaciones: r.observaciones,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/calificaciones
exports.calificaciones = async (req, res) => {
  try {
    const notas = await Nota.findAll({
      where: { alumno_id: req.usuario.id },
      include: [{ model: Examen, attributes: ['fecha', 'tipo_examen', 'semana', 'cantidad_preguntas'] }],
      order: [[Examen, 'fecha', 'DESC']],
    });

    res.json(
      notas.map((n) => ({
        fecha: n.Examen?.fecha,
        nota: n.valor,
        puesto: n.puesto,
        tipo: n.Examen?.tipo_examen,
        semana: n.Examen?.semana,
        cantidadPreguntas: n.Examen?.cantidad_preguntas,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/cursos
exports.cursos = async (req, res) => {
  try {
    const matriculas = await Matricula.findAll({
      where: { alumno_id: req.usuario.id },
      include: [{ model: Ciclo }],
    });
    const cicloIds = matriculas.map((m) => m.ciclo_id);

    const cursos = await Curso.findAll({
      where: { ciclo_id: cicloIds },
      include: [{ model: Ciclo, attributes: ['nombres'] }],
    });

    res.json(
      cursos.map((c) => ({
        idCurso: c.id,
        nombreCurso: c.nombre,
        ciclo: c.Ciclo?.nombres,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/cursos/:idCurso/materiales?semana=X
exports.materiales = async (req, res) => {
  try {
    const { idCurso } = req.params;
    const { semana } = req.query;

    const where = { curso_id: idCurso };
    if (semana) where.semana = semana;

    const materiales = await Material.findAll({ where });

    res.json(
      materiales.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        semana: m.semana,
        urlArchivo: m.url_archivo,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/alumno/logout
exports.logout = async (req, res) => {
  try {
    invalidarToken(req.token);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/alumno/recuperar-password
exports.recuperarPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const alumno = await Alumno.findOne({ where: { email_alumno: email } });
    if (!alumno) {
      // No revelamos si el email existe o no
      return res.json({ ok: true });
    }
    const token = generarToken({ id: alumno.id, rol: 'reset' });
    // En producción aquí se enviaría el email con el token
    console.log(`Token de recuperación para ${email}: ${token}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/alumno/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, nuevaContrasena, confirmarContrasena } = req.body;

    if (nuevaContrasena !== confirmarContrasena) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    const { verificarToken } = require('../utils/tokenUtils');
    const decoded = verificarToken(token);
    if (!decoded || decoded.rol !== 'reset') {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const hash = await bcrypt.hash(nuevaContrasena, 10);
    await Alumno.update({ contrasena: hash }, { where: { id: decoded.id } });
    invalidarToken(token);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
