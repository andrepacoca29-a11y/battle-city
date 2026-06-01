'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const db = require('./db');
const auth = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 5000,
  pingTimeout: 10000,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar banco de dados
db.initDB().catch(err => {
  console.error('Erro ao inicializar DB:', err);
  process.exit(1);
});

// ─── Constants ────────────────────────────────────────────────────────────────
const TICK_RATE        = 30;          // server ticks per second
const TILE            = 32;          // pixels per tile
const MAP_COLS        = 26;
const MAP_ROWS        = 26;
const TANK_SIZE       = 28;
const BULLET_SPEED    = 16;           // tiles/s * (TILE/TICK_RATE)  → px per tick
const TANK_SPEED      = 2.2;         // px per tick
const MAX_PLAYERS     = 6;
const RESPAWN_DELAY   = 3000;        // ms
const POWERUP_INTERVAL= 12000;       // ms
const POWERUP_DURATION= 10000;       // ms for shield / extra-bullets

// ─── Map Templates ───────────────────────────────────────────────────────────
// 0=empty 1=brick 2=steel
function buildMap() {
  const M = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(0));

  // border steel
  for (let c = 0; c < MAP_COLS; c++) { M[0][c] = 2; M[MAP_ROWS-1][c] = 2; }
  for (let r = 0; r < MAP_ROWS; r++) { M[r][0] = 2; M[r][MAP_COLS-1] = 2;  }

  // interior pattern — symmetric brick clusters
  const brickZones = [
    [2,2],[2,3],[3,2],[3,3],
    [2,10],[2,11],[3,10],[3,11],
    [2,14],[2,15],[3,14],[3,15],
    [2,22],[2,23],[3,22],[3,23],
    [6,2],[6,3],[7,2],[7,3],
    [6,6],[6,7],[7,6],[7,7],
    [6,10],[6,11],[7,10],[7,11],
    [6,14],[6,15],[7,14],[7,15],
    [6,18],[6,19],[7,18],[7,19],
    [6,22],[6,23],[7,22],[7,23],
    [10,2],[10,3],[11,2],[11,3],
    [10,6],[10,7],[11,6],[11,7],
    [10,10],[10,11],[11,10],[11,11],
    [10,14],[10,15],[11,14],[11,15],
    [10,18],[10,19],[11,18],[11,19],
    [10,22],[10,23],[11,22],[11,23],
    [14,2],[14,3],[15,2],[15,3],
    [14,6],[14,7],[15,6],[15,7],
    [14,10],[14,11],[15,10],[15,11],
    [14,14],[14,15],[15,14],[15,15],
    [14,18],[14,19],[15,18],[15,19],
    [14,22],[14,23],[15,22],[15,23],
    [18,2],[18,3],[19,2],[19,3],
    [18,6],[18,7],[19,6],[19,7],
    [18,10],[18,11],[19,10],[19,11],
    [18,14],[18,15],[19,14],[19,15],
    [18,18],[18,19],[19,18],[19,19],
    [18,22],[18,23],[19,22],[19,23],
    [22,2],[22,3],[23,2],[23,3],
    [22,10],[22,11],[23,10],[23,11],
    [22,14],[22,15],[23,14],[23,15],
    [22,22],[22,23],[23,22],[23,23],
  ];
  const steelZones = [
    [5,5],[5,20],[20,5],[20,20],
    [12,12],[13,12],[12,13],[13,13],
  ];

  for (const [r,c] of brickZones) if (r>0&&r<MAP_ROWS-1&&c>0&&c<MAP_COLS-1) M[r][c]=1;
  for (const [r,c] of steelZones) if (r>0&&r<MAP_ROWS-1&&c>0&&c<MAP_COLS-1) M[r][c]=2;

  return M;
}

// ─── Spawn Positions ─────────────────────────────────────────────────────────
const SPAWNS = [
  { x: 1*TILE+2, y: 1*TILE+2, dir: 'down'  },
  { x: 24*TILE+2,y: 1*TILE+2, dir: 'down'  },
  { x: 1*TILE+2, y: 24*TILE+2,dir: 'up'    },
  { x: 24*TILE+2,y: 24*TILE+2,dir: 'up'    },
  { x: 12*TILE+2,y: 1*TILE+2, dir: 'down'  },
  { x: 12*TILE+2,y: 24*TILE+2,dir: 'up'    },
];

