const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ConfigPagosCiclo = sequelize.define('ConfigPagosCiclo', {
  id:                    { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ciclo_id:              { type: DataTypes.INTEGER, allowNull: false, unique: true },
  pagos_visible:         { type: DataTypes.BOOLEAN, defaultValue: false },
  permite_transferencia: { type: DataTypes.BOOLEAN, defaultValue: false },
  permite_yape_plin:     { type: DataTypes.BOOLEAN, defaultValue: false },
  bcp_cuenta:            { type: DataTypes.STRING(80),  allowNull: true },
  bcp_cci:               { type: DataTypes.STRING(80),  allowNull: true },
  bbva_cuenta:           { type: DataTypes.STRING(80),  allowNull: true },
  bbva_cci:              { type: DataTypes.STRING(80),  allowNull: true },
  interbank_cuenta:      { type: DataTypes.STRING(80),  allowNull: true },
  interbank_cci:         { type: DataTypes.STRING(80),  allowNull: true },
  yape_numero:           { type: DataTypes.STRING(20),  allowNull: true },
  plin_numero:           { type: DataTypes.STRING(20),  allowNull: true },
  yape_qr_url:           { type: DataTypes.STRING(400), allowNull: true },
  plin_qr_url:           { type: DataTypes.STRING(400), allowNull: true },
  whatsapp_numero:       { type: DataTypes.STRING(20),  allowNull: true,
                           comment: 'Número WhatsApp para contacto de pagos (sin +, ej: 51924513040)' },
}, { tableName: 'config_pagos_ciclo', timestamps: false });

module.exports = ConfigPagosCiclo;
