# 📚 Estrutura do Projeto Battle City Multiplayer

## 🎮 Visão Geral

Este é um clone multiplayer do jogo clássico **Battle City** (NES) desenvolvido para navegadores web. Permite que até 6 jogadores se enfrentem simultaneamente em um mesmo mapa, com comunicação em tempo real via WebSocket.

**Stack:**
- Backend: Node.js + Express + Socket.io
- Frontend: HTML5 Canvas + JavaScript Vanilla
- Banco de Dados: SQLite3
- Deploy: Fly.io

---

## 📁 Estrutura de Diretórios

```
battle-city/
├── 📄 server.js              ← Servidor principal
├── 📄 auth.js                ← Autenticação e JWT
├── 📄 db.js                  ← Banco de dados SQLite
├── 📄 package.json           ← Dependências do projeto
├── 📄 Dockerfile             ← Configuração Docker
├── 📄 fly.toml               ← Configuração Fly.io
├── 📄 README.md              ← Documentação principal
├── 📄 ESTRUTURA_PROJETO.md   ← Este arquivo
└── 📁 public/                ← Arquivos estáticos (frontend)
    ├── 📄 index.html         ← Página HTML principal
    ├── 📄 game.js            ← Lógica do jogo (cliente)
    ├── 📄 auth.js            ← Lógica de autenticação (cliente)
    ├── 📄 scoreboard.js      ← Placar e ranking
    └── 📄 style.css          ← Estilos CSS
```

---

## 📋 Detalhamento dos Arquivos

### ⚙️ Arquivos de Configuração

#### **`package.json`**
- **Propósito:** Define as dependências do projeto e scripts de execução
- **Conteúdo:**
  - Nome do projeto: `battle-city-multiplayer`
  - Versão: `1.0.0`
  - Script `start`: inicia o servidor com `node server.js`
  - Script `dev`: inicia com nodemon (reinicia automaticamente ao salvar)
  - Dependências principais:
    - `express`: framework web
    - `socket.io`: comunicação em tempo real
    - `sqlite3`: banco de dados
    - `bcryptjs`: criptografia de senhas
    - `jsonwebtoken`: autenticação via JWT
    - `cors`: controle de origem (CORS)

#### **`fly.toml`**
- **Propósito:** Configuração para deploy no Fly.io
- **Conteúdo:**
  - Define a aplicação e região de deploy (gru - São Paulo)
  - Configurações de porta, variáveis de ambiente
  - Instâncias e recursos

#### **`Dockerfile`**
- **Propósito:** Define como a aplicação será containerizada
- **Conteúdo:**
  - Imagem base Node.js
  - Instalação de dependências
  - Exposição da porta
  - Comando de inicialização

---

### 🖥️ Arquivos Backend (Node.js)

#### **`server.js`** ⭐ ARQUIVO PRINCIPAL
- **Propósito:** Servidor central da aplicação
- **Responsabilidades:**
  - Inicializa o Express e Socket.io
  - Cria e gerencia salas de jogo (lobbies)
  - Implementa o **game loop autoritativo** (30 FPS)
  - Valida e processa movimentos de tanques
  - Detecta colisões
  - Gerencia disparo de munições
  - Controla destruction de tiles (blocos)
  - Gerencia power-ups
  - Distribui estado do jogo para todos os clientes
  - Autentica jogadores via JWT

- **Principais Constantes:**
  - `TICK_RATE`: 30 (atualizações por segundo)
  - `TILE`: 32 pixels
  - `MAP_COLS/MAP_ROWS`: 26x26 (mapa)
  - `TANK_SIZE`: 28 pixels
  - `BULLET_SPEED`: 16 px por tick
  - `TANK_SPEED`: 2.2 px por tick
  - `MAX_PLAYERS`: 6 jogadores por sala

- **Eventos Socket.io que recebe:**
  - `input` - movimento e ação do tanque
  - `joinGame` - jogador entra na sala
  - `leaveGame` - jogador sai da sala

- **Eventos Socket.io que envia:**
  - `state` - estado completo do jogo
  - `tileDestroyed` - bloco foi destruído
  - `roomFull` - sala cheia
  - `gameStatus` - status da partida

#### **`auth.js`**
- **Propósito:** Gerencia autenticação e autorização
- **Funções principais:**
  - `hashPassword()` - criptografa senhas com bcryptjs
  - `verifyPassword()` - valida senha contra hash
  - `generateToken()` - cria JWT com ID do usuário
  - `verifyToken()` - valida e decodifica JWT
  - `registerUser()` - cria novo usuário no BD
  - `loginUser()` - autentica usuário
  - `authenticateSocket()` - middleware para validar conexões WebSocket

