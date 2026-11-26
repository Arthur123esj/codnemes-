const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const WORDS = [
"ABACAXI","ÁGUIA","ÂNCORA","ANJO","APITO","ARCO","AREIA","ARMADILHA","ASTRONAUTA","AVIÃO",
"BAILARINA","BANCO","BARCO","BARRIL","BATERIA","BOLA","BOMBA","BOTÃO","BRUXA","CABO",
"CACTO","CAFÉ","CAIXA","CAMA","CAMPO","CANAL","CANETA","CAPITÃO","CARRO","CARTA",
"CASTELO","CAVALO","CÉREBRO","CHAVE","CHUVA","CINEMA","COBRA","COGUMELO","COLA","COROA",
"CRUZ","DADO","DANÇA","DESERTO","DIAMANTE","DINOSSAURO","DISCO","DRAGÃO","ELEFANTE","ESCADA",
"ESCOLA","ESPADA","ESTRELA","FANTASMA","FAROL","FERRO","FESTA","FLORESTA","FOGUETE","FOLHA",
"FONTE","FORMIGA","FOTOGRAFIA","FRIO","FUTEBOL","GALINHA","GATO","GELO","GIGANTE","GIRAFA",
"GUERRA","HELICÓPTERO","ILHA","ÍMÃ","ÍNDIO","JANELA","JARDIM","JATO","JOGO","JORNAL",
"LÂMPADA","LARANJA","LEÃO","LIVRO","LUA","LUVA","MÁGICO","MAR","MARTE","MÁSCARA",
"MEDALHA","MEL","MEMÓRIA","MESA","METAL","MONSTRO","MONTANHA","MOTOR","MÚSICA","NAVIO",
"NÉVOA","NEVE","NOITE","NUVEM","ÓCULOS","OLHO","OURO","OVELHA","PÁ","PALÁCIO",
"PANDA","PAPEL","PARQUE","PASSAPORTE","PEDRA","PEIXE","PÊRA","PILOTO","PIRATA","PISTA",
"PLANETA","PLANTA","PONTE","PONTO","PORTA","PRAIA","PRATA","PRESENTE","PROFESSOR","QUADRO",
"QUEIJO","RAIO","RELÓGIO","RIO","ROBÔ","RODA","ROSA","SANGUE","SAPATO","SATÉLITE",
"SEGREDO","SEREIA","SINO","SOL","SORVETE","TATUAGEM","TAXI","TEATRO","TECLADO","TELEFONE",
"TEMPLO","TESOURO","TIGRE","TINTA","TOMATE","TORRE","TREM","TRIÂNGULO","TUBARÃO","UNIVERSO",
"VAMPIRO","VASSOURA","VENTO","VIDRO","VIOLETA","VIOLÃO","VOLANTE","XADREZ","ZEBRA","ZÍPER"
];

const rooms = new Map();
const COLORS = ["red", "blue"];
const code = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

function publicRoom(room) {
  return {
    code: room.code, phase: room.phase, players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, team: p.team, role: p.role, connected: p.connected
    })),
    board: room.board?.map((card, i) => ({
      index: i, word: card.word,
      revealed: card.revealed,
      color: card.revealed ? card.color : null
    })),
    turn: room.turn, counts: room.counts, clue: room.clue,
    winner: room.winner, hostId: room.hostId,
    remainingGuesses: room.remainingGuesses,
    customWordsCount: room.customWords?.length || 0
  };
}
function emitRoom(room) {
  io.to(room.code).emit("state", publicRoom(room));
  // The answer key is sent privately to spymasters only.
  for (const player of room.players.values()) {
    if (player.connected && player.role === "spymaster" && room.board) {
      io.to(player.id).emit("answerKey", room.board.map(card => card.color));
    }
  }
}
function error(socket, message) { socket.emit("notice", message); }

function newBoard(customWords = []) {
  const words = customWords.length === 25 ? shuffle(customWords) : shuffle(WORDS).slice(0,25);
  const start = Math.random() < 0.5 ? "red" : "blue";
  const colors = shuffle([
    ...Array(9).fill("red"), ...Array(8).fill("blue"),
    ...Array(7).fill("neutral"), "assassin"
  ]);
  // The starting team receives nine agents.
  const blueIndex = colors.indexOf("blue");
  if (start === "blue") {
    const redIndex = colors.indexOf("red");
    [colors[redIndex], colors[blueIndex]] = [colors[blueIndex], colors[redIndex]];
  }
  return { cards: words.map((word,i)=>({word,color:colors[i],revealed:false})), start };
}
function startGame(room) {
  const board = newBoard(room.customWords || []);
  room.board = board.cards;
  room.turn = board.start;
  room.phase = "playing";
  room.clue = null;
  room.remainingGuesses = 0;
  room.winner = null;
  room.counts = {
    red: room.board.filter(c=>c.color==="red").length,
    blue: room.board.filter(c=>c.color==="blue").length
  };
}

