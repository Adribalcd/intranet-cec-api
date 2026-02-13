const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'cec_camargo_secret_key';

const tokenBlacklist = new Set();

function generarToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

function verificarToken(token) {
  if (tokenBlacklist.has(token)) return null;
  return jwt.verify(token, SECRET);
}

function invalidarToken(token) {
  tokenBlacklist.add(token);
}

module.exports = { generarToken, verificarToken, invalidarToken };
