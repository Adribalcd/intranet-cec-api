const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Examen = sequelize.define('Examen', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ciclo_id: { type: DataTypes.INTEGER },
  semana: { type: DataTypes.INTEGER },
  tipo_examen: { type: DataTypes.STRING(50) },
  fecha: { type: DataTypes.DATEONLY },
  cantidad_preguntas: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
}, { tableName: 'examen', timestamps: false });

module.exports = Examen;
