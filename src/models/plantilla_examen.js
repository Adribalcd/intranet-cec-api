const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PlantillaExamen = sequelize.define('PlantillaExamen', {
  id:              { type: DataTypes.INTEGER,                                        autoIncrement: true, primaryKey: true },
  nombre:          { type: DataTypes.STRING(100),  allowNull: false },
  descripcion:     { type: DataTypes.TEXT,          allowNull: true,  defaultValue: null },
  tipo_calculo:    { type: DataTypes.ENUM('buenas_malas', 'nota_directa'), allowNull: false, defaultValue: 'buenas_malas' },
  tiene_secciones: { type: DataTypes.TINYINT,       allowNull: false, defaultValue: 0 },
  activo:          { type: DataTypes.TINYINT,       allowNull: false, defaultValue: 1 },
}, { tableName: 'plantilla_examen', timestamps: false });

module.exports = PlantillaExamen;
