const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Curso = sequelize.define('Curso', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombre: { type: DataTypes.STRING(50), allowNull: false },
  profesor: { type: DataTypes.STRING(50), allowNull: false },
  ciclo_id: { type: DataTypes.INTEGER },
}, { tableName: 'curso', timestamps: false });

module.exports = Curso;
