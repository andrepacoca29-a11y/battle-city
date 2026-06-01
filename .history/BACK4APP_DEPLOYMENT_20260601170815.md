# Battle City - Back4App Deployment Guide

## Visão Geral

Battle City é um clone multiplayer do jogo Battle City do NES, com suporte real-time via Socket.io.

Deployado em: **Back4App** (plataforma Node.js hospedada)

## Stack Tecnológico

- **Backend**: Node.js + Express.js
- **Real-time**: Socket.io (WebSocket)
- **Autenticação**: JWT (JSON Web Tokens)
- **Banco de Dados**: SQLite
- **Frontend**: HTML5 + Canvas + JavaScript

## Deploy no Back4App

### Pré-requisitos

1. Conta em [back4app.com](https://www.back4app.com)
2. Git instalado
3. Node.js >= 18

### Passos para Deploy

1. **Criar novo app no Back4App**
   - Acesse o dashboard e crie um novo Node.js app
   - Copie a URL do repositório Git remoto

2. **Adicionar remote do Back4App**
   ```bash
   git remote add back4app <sua-url-git-back4app>
   ```

3. **Deploy**
   ```bash
   git push back4app main
   ```

4. **Variáveis de Ambiente**
   - No dashboard Back4App, configure:
     - `NODE_ENV`: `production`
     - `PORT`: `8080` (ou conforme fornecido)
     - `JWT_SECRET`: Uma chave segura para JWT

### Configuração Local

```bash
npm install
npm start
```

Servidor roda em: http://localhost:3000

## Arquitetura

- `server.js` - Servidor Express + Socket.io
- `auth.js` - Middleware de autenticação JWT
- `db.js` - Gerenciador SQLite
- `public/` - Interface web (HTML + CSS + JS)

## Socket.io

- **Transporte**: WebSocket (suportado nativamente por Back4App)
- **Ping/Pong**: 5s interval, 10s timeout
- **CORS**: Aceita todas as origens (configurável em produção)

## Características

✅ Multiplayer em tempo real
✅ Autenticação JWT
✅ Leaderboard persistente
✅ Sistema de salas
✅ Movimentação sincronizada de tanques
✅ Tiro e colisão em tempo real
✅ Power-ups (escudo, tiros extras)

## Troubleshooting

### Socket.io não conecta
- Verifique se o WebSocket está habilitado em Back4App
- Confirme firewall permite conexão

### Banco de dados não inicializa
- Verifique permissões de escrita no diretório `/data`
- Verifique se `db.js` está presente

### Performance lenta
- Reduzir número máximo de jogadores em `server.js` (MAX_PLAYERS)
- Otimizar tick rate (TICK_RATE)

## Monitoramento

Health check endpoint:
```bash
curl https://<seu-app>.back4app.io/health
```

Logs no Back4App dashboard em tempo real.
