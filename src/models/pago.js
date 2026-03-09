const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pago = sequelize.define('Pago', {
  id:                { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  alumno_id:         { type: DataTypes.INTEGER, allowNull: false },
  concepto_id:       { type: DataTypes.INTEGER, allowNull: false },
  monto_pagado:      { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  opcion_pago:       { type: DataTypes.STRING(20), defaultValue: 'opcion_1' },
  metodo_pago:       { type: DataTypes.ENUM('Yape', 'Transferencia', 'Efectivo'), allowNull: false },
  fecha_pago:        { type: DataTypes.DATEONLY, allowNull: false },
  visible_alumno:    { type: DataTypes.BOOLEAN, defaultValue: false },
  observaciones:     { type: DataTypes.TEXT, allowNull: true },
  numero_operacion:  { type: DataTypes.STRING(60), allowNull: true },
}, { tableName: 'pago', timestamps: false });

module.exports = Pago;
