const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Asistencia = sequelize.define('Asistencia', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  alumno_id: { type: DataTypes.INTEGER },
  ciclo_id: { type: DataTypes.INTEGER },
  fecha_hora: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  estado: { type: DataTypes.STRING(20) },
  observaciones: { type: DataTypes.STRING(255) },
}, { tableName: 'asistencia', timestamps: false });

module.exports = Asistencia;
