require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const alumnoRoutes = require('./routes/alumnoRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ── Logger de requests ────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const contentLength = req.headers['content-length'];
  console.log(`→ ${req.method} ${req.originalUrl}${contentLength ? ` [${(contentLength / 1024).toFixed(1)} KB]` : ''}`);
  res.on('finish', () => {
    const ms = Date.now() - start;
    const icon = res.statusCode >= 500 ? '💥' : res.statusCode >= 400 ? '⚠️' : '✓';
    console.log(`${icon} ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Servir archivos estáticos (fotos de alumnos)
// Usa UPLOADS_PATH si está configurado (para persistencia en producción)
const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// ── Error handler global ──────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`💥 Error no manejado en ${req.method} ${req.originalUrl}:`, err.message);
  res.status(500).json({ error: err.message });
});

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
    console.log('✓ Conexión a MySQL establecida');
    console.log(`  IMAGE_SERVICE_URL : ${process.env.IMAGE_SERVICE_URL || '(no configurado — modo local)'}`);
    console.log(`  BASE_URL          : ${process.env.BASE_URL || '(no configurado)'}`);
    console.log(`  INTRANET_URL      : ${process.env.INTRANET_URL || '(no configurado)'}`);
    console.log(`  SMTP_USER         : ${process.env.SMTP_USER || '(no configurado)'}`);
    app.listen(PORT, () => console.log(`✓ Servidor en puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('💥 Error al conectar a MySQL:', err.message);
  });

module.exports = app;
