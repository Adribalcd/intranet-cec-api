const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ciclo = sequelize.define('Ciclo', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombres: { type: DataTypes.STRING(50), allowNull: false },
  fecha_inicio: { type: DataTypes.DATE, allowNull: false },
  fecha_fin: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'ciclo', timestamps: false });

module.exports = Ciclo;