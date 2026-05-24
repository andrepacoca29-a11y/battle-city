'use strict';
// ─── scoreboard.js ─ Match end scoreboard ─────────────────────────────────

// Chamada após o fim de uma partida
async function showScoreboard(matchData) {
  // matchData = { players: [ { id, username, score, kills, deaths, position }, ... ], winnerId }
  const content = document.getElementById('scoreboard-content');
  const ranking = matchData.players.sort((a, b) => a.position - b.position);

  let html = '<div class="ranking-list">';
  ranking.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const isWinner = p.id === matchData.winnerId ? '👑' : '';
    html += `
      <div class="ranking-item ${p.id === matchData.winnerId ? 'winner' : ''}">
        <span class="medal">${medal}</span>
        <span class="player-name">${p.username || 'Anônimo'}</span>
        <span class="score-label">Pontos:</span>
        <span class="score-value">${p.score}</span>
        <span class="kills-deaths">
          <span class="kills">${p.kills} 🔫</span>
          <span class="deaths">${p.deaths} 💀</span>
        </span>
        <span class="winner-badge">${isWinner}</span>
      </div>
    `;
  });
  html += '</div>';

  content.innerHTML = html;
  showAuthScreen('scoreboard');

  // Salvar stats do jogador atual
  if (currentToken && myMatchData) {
    try {
      console.log('📤 Enviando dados da partida:', myMatchData);
      console.log('   currentToken:', currentToken ? 'OK' : 'AUSENTE');
      console.log('   currentUserId:', currentUserId);
      
      const response = await fetch('/api/match-end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          matchId: currentRoomId,
          matchData: myMatchData,
        }),
      });
      
      const result = await response.json();
      console.log('📥 Resposta do servidor:', result);
      if (result.ok) {
        console.log('✓ Stats salvas com sucesso!');
      } else {
        console.error('❌ Erro ao salvar stats:', result.error);
      }
    } catch (err) {
      console.error('❌ Erro ao salvar dados da partida:', err);
    }
  } else {
    console.warn('⚠️ Não posso salvar: currentToken=' + !!currentToken + ', myMatchData=' + !!myMatchData);
  }
}

document.getElementById('btn-back-lobby').addEventListener('click', () => {
  // Resetar jogo e voltar ao lobby
  gameRunning = false;
  disableGameControls();
  socket.disconnect();
  location.reload(); // Ou mostrar tela de lobby sem recarregar
  showAuthScreen('lobby');
});
