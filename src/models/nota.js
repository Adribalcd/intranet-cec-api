const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Nota = sequelize.define('Nota', {
  id:        { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true },
  examen_id: { type: DataTypes.INTEGER },
  alumno_id: { type: DataTypes.INTEGER },
  valor:     { type: DataTypes.DECIMAL(7, 3) },
  buenas:    { type: DataTypes.INTEGER,       allowNull: true, defaultValue: null },
  malas:     { type: DataTypes.INTEGER,       allowNull: true, defaultValue: null },
  nc:        { type: DataTypes.INTEGER,       allowNull: true, defaultValue: null },
  puesto:    { type: DataTypes.INTEGER },
  // Campos para simulacros por área (Excel OMR)
  area:      { type: DataTypes.CHAR(1),       allowNull: true, defaultValue: null },
  carrera:   { type: DataTypes.STRING(80),    allowNull: true, defaultValue: null },
  aula:      { type: DataTypes.STRING(30),    allowNull: true, defaultValue: null },
}, { tableName: 'nota', timestamps: false });

module.exports = Nota;
