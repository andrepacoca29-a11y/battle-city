'use strict';
// ─── auth.js ─ Client-side authentication ─────────────────────────────────

let currentToken = null;
let currentUserId = null;
let currentUsername = null;

// ─── Screens ────────────────────────────────────────────────────────────────
const authScreens = {
  auth: document.getElementById('screen-auth'),
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game'),
  overlay: document.getElementById('screen-overlay'),
  scoreboard: document.getElementById('screen-scoreboard'),
  leaderboard: document.getElementById('screen-leaderboard'),
};

function showAuthScreen(name) {
  for (const [k, el] of Object.entries(authScreens)) {
    el.style.display = k === name ? 'flex' : 'none';
  }
}

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Carrega token do localStorage se existir
  const savedToken = localStorage.getItem('battle-city-token');
  if (savedToken) {
    currentToken = savedToken;
    currentUserId = localStorage.getItem('battle-city-userId');
    currentUsername = localStorage.getItem('battle-city-username');
    initSocket();
    loadUserStats();
    showAuthScreen('lobby');
  } else {
    showAuthScreen('auth');
  }

  setupAuthTabButtons();
  setupAuthButtons();
  setupLogoutButton();
  setupLeaderboardButton();
});

// ─── Auth Tabs ──────────────────────────────────────────────────────────────
function setupAuthTabButtons() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      // Remove active class
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-tab-content').forEach(c => c.classList.remove('active'));
      // Add active class
      tab.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');
    });
  });
}

// ─── Login ──────────────────────────────────────────────────────────────────
function setupAuthButtons() {
  // Login button
  document.getElementById('btn-login').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      showAuthError('Preencha todos os campos');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      // Salvar dados
      currentToken = data.token;
      currentUserId = data.userId;
      currentUsername = data.username;

      localStorage.setItem('battle-city-token', currentToken);
      localStorage.setItem('battle-city-userId', currentUserId);
      localStorage.setItem('battle-city-username', currentUsername);

      // Limpar inputs
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      document.getElementById('auth-error-msg').textContent = '';

      initSocket();
      loadUserStats();
      showAuthScreen('lobby');
    } catch (err) {
      showAuthError(err.message);
    }
  });

  // Register button
  document.getElementById('btn-register').addEventListener('click', async () => {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;

    if (!username || !password) {
      showAuthError('Username e Senha são obrigatórios');
      return;
    }

    if (password !== password2) {
      showAuthError('Senhas não conferem');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email: email || null, password }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      // Salvar dados
      currentToken = data.token;
      currentUserId = data.userId;
      currentUsername = data.username;

      localStorage.setItem('battle-city-token', currentToken);
      localStorage.setItem('battle-city-userId', currentUserId);
      localStorage.setItem('battle-city-username', currentUsername);

      // Limpar inputs
      document.getElementById('register-username').value = '';
      document.getElementById('register-email').value = '';
      document.getElementById('register-password').value = '';
      document.getElementById('register-password2').value = '';
      document.getElementById('auth-error-msg').textContent = '';

      initSocket();
      loadUserStats();
      showAuthScreen('lobby');
    } catch (err) {
      showAuthError(err.message);
    }
  });

  // Enter key
  document.getElementById('login-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
  document.getElementById('register-password2').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-register').click();
  });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error-msg');
  el.textContent = msg;
  el.style.opacity = 1;
  setTimeout(() => { el.style.opacity = 0; }, 4000);
}

// ─── User Info ──────────────────────────────────────────────────────────────
function setupLogoutButton() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    currentToken = null;
    currentUserId = null;
    currentUsername = null;
    localStorage.removeItem('battle-city-token');
    localStorage.removeItem('battle-city-userId');
    localStorage.removeItem('battle-city-username');
    showAuthScreen('auth');
  });
}

async function loadUserStats() {
  try {
    const res = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${currentToken}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const stats = data.stats;
    document.getElementById('username-display').textContent = currentUsername;
    document.getElementById('stat-wins').textContent = stats.total_wins;
    document.getElementById('stat-kills').textContent = stats.total_kills;
    document.getElementById('stat-winrate').textContent = (stats.win_rate * 100).toFixed(1) + '%';
  } catch (err) {
    console.error('Erro ao carregar stats:', err);
  }
}

// ─── Leaderboard ────────────────────────────────────────────────────────────
function setupLeaderboardButton() {
  document.getElementById('btn-leaderboard').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=20');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const lb = data.leaderboard;
      let html = '<table class="lb-table"><tr><th>Pos</th><th>Player</th><th>Vitórias</th><th>Taxa</th><th>Eliminations</th></tr>';
      lb.forEach((p, i) => {
        html += `<tr><td>${i+1}</td><td>${p.username}</td><td>${p.total_wins}</td><td>${(p.win_rate*100).toFixed(1)}%</td><td>${p.total_kills}</td></tr>`;
      });
      html += '</table>';

      document.getElementById('leaderboard-content').innerHTML = html;
      showAuthScreen('leaderboard');
    } catch (err) {
      console.error('Erro ao carregar leaderboard:', err);
    }
  });

  document.getElementById('btn-back-from-lb').addEventListener('click', () => {
    showAuthScreen('lobby');
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function showErrorLobby(msg) {
  const el = document.getElementById('lobby-error-msg');
  el.textContent = msg;
  el.style.opacity = 1;
  setTimeout(() => { el.style.opacity = 0; }, 3000);
}
