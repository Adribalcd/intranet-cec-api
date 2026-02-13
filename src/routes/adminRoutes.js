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

// Matrícula
router.post('/matricula/manual', auth('admin'), adminCtrl.matriculaManual);
router.post('/matricula/masiva', auth('admin'), adminCtrl.matriculaMasiva);

// Asistencia
router.post('/asistencia', auth('admin'), adminCtrl.registrarAsistencia);
router.post('/asistencia/inhabilitar-dia', auth('admin'), adminCtrl.inhabilitarDia);

// Exámenes y calificaciones
router.post('/examen', auth('admin'), adminCtrl.crearExamen);
router.post('/examen/:examenId/calificaciones', auth('admin'), adminCtrl.registrarCalificaciones);

module.exports = router;
