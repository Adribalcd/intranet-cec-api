const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// SQL para TiDB Cloud (ejecutar una sola vez si la tabla ya existe):
// ALTER TABLE alumno ADD COLUMN dni VARCHAR(15) NULL;
// ALTER TABLE alumno ADD COLUMN fecha_nacimiento DATE NULL;

const Alumno = sequelize.define('Alumno', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  codigo: { type: DataTypes.STRING(20), unique: true, allowNull: false },
  nombres: { type: DataTypes.STRING(50), allowNull: false },
  apellidos: { type: DataTypes.STRING(50), allowNull: false },
  email_alumno: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  contrasena: { type: DataTypes.STRING(255), allowNull: false },
  foto_url: { type: DataTypes.STRING(255), defaultValue: 'https://via.placeholder.com/150' },
  celular: { type: DataTypes.STRING(15) },
  dni: { type: DataTypes.STRING(15), allowNull: true },
  fecha_nacimiento: { type: DataTypes.DATEONLY, allowNull: true },
  suspendido:  { type: DataTypes.BOOLEAN, defaultValue: false },
  es_escolar:  { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false,
                 comment: 'true = alumno de modalidad escolaridad (10 cuotas × S/70)' },
}, { tableName: 'alumno', timestamps: false });

module.exports = Alumno;
