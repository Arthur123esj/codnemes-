const socket=io();
let state=null,myId=null,isHost=false,answerKey=null;
const $=id=>document.getElementById(id);
function notice(msg){$("notice").textContent=msg;$("notice").classList.remove("hidden");setTimeout(()=>$("notice").classList.add("hidden"),3200)}
function showGame(){ $("welcome").classList.add("hidden");$("game").classList.remove("hidden"); }
$("createBtn").onclick=()=>socket.emit("createRoom",{name:$("playerName").value});
$("joinBtn").onclick=()=>socket.emit("joinRoom",{name:$("playerName").value,code:$("roomCode").value});
$("assignBtn").onclick=()=>socket.emit("assign",{team:$("team").value,role:$("role").value});
$("startBtn").onclick=()=>socket.emit("startGame");
$("saveWordsBtn").onclick=()=>socket.emit("setCustomWords",{words:$("customWords").value.split(/\r?\n|,/)});
$("endTurnBtn").onclick=()=>socket.emit("endTurn");
$("newRoundBtn").onclick=()=>socket.emit("newRound");
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+"?room="+state.code);notice("Link do convite copiado!");}catch{notice("Código da sala: "+state.code)}};
socket.on("joined",s=>{myId=socket.id;showGame();});
socket.on("notice",notice);
socket.on("state",s=>{state=s;if(s.phase!=="playing")answerKey=null;render();});
socket.on("answerKey",key=>{answerKey=Array.isArray(key)?key:null;render();});
function render(){
 if(!state)return;
 showGame();$("roomCodeLabel").textContent=state.code;
 const me=state.players.find(p=>p.id===myId);isHost=state.hostId===myId;
 $("redPlayers").innerHTML="";$("bluePlayers").innerHTML="";
 for(const p of state.players){const el=document.createElement("div");el.className="player";el.textContent=p.name+" · "+(p.role==="spymaster"?"Mestre espião":p.role==="operative"?"Agente":"Escolhendo")+(p.connected?"":" · reconectando");(p.team==="red"?$("redPlayers"):p.team==="blue"?$("bluePlayers"):null)?.append(el);}
 $("startBtn").classList.toggle("hidden",!isHost);
 $("customWordsPanel").classList.toggle("hidden",!isHost);
 $("customWordsStatus").textContent=state.customWordsCount>0?`${state.customWordsCount} palavra(s) personalizada(s); o restante será aleatório.`:"Nenhuma palavra personalizada; todas serão aleatórias.";
 $("lobby").classList.toggle("hidden",state.phase!=="lobby");
 $("playing").classList.toggle("hidden",state.phase!=="playing");
 $("finished").classList.toggle("hidden",state.phase!=="finished");
 if(state.phase==="playing"){
  const redAgents=state.players.filter(p=>p.team==="red"&&p.role==="operative");
  const blueAgents=state.players.filter(p=>p.team==="blue"&&p.role==="operative");
  const redMaster=state.players.find(p=>p.team==="red"&&p.role==="spymaster");
  const blueMaster=state.players.find(p=>p.team==="blue"&&p.role==="spymaster");
  const renderAgents=players=>players.length?players.map(p=>'<span class="roster-chip">'+escapeHtml(p.name)+'</span>').join(""):'<span class="roster-empty">Nenhum agente ainda</span>';
  $("redOperatives").innerHTML=renderAgents(redAgents);
  $("blueOperatives").innerHTML=renderAgents(blueAgents);
  $("redSpymaster").textContent=redMaster?redMaster.name:"Aguardando mestre espião";
  $("blueSpymaster").textContent=blueMaster?blueMaster.name:"Aguardando mestre espião";
  $("turnLabel").textContent=state.turn==="red"?"🔴 VERMELHA":"🔵 AZUL";
  $("redCount").textContent=state.counts.red;$("blueCount").textContent=state.counts.blue;
  const board=$("board");board.innerHTML="";
  state.board.forEach(card=>{const b=document.createElement("button");b.className="card"+(card.revealed?" revealed "+card.color:"");
   if(!card.revealed&&me?.role==="spymaster"&&answerKey?.[card.index])b.classList.add("key-"+answerKey[card.index]);b.textContent=card.word;b.disabled=card.revealed||!me||me.team!==state.turn||me.role!=="operative"||!state.clue;b.onclick=()=>socket.emit("guess",{index:card.index});board.append(b);});
  const clueBox=$("clueBox");clueBox.innerHTML=state.clue?'<div class="eyebrow">DICA DO MESTRE</div><h3>'+escapeHtml(state.clue.word)+' · '+state.clue.number+'</h3><p>Equipe, discutam e escolham suas palavras.</p>':'<div class="eyebrow">AGUARDANDO DICA</div><p>O mestre espião está preparando uma pista.</p>';
  const sm=$("spymasterBox");sm.innerHTML="";
  if(me&&me.team===state.turn&&me.role==="spymaster"&&!state.clue){sm.innerHTML='<h3>Sua dica</h3><input id="clueWord" maxlength="30" placeholder="Uma palavra"><input id="clueNumber" type="number" min="0" max="9" value="1"><button class="primary" id="sendClue">Enviar dica</button>';$("sendClue").onclick=()=>socket.emit("giveClue",{word:$("clueWord").value,number:$("clueNumber").value});}
  $("endTurnBtn").classList.toggle("hidden",!(me&&me.team===state.turn&&me.role==="operative"&&!!state.clue));
 }
 if(state.phase==="finished")$("winnerLabel").textContent=state.winner==="red"?"🔴 Equipe vermelha venceu!":"🔵 Equipe azul venceu!";
 $("newRoundBtn").classList.toggle("hidden",!isHost);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
const params=new URLSearchParams(location.search);if(params.get("room"))$("roomCode").value=params.get("room");
