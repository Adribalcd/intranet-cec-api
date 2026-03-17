require('dotenv').config();
const bcrypt    = require('bcryptjs');
const sequelize = require('./src/config/database');
const Admin     = require('./src/models/admin');

const USUARIO   = 'admin';
const PASSWORD  = 'cec@Adm!n#7x2026';

(async () => {
  try {
    await sequelize.authenticate();
    const hash = await bcrypt.hash(PASSWORD, 12);
    const [admin, created] = await Admin.findOrCreate({
      where: { usuario: USUARIO },
      defaults: { contrasena: hash, nombre: 'Administrador', rol: 'general' },
    });

    if (!created) {
      await admin.update({ contrasena: hash, rol: 'general' });
      console.log(`✅ Admin actualizado → usuario: ${USUARIO} | rol: general`);
    } else {
      console.log(`✅ Admin creado      → usuario: ${USUARIO} | rol: general`);
    }
    console.log(`   Contraseña: ${PASSWORD}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await sequelize.close();
  }
})();
