'use strict';

/**
 * Script para modificar la base de datos:
 * 1. Agrega la columna 'respuestas' a la tabla 'nota_curso'.
 * 2. ELIMINA todas las notas existentes (tablas 'nota' y 'nota_curso') 
 *    para permitir una nueva carga de datos limpia.
 */

const { sequelize, Nota, NotaCurso } = require('./src/models');
const { QueryInterface, DataTypes } = require('sequelize');

async function run() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('--- Iniciando script de modificación y limpieza ---');

  try {
    // 1. Modificar la estructura de la tabla nota_curso
    console.log('Verificando columna "respuestas" en nota_curso...');
    const tableInfo = await queryInterface.describeTable('nota_curso');
    
    if (!tableInfo.respuestas) {
      console.log('Agregando columna "respuestas" a nota_curso...');
      await queryInterface.addColumn('nota_curso', 'respuestas', {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null
      });
      console.log('✓ Columna "respuestas" agregada con éxito.');
    } else {
      console.log('ℹ La columna "respuestas" ya existe.');
    }

    // 2. Limpiar datos de notas
    console.log('Eliminando registros de nota_curso y nota...');
    
    // Desactivar temporalmente el chequeo de llaves foráneas para limpieza masiva si es necesario
    // Aunque Sequelize maneja el orden si lo hacemos manual:
    await NotaCurso.destroy({ where: {}, truncate: false });
    console.log('✓ Registros de nota_curso eliminados.');
    
    await Nota.destroy({ where: {}, truncate: false });
    console.log('✓ Registros de nota eliminados.');

    console.log('--- Proceso completado exitosamente ---');
    process.exit(0);
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    process.exit(1);
  }
}

run();
