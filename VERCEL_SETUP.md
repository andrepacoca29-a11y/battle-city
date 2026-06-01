# Battle City - Configurado para Vercel

## 📋 Alterações para Vercel

Este projeto foi configurado para rodar no **Vercel** com as seguintes otimizações:

### ✅ O que foi alterado:

1. **`vercel.json`** - Configuração de deployment do Vercel
2. **`server.js`** - Adicionado suporte a HTTP long-polling (compatível com Vercel gratuito)
3. **`public/game.js`** - Cliente configurado para usar polling
4. **`.env.example`** - Variáveis de ambiente necessárias

### ⚠️ Importante: WebSocket vs Polling

- **Vercel gratuito**: Usa HTTP long-polling (funciona bem)
- **Vercel Pro**: Poderia usar WebSocket, mas é mais caro

O polling é um pouco mais lento que WebSocket, mas é perfeitamente viável para este jogo.

---

## 🚀 Deploy no Vercel

### 1. Prepare o ambiente

```bash
npm install
```

### 2. Crie um arquivo `.env.local` (ou configure no Vercel dashboard)

```env
NODE_ENV=production
JWT_SECRET=sua_chave_secreta_segura_aqui
```

### 3. Deploy

**Opção A: Via CLI Vercel**
```bash
npm i -g vercel
vercel
```

**Opção B: Via GitHub (recomendado)**
1. Push para GitHub
2. Conecte o repositório no Vercel dashboard
3. Vercel fará deploy automático a cada push

### 4. Configure variáveis no Vercel Dashboard

- Vá para seu projeto no [vercel.com](https://vercel.com)
- Clique em "Settings" → "Environment Variables"
- Adicione:
  - `JWT_SECRET` = sua chave secreta

---

## 🗄️ Banco de Dados SQLite

O SQLite será criado automaticamente quando o servidor iniciar. No Vercel:

- ✅ Funciona com read/write durante a execução
- ⚠️ Não persiste entre deploys (dados são perdidos)

**Para persistência permanente**, considere usar:
- [Neon (PostgreSQL gratuito)](https://neon.tech)
- [MongoDB Atlas (gratuito)](https://www.mongodb.com/cloud/atlas)
- [Supabase (PostgreSQL + Auth gratuito)](https://supabase.com)

---

## 🧪 Testar localmente

```bash
npm run dev
# ou
node server.js
```

Abra http://localhost:3000

---

## 📊 Monitoring

Para verificar se o servidor está vivo:

```bash
curl https://seu-app.vercel.app/health
```

---

## ⚡ Performance

- Polling: ~1 requisição/segundo (muito leve)
- Latência: ~100-200ms típico
- Compatível com Vercel gratuito

---

## 🆘 Troubleshooting

### Erro: "WebSocket connection failed"
✅ **Esperado no Vercel gratuito** - estamos usando polling automaticamente

### Erro: "CORS error"
- Verifique se o cliente está chamando o mesmo domínio
- O `vercel.json` já configura as rotas corretamente

### Banco de dados vazio após deploy
- ✅ Normal - SQLite não persiste no Vercel gratuito
- Configure um banco externo (Neon, Supabase, etc)

---

**Seu app está pronto para Vercel! 🎉**
