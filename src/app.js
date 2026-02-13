require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const alumnoRoutes = require('./routes/alumnoRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.get('/', (req, res) => {
  res.json({ message: 'API Intranet CEC funcionando' });
});

app.use('/api/alumno', alumnoRoutes);
app.use('/api/admin', adminRoutes);

// Conexión a BD y arranque del servidor
const PORT = process.env.PORT || 3000;

sequelize
  .authenticate()
  .then(() => {
    console.log('Conexión a MySQL establecida');
    app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('Error al conectar a MySQL:', err.message);
  });

module.exports = app;
