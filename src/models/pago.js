const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pago = sequelize.define('Pago', {
  id:                { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  alumno_id:         { type: DataTypes.INTEGER, allowNull: false },
  concepto_id:       { type: DataTypes.INTEGER, allowNull: false },
  monto_pagado:      { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  opcion_pago:       { type: DataTypes.STRING(20), defaultValue: 'opcion_1' },
  metodo_pago:       { type: DataTypes.ENUM('Yape', 'Plin', 'Transferencia', 'Efectivo'), allowNull: false },
  fecha_pago:        { type: DataTypes.DATEONLY, allowNull: false },
  visible_alumno:    { type: DataTypes.BOOLEAN, defaultValue: false },
  observaciones:     { type: DataTypes.TEXT, allowNull: true },
  numero_operacion:  { type: DataTypes.STRING(60), allowNull: true },
  estado:            { type: DataTypes.ENUM('confirmado', 'pendiente', 'rechazado'), defaultValue: 'confirmado' },
  tipo_registro:     { type: DataTypes.ENUM('admin', 'online'), defaultValue: 'admin' },
  codigo_recibo:     { type: DataTypes.STRING(60), allowNull: true, defaultValue: null,
                       comment: 'Código o número de recibo físico entregado al alumno' },
}, { tableName: 'pago', timestamps: false });

module.exports = Pago;
