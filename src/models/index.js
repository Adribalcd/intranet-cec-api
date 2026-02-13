const sequelize = require('../config/database');
const Alumno = require('./alumno');
const Admin = require('./admin');
const Ciclo = require('./ciclo');
const Curso = require('./curso');
const HorarioCurso = require('./horarioCurso');
const Material = require('./material');
const Examen = require('./examen');
const Nota = require('./nota');
const Asistencia = require('./asistencia');
const Matricula = require('./matricula');

// Asociaciones
Ciclo.hasMany(Curso, { foreignKey: 'ciclo_id' });
Curso.belongsTo(Ciclo, { foreignKey: 'ciclo_id' });

Curso.hasMany(HorarioCurso, { foreignKey: 'curso_id' });
HorarioCurso.belongsTo(Curso, { foreignKey: 'curso_id' });

Curso.hasMany(Material, { foreignKey: 'curso_id' });
Material.belongsTo(Curso, { foreignKey: 'curso_id' });

Ciclo.hasMany(Examen, { foreignKey: 'ciclo_id' });
Examen.belongsTo(Ciclo, { foreignKey: 'ciclo_id' });

Examen.hasMany(Nota, { foreignKey: 'examen_id' });
Nota.belongsTo(Examen, { foreignKey: 'examen_id' });

Alumno.hasMany(Nota, { foreignKey: 'alumno_id' });
Nota.belongsTo(Alumno, { foreignKey: 'alumno_id' });

Alumno.hasMany(Asistencia, { foreignKey: 'alumno_id' });
Asistencia.belongsTo(Alumno, { foreignKey: 'alumno_id' });

Ciclo.hasMany(Asistencia, { foreignKey: 'ciclo_id' });
Asistencia.belongsTo(Ciclo, { foreignKey: 'ciclo_id' });

Alumno.hasMany(Matricula, { foreignKey: 'alumno_id' });
Matricula.belongsTo(Alumno, { foreignKey: 'alumno_id' });

Ciclo.hasMany(Matricula, { foreignKey: 'ciclo_id' });
Matricula.belongsTo(Ciclo, { foreignKey: 'ciclo_id' });

module.exports = {
  sequelize,
  Alumno,
  Admin,
  Ciclo,
  Curso,
  HorarioCurso,
  Material,
  Examen,
  Nota,
  Asistencia,
  Matricula,
};
