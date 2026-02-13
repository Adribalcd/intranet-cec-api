const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alumno = sequelize.define('Alumno', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  codigo: { type: DataTypes.STRING(20), unique: true, allowNull: false },
  nombres: { type: DataTypes.STRING(50), allowNull: false },
  apellidos: { type: DataTypes.STRING(50), allowNull: false },
  email_alumno: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  contrasena: { type: DataTypes.STRING(255), allowNull: false },
  foto_url: { type: DataTypes.STRING(255), defaultValue: 'https://via.placeholder.com/150' },
  celular: { type: DataTypes.STRING(15) },
}, { tableName: 'alumno', timestamps: false });

module.exports = Alumno;
