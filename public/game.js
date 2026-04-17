'use strict';
// ─── game.js ─ Client-side rendering + interpolation + input ─────────────────

const socket = io({ transports: ['websocket'] });

// ─── Config ───────────────────────────────────────────────────────────────────
const TILE       = 32;
const TANK_SIZE  = 28;
const MAP_COLS   = 26;
const MAP_ROWS   = 26;
const CANVAS_W   = MAP_COLS * TILE;
const CANVAS_H   = MAP_ROWS * TILE;
const INTERP_MS  = 80;  // interpolation window (ms)

// ─── State ────────────────────────────────────────────────────────────────────
let myId      = null;
let myColor   = null;
let roomId    = null;
let map       = null;
let gameRunning = false;

// Snapshot ring buffer for interpolation
let snapA = null, snapB = null;

// Inputs
const keys = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false,
               w:false, a:false, s:false, d:false, W:false, A:false, S:false, D:false, ' ':false };
let lastInputSent = '';
let inputInterval = null;

// Canvas
const canvas  = document.getElementById('game-canvas');
const ctx     = canvas.getContext('2d');
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

// Sprite cache
const spriteCache = {};

// ─── Screens ─────────────────────────────────────────────────────────────────
const screens = {
  lobby:   document.getElementById('screen-lobby'),
  game:    document.getElementById('screen-game'),
  overlay: document.getElementById('screen-overlay'),
};

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.style.display = k === name ? 'flex' : 'none';
}
showScreen('lobby');

// ─── Lobby Logic ─────────────────────────────────────────────────────────────
document.getElementById('btn-create').addEventListener('click', () => {
  socket.emit('createRoom', {}, (res) => {
    if (!res.ok) return showError(res.error);
    initGame(res);
  });
});

document.getElementById('btn-join').addEventListener('click', () => {
  const code = document.getElementById('room-input').value.trim().toUpperCase();
  if (code.length !== 4) return showError('Digite um código de 4 letras');
  socket.emit('joinRoom', { roomId: code }, (res) => {
    if (!res.ok) return showError(res.error);
    initGame(res);
  });
});

document.getElementById('room-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.opacity = 1;
  setTimeout(() => { el.style.opacity = 0; }, 3000);
}

// ─── Game Init ────────────────────────────────────────────────────────────────
function initGame(res) {
  myId    = res.playerId;
  myColor = res.color;
  roomId  = res.roomId;
  map     = res.map;
  gameRunning = true;
  document.getElementById('room-code').textContent = res.roomId;
  showScreen('game');
  startInputLoop();
  requestAnimationFrame(renderLoop);
}

// ─── Socket Events ────────────────────────────────────────────────────────────
socket.on('state', (state) => {
  snapA = snapB;
  snapB = { time: Date.now(), state };
});

socket.on('tileDestroyed', ({ row, col }) => {
  // Apaga o tijolo visualmente do mapa local
  if (map && map[row]) {
    map[row][col] = 0;
  }
});

socket.on('roundOver', ({ winnerId }) => {
  const msg = winnerId === myId ? '🏆 VOCÊ VENCEU!' : '💥 Derrota...';
  showOverlay(msg, 5);
});

socket.on('roundReset', ({ map: newMap }) => {
  map = newMap;
  hideOverlay();
});

// ─── Input ────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => { if (e.key in keys) { keys[e.key] = true; e.preventDefault(); } });
window.addEventListener('keyup',   (e) => { if (e.key in keys) keys[e.key] = false; });

// Mobile controls
document.querySelectorAll('[data-key]').forEach(btn => {
  const key = btn.dataset.key;
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
  btn.addEventListener('touchend',   (e) => { e.preventDefault(); keys[key] = false; });
  btn.addEventListener('mousedown',  () => keys[key] = true);
  btn.addEventListener('mouseup',    () => keys[key] = false);
});

function getInputState() {
  return {
    up:    keys.ArrowUp    || keys.w || keys.W,
    down:  keys.ArrowDown  || keys.s || keys.S,
    left:  keys.ArrowLeft  || keys.a || keys.A,
    right: keys.ArrowRight || keys.d || keys.D,
    fire:  keys[' '],
  };
}

function startInputLoop() {
  inputInterval = setInterval(() => {
    if (!gameRunning) return;
    const inp = getInputState();
    const encoded = JSON.stringify(inp);
    if (encoded !== lastInputSent) {
      socket.emit('input', inp);
      lastInputSent = encoded;
    }
  }, 1000 / 60);
}

