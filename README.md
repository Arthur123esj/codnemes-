# Codnemes Online

Jogo de associação de palavras multiplayer para navegador, inspirado no formato clássico de Codenames.

## Requisitos
- Node.js 20 ou superior
- npm

## Executar localmente
```bash
npm install
npm run dev
```
Abra http://localhost:3000 em duas ou mais abas para testar.

## Publicar online
A aplicação usa Express + Socket.IO e precisa de hospedagem Node.js que mantenha conexões WebSocket. Render, Railway ou Fly.io são opções. Configure o comando de início como `npm start`.

## Como jogar
1. Uma pessoa cria a sala e compartilha o código.
2. Os amigos entram pelo código.
3. Cada jogador escolhe equipe e função (mestre espião ou agente).
4. O anfitrião inicia quando houver mestre espião nas duas equipes.
5. Mestres dão uma palavra e um número; agentes escolhem as cartas.

## Próximos passos
- Persistência e reconexão robusta
- Validação avançada das dicas (palavras compostas/derivações)
- Proteção de informação secreta dos mestres espiões
- Testes automatizados e moderação de salas
- Deploy e domínio público

> Protótipo inicial: use apenas em partidas privadas de teste. O estado das salas fica em memória e é perdido quando o servidor reinicia.
