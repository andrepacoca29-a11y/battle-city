# 🎮 Battle City Multiplayer

Clone multiplayer do Battle City (NES) para navegador — até 6 jogadores, baixa latência, deploy no Fly.io.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Socket.io 4 |
| Frontend | HTML5 Canvas + Vanilla JS |
| Deploy | Fly.io (região `gru` — São Paulo) |
| CI/CD | GitHub Actions |

---

## Rodar Localmente

```bash
npm install
npm start          # ou: npm run dev  (com nodemon)
```

Abra `http://localhost:3000` em dois abas/janelas e teste.

---

## Deploy no Fly.io

### 1. Instale o flyctl

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Crie o app (apenas na primeira vez)

```bash
cd battle-city
fly apps create battle-city-mp   # use o nome que quiser
```

> O `fly.toml` já está configurado para a região `gru` (São Paulo).

### 3. Faça o deploy manualmente

```bash
fly deploy
```

### 4. CI/CD via GitHub Actions

1. Gere um token de API no Fly.io:  
   `fly tokens create deploy -x 999999h`
2. Adicione como secret no GitHub:  
   `Settings → Secrets → New → FLY_API_TOKEN`
3. Todo push na branch `main` dispara o deploy automaticamente.

---

## Arquitetura

```
battle-city/
├── server.js           ← Game loop autoritativo + gerenciamento de salas
├── public/
│   ├── index.html      ← Lobby + Canvas
│   ├── game.js         ← Renderização + interpolação + inputs
│   └── style.css       ← UI retro
├── Dockerfile
├── fly.toml
├── package.json
└── .github/
    └── workflows/
        └── deploy.yml
```

### Decisões de performance

- **Tick rate 30Hz** no servidor com interpolação de 80ms no cliente — equilibra responsividade e consumo de banda.
- **WebSocket puro** (`transports: ['websocket']`) — elimina o overhead do polling HTTP.
- **Colisões autoritativas no servidor** — evita cheating e garante consistência.
- **Delta inputs** — o cliente só envia ao servidor quando o estado das teclas muda.

---

## Controles

| Ação | PC |
|---|---|
| Mover | `WASD` ou `↑ ↓ ← →` |
| Atirar | `Espaço` |

Mobile: D-pad e botão de fogo na tela.

---

## Power-ups

| Ícone | Efeito | Duração |
|---|---|---|
| 🛡 | Escudo (imune a dano) | 10s |
| ❤ | Reparo (+1 HP) | Instantâneo |
| ⚡ | +Balas (até 3 simultâneas) | 10s |
# Battle_City
