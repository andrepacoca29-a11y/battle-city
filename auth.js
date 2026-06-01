'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Secret para JWT - em produção, usar variável de ambiente
const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-muito-seguro-aqui-mude-em-producao';

// ─── Hash de Senha ──────────────────────────────────────────────────────────
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─── JWT ────────────────────────────────────────────────────────────────────
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ─── Registro ───────────────────────────────────────────────────────────────
async function register(username, email, password) {
  // Validações
  if (!username || username.length < 3) {
    throw new Error('Username deve ter pelo menos 3 caracteres');
  }
  if (!password || password.length < 6) {
    throw new Error('Senha deve ter pelo menos 6 caracteres');
  }

  // Verificar se usuário já existe
  const existing = await db.getUserByUsername(username);
  if (existing) {
    throw new Error('Usuário já existe');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Criar usuário
  const userId = await db.createUser(username, email || null, passwordHash);
  const token = generateToken(userId);

  return {
    userId,
    username,
    token,
  };
}

// ─── Login ──────────────────────────────────────────────────────────────────
async function login(username, password) {
  // Buscar usuário
  const user = await db.getUserByUsername(username);
  if (!user) {
    throw new Error('Usuário ou senha inválidos');
  }

  // Verificar senha
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('Usuário ou senha inválidos');
  }

  // Gerar token
  const token = generateToken(user.id);

  return {
    userId: user.id,
    username: user.username,
    token,
  };
}

// ─── Middleware de Autenticação ─────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Token ausente' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ ok: false, error: 'Token inválido ou expirado' });
  }

  req.userId = decoded.userId;
  next();
}

// ─── Socket.io Middleware ───────────────────────────────────────────────────
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Token ausente'));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Token inválido'));
  }

  socket.userId = decoded.userId;
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  register,
  login,
  authMiddleware,
  socketAuthMiddleware,
};
