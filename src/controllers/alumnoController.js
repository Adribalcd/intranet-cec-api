const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { Alumno, Matricula, Curso, Ciclo, HorarioCurso, Asistencia, Nota, Examen, Material } = require('../models');
const { generarToken, invalidarToken } = require('../utils/tokenUtils');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
function buildFotoUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url}`;
}

// POST /api/alumno/login
exports.login = async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;
    const alumno = await Alumno.findOne({
      where: { codigo: usuario },
      attributes: ['id', 'codigo', 'contrasena'],
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
      attributes: ['codigo', 'nombres', 'apellidos', 'email_alumno', 'celular', 'foto_url'],
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const matricula = await Matricula.findOne({
      where: { alumno_id: req.usuario.id },
      include: [{ model: Ciclo, attributes: ['nombres'] }],
      order: [['fecha_registro', 'DESC']],
    });

    res.json({
      codigo: alumno.codigo,
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      email: alumno.email_alumno,
      celular: alumno.celular || null,
      ciclo: matricula?.Ciclo?.nombres || null,
      fotoUrl: buildFotoUrl(alumno.foto_url),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/qr
exports.getQr = async (req, res) => {
  try {
    const alumno = await Alumno.findByPk(req.usuario.id, { attributes: ['codigo'] });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const qrBuffer = await QRCode.toBuffer(alumno.codigo, { type: 'png', width: 300 });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename=qr_${alumno.codigo}.png`);
    res.send(qrBuffer);
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
      include: [{
        model: Examen,
        attributes: [
          'id', 'fecha', 'tipo_examen', 'subtipo_examen',
          'semana', 'cantidad_preguntas',
          'puntaje_pregunta_buena', 'puntaje_pregunta_mala',
        ],
      }],
      order: [[Examen, 'semana', 'ASC']],
    });

    res.json(
      notas.map((n) => ({
        examenId:          n.examen_id,
        fecha:             n.Examen?.fecha,
        nota:              n.valor,
        buenas:            n.buenas,
        malas:             n.malas,
        puesto:            n.puesto,
        tipo:              n.Examen?.tipo_examen,
        subtipo:           n.Examen?.subtipo_examen,
        semana:            n.Examen?.semana,
        cantidadPreguntas: n.Examen?.cantidad_preguntas,
        puntajeBuena:      n.Examen?.puntaje_pregunta_buena,
        puntajeMala:       n.Examen?.puntaje_pregunta_mala,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/alumno/examenes/:examenId/ranking
exports.rankingSalon = async (req, res) => {
  try {
    const { examenId } = req.params;

    // Verificar que este alumno participó en este examen
    const miNota = await Nota.findOne({
      where: { examen_id: examenId, alumno_id: req.usuario.id },
    });
    if (!miNota) return res.status(404).json({ error: 'No tienes nota en este examen' });

    // Traer todas las notas del examen
    const todas = await Nota.findAll({
      where: { examen_id: examenId },
      attributes: ['valor', 'puesto'],
    });

    const totalAlumnos = todas.length;

    // Distribución por rangos
    const rangos = [
      { rango: '18–20', min: 18, max: 20 },
      { rango: '14–17', min: 14, max: 17 },
      { rango: '11–13', min: 11, max: 13 },
      { rango: '7–10',  min: 7,  max: 10  },
      { rango: '0–6',   min: 0,  max: 6   },
    ];

    const distribucion = rangos.map((r) => ({
      rango: r.rango,
      cantidad: todas.filter((n) => Number(n.valor) >= r.min && Number(n.valor) <= r.max).length,
      incluye: Number(miNota.valor) >= r.min && Number(miNota.valor) <= r.max,
    }));

    // Percentil (qué porcentaje tiene nota MENOR que yo)
    const menores = todas.filter((n) => Number(n.valor) < Number(miNota.valor)).length;
    const percentil = Math.round((menores / totalAlumnos) * 100);

    res.json({
      examenId: parseInt(examenId),
      totalAlumnos,
      miPuesto: miNota.puesto,
      miNota: Number(miNota.valor),
      percentil,
      distribucion,
    });
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
        urlDrive: m.url_drive || null,
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