- **Segurança:**
  - Usa bcryptjs para hash de senhas (salt round 10)
  - JWT com expiração de 7 dias
  - Secret armazenado em variável de ambiente

#### **`db.js`**
- **Propósito:** Gerencia o banco de dados SQLite
- **Responsabilidades:**
  - Conecta ao banco `battle-city.db`
  - Cria tabelas automaticamente
  - Fornece funções CRUD para usuários e partidas

- **Tabelas criadas:**
  - `users` - armazena usuários, emails, senhas criptografadas
  - `matches` - histórico de partidas
  - `scoreboards` - placar de jogadores

- **Funções:**
  - `initDB()` - inicializa as tabelas
  - `getUser()` - busca usuário por username
  - `createUser()` - insere novo usuário
  - `saveMatch()` - registra resultado de partida

---

### 🌐 Arquivos Frontend (JavaScript + HTML + CSS)

#### **`public/index.html`**
- **Propósito:** Arquivo HTML principal
- **Conteúdo:**
  - Estrutura da página web
  - Telas de login e registro
  - Canvas para o jogo
  - Links para CSS e fontes Google (Press Start 2P - fonte retro)
  - Carregamento de scripts JavaScript

- **Telas:**
  - `screen-auth` - Tela de autenticação (login/registro)
  - `screen-lobby` - Lobby para criar/entrar em salas
  - `screen-game` - Tela principal do jogo com canvas
  - `screen-gameover` - Tela de fim de jogo com placar

#### **`public/game.js`**
- **Propósito:** Lógica do jogo no lado do cliente
- **Responsabilidades:**
  - Inicializa conexão WebSocket (Socket.io)
  - Renderiza o jogo na tela (canvas)
  - Implementa interpolação de movimento (suaviza animação)
  - Captura inputs do teclado (WASD + Espaço)
  - Envia apenas deltas (mudanças) de estado para o servidor
  - Renderiza outros tanques, munição, obstáculos
  - Atualiza placar em tempo real

- **Principais variáveis:**
  - `socket` - conexão WebSocket
  - `map` - mapa do jogo
  - `players` - lista de tanques
  - `bullets` - lista de munições
  - `canvas` - elemento Canvas do HTML
  - `ctx` - contexto 2D do canvas

- **Funções principais:**
  - `initSocket()` - conecta ao servidor
  - `setupSocketListeners()` - escuta eventos do servidor
  - `gameLoop()` - loop de renderização (~60 FPS)
  - `interpolate()` - suaviza movimento entre ticks
  - `handleKeyDown()` / `handleKeyUp()` - captura teclado
  - `render()` - desenha tudo na tela

#### **`public/auth.js`**
- **Propósito:** Lógica de autenticação no frontend
- **Responsabilidades:**
  - Gerencia tela de login e registro
  - Valida entrada do usuário
  - Envia credenciais para o backend
  - Armazena token JWT no localStorage
  - Redireciona para lobby após autenticação bem-sucedida
  - Gerencia alternância entre abas "Entrar" e "Registrar"

- **Funções principais:**
  - `register()` - envia dados de novo usuário
  - `login()` - autentica usuário
  - `logout()` - remove token e volta para auth
  - `switchTab()` - alterna entre login e registro

#### **`public/scoreboard.js`**
- **Propósito:** Gerencia placar e ranking
- **Responsabilidades:**
  - Exibe pontuação dos jogadores durante a partida
  - Mostra ranking final após fim do jogo
  - Atualiza scores em tempo real
  - Marca vitória/derrota
  - Exibe estatísticas da partida

- **Dados exibidos:**
  - Nome do jogador
  - Pontos totais
  - Número de mortes
  - Número de kills
  - Tempo de partida

#### **`public/style.css`**
- **Propósito:** Estilos visuais da aplicação
- **Conteúdo:**
  - Tema retro (pixel art, cores vibrantes)
  - Fonte Press Start 2P (estilo 8-bit)
  - Estilos para telas (auth, lobby, game, gameover)
  - Estilos para botões, inputs, cards
  - Canvas responsivo
  - Efeitos visuais e animações
  - Paleta de cores retrô

---

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENTE (Browser)                        │
│  index.html → auth.js → game.js → scoreboard.js → style.css │
└────────────────────────┬────────────────────────────────────┘
                         │
                    WebSocket
                    (Socket.io)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   SERVIDOR (Node.js)                         │
│  server.js → [game loop 30Hz] → state broadcast             │
│      ↓              ↓              ↓                          │
│    auth.js        db.js      Validação                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎮 Como o Jogo Funciona

