const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HorarioCurso = sequelize.define('HorarioCurso', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  curso_id: { type: DataTypes.INTEGER },
  dia_semana: { type: DataTypes.STRING(15), allowNull: false },
  hora_inicio: { type: DataTypes.TIME },
  hora_fin: { type: DataTypes.TIME },
}, { tableName: 'horario_curso', timestamps: false });

module.exports = HorarioCurso;
