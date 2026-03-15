const { verificarToken } = require('../utils/tokenUtils');

/**
 * authMiddleware(rol, allowedAdminRoles?)
 *
 * rol              — 'admin' | 'alumno'
 * allowedAdminRoles — array de subroles permitidos: ['general','academico','pagos']
 *                     Si se omite → cualquier subrol de admin pasa.
 *
 * Ejemplos:
 *   auth('admin')                              → cualquier admin
 *   auth('admin', ['general','pagos'])          → solo general y pagos (bloquea academico)
 *   auth('admin', ['general','academico'])      → solo general y academico (bloquea pagos)
 */
function authMiddleware(rol, allowedAdminRoles = null) {
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
      // Restricción de subrol admin
      if (rol === 'admin' && allowedAdminRoles && allowedAdminRoles.length) {
        const subrole = decoded.rolAdmin || 'general';
        if (!allowedAdminRoles.includes(subrole)) {
          return res.status(403).json({ error: 'Tu rol no tiene acceso a este módulo' });
        }
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
