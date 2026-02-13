const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Material = sequelize.define('Material', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  curso_id: { type: DataTypes.INTEGER },
  semana: { type: DataTypes.INTEGER, allowNull: false },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  url_archivo: { type: DataTypes.STRING(255) },
}, { tableName: 'material', timestamps: false });

module.exports = Material;