const COLORS = ['#f7c948','#4ecdc4','#ff6b6b','#a8e6cf','#f8a5c2','#c3a6ff'];

// ─── Utilities ────────────────────────────────────────────────────────────────
function randId(len = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function rectOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}
function tileAt(map, px, py) {
  const col = Math.floor(px / TILE);
  const row = Math.floor(py / TILE);
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return 2;
  return map[row][col];
}
function clearTile(map, col, row) {
  if (row>0&&row<MAP_ROWS-1&&col>0&&col<MAP_COLS-1 && map[row][col]===1) {
    map[row][col] = 0;
    return true;
  }
  return false;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
const rooms = new Map(); // id → RoomState

class RoomState {
  constructor(id) {
    this.id         = id;
    this.map        = buildMap();
    this.players    = new Map();   // socketId → PlayerState
    this.bullets    = new Map();   // bulletId → BulletState
    this.powerups   = new Map();   // powerupId → PowerupState
    this.bulletSeq  = 0;
    this.powerupSeq = 0;
    this.roundOver  = false;
    this.tick       = 0;
    this.interval   = setInterval(() => this.update(), 1000 / TICK_RATE);
    this.powerupTimer = setTimeout(() => this.spawnPowerup(), POWERUP_INTERVAL);
  }

  destroy() {
    clearInterval(this.interval);
    clearTimeout(this.powerupTimer);
  }

  addPlayer(socketId, userId, username) {
    const idx   = this.players.size % MAX_PLAYERS;
    const spawn = SPAWNS[idx];
    const p = {
      id:         socketId,
      userId:     userId,
      username:   username,
      x:          spawn.x,
      y:          spawn.y,
      dir:        spawn.dir,
      color:      COLORS[idx],
      hp:         3,
      shield:     false,
      shieldTimer:0,
      extraBullets:false,
      extraTimer: 0,
      maxBullets: 2,
      bulletCount:0,
      alive:      true,
      disconnected: false,
      inputs:     { up:false, down:false, left:false, right:false, fire:false },
      fireCooldown: 0,
      spawnProtection: 120,  // ticks
      kills:      0,
      deaths:     0,
    };
    this.players.set(socketId, p);
    return p;
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (p) {
      p.disconnected = true;
      p.alive = false; // ghost obstacle
    }
  }

  applyInput(socketId, inputs) {
    const p = this.players.get(socketId);
    if (!p || !p.alive || p.disconnected) return;
    p.inputs = inputs;
  }

  // ── Main Update Loop ───────────────────────────────────────────────────────
  update() {
    this.tick++;

    // move tanks
    for (const p of this.players.values()) {
      if (!p.alive || p.disconnected) continue;
      if (p.spawnProtection > 0) p.spawnProtection--;

      const { up, down, left, right, fire } = p.inputs;
      let dx = 0, dy = 0;
      if      (up)    { dy = -TANK_SPEED; p.dir = 'up';    }
      else if (down)  { dy =  TANK_SPEED; p.dir = 'down';  }
      else if (left)  { dx = -TANK_SPEED; p.dir = 'left';  }
      else if (right) { dx =  TANK_SPEED; p.dir = 'right'; }

      if (dx !== 0 || dy !== 0) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (this.canMoveTo(p, nx, ny)) { p.x = nx; p.y = ny; }
        else {
          // try sliding: one axis at a time
          if (dx !== 0 && this.canMoveTo(p, nx, p.y)) p.x = nx;
          else if (dy !== 0 && this.canMoveTo(p, p.x, ny)) p.y = ny;
        }
      }

      // fire
      if (p.fireCooldown > 0) p.fireCooldown--;
      if (fire && p.fireCooldown === 0 && p.bulletCount < p.maxBullets) {
        this.spawnBullet(p);
        p.fireCooldown = 6; // ticks between shots
      }

      // powerup timers
      if (p.shield && Date.now() > p.shieldTimer) p.shield = false;
      if (p.extraBullets && Date.now() > p.extraTimer) {
        p.extraBullets = false;
        p.maxBullets = 1;
      }
    }

    // move bullets
    const toRemove = [];
    for (const [bid, b] of this.bullets) {
      const speed = BULLET_SPEED;
      if      (b.dir === 'up')    b.y -= speed;
      else if (b.dir === 'down')  b.y += speed;
      else if (b.dir === 'left')  b.x -= speed;
      else if (b.dir === 'right') b.x += speed;

      let removed = false;

      // wall collision
      const bSize = 6;
      const corners = [
        [b.x, b.y], [b.x+bSize, b.y], [b.x, b.y+bSize], [b.x+bSize, b.y+bSize]
      ];
      for (const [cx,cy] of corners) {
        const tile = tileAt(this.map, cx, cy);
        if (tile === 2) { toRemove.push(bid); removed = true; break; }
        if (tile === 1) {
          const col = Math.floor(cx / TILE);
          const row = Math.floor(cy / TILE);
          
          // NOVA LÓGICA: Se o bloco for destruído, avisa os clientes da sala
          if (clearTile(this.map, col, row)) {
            io.to(this.id).emit('tileDestroyed', { row, col });
          }
          
          toRemove.push(bid); removed = true;
          break;
        }
      }
      if (removed) continue;

      // out of bounds
      if (b.x < 0 || b.x > MAP_COLS*TILE || b.y < 0 || b.y > MAP_ROWS*TILE) {
        toRemove.push(bid); continue;
      }

      // bullet vs bullet (cancel each other)
      for (const [bid2, b2] of this.bullets) {
        if (bid2 <= bid) continue;
        if (rectOverlap(b.x,b.y,bSize,bSize, b2.x,b2.y,bSize,bSize)) {
          toRemove.push(bid); toRemove.push(bid2);
          const owner1 = this.players.get(b.ownerId);
          const owner2 = this.players.get(b2.ownerId);
          if (owner1) owner1.bulletCount = Math.max(0, owner1.bulletCount-1);
          if (owner2) owner2.bulletCount = Math.max(0, owner2.bulletCount-1);
          break;
        }
      }

      // bullet vs tank
      for (const p of this.players.values()) {
        if (p.id === b.ownerId) continue;
        if (!p.alive && !p.disconnected) continue;
        if (p.spawnProtection > 0) continue;
        if (rectOverlap(b.x,b.y,bSize,bSize, p.x,p.y,TANK_SIZE,TANK_SIZE)) {
          toRemove.push(bid);
          const owner = this.players.get(b.ownerId);
          if (owner) owner.bulletCount = Math.max(0, owner.bulletCount-1);
          if (!p.shield) {
            p.hp--;
            if (p.hp <= 0) { p.alive = false; this.onPlayerDeath(p, b.ownerId); }
          }
          break;
        }
      }
    }

    const unique = [...new Set(toRemove)];
    for (const bid of unique) {
      const b = this.bullets.get(bid);
      if (b) {
        const owner = this.players.get(b.ownerId);
        if (owner) owner.bulletCount = Math.max(0, owner.bulletCount-1);
      }
      this.bullets.delete(bid);
    }

    // powerup pickup
    for (const [pid, pu] of this.powerups) {
      for (const p of this.players.values()) {
        if (!p.alive || p.disconnected) continue;
        if (rectOverlap(p.x,p.y,TANK_SIZE,TANK_SIZE, pu.x,pu.y,24,24)) {
          this.applyPowerup(p, pu.type);
          this.powerups.delete(pid);
          break;
        }
      }
    }

    // broadcast state
    const state = this.getState();
    io.to(this.id).emit('state', state);
  }

  canMoveTo(player, nx, ny) {
    const corners = [
      [nx,         ny],
      [nx+TANK_SIZE-1, ny],
      [nx,         ny+TANK_SIZE-1],
      [nx+TANK_SIZE-1, ny+TANK_SIZE-1],
    ];
    for (const [cx,cy] of corners) {
      if (tileAt(this.map,cx,cy) !== 0) return false;
    }
    // tank vs tank collision
    for (const other of this.players.values()) {
      if (other.id === player.id) continue;
      if (!other.alive && !other.disconnected) continue;
      if (rectOverlap(nx,ny,TANK_SIZE,TANK_SIZE, other.x,other.y,TANK_SIZE,TANK_SIZE)) return false;
    }
    return true;
  }

  spawnBullet(player) {
    const id = ++this.bulletSeq;
    const half = TANK_SIZE / 2 - 3;
    let bx = player.x + half, by = player.y + half;
    if (player.dir === 'up')    by = player.y - 6;
    if (player.dir === 'down')  by = player.y + TANK_SIZE;
    if (player.dir === 'left')  bx = player.x - 6;
    if (player.dir === 'right') bx = player.x + TANK_SIZE;
    this.bullets.set(id, { id, x: bx, y: by, dir: player.dir, ownerId: player.id, color: player.color });
    player.bulletCount++;
  }

  spawnPowerup() {
    // find empty cell
    let attempts = 0;
    while (attempts++ < 50) {
      const col = 1 + Math.floor(Math.random() * (MAP_COLS - 2));
      const row = 1 + Math.floor(Math.random() * (MAP_ROWS - 2));
      if (this.map[row][col] !== 0) continue;
      const types = ['shield','repair','extraBullets'];
      const type  = types[Math.floor(Math.random() * types.length)];
      const id    = ++this.powerupSeq;
      this.powerups.set(id, { id, x: col*TILE+4, y: row*TILE+4, type });
      break;
    }
    this.powerupTimer = setTimeout(() => this.spawnPowerup(), POWERUP_INTERVAL);
  }

  applyPowerup(player, type) {
    if (type === 'shield') {
      player.shield = true;
      player.shieldTimer = Date.now() + POWERUP_DURATION;
    } else if (type === 'repair') {
      player.hp = Math.min(3, player.hp + 1);
    } else if (type === 'extraBullets') {
      player.extraBullets = true;
      player.maxBullets   = 3;
      player.extraTimer   = Date.now() + POWERUP_DURATION;
    }
  }

  onPlayerDeath(player, killerId) {
    player.deaths++;
    const killer = this.players.get(killerId);
    if (killer && killer !== player) {
      killer.kills++;
    }
    
    const alive = [...this.players.values()].filter(p => p.alive && !p.disconnected);
    if (alive.length <= 1 && !this.roundOver) {
      this.roundOver = true;
      const winner = alive[0] || null;
      
      // 1. Mapeia os dados e ordena para definir as posições (ranking da partida)
      const sortedPlayers = [...this.players.values()]
        .filter(p => !p.disconnected)
        .map(p => ({
          id: p.id,
          userId: p.userId,
          username: p.username || 'Anônimo', // ← Agora repassa o username real
          kills: p.kills,
          deaths: p.deaths,
          score: (p.kills * 10) - (p.deaths * 5),
          color: p.color,
          alive: p.alive
        }))
        .sort((a, b) => {
          // Quem terminou vivo fica no topo
          if (a.alive && !b.alive) return -1;
          if (!a.alive && b.alive) return 1;
          // Se ambos morreram/estão vivos, desempata pelo score
          return b.score - a.score;
        });

      // 2. Aplica a propriedade 'position' exigida pelo seu scoreboard.js
      sortedPlayers.forEach((p, index) => {
        p.position = index + 1;
      });

      // 3. SALVAMENTO AUTOMÁTICO NO BANCO (Server-side)
      // Varre os jogadores e atualiza a tabela player_stats do SQLite de forma segura
      for (const p of sortedPlayers) {
        if (p.userId) {
          const amIWinner = winner ? (winner.id === p.id) : false;
          db.updatePlayerStats(p.userId, {
            won: amIWinner,
            kills: p.kills,
            deaths: p.deaths
          }).catch(err => console.error(`Erro ao salvar dados do user ${p.userId}:`, err));
        }
      }
      
      // 4. Envia os dados perfeitamente mastigados para o frontend
      io.to(this.id).emit('roundOver', { 
        winnerId: winner ? winner.id : null,
        players: sortedPlayers, // ← Contém os usernames e as positions ordenadas
      });
      setTimeout(() => this.resetRound(), 5000);
    }
  }

  resetRound() {
    this.map       = buildMap();
    this.bullets.clear();
    this.powerups.clear();
    this.roundOver = false;
    this.bulletSeq = 0;
    const idx = { v: 0 };
    for (const p of this.players.values()) {
      if (p.disconnected) continue;
      const spawn = SPAWNS[idx.v % MAX_PLAYERS];
      p.x = spawn.x; p.y = spawn.y; p.dir = spawn.dir;
      p.hp = 3; p.alive = true; p.shield = false;
      p.extraBullets = false; p.maxBullets = 1; p.bulletCount = 0;
      p.spawnProtection = 120; p.fireCooldown = 0;
      idx.v++;
    }
    io.to(this.id).emit('roundReset', { map: this.map });
  }

  getState() {
    return {
      tick:     this.tick,
      players:  [...this.players.values()].map(p => ({
        id: p.id, x: p.x, y: p.y, dir: p.dir, color: p.color,
        hp: p.hp, shield: p.shield, alive: p.alive, disconnected: p.disconnected,
        extraBullets: p.extraBullets,
      })),
      bullets:  [...this.bullets.values()],
      powerups: [...this.powerups.values()],
      mapDiff:  null,  // future: only send changed tiles
    };
  }
}

