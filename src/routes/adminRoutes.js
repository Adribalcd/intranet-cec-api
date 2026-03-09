const { Router } = require('express');
const router = Router();
const adminCtrl = require('../controllers/adminController');
const pagosCtrl = require('../controllers/pagosController');
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
router.get('/matricula/plantilla-masiva', auth('admin'), adminCtrl.plantillaMasivaExcel);
router.post('/matricula/masiva-excel', auth('admin'), adminCtrl.uploadExcelMatriculaMiddleware, adminCtrl.matriculaMasivaExcel);

// Asistencia
router.post('/asistencia', auth('admin'), adminCtrl.registrarAsistencia);
router.post('/asistencia/inhabilitar-dia', auth('admin'), adminCtrl.inhabilitarDia);
router.post('/asistencia/cierre-dia', auth('admin'), adminCtrl.cierreDia);

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

// Restaurar contraseña por defecto
router.post('/alumno/:codigo/restaurar-password', auth('admin'), adminCtrl.restaurarPasswordPorDefecto);

// Subir foto de alumno
router.post('/alumno/:codigo/foto', auth('admin'), adminCtrl.uploadFotoMiddleware, adminCtrl.subirFotoAlumno);

// Alumnos matriculados en ciclo vigente
router.get('/ciclo-vigente/alumnos', auth('admin'), adminCtrl.alumnosCicloVigente);

// Alumnos matriculados por cualquier ciclo
router.get('/ciclos/:cicloId/alumnos-matriculados', auth('admin'), adminCtrl.getAlumnosPorCiclo);

// Descargar QR del alumno
router.get('/alumno/:codigo/qr', auth('admin'), adminCtrl.descargarQR);

// Listado de asistencia por día y ciclo
router.get('/asistencia/listado', auth('admin'), adminCtrl.listadoAsistencia);

// Configuración horario asistencia
router.get('/asistencia/config', auth('admin'), adminCtrl.getConfigAsistencia);

// Ver notas/ranking de un examen
router.get('/examen/:examenId/notas', auth('admin'), adminCtrl.getNotasExamen);

// Descargar plantilla Excel de notas
router.get('/examen/:examenId/plantilla-notas', auth('admin'), adminCtrl.descargarPlantillaNotas);

// Subir Excel con notas
router.post('/examen/:examenId/notas-excel', auth('admin'), adminCtrl.uploadExcelMiddleware, adminCtrl.subirNotasExcel);

// Reportes Excel
router.get('/reportes/alumnos-ciclo', auth('admin'), adminCtrl.reporteAlumnosCiclo);
router.get('/reportes/orden-merito', auth('admin'), adminCtrl.reporteOrdenMerito);

// Configuración de pagos online por ciclo
router.get('/ciclos/:cicloId/config-pagos', auth('admin'), pagosCtrl.getConfigPagos);
router.put('/ciclos/:cicloId/config-pagos', auth('admin'), pagosCtrl.upsertConfigPagos);

// Gestión de pagos online
router.get('/pagos/pendientes-online', auth('admin'), pagosCtrl.getPagosOnlinePendientes);
router.put('/pago/:id/confirmar', auth('admin'), pagosCtrl.confirmarPago);

// Anular matrícula (elimina el registro de matrícula)
router.delete('/matricula/:matriculaId', auth('admin'), adminCtrl.anularMatricula);

// Anular matrícula por codigo de alumno + cicloId
router.delete('/alumno/:codigo/matricula/:cicloId', auth('admin'), adminCtrl.anularMatricula);

// Eliminar alumno del sistema (cascada: asistencias, matrículas, notas)
router.delete('/alumno/:codigo/eliminar', auth('admin'), adminCtrl.eliminarAlumno);

// Materiales por curso (admin) — 1:N por semana
router.get('/cursos/:cursoId/materiales',             auth('admin'), adminCtrl.getMaterialesPorCurso);
router.post('/cursos/:cursoId/materiales',            auth('admin'), adminCtrl.createMaterial);
router.put('/cursos/:cursoId/materiales/:id',         auth('admin'), adminCtrl.updateMaterial);
router.delete('/cursos/:cursoId/materiales/:id',      auth('admin'), adminCtrl.deleteMaterial);
// Subida de archivo físico al image-service
router.post(
  '/cursos/:cursoId/materiales/upload',
  auth('admin'),
  adminCtrl.uploadMaterialMiddleware,
  adminCtrl.uploadMaterial,
);

// ── Pagos ──────────────────────────────────────────────────────
const pagosCtrl = require('../controllers/pagosController');
router.get('/ciclos/:cicloId/conceptos-pago',    auth('admin'), pagosCtrl.getConceptos);
router.post('/ciclos/:cicloId/conceptos-pago',   auth('admin'), pagosCtrl.createConcepto);
router.put('/concepto-pago/:id',                 auth('admin'), pagosCtrl.updateConcepto);
router.delete('/concepto-pago/:id',              auth('admin'), pagosCtrl.deleteConcepto);
router.get('/ciclos/:cicloId/resumen-pagos',     auth('admin'), pagosCtrl.getResumenCiclo);
router.get('/alumnos/:alumnoId/pagos/:cicloId',  auth('admin'), pagosCtrl.getPagosAlumno);
router.post('/pago',                             auth('admin'), pagosCtrl.registrarPago);
router.put('/pago/:id',                          auth('admin'), pagosCtrl.updatePago);
router.delete('/pago/:id',                       auth('admin'), pagosCtrl.deletePago);
router.put('/pago/:id/visibilidad',              auth('admin'), pagosCtrl.toggleVisibilidad);
router.put('/alumno/:codigo/suspender',          auth('admin'), pagosCtrl.toggleSuspension);
// Config pagos por ciclo
router.get('/ciclos/:cicloId/config-pagos',      auth('admin'), pagosCtrl.getConfigPagos);
router.put('/ciclos/:cicloId/config-pagos',      auth('admin'), pagosCtrl.upsertConfigPagos);
// Pagos online pendientes y confirmación
router.get('/pagos/pendientes-online',           auth('admin'), pagosCtrl.getPagosOnlinePendientes);
router.put('/pago/:id/confirmar',                auth('admin'), pagosCtrl.confirmarPago);

module.exports = router;
