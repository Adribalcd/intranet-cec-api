const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  usuario: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  contrasena: { type: DataTypes.STRING(255), allowNull: false },
}, { tableName: 'admin', timestamps: false });

module.exports = Admin;
