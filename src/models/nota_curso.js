const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * NotaCurso — puntaje detallado por curso/área para exámenes de simulacro
 * Cada nota (Nota) puede tener N filas aquí, una por curso evaluado.
 */
const NotaCurso = sequelize.define('NotaCurso', {
  id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nota_id:     { type: DataTypes.INTEGER, allowNull: false },
  curso_nombre:{ type: DataTypes.STRING(80), allowNull: false },
  buenas:      { type: DataTypes.INTEGER,       defaultValue: 0 },
  malas:       { type: DataTypes.INTEGER,       defaultValue: 0 },
  nc:          { type: DataTypes.INTEGER,       defaultValue: 0 },
  puntaje:     { type: DataTypes.DECIMAL(10,3), allowNull: true },
}, { tableName: 'nota_curso', timestamps: false });

module.exports = NotaCurso;