// ─── REST API Routes ────────────────────────────────────────────────────────
// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const result = await auth.register(username, email, password);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await auth.login(username, password);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get user stats
app.get('/api/stats', auth.authMiddleware, async (req, res) => {
  try {
    const stats = await db.getPlayerStats(req.userId);
    const user = await db.getUserById(req.userId);
    res.json({ ok: true, stats, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get match history
app.get('/api/history', auth.authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await db.getMatchHistory(req.userId, limit);
    res.json({ ok: true, history });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get global leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const leaderboard = await db.getGlobalLeaderboard(limit);
    res.json({ ok: true, leaderboard });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// End match and save stats
app.post('/api/match-end', auth.authMiddleware, async (req, res) => {
  try {
    const { matchId, matchData } = req.body;
    console.log('🔵 /api/match-end chamado');
    console.log('   userId:', req.userId);
    console.log('   matchData:', matchData);
    
    if (!matchData) {
      return res.status(400).json({ ok: false, error: 'matchData ausente' });
    }
    
    // matchData = { position, score, kills, deaths, survivalTime, won }
    await db.updatePlayerStats(req.userId, matchData);
    console.log('✓ Stats salvas para userId:', req.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro em /api/match-end:', err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ─── Socket.io Middleware ──────────────────────────────────────────────────
io.use(auth.socketAuthMiddleware);

// ─── Socket.io Handlers ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoomId = null;
  const userId = socket.userId;
  let playerStats = { kills: 0, deaths: 0, score: 0, survivalTime: Date.now() };

  // Dentro de io.on('connection', (socket) => { ... })

  socket.on('createRoom', async (_, cb) => { // ← Adicionado async
    let id;
    do { id = randId(); } while (rooms.has(id));
    const room = new RoomState(id);
    rooms.set(id, room);
    currentRoomId = id;
    socket.join(id);

    // Buscar o nome real do usuário no banco de dados
    let username = 'Anônimo';
    if (userId) {
      try {
        const user = await db.getUserById(userId);
        if (user) username = user.username;
      } catch (err) {
        console.error('Erro ao buscar username:', err);
      }
    }

    const player = room.addPlayer(socket.id, userId, username); // ← Passando o nome encontrado
    playerStats.survivalTime = Date.now();
    cb({ ok: true, roomId: id, playerId: socket.id, color: player.color, map: room.map });
  });

  socket.on('joinRoom', async ({ roomId }, cb) => { // ← Adicionado async
    const room = rooms.get(roomId?.toUpperCase());
    if (!room) return cb({ ok: false, error: 'Sala não encontrada' });
    if ([...room.players.values()].filter(p => !p.disconnected).length >= MAX_PLAYERS)
      return cb({ ok: false, error: 'Sala cheia (máx 6)' });
    currentRoomId = roomId.toUpperCase();
    socket.join(currentRoomId);

    // Buscar o nome real do usuário no banco de dados
    let username = 'Anônimo';
    if (userId) {
      try {
        const user = await db.getUserById(userId);
        if (user) username = user.username;
      } catch (err) {
        console.error('Erro ao buscar username:', err);
      }
    }

    const player = room.addPlayer(socket.id, userId, username); // ← Passando o nome encontrado
    playerStats.survivalTime = Date.now();
    cb({ ok: true, roomId: currentRoomId, playerId: socket.id, color: player.color, map: room.map });
  });

  socket.on('input', (inputs) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (room) room.applyInput(socket.id, inputs);
  });

  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    room.removePlayer(socket.id);
    const active = [...room.players.values()].filter(p => !p.disconnected);
    if (active.length === 0) {
      room.destroy();
      rooms.delete(currentRoomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Battle City server on :${PORT}`));
