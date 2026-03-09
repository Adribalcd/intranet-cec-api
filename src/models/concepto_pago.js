const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ConceptoPago = sequelize.define('ConceptoPago', {
  id:                { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ciclo_id:          { type: DataTypes.INTEGER, allowNull: false },
  tipo:              { type: DataTypes.ENUM('mensualidad', 'matricula', 'materiales', 'otro'), defaultValue: 'mensualidad' },
  descripcion:       { type: DataTypes.STRING(120), allowNull: false },
  mes:               { type: DataTypes.INTEGER, allowNull: true },
  anio:              { type: DataTypes.INTEGER, allowNull: true },
  monto_opcion_1:    { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  etiqueta_opcion_1: { type: DataTypes.STRING(60), defaultValue: 'Tarifa A' },
  monto_opcion_2:    { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  etiqueta_opcion_2: { type: DataTypes.STRING(60), allowNull: true },
  fecha_vencimiento:    { type: DataTypes.DATEONLY, allowNull: true },
  orden:                { type: DataTypes.INTEGER, defaultValue: 0 },
  permite_pago_online:  { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'concepto_pago', timestamps: false });

module.exports = ConceptoPago;
