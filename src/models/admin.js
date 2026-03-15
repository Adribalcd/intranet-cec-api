const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  usuario:    { type: DataTypes.STRING(50), unique: true, allowNull: false },
  contrasena: { type: DataTypes.STRING(255), allowNull: false },
  nombre:     { type: DataTypes.STRING(80), allowNull: true, defaultValue: null },
  rol:        { type: DataTypes.ENUM('general', 'academico', 'pagos'),
                allowNull: false, defaultValue: 'general',
                comment: 'general=acceso total | academico=sin pagos | pagos=solo pagos' },
}, { tableName: 'admin', timestamps: false });

module.exports = Admin;
