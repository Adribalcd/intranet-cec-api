require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Admin } = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✓ Conexión con la base de datos establecida.');

    // Sincronizar solo la tabla Admin (sin borrar todo lo demás)
    // Usamos alter: true para no perder datos si la tabla ya existe
    await Admin.sync({ alter: true });

    // =========================================================
    // CONFIGURACIÓN DE SEGURIDAD ALTA
    // =========================================================
    // RECOMENDACIÓN: Usa un generador de contraseñas (ej. 32 caracteres)
    const ADMIN_USER = 'admin_cecamargo_secure_2026'; 
    const ADMIN_PASS = 'K8#zP2$mQ9!vL5*nR4^xJ1@bW7&tY3'; 
    
    // Generar Hash con 12 rounds de salting para mayor seguridad
    const saltRounds = 12;
    const hash = await bcrypt.hash(ADMIN_PASS, saltRounds);

    // Limpiar administradores previos para evitar duplicados si es necesario
    await Admin.destroy({ where: {}, truncate: true, cascade: false });

    // Crear el único Super Admin
    await Admin.create({
      usuario: ADMIN_USER,
      contrasena: hash,
    });

    console.log('\n======================================');
    console.log('   SISTEMA DE CREDENCIALES INICIADO   ');
    console.log('======================================');
    console.log(`Usuario:    ${ADMIN_USER}`);
    console.log(`Password:   ${ADMIN_PASS}`);
    console.log('ESTADO:     Guardado con Hash BCrypt (12 rounds)');
    console.log('======================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error crítico en el seed de seguridad:', error);
    process.exit(1);
  }
}

seed();