// ─── Interpolation ────────────────────────────────────────────────────────────
function interpolatedState() {
  if (!snapB) return null;
  if (!snapA) return snapB.state;
  const now    = Date.now();
  const renderTime = now - INTERP_MS;
  const t = Math.max(0, Math.min(1,
    (renderTime - snapA.time) / (snapB.time - snapA.time)
  ));
  const sA = snapA.state, sB = snapB.state;
  // interpolate player positions
  const players = sB.players.map(pb => {
    const pa = sA.players.find(p => p.id === pb.id);
    if (!pa) return pb;
    return { ...pb, x: lerp(pa.x, pb.x, t), y: lerp(pa.y, pb.y, t) };
  });
  return { ...sB, players };
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ─── Render ───────────────────────────────────────────────────────────────────
let lastTime = 0;

function renderLoop(ts) {
  const dt = ts - lastTime; lastTime = ts;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground();
  if (map) drawMap();
  const state = interpolatedState();
  if (state) {
    drawPowerups(state.powerups);
    drawBullets(state.bullets);
    drawPlayers(state.players);
  }
  requestAnimationFrame(renderLoop);
}

// ─── Drawing ─────────────────────────────────────────────────────────────────
function drawBackground() {
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= MAP_COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c*TILE, 0); ctx.lineTo(c*TILE, CANVAS_H); ctx.stroke();
  }
  for (let r = 0; r <= MAP_ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r*TILE); ctx.lineTo(CANVAS_W, r*TILE); ctx.stroke();
  }
}

function drawMap() {
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const tile = map[r][c];
      if (tile === 0) continue;
      const x = c * TILE, y = r * TILE;
      if (tile === 1) drawBrick(x, y);
      else if (tile === 2) drawSteel(x, y);
    }
  }
}

function drawBrick(x, y) {
  ctx.fillStyle = '#8b3a2a';
  ctx.fillRect(x+1, y+1, TILE-2, TILE-2);
  // mortar lines
  ctx.fillStyle = '#5c2419';
  ctx.fillRect(x+1, y+TILE/2-1, TILE-2, 2);
  ctx.fillRect(x+TILE/2-1, y+1, 2, TILE/2-2);
  ctx.fillRect(x+TILE/4-1, y+TILE/2+1, 2, TILE/2-2);
  ctx.fillRect(x+3*TILE/4-1, y+TILE/2+1, 2, TILE/2-2);
  // highlight
  ctx.fillStyle = 'rgba(255,200,150,0.08)';
  ctx.fillRect(x+1, y+1, TILE-2, 3);
}

