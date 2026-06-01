'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Banco de dados local para desenvolvimento
const dbPath = path.join(__dirname, 'battle-city.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao conectar DB:', err);
  else console.log('✓ SQLite conectado:', dbPath);
});

// ─── Inicializar tabelas ────────────────────────────────────────────────────
function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabela de usuários
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabela de partidas
      db.run(`
        CREATE TABLE IF NOT EXISTS matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id TEXT UNIQUE NOT NULL,
          winner_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          duration INTEGER,
          FOREIGN KEY(winner_id) REFERENCES users(id)
        )
      `);

      // Tabela de participação em partidas
      db.run(`
        CREATE TABLE IF NOT EXISTS match_players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          position INTEGER,
          score INTEGER DEFAULT 0,
          kills INTEGER DEFAULT 0,
          deaths INTEGER DEFAULT 0,
          survival_time INTEGER DEFAULT 0,
          FOREIGN KEY(match_id) REFERENCES matches(id),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);

      // Tabela de estatísticas gerais
      db.run(`
        CREATE TABLE IF NOT EXISTS player_stats (
          user_id INTEGER PRIMARY KEY,
          total_matches INTEGER DEFAULT 0,
          total_wins INTEGER DEFAULT 0,
          total_kills INTEGER DEFAULT 0,
          total_deaths INTEGER DEFAULT 0,
          win_rate REAL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('✓ Tabelas inicializadas');
          resolve();
        }
      });
    });
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ─── Operações de Usuário ───────────────────────────────────────────────────
async function createUser(username, email, passwordHash) {
  const result = await dbRun(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, passwordHash]
  );
  return result.lastID;
}

async function getUserByUsername(username) {
  return dbGet('SELECT * FROM users WHERE username = ?', [username]);
}

async function getUserById(id) {
  return dbGet('SELECT id, username, email, created_at FROM users WHERE id = ?', [id]);
}

// ─── Operações de Partidas ──────────────────────────────────────────────────
async function createMatch(matchId, duration) {
  const result = await dbRun(
    'INSERT INTO matches (match_id, duration) VALUES (?, ?)',
    [matchId, duration]
  );
  return result.lastID;
}

async function addPlayerToMatch(matchId, userId, position, score, kills, deaths, survivalTime) {
  await dbRun(
    `INSERT INTO match_players (match_id, user_id, position, score, kills, deaths, survival_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [matchId, userId, position, score, kills, deaths, survivalTime]
  );
}

async function setMatchWinner(matchId, winnerId) {
  await dbRun(
    'UPDATE matches SET winner_id = ? WHERE id = ?',
    [winnerId, matchId]
  );
}

async function getMatchHistory(userId, limit = 20) {
  return dbAll(
    `SELECT m.*, mp.position, mp.score, mp.kills, mp.deaths, mp.survival_time
     FROM matches m
     JOIN match_players mp ON m.id = mp.match_id
     WHERE mp.user_id = ?
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
}

async function getPlayerStats(userId) {
  let stats = await dbGet(
    'SELECT * FROM player_stats WHERE user_id = ?',
    [userId]
  );
  
  if (!stats) {
    stats = {
      user_id: userId,
      total_matches: 0,
      total_wins: 0,
      total_kills: 0,
      total_deaths: 0,
      win_rate: 0
    };
  }
  
  return stats;
}

async function updatePlayerStats(userId, matchData) {
  console.log('📊 updatePlayerStats:', { userId, matchData });
  
  const stats = await getPlayerStats(userId);
  console.log('📋 Stats atuais:', stats);
  
  const newStats = {
    total_matches: stats.total_matches + 1,
    total_wins: stats.total_wins + (matchData.won ? 1 : 0),
    total_kills: stats.total_kills + (matchData.kills || 0),
    total_deaths: stats.total_deaths + (matchData.deaths || 0),
  };
  newStats.win_rate = newStats.total_wins / newStats.total_matches;

  console.log('🆕 Novos stats:', newStats);

  await dbRun(
    `INSERT INTO player_stats (user_id, total_matches, total_wins, total_kills, total_deaths, win_rate)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
     total_matches = excluded.total_matches,
     total_wins = excluded.total_wins,
     total_kills = excluded.total_kills,
     total_deaths = excluded.total_deaths,
     win_rate = excluded.win_rate,
     updated_at = CURRENT_TIMESTAMP`,
    [userId, newStats.total_matches, newStats.total_wins, newStats.total_kills, newStats.total_deaths, newStats.win_rate]
  );
  
  console.log('✓ Stats salvas no DB para userId:', userId);
}

async function getGlobalLeaderboard(limit = 50) {
  return dbAll(
    `SELECT u.id, u.username, ps.total_wins, ps.total_kills, ps.total_matches, ps.win_rate
     FROM player_stats ps
     JOIN users u ON ps.user_id = u.id
     ORDER BY ps.total_wins DESC, ps.win_rate DESC
     LIMIT ?`,
    [limit]
  );
}

module.exports = {
  db,
  initDB,
  // Users
  createUser,
  getUserByUsername,
  getUserById,
  // Matches
  createMatch,
  addPlayerToMatch,
  setMatchWinner,
  getMatchHistory,
  getPlayerStats,
  updatePlayerStats,
  getGlobalLeaderboard,
};
