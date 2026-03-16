const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlantillaCurso = sequelize.define('PlantillaCurso', {
  id:                 { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true },
  plantilla_id:       { type: DataTypes.INTEGER,      allowNull: false },
  seccion_id:         { type: DataTypes.INTEGER,      allowNull: true,  defaultValue: null },
  nombre:             { type: DataTypes.STRING(80),   allowNull: false },
  cantidad_preguntas: { type: DataTypes.INTEGER,      allowNull: true,  defaultValue: null },
  puntaje_buena:      { type: DataTypes.DECIMAL(6,3), allowNull: false, defaultValue: 4.000 },
  puntaje_mala:       { type: DataTypes.DECIMAL(6,3), allowNull: false, defaultValue: 1.000 },
  orden:              { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0 },
}, { tableName: 'plantilla_curso', timestamps: false });

module.exports = PlantillaCurso;
