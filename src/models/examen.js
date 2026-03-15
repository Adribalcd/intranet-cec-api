const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Examen = sequelize.define('Examen', {
  id:                     { type: DataTypes.INTEGER,       autoIncrement: true, primaryKey: true },
  ciclo_id:               { type: DataTypes.INTEGER },
  semana:                 { type: DataTypes.INTEGER },
  tipo_examen:            { type: DataTypes.STRING(50) },
  subtipo_examen:         { type: DataTypes.STRING(80),    allowNull: true,  defaultValue: null },
  fecha:                  { type: DataTypes.DATEONLY },
  cantidad_preguntas:     { type: DataTypes.INTEGER,        allowNull: true,  defaultValue: null },
  puntaje_pregunta_buena: { type: DataTypes.DECIMAL(5, 3),  allowNull: false, defaultValue: 4.00 },
  puntaje_pregunta_mala:  { type: DataTypes.DECIMAL(5, 3),  allowNull: false, defaultValue: 1.00 },
  // Campos para simulacros OMR por área
  area:                   { type: DataTypes.CHAR(1),        allowNull: true,  defaultValue: null },
  ponderaciones_json:     { type: DataTypes.TEXT,           allowNull: true,  defaultValue: null },
}, { tableName: 'examen', timestamps: false });

module.exports = Examen;
