const { Router } = require('express');
const router = Router();
const adminCtrl = require('../controllers/adminController');
const auth = require('../middlewares/authMiddleware');

// Pública
router.post('/login', adminCtrl.login);

// Protegidas (requieren rol admin)
// Ciclos
router.get('/ciclos', auth('admin'), adminCtrl.getCiclos);
router.post('/ciclos', auth('admin'), adminCtrl.createCiclo);
router.put('/ciclos/:id', auth('admin'), adminCtrl.updateCiclo);
router.delete('/ciclos/:id', auth('admin'), adminCtrl.deleteCiclo);

// Cursos
router.get('/cursos', auth('admin'), adminCtrl.getCursos);
router.post('/cursos', auth('admin'), adminCtrl.createCurso);
router.put('/cursos/:id', auth('admin'), adminCtrl.updateCurso);
router.delete('/cursos/:id', auth('admin'), adminCtrl.deleteCurso);

// Registro de alumno
router.post('/alumno/registrar', auth('admin'), adminCtrl.registrarAlumno);

// Matrícula
router.post('/matricula/manual', auth('admin'), adminCtrl.matriculaManual);
router.post('/matricula/masiva', auth('admin'), adminCtrl.matriculaMasiva);
router.post('/matricula/cambiar-ciclo', auth('admin'), adminCtrl.cambiarCicloAlumno);

// Asistencia
router.post('/asistencia', auth('admin'), adminCtrl.registrarAsistencia);
router.post('/asistencia/inhabilitar-dia', auth('admin'), adminCtrl.inhabilitarDia);

// Horarios de cursos
router.get('/horario', auth('admin'), adminCtrl.getHorarios);
router.post('/horario', auth('admin'), adminCtrl.createHorario);
router.put('/horario/:id', auth('admin'), adminCtrl.updateHorario);
router.delete('/horario/:id', auth('admin'), adminCtrl.deleteHorario);

// Exámenes por ciclo
router.get('/ciclos/:cicloId/examenes', auth('admin'), adminCtrl.getExamenesPorCiclo);

// Exámenes y calificaciones
router.post('/examen', auth('admin'), adminCtrl.crearExamen);
router.post('/examen/:examenId/calificaciones', auth('admin'), adminCtrl.registrarCalificaciones);

// Consultar alumno por código
router.get('/alumno/:codigo', auth('admin'), adminCtrl.getAlumnoByCodigo);

// Subir foto de alumno
router.post('/alumno/:codigo/foto', auth('admin'), adminCtrl.uploadFotoMiddleware, adminCtrl.subirFotoAlumno);

// Alumnos matriculados en ciclo vigente
router.get('/ciclo-vigente/alumnos', auth('admin'), adminCtrl.alumnosCicloVigente);

// Descargar QR del alumno
router.get('/alumno/:codigo/qr', auth('admin'), adminCtrl.descargarQR);

// Listado de asistencia por día y ciclo
router.get('/asistencia/listado', auth('admin'), adminCtrl.listadoAsistencia);

// Descargar plantilla Excel de notas
router.get('/examen/:examenId/plantilla-notas', auth('admin'), adminCtrl.descargarPlantillaNotas);

// Subir Excel con notas
router.post('/examen/:examenId/notas-excel', auth('admin'), adminCtrl.uploadExcelMiddleware, adminCtrl.subirNotasExcel);

module.exports = router;