function drawSteel(x, y) {
  const g = ctx.createLinearGradient(x, y, x+TILE, y+TILE);
  g.addColorStop(0, '#8a9baa');
  g.addColorStop(0.5, '#c5d5e4');
  g.addColorStop(1, '#5a6e7c');
  ctx.fillStyle = g;
  ctx.fillRect(x+1, y+1, TILE-2, TILE-2);
  // rivets
  ctx.fillStyle = '#6a7f8e';
  const rivetPos = [[x+5,y+5],[x+TILE-7,y+5],[x+5,y+TILE-7],[x+TILE-7,y+TILE-7]];
  for (const [rx,ry] of rivetPos) {
    ctx.beginPath(); ctx.arc(rx,ry,2.5,0,Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle = '#4a5f6e';
  ctx.lineWidth = 1;
  ctx.strokeRect(x+1, y+1, TILE-2, TILE-2);
}

function drawPlayers(players) {
  for (const p of players) {
    if (!p.alive && !p.disconnected) continue;
    if (p.disconnected) {
      drawDestroyedTank(p);
      continue;
    }
    drawTank(p);
    drawHP(p);
  }
}

function drawTank(p) {
  ctx.save();
  ctx.translate(p.x + TANK_SIZE/2, p.y + TANK_SIZE/2);

  // Como o tanque foi desenhado apontando para cima, 
  // 'up' é 0 radianos, e o resto gira a partir daí.
  const angle = { up: 0, down: Math.PI, left: -Math.PI/2, right: Math.PI/2 }[p.dir] || 0;
  ctx.rotate(angle);

  const s = TANK_SIZE;
  const hs = s / 2;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, hs-2, hs/2-1, 0, 0, Math.PI*2);
  ctx.fill();

  // tracks
  ctx.fillStyle = '#333';
  ctx.fillRect(-hs, -hs, 6, s);
  ctx.fillRect(hs-6, -hs, 6, s);

  // track details
  ctx.fillStyle = '#555';
  for (let i = -hs+2; i < hs-2; i += 6) {
    ctx.fillRect(-hs+1, i, 4, 3);
    ctx.fillRect(hs-5, i, 4, 3);
  }

  // body
  const bodyGrad = ctx.createLinearGradient(-hs+6, -hs+2, hs-6, hs-2);
  bodyGrad.addColorStop(0, lighten(p.color, 40));
  bodyGrad.addColorStop(1, p.color);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-hs+6, -hs+2, s-12, s-4, 3);
  ctx.fill();

  // turret base
  ctx.fillStyle = darken(p.color, 20);
  ctx.beginPath();
  ctx.arc(0, 0, hs/2+1, 0, Math.PI*2);
  ctx.fill();

  // barrel
  ctx.fillStyle = '#222';
  ctx.fillRect(-2, -hs+2, 4, hs-2);

  // barrel tip
  ctx.fillStyle = '#444';
  ctx.fillRect(-3, -hs+2, 6, 4);

  // is-me indicator
  if (p.id === myId) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.rect(-hs-2, -hs-2, s+4, s+4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // shield ring
  if (p.shield) {
    ctx.strokeStyle = `rgba(100,200,255,${0.5 + 0.3 * Math.sin(Date.now()/200)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, hs+5, 0, Math.PI*2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDestroyedTank(p) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.translate(p.x + TANK_SIZE/2, p.y + TANK_SIZE/2);
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.roundRect(-TANK_SIZE/2+2, -TANK_SIZE/2+2, TANK_SIZE-4, TANK_SIZE-4, 3);
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.stroke();
  // X mark
  ctx.strokeStyle = '#f44';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6,-6); ctx.lineTo(6,6);
  ctx.moveTo(6,-6);  ctx.lineTo(-6,6);
  ctx.stroke();
  ctx.restore();
}

function drawHP(p) {
  const dotR  = 5;
  const gap   = 4;
  const total = 3;
  const width = total * (dotR*2) + (total-1) * gap;
  const sx    = p.x + TANK_SIZE/2 - width/2 + dotR;
  const sy    = p.y - 12;
  for (let i = 0; i < total; i++) {
    const x = sx + i * (dotR*2 + gap);
    ctx.beginPath();
    ctx.arc(x, sy, dotR, 0, Math.PI*2);
    ctx.fillStyle = i < p.hp ? '#e74' : 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawBullets(bullets) {
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x+3, b.y+3);
    // glow
    const grd = ctx.createRadialGradient(0,0,0, 0,0,8);
    grd.addColorStop(0, b.color || '#ffe066');
    grd.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
    // core
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

const POWERUP_COLORS = { shield:'#4ecdc4', repair:'#a8e6cf', extraBullets:'#f7c948' };
const POWERUP_ICONS  = { shield:'🛡', repair:'❤', extraBullets:'⚡' };

function drawPowerups(powerups) {
  const t = Date.now() / 1000;
  for (const pu of powerups) {
    ctx.save();
    const pulse = 1 + 0.08 * Math.sin(t * 3);
    ctx.translate(pu.x + 12, pu.y + 12);
    ctx.scale(pulse, pulse);

    // glow
    ctx.shadowColor = POWERUP_COLORS[pu.type] || '#fff';
    ctx.shadowBlur  = 14;

    // bg
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(-12,-12,24,24,6); ctx.fill();

    ctx.strokeStyle = POWERUP_COLORS[pu.type] || '#fff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // icon
    ctx.font = '14px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_ICONS[pu.type] || '?', 0, 0);

    ctx.restore();
  }
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
function showOverlay(msg, seconds) {
  const el = document.getElementById('screen-overlay');
  el.style.display = 'flex';
  el.querySelector('.overlay-msg').textContent = msg;
  let s = seconds;
  const cd = el.querySelector('.overlay-cd');
  const iv = setInterval(() => {
    cd.textContent = `Próxima rodada em ${s--}s`;
    if (s < 0) clearInterval(iv);
  }, 1000);
}
function hideOverlay() {
  document.getElementById('screen-overlay').style.display = 'none';
}

// ─── Color Utils ─────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return {r,g,b};
}
function lighten(hex, amt) {
  const {r,g,b} = hexToRgb(hex);
  return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}
function darken(hex, amt) {
  const {r,g,b} = hexToRgb(hex);
  return `rgb(${Math.max(0,r-amt)},${Math.max(0,g-amt)},${Math.max(0,b-amt)})`;
}