### 1️⃣ Inicialização
- Usuário faz login/registro via `auth.js`
- Token JWT é armazenado
- Usuário entra no lobby via `game.js`

### 2️⃣ Lobby
- Escolhe uma sala ou cria uma nova
- Aguarda outros jogadores (até 6)
- Quando todos estão prontos, partida inicia

### 3️⃣ Gameplay
- **Servidor** (`server.js`):
  - Roda game loop a 30 FPS
  - Processa inputs de todos os clientes
  - Calcula colisões
  - Valida movimentos (anti-cheat)
  - Envia estado para todos os clientes

- **Cliente** (`game.js`):
  - Renderiza localmente a 60 FPS
  - Interpola movimento entre ticks (suavidade)
  - Envia inputs apenas quando mudam (economia de banda)
  - Desenha tanques, munição, obstáculos

### 4️⃣ Placar
- `scoreboard.js` exibe pontos em tempo real
- Atualizado a cada evento importante (kill, morte, etc)

### 5️⃣ Fim da Partida
- Último jogador vivo vence
- Tela de resultados mostra ranking
- Opção de rematch ou voltar ao lobby

---

## 🔐 Segurança

### Autenticação
- Senhas criptografadas com **bcryptjs** (10 salt rounds)
- JWT com expiração de **7 dias**
- Token armazenado no localStorage do navegador

### Validação
- **Servidor autoritário**: todas as ações críticas validadas no servidor
- Posição dos tanques só é aceita se válida
- Colisões calculadas apenas no servidor (anti-cheat)
- Inputs são validados antes de processar

### CORS
- Configurado para aceitar requisições da origem correta
- WebSocket puro (sem fallback HTTP - menor superfície de ataque)

---

## 📊 Performance

### Otimizações
- **Tick rate 30Hz**: equilibra responsividade vs largura de banda
- **Interpolação 80ms**: suaviza movimento no cliente
- **Delta inputs**: cliente envia apenas mudanças de estado
- **WebSocket puro**: sem overhead de polling HTTP
- **Compression**: Socket.io comprime dados automaticamente

### Métricas
- Latência típica: 50-200ms (dependendo da região)
- Consumo de banda: ~5-10 Kbps por jogador
- CPU do servidor: baixo (cálculos simples)

---

## 🚀 Como Rodar

### Localmente
```bash
npm install
npm start              # Modo produção
# ou
npm run dev            # Modo desenvolvimento com nodemon
```

Acesse: `http://localhost:3000`

### Deploy no Fly.io
```bash
fly deploy
```

---

## 📝 Resumo Rápido dos Arquivos

| Arquivo | Tipo | Função Principal |
|---------|------|-----------------|
| `server.js` | Backend | Game loop, validação, distribuição de estado |
| `auth.js` | Backend | Autenticação, JWT, hash de senhas |
| `db.js` | Backend | SQLite, persistência de usuários e matches |
| `index.html` | Frontend | Estrutura HTML, telas, canvas |
| `game.js` | Frontend | Renderização, interpolação, inputs |
| `auth.js` | Frontend | Login, registro, gerenciamento de token |
| `scoreboard.js` | Frontend | Placar e ranking |
| `style.css` | Frontend | Estilos e tema retro |
| `package.json` | Config | Dependências e scripts |
| `fly.toml` | Config | Deploy Fly.io |
| `Dockerfile` | Config | Containerização |

---

## 🎯 Arquitetura em Camadas

```
┌─────────────────────────────────┐
│   Interface Usuário (UI)         │  ← index.html + style.css
├─────────────────────────────────┤
│   Lógica do Jogo (Render)        │  ← game.js, scoreboard.js
├─────────────────────────────────┤
│   Autenticação & Comunicação     │  ← auth.js (cliente + servidor)
├─────────────────────────────────┤
│   Game Loop Autoritário          │  ← server.js (30 Hz)
├─────────────────────────────────┤
│   Persistência (Banco de Dados)  │  ← db.js
└─────────────────────────────────┘
```

---

## 🔗 Dependências Externas

```json
{
  "express": "servidor HTTP",
  "socket.io": "WebSocket em tempo real",
  "sqlite3": "banco de dados local",
  "bcryptjs": "hash de senhas",
  "jsonwebtoken": "autenticação JWT",
  "cors": "controle de origem",
  "nodemon": "reinicialização automática (dev)"
}
```

---

## 📚 Próximos Passos para Contribuir

1. Entender o fluxo em `server.js` (game loop)
2. Estudar interpolação em `game.js` (cliente)
3. Adicionar novos power-ups em `server.js`
4. Melhorar UI em `index.html` + `style.css`
5. Implementar novos modos de jogo

---

Documento gerado em: **junho de 2026**
