const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlantillaSeccion = sequelize.define('PlantillaSeccion', {
  id:           { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true },
  plantilla_id: { type: DataTypes.INTEGER,      allowNull: false },
  nombre:       { type: DataTypes.STRING(80),   allowNull: false },
  orden:        { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0 },
}, { tableName: 'plantilla_seccion', timestamps: false });

module.exports = PlantillaSeccion;
