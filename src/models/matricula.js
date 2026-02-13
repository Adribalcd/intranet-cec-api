const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Matricula = sequelize.define('Matricula', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  alumno_id: { type: DataTypes.INTEGER },
  ciclo_id: { type: DataTypes.INTEGER },
  fecha_registro: { type: DataTypes.DATEONLY },
}, { tableName: 'matricula', timestamps: false });

module.exports = Matricula;
