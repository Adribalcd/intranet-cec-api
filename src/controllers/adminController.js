const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const multer = require('multer');
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');
const { google } = require('googleapis');
const { Admin, Ciclo, Curso, HorarioCurso, Matricula, Alumno, Asistencia, Examen, Nota, Material } = require('../models');
const { generarToken } = require('../utils/tokenUtils');
const { sendCredentials, sendWelcomeCiclo } = require('../utils/emailService');
const axios = require('axios');
const { Op } = require('sequelize');

// Carpeta de Drive donde se guardan las fotos de alumnos
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '12RAhO7i3rW3LbXFzbdh43CGk_BjEDKGi';

function getDrive() {
  let credentials;
  try {
    // Intentar cargar desde archivo primero (recomendado)
    const credentialsPath = path.join(__dirname, '../../google-credentials.json');
    if (fs.existsSync(credentialsPath)) {
      credentials = require(credentialsPath);
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Fallback a variable de entorno
      let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
        jsonStr = jsonStr.slice(1, -1);
      }
      jsonStr = jsonStr.replace(/\\n/g, '\n');
      credentials = JSON.parse(jsonStr);
    } else {
      throw new Error('No se encontró configuración de Google Drive');
    }
  } catch (err) {
    throw new Error(`Error al cargar credenciales de Google: ${err.message}`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function subirImagenLocal(buffer, codigo) {
  // Usar variable de entorno para la ruta de almacenamiento
  // En desarrollo: src/uploads/fotos
  // En producción: /app/data/uploads/fotos o la ruta que especifiques en UPLOADS_PATH
  const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads/fotos');
  
  // Crear carpeta si no existe
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  // Nombre del archivo: alumno_CODIGO.jpg
  const filename = `alumno_${codigo}.jpg`;
  const filepath = path.join(uploadsPath, filename);

  // Guardar el archivo
  fs.writeFileSync(filepath, buffer);

  // Retornar URL relativa que el cliente puede acceder
  return `/uploads/fotos/${filename}`;
}

// helper que envía la imagen al image-service (IMAGE_SERVICE_URL)
async function subirFotoRemota(buffer, codigo) {
  if (!process.env.IMAGE_SERVICE_URL) {
    throw new Error('IMAGE_SERVICE_URL no configurado');
  }
  const FormData = require('form-data');
  const form = new FormData();
  form.append('foto', buffer, { filename: `alumno_${codigo}.jpg`, contentType: 'image/jpeg' });
  form.append('codigo', codigo);

  const response = await axios.post(
    process.env.IMAGE_SERVICE_URL.replace(/\/+$/, '') + '/upload',
    form,
    { headers: form.getHeaders() },
  );
  const data = response.data;
  if (!data.ok) {
    throw new Error(data.error || 'Image service upload failed');
  }
  // El image-service devuelve la URL completa (ej: http://image-service/fotos/alumno_CEC001.jpg)
  return data.url;
}

// buildFotoUrl: las URLs de Drive ya son https:// y pasan directo
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

function buildFotoUrl(fotoUrl) {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith('http')) return fotoUrl;
  const p = fotoUrl.startsWith('/') ? fotoUrl : `/${fotoUrl}`;
  return `${BASE_URL}${p}`;
}

// Multer en memoria (el archivo va a Drive, no al disco)
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Solo se permiten imágenes JPG, PNG o WebP'));
    }
    cb(null, true);
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

