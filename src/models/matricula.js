const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// SQL para TiDB Cloud (ejecutar una sola vez si la tabla ya existe):
// ALTER TABLE matricula ADD UNIQUE INDEX uk_alumno_ciclo (alumno_id, ciclo_id);

const Matricula = sequelize.define('Matricula', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  alumno_id: { type: DataTypes.INTEGER },
  ciclo_id: { type: DataTypes.INTEGER },
  fecha_registro: { type: DataTypes.DATEONLY },
}, {
  tableName: 'matricula',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['alumno_id', 'ciclo_id'], name: 'uk_alumno_ciclo' },
  ],
});

module.exports = Matricula;
