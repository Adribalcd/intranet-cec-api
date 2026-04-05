const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ciclo = sequelize.define('Ciclo', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nombres: { type: DataTypes.STRING(50), allowNull: false },
  fecha_inicio: { type: DataTypes.DATE, allowNull: false },
  fecha_fin: { type: DataTypes.DATE, allowNull: false },
  // Configuración de turno tarde (opcional por ciclo)
  tiene_tarde:        { type: DataTypes.BOOLEAN, defaultValue: false },
  hora_tarde_inicio:  { type: DataTypes.STRING(8), allowNull: true },  // HH:MM
  hora_tarde_puntual: { type: DataTypes.STRING(8), allowNull: true },  // HH:MM
}, { tableName: 'ciclo', timestamps: false });

module.exports = Ciclo;