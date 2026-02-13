const { verificarToken } = require('../utils/tokenUtils');

function authMiddleware(rol) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = header.split(' ')[1];
    try {
      const decoded = verificarToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
      if (rol && decoded.rol !== rol) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      req.usuario = decoded;
      req.token = token;
      next();
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
}

module.exports = authMiddleware;
