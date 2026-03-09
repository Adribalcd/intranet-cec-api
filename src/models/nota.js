const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Nota = sequelize.define('Nota', {
  id:        { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true },
  examen_id: { type: DataTypes.INTEGER },
  alumno_id: { type: DataTypes.INTEGER },
  valor:     { type: DataTypes.DECIMAL(7, 3) },
  buenas:    { type: DataTypes.INTEGER,       allowNull: true, defaultValue: null },
  malas:     { type: DataTypes.INTEGER,       allowNull: true, defaultValue: null },
  puesto:    { type: DataTypes.INTEGER },
}, { tableName: 'nota', timestamps: false });

module.exports = Nota;
