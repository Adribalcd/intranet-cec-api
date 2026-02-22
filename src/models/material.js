const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// SQL para TiDB Cloud (ejecutar una sola vez si la tabla ya existe):
// ALTER TABLE material ADD COLUMN url_drive VARCHAR(500) NULL;

const Material = sequelize.define('Material', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  curso_id: { type: DataTypes.INTEGER },
  semana: { type: DataTypes.INTEGER, allowNull: false },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  url_archivo: { type: DataTypes.STRING(255) },
  url_drive: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: 'material', timestamps: false });

module.exports = Material;
