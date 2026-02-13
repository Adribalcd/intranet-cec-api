const { Router } = require('express');
const router = Router();
const alumnoCtrl = require('../controllers/alumnoController');
const auth = require('../middlewares/authMiddleware');

// Públicas
router.post('/login', alumnoCtrl.login);
router.post('/recuperar-password', alumnoCtrl.recuperarPassword);
router.post('/reset-password', alumnoCtrl.resetPassword);

// Protegidas
router.get('/perfil', auth('alumno'), alumnoCtrl.perfil);
router.get('/horario', auth('alumno'), alumnoCtrl.horario);
router.get('/asistencia', auth('alumno'), alumnoCtrl.asistencia);
router.get('/calificaciones', auth('alumno'), alumnoCtrl.calificaciones);
router.get('/cursos', auth('alumno'), alumnoCtrl.cursos);
router.get('/cursos/:idCurso/materiales', auth('alumno'), alumnoCtrl.materiales);
router.post('/logout', auth('alumno'), alumnoCtrl.logout);

module.exports = router;