io.on("connection", socket => {
  socket.on("createRoom", ({name}) => {
    if (!name?.trim()) return error(socket,"Digite seu nome.");
    let roomCode; do { roomCode=code(); } while(rooms.has(roomCode));
    const player={id:socket.id,name:name.trim().slice(0,18),team:null,role:"player",connected:true};
    const room={code:roomCode,hostId:socket.id,players:new Map([[socket.id,player]]),phase:"lobby",board:null,turn:null,counts:{red:0,blue:0},clue:null,winner:null,remainingGuesses:0,customWords:[]};
    rooms.set(roomCode,room); socket.join(roomCode);
    socket.emit("joined",publicRoom(room)); emitRoom(room);
  });

  socket.on("joinRoom", ({code:roomCode,name}) => {
    const room=rooms.get(String(roomCode||"").toUpperCase());
    if (!room) return error(socket,"Sala não encontrada. Confira o código.");
    if (!name?.trim()) return error(socket,"Digite seu nome.");
    if (room.phase!=="lobby") return error(socket,"Essa partida já começou.");
    if (room.players.size>=20) return error(socket,"A sala está cheia.");
    const player={id:socket.id,name:name.trim().slice(0,18),team:null,role:"player",connected:true};
    room.players.set(socket.id,player); socket.join(room.code);
    socket.emit("joined",publicRoom(room)); emitRoom(room);
  });

  socket.on("assign", ({team,role}) => {
    const room=[...rooms.values()].find(r=>r.players.has(socket.id));
    if (!room || room.phase!=="lobby") return;
    if (!COLORS.includes(team) || !["spymaster","operative"].includes(role)) return;
    const p=room.players.get(socket.id); p.team=team; p.role=role; emitRoom(room);
  });

  socket.on("setCustomWords", ({words}) => {
    const room=[...rooms.values()].find(r=>r.players.has(socket.id));
    if (!room || room.hostId!==socket.id || room.phase!=="lobby") return;
    if (!Array.isArray(words)) return error(socket,"Envie uma lista de palavras válida.");
    const cleaned=words.map(w=>String(w||"").trim().replace(/\\s+/g," ").toUpperCase()).filter(Boolean);
    const unique=[...new Set(cleaned)];
    if (unique.length!==25) return error(socket,`Você precisa informar exatamente 25 palavras diferentes. Foram encontradas ${unique.length}.`);
    if (unique.some(w=>w.length>24)) return error(socket,"Cada palavra deve ter no máximo 24 caracteres.");
    room.customWords=unique;
    emitRoom(room);
    socket.emit("notice","As 25 palavras personalizadas foram salvas!");
  });

  socket.on("startGame", () => {
    const room=[...rooms.values()].find(r=>r.players.has(socket.id));
    if (!room || room.hostId!==socket.id) return;
    const teams=COLORS.every(team=>[...room.players.values()].some(p=>p.team===team));
    if (!teams) return error(socket,"Coloque pelo menos um jogador em cada equipe.");
    if (room.customWords && room.customWords.length!==25) return error(socket,"A lista personalizada precisa ter 25 palavras.");
    if (!COLORS.every(team=>[...room.players.values()].some(p=>p.team===team&&p.role==="spymaster"))) return error(socket,"Cada equipe precisa de um mestre espião.");
    startGame(room); emitRoom(room);
  });

  socket.on("giveClue", ({word,number}) => {
    const room=[...rooms.values()].find(r=>r.players.has(socket.id));
    const p=room?.players.get(socket.id);
    if (!room || room.phase!=="playing" || p.team!==room.turn || p.role!=="spymaster" || room.clue) return;
    const n=Number(number), clueWord=String(word||"").trim().toUpperCase();
    if (!clueWord || clueWord.length>30 || !Number.isInteger(n) || n<0 || n>9) return error(socket,"Dica ou número inválido.");
    room.clue={word:clueWord,number:n};
    room.remainingGuesses=n+1; emitRoom(room);
  });

  socket.on("guess", ({index}) => {
    const room=[...rooms.values()].find(r=>r.players.has(socket.id));
    const p=room?.players.get(socket.id);
    if (!room || room.phase!=="playing" || !room.clue || p.team!==room.turn || p.role!=="operative") return;
    const card=room.board[Number(index)];
    if (!card || card.revealed) return;
    card.revealed=true;
    if (card.color==="assassin") { room.winner=room.turn==="red"?"blue":"red"; room.phase="finished"; }
    else if (card.color==="red" || card.color==="blue") {
      room.counts[card.color]--;
      if (room.counts[card.color]===0) { room.winner=card.color; room.phase="finished"; }
      else if (card.color!==room.turn) { room.turn=room.turn==="red"?"blue":"red"; room.clue=null; room.remainingGuesses=0; }
      else { room.remainingGuesses--; if(room.remainingGuesses<=0){room.turn=room.turn==="red"?"blue":"red";room.clue=null;room.remainingGuesses=0;} }
    } else { room.turn=room.turn==="red"?"blue":"red"; room.clue=null; room.remainingGuesses=0; }
    emitRoom(room);
  });

  socket.on("endTurn", () => {
    const room=[...rooms.values()].find(r=>r.players.has(socket.id));
    const p=room?.players.get(socket.id);
    if (!room || room.phase!=="playing" || !room.clue || p.team!==room.turn || p.role!=="operative") return;
    room.turn=room.turn==="red"?"blue":"red"; room.clue=null; room.remainingGuesses=0; emitRoom(room);
  });

  socket.on("newRound", () => {
    const room=[...rooms.values()].find(r=>r.players.has(socket.id));
    if (!room || room.hostId!==socket.id || room.phase!=="finished") return;
    room.phase="lobby"; room.board=null; room.clue=null; room.winner=null;
    for (const p of room.players.values()) { p.team=null; p.role="player"; }
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      if (room.players.has(socket.id)) {
        const p=room.players.get(socket.id); p.connected=false;
        emitRoom(room);
        setTimeout(()=>{ if(room.players.get(socket.id)?.connected===false) { room.players.delete(socket.id); if(room.hostId===socket.id) room.hostId=room.players.keys().next().value; emitRoom(room); if(!room.players.size) rooms.delete(room.code); } },30000);
      }
    }
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log("Codenames Online rodando na porta "+PORT));