exports.registrarAlumno = async (req, res) => {
  const { codigo, nombres, apellidos, email, celular, dni, fechaNacimiento } = req.body;
  try {
    if (!codigo || !nombres || !apellidos) {
      return res.status(400).json({ error: 'Se requiere codigo, nombres y apellidos' });
    }

    const anio = fechaNacimiento ? fechaNacimiento.split('-')[0] : new Date().getFullYear();
    const contrasenaPlana = (fechaNacimiento && celular && dni)
      ? `${anio}-${celular}-${dni}`
      : codigo;

    const hash = await bcrypt.hash(contrasenaPlana, 10);

    const nuevoAlumno = await Alumno.create({
      codigo,
      nombres,
      apellidos,
      email_alumno: email || `${codigo}@cec.edu.pe`,
      contrasena: hash,
      celular: celular || null,
      dni: dni || null,
      fecha_nacimiento: fechaNacimiento || null,
    });

    if (email) {
      sendCredentials(email, nombres, codigo, contrasenaPlana).catch(() => {});
    }

    return res.status(201).json({
      ok: true,
      mensaje: 'Alumno registrado correctamente',
      alumno: { ...nuevoAlumno.toJSON(), contrasena: undefined },
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      const campo = error.errors?.[0]?.path;
      if (campo === 'codigo') return res.status(409).json({ error: `El código "${codigo}" ya está registrado.` });
      if (campo === 'email_alumno') return res.status(409).json({ error: `El correo "${email}" ya está registrado. Usa uno diferente o deja el campo vacío.` });
      return res.status(409).json({ error: 'Ya existe un alumno con ese código o correo electrónico.' });
    }
    console.error('Error en registrarAlumno:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ===================== ALUMNOS POR CICLO (cualquier ciclo) =====================

exports.getAlumnosPorCiclo = async (req, res) => {
  try {
    const { cicloId } = req.params;
    const ciclo = await Ciclo.findByPk(cicloId);
    if (!ciclo) return res.status(404).json({ error: 'Ciclo no encontrado' });

    const matriculas = await Matricula.findAll({
      where: { ciclo_id: cicloId },
      include: [{ model: Alumno, attributes: { exclude: ['contrasena'] } }],
      order: [[Alumno, 'apellidos', 'ASC']],
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

// ===================== RESTAURAR CONTRASEÑA POR DEFECTO =====================

exports.restaurarPasswordPorDefecto = async (req, res) => {
  try {
    const { codigo } = req.params;
    const alumno = await Alumno.findOne({ where: { codigo } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    let passwordDefault;
    if (alumno.fecha_nacimiento && alumno.celular && alumno.dni) {
      const anio = new Date(alumno.fecha_nacimiento).getFullYear();
      passwordDefault = `${anio}-${alumno.celular}-${alumno.dni}`;
    } else {
      passwordDefault = alumno.codigo;
    }

    const hash = await bcrypt.hash(passwordDefault, 10);
    await alumno.update({ contrasena: hash });

    res.json({ ok: true, passwordDefault, mensaje: 'Contraseña restaurada al valor por defecto' });
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

    const ciclo = await Ciclo.findByPk(cicloId);

    const matricula = await Matricula.create({
      alumno_id: alumno.id,
      ciclo_id: cicloId,
      fecha_registro: new Date(),
    });

    // Enviar correo de bienvenida al ciclo (si el alumno tiene email registrado)
    if (alumno.email_alumno) {
      sendWelcomeCiclo(
        alumno.email_alumno,
        alumno.nombres,
        alumno.codigo,
        ciclo ? ciclo.nombres : `Ciclo #${cicloId}`,
      ).catch(() => {});
    }

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

// ─── Configuración de horario de asistencia ────────────────────
// Activo: Lunes a Sábado (0=Dom, 1=Lun...6=Sáb)
const DIAS_ACTIVOS = [1, 2, 3, 4, 5, 6]; // Lun–Sáb
// Ventana "a tiempo": 07:00:00 → 08:15:00
const HORA_INICIO_ASIS = { h: 7,  m: 0  }; // 07:00
const HORA_FIN_ASIS    = { h: 8,  m: 15 }; // 08:15
const HORA_LIMITE_ASIS = { h: 23, m: 59 }; // hasta las 23:59 se acepta (tardanza)

function calcularEstadoAsistencia(ahora = new Date()) {
  const diaSemana = ahora.getDay(); // 0=Dom…6=Sáb
  if (!DIAS_ACTIVOS.includes(diaSemana)) {
    return { valido: false, razon: 'El registro de asistencia solo está activo de lunes a sábado.' };
  }
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const minInicio    = HORA_INICIO_ASIS.h * 60 + HORA_INICIO_ASIS.m; // 420
  const minFin       = HORA_FIN_ASIS.h   * 60 + HORA_FIN_ASIS.m;    // 495
  const minLimite    = HORA_LIMITE_ASIS.h * 60 + HORA_LIMITE_ASIS.m;

  if (minutosAhora < minInicio) {
    return { valido: false, razon: `El registro de asistencia aún no ha comenzado. Inicia a las 07:00 AM.` };
  }
  if (minutosAhora > minLimite) {
    return { valido: false, razon: 'El registro de asistencia ya cerró.' };
  }
  const estado = minutosAhora <= minFin ? 'Presente' : 'Tardanza';
  return { valido: true, estado };
}

exports.registrarAsistencia = async (req, res) => {
  try {
    const { dni } = req.body;

    const alumno = await Alumno.findOne({
      where: { codigo: dni },
      include: [{ model: Matricula, include: [Ciclo], order: [['fecha_registro', 'DESC']], limit: 1 }],
    });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    // Buscar matrícula más reciente
    const matricula = await Matricula.findOne({
      where: { alumno_id: alumno.id },
      include: [{ model: Ciclo }],
      order: [['fecha_registro', 'DESC']],
    });
    if (!matricula) return res.status(400).json({ error: 'Alumno sin matrícula activa' });

    // Calcular estado según hora actual
    const ahora = new Date();
    const { valido, razon, estado } = calcularEstadoAsistencia(ahora);
    if (!valido) return res.status(400).json({ error: razon });

    // Verificar registro único por día
    const hoyInicio = new Date(ahora); hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin    = new Date(ahora); hoyFin.setHours(23, 59, 59, 999);
    const existente = await Asistencia.findOne({
      where: {
        alumno_id: alumno.id,
        ciclo_id:  matricula.ciclo_id,
        fecha_hora: { [Op.between]: [hoyInicio, hoyFin] },
        estado:    { [Op.ne]: 'Inhabilitado' },
      },
    });
    if (existente) {
      return res.status(409).json({
        error: `El alumno ya tiene asistencia registrada hoy (${existente.estado})`,
        estado: existente.estado,
      });
    }

    const asistencia = await Asistencia.create({
      alumno_id:     alumno.id,
      ciclo_id:      matricula.ciclo_id,
      fecha_hora:    ahora,
      estado,
      observaciones: estado === 'Tardanza' ? 'Llegó fuera del horario de 07:00–08:15' : null,
    });

    const alumnoData = alumno.toJSON();
    alumnoData.foto_url = buildFotoUrl(alumnoData.foto_url);

    res.status(201).json({
      asistencia,
      estado,
      alumno: {
        nombres:   alumnoData.nombres,
        apellidos: alumnoData.apellidos,
        codigo:    alumnoData.codigo,
        foto_url:  alumnoData.foto_url,
        ciclo:     matricula.Ciclo ? { id: matricula.Ciclo.id, nombres: matricula.Ciclo.nombres } : null,
      },
    });
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
    const {
      cicloId, semana, tipoExamen, subtipoExamen,
      fecha, cantidadPreguntas,
      puntajeBuena, puntajeMala,
    } = req.body;

    const examen = await Examen.create({
      ciclo_id:               cicloId,
      semana,
      tipo_examen:            tipoExamen,
      subtipo_examen:         subtipoExamen  || null,
      fecha,
      cantidad_preguntas:     cantidadPreguntas || null,
      puntaje_pregunta_buena: puntajeBuena  != null ? puntajeBuena : 4.00,
      puntaje_pregunta_mala:  puntajeMala   != null ? puntajeMala  : 1.00,
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

// ===================== VER NOTAS DE UN EXAMEN =====================

exports.getNotasExamen = async (req, res) => {
  try {
    const { examenId } = req.params;
    const examen = await Examen.findByPk(examenId);
    if (!examen) return res.status(404).json({ error: 'Examen no encontrado' });

    const notas = await Nota.findAll({
      where: { examen_id: examenId },
      include: [{ model: Alumno, attributes: ['codigo', 'nombres', 'apellidos'] }],
      order: [['puesto', 'ASC']],
    });

    res.json({
      examen,
      notas: notas.map((n) => ({
        puesto: n.puesto,
        nota: n.valor,
        codigo: n.Alumno?.codigo,
        nombres: n.Alumno?.nombres,
        apellidos: n.Alumno?.apellidos,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.registrarCalificaciones = async (req, res) => {
  try {
    const { examenId } = req.params;
    const calificaciones = req.body; // [ { codigoAlumno, nota } ] o [ { codigoAlumno, buenas, malas } ]

    if (!Array.isArray(calificaciones)) {
      return res.status(400).json({ error: 'Se requiere un array de calificaciones' });
    }

    // Obtener el examen para leer los puntajes configurados
    const examen = await Examen.findByPk(examenId);
    if (!examen) return res.status(404).json({ error: 'Examen no encontrado' });

    const pBuena = parseFloat(examen.puntaje_pregunta_buena) || 4.00;
    const pMala  = parseFloat(examen.puntaje_pregunta_mala)  || 1.00;

    // Buscar alumnos por código
    const codigos = calificaciones.map((c) => c.codigoAlumno);
    const alumnos = await Alumno.findAll({ where: { codigo: { [Op.in]: codigos } } });
    const alumnoMap = {};
    alumnos.forEach((a) => { alumnoMap[a.codigo] = a.id; });

    // Calcular nota final: si vienen buenas/malas → fórmula; si viene nota → usarla directo
    const conValor = calificaciones
      .filter((c) => alumnoMap[c.codigoAlumno])
      .map((c) => {
        let valor;
        let buenas = null;
        let malas  = null;
        if (c.buenas != null && c.malas != null) {
          buenas = parseInt(c.buenas, 10);
          malas  = parseInt(c.malas,  10);
          valor  = Math.max(0, (buenas * pBuena) - (malas * pMala));
        } else {
          valor = parseFloat(c.nota);
        }
        return { codigoAlumno: c.codigoAlumno, valor, buenas, malas };
      });

    // Ordenar por valor descendente para calcular puesto
    const ordenadas = [...conValor].sort((a, b) => b.valor - a.valor);

    const notas = ordenadas.map((c, index) => ({
      examen_id: parseInt(examenId),
      alumno_id: alumnoMap[c.codigoAlumno],
      valor:     c.valor,
      buenas:    c.buenas,
      malas:     c.malas,
      puesto:    index + 1,
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

exports.uploadFotoMiddleware = (req, res, next) => {
  uploadFoto.single('foto')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

exports.subirFotoAlumno = async (req, res) => {
  try {
    const { codigo } = req.params;
    const alumno = await Alumno.findOne({ where: { codigo } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen' });

    let fotoUrl;
    if (process.env.IMAGE_SERVICE_URL) {
      fotoUrl = await subirFotoRemota(req.file.buffer, codigo);
    } else {
      fotoUrl = await subirImagenLocal(req.file.buffer, codigo);
    }
    await alumno.update({ foto_url: fotoUrl });

    res.json({ ok: true, foto_url: buildFotoUrl(fotoUrl) });
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
      asistenciaMap[a.alumno_id] = {
        estado: a.estado,
        observaciones: a.observaciones,
        hora: a.fecha_hora,
      };
    });

    const listado = matriculas.map((m) => ({
      codigo: m.Alumno.codigo,
      nombres: m.Alumno.nombres,
      apellidos: m.Alumno.apellidos,
      estado: asistenciaMap[m.Alumno.id]?.estado || 'Sin registro',
      observaciones: asistenciaMap[m.Alumno.id]?.observaciones || '',
      hora: asistenciaMap[m.Alumno.id]?.hora || null,
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

    // Si el examen tiene puntajes configurados, incluir columnas de Buenas/Malas
    const usaPuntajes = examen.puntaje_pregunta_buena != null;

    sheet.columns = [
      { header: 'CODIGO',         key: 'codigo', width: 15 },
      { header: 'NOMBRE_COMPLETO',key: 'nombre', width: 40 },
      ...(usaPuntajes
        ? [
            { header: `BUENAS (×${examen.puntaje_pregunta_buena})`, key: 'buenas', width: 14 },
            { header: `MALAS  (×${examen.puntaje_pregunta_mala})`,  key: 'malas',  width: 14 },
          ]
        : [{ header: 'NOTA', key: 'nota', width: 10 }]),
    ];

    // Estilo del header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D4F5C' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    matriculas.forEach((m) => {
      const row = { codigo: m.Alumno.codigo, nombre: `${m.Alumno.apellidos}, ${m.Alumno.nombres}` };
      if (usaPuntajes) { row.buenas = ''; row.malas = ''; } else { row.nota = ''; }
      sheet.addRow(row);
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

exports.uploadExcelMiddleware = (req, res, next) => {
  uploadExcel.single('archivo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

exports.subirNotasExcel = async (req, res) => {
  try {
    const { examenId } = req.params;

    const examen = await Examen.findByPk(examenId);
    if (!examen) return res.status(404).json({ error: 'Examen no encontrado' });

    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo Excel' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    // Detectar si la plantilla usa columnas Buenas/Malas (columnas 3 y 4) o Nota (columna 3)
    const headerRow = sheet.getRow(1);
    const col3Header = (headerRow.getCell(3).value || '').toString().toUpperCase();
    const usaBuenasMalas = col3Header.startsWith('BUENAS');

    const pBuena = parseFloat(examen.puntaje_pregunta_buena) || 4.00;
    const pMala  = parseFloat(examen.puntaje_pregunta_mala)  || 1.00;

    const calificaciones = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // saltar header
      const codigo = row.getCell(1).value?.toString().trim();
      if (!codigo) return;

      if (usaBuenasMalas) {
        const buenas = parseInt(row.getCell(3).value, 10);
        const malas  = parseInt(row.getCell(4).value, 10);
        if (!isNaN(buenas) && !isNaN(malas)) {
          const valor = Math.max(0, (buenas * pBuena) - (malas * pMala));
          calificaciones.push({ codigo, buenas, malas, nota: valor });
        }
      } else {
        const nota = parseFloat(row.getCell(3).value);
        if (!isNaN(nota)) calificaciones.push({ codigo, buenas: null, malas: null, nota });
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
        valor:  c.nota,
        buenas: c.buenas,
        malas:  c.malas,
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

exports.uploadExcelMatriculaMiddleware = (req, res, next) => {
  uploadExcel.single('archivo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

/** Genera plantilla Excel para matrícula masiva (sin columna CicloId — el ciclo se selecciona en el formulario) */
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
    ];

    sheet.getRow(1).font = { bold: true };
    // Instrucción: si el alumno ya existe, basta con el DNI; el ciclo se elige en el formulario
    sheet.addRow(['12345678', 'Juan Carlos', 'Pérez García', '2005-03-15', '999888777', 'apoderado@email.com']);
    sheet.addRow(['87654321', 'María', 'López Ríos', '2006-07-20', '987654321', '']);
    sheet.addRow(['11223344', '', '', '', '', '']); // Solo DNI (alumno ya existe)

    // Añadir nota explicativa en la fila 5
    sheet.getRow(5).getCell(1).value = '← Si el alumno ya existe, solo llena el DNI. Si es nuevo, completa todos los campos.';
    sheet.getRow(5).getCell(1).font = { italic: true, color: { argb: 'FF888888' } };

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
      // cicloId siempre viene del formulario (cicloIdDefault), no del Excel
      const cicloId    = cicloIdDefault;
      if (dni && dni.length > 0) filas.push({ rowNum, dni, nombres, apellidos, fechaNac, celular, email, cicloId });
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

// ===================== MATERIALES POR CURSO (1:N — múltiples por semana) =====================

exports.getMaterialesPorCurso = async (req, res) => {
  try {
    const { cursoId } = req.params;
    const materiales = await Material.findAll({
      where: { curso_id: cursoId },
      order: [['semana', 'ASC'], ['id', 'ASC']],
    });
    res.json(materiales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /cursos/:cursoId/materiales
 * Crea un nuevo material para el curso (sin restricción de unicidad por semana).
 * Body: { semana, nombre, urlDrive?, urlArchivo?, tipoArchivo? }
 */
exports.createMaterial = async (req, res) => {
  try {
    const { cursoId } = req.params;
    const { semana, nombre, urlDrive, urlArchivo, tipoArchivo } = req.body;

    if (!semana || !nombre) {
      return res.status(400).json({ error: 'Se requiere semana y nombre' });
    }

    const material = await Material.create({
      curso_id:     parseInt(cursoId),
      semana:       parseInt(semana),
      nombre,
      url_drive:    urlDrive    || null,
      url_archivo:  urlArchivo  || null,
      tipo_archivo: tipoArchivo || null,
    });

    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT /cursos/:cursoId/materiales/:id
 * Actualiza un material existente.
 */
exports.updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { semana, nombre, urlDrive, urlArchivo, tipoArchivo } = req.body;

    const material = await Material.findByPk(id);
    if (!material) return res.status(404).json({ error: 'Material no encontrado' });

    await material.update({
      ...(semana       != null && { semana: parseInt(semana) }),
      ...(nombre       != null && { nombre }),
      ...(urlDrive     !== undefined && { url_drive:    urlDrive    || null }),
      ...(urlArchivo   !== undefined && { url_archivo:  urlArchivo  || null }),
      ...(tipoArchivo  !== undefined && { tipo_archivo: tipoArchivo || null }),
    });

    res.json(material);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /cursos/:cursoId/materiales/:id
 * Elimina un material. Si tiene url_archivo del image-service, lo elimina también.
 */
exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findByPk(id);
    if (!material) return res.status(404).json({ error: 'Material no encontrado' });

    // Si el archivo fue subido al image-service, eliminarlo físicamente
    const imageServiceUrl = process.env.IMAGE_SERVICE_URL;
    if (imageServiceUrl && material.url_archivo && material.url_archivo.includes('/materiales/')) {
      const filename = material.url_archivo.split('/materiales/').pop();
      if (filename) {
        axios.delete(`${imageServiceUrl}/materiales/${filename}`).catch(() => {});
      }
    }

    await material.destroy();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /cursos/:cursoId/materiales/upload
 * Recibe un archivo (multipart/form-data campo "archivo"), lo envía al image-service
 * y crea o actualiza el registro en la BD.
 * Body fields: semana (requerido), nombre (requerido), materialId (opcional — si se pasa, actualiza en vez de crear)
 */
const multerMemStorage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    // Algunos navegadores envían PDFs con mimetype vacío o incorrecto según extensión
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (allowedExts.includes(ext)) return cb(null, true);
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype || ext}. Usa PDF, PPT, DOC o imágenes.`));
  },
});
exports.uploadMaterialMiddleware = multerMemStorage.single('archivo');

exports.uploadMaterial = async (req, res) => {
  try {
    const { cursoId } = req.params;
    const { semana, nombre, materialId } = req.body;

    if (!semana || !nombre) {
      return res.status(400).json({ error: 'Se requiere semana y nombre' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const imageServiceUrl = process.env.IMAGE_SERVICE_URL;
    if (!imageServiceUrl) {
      return res.status(503).json({ error: 'IMAGE_SERVICE_URL no configurado. Configura IMAGE_SERVICE_URL en .env para subir archivos.' });
    }

    // Enviar al image-service
    const FormData = require('form-data');
    const form = new FormData();
    form.append('archivo', req.file.buffer, {
      filename:    req.file.originalname,
      contentType: req.file.mimetype || 'application/octet-stream',
      knownLength: req.file.buffer.length,
    });
    form.append('prefijo', `curso${cursoId}_s${semana}`);

    const response = await axios.post(
      `${imageServiceUrl.replace(/\/+$/, '')}/upload/material`,
      form,
      { headers: form.getHeaders() },
    );

    const { url, tipo } = response.data;

    // Si se pasó materialId, actualizar el registro existente
    if (materialId) {
      const mat = await Material.findByPk(parseInt(materialId));
      if (!mat) return res.status(404).json({ error: 'Material no encontrado' });
      await mat.update({
        semana:       parseInt(semana),
        nombre,
        url_archivo:  url,
        tipo_archivo: tipo,
      });
      return res.json(mat);
    }

    // Crear nuevo registro
    const material = await Material.create({
      curso_id:     parseInt(cursoId),
      semana:       parseInt(semana),
      nombre,
      url_archivo:  url,
      tipo_archivo: tipo,
      url_drive:    null,
    });

    res.status(201).json(material);
  } catch (error) {
    console.error('Error en uploadMaterial:', error.message);
    res.status(500).json({ error: error.response?.data?.error || error.message });
  }
};

// Alias para compatibilidad con rutas antiguas (upsert → create)
exports.upsertMaterial = exports.createMaterial;

// ===================== ANULAR MATRÍCULA =====================

exports.anularMatricula = async (req, res) => {
  try {
    // Soporta dos modos:
    // 1. Por matriculaId: DELETE /matricula/:matriculaId
    // 2. Por codigo+cicloId: DELETE /alumno/:codigo/matricula/:cicloId
    const { matriculaId, codigo, cicloId } = req.params;

    let matricula;
    if (matriculaId) {
      matricula = await Matricula.findByPk(matriculaId, { include: [Alumno, Ciclo] });
    } else if (codigo && cicloId) {
      const alumno = await Alumno.findOne({ where: { codigo } });
      if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
      matricula = await Matricula.findOne({
        where: { alumno_id: alumno.id, ciclo_id: cicloId },
        include: [Alumno, Ciclo],
      });
    }

    if (!matricula) return res.status(404).json({ error: 'Matrícula no encontrada' });

    const alumnoNombre = matricula.Alumno ? `${matricula.Alumno.nombres} ${matricula.Alumno.apellidos}` : '';
    const cicloNombre  = matricula.Ciclo  ? matricula.Ciclo.nombres : '';

    await matricula.destroy();

    res.json({ ok: true, mensaje: `Matrícula de "${alumnoNombre}" en "${cicloNombre}" anulada.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== ELIMINAR ALUMNO DEL SISTEMA =====================

exports.eliminarAlumno = async (req, res) => {
  try {
    const codigo = req.params.codigo;
    const alumno = await Alumno.findOne({ where: { codigo } });
    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

    const nombre = `${alumno.nombres} ${alumno.apellidos}`;

    // Eliminar en cascada: asistencias, matrículas, notas
    await Asistencia.destroy({ where: { alumno_id: alumno.id } });
    await Matricula.destroy({ where: { alumno_id: alumno.id } });
    await Nota.destroy({ where: { alumno_id: alumno.id } });
    await alumno.destroy();

    res.json({ ok: true, mensaje: `Alumno "${nombre}" (${codigo}) eliminado del sistema.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===================== CONFIG HORARIO ASISTENCIA (para frontend) =====================

exports.getConfigAsistencia = (_req, res) => {
  res.json({
    diasActivos: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    horaInicio: '07:00',
    horaFinPuntual: '08:15',
    horaLimite: '23:59',
  });
};
