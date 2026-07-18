var xe=Object.defineProperty;var Pe=(t,e,s)=>e in t?xe(t,e,{enumerable:!0,configurable:!0,writable:!0,value:s}):t[e]=s;var M=(t,e,s)=>Pe(t,typeof e!="symbol"?e+"":e,s);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const c of o.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&n(c)}).observe(document,{childList:!0,subtree:!0});function s(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(r){if(r.ep)return;r.ep=!0;const o=s(r);fetch(r.href,o)}})();var Z={};const se={debug:0,info:1,warn:2,error:3,silent:4};function je(){if(typeof process<"u"&&Z){if(Z.VITEST)return"warn";const t=Z.LOG_LEVEL;if(t&&t in se)return t}return"info"}let be=je();function Ce(t){be=t}function ge(t){const e=(s,n,r)=>{se[s]<se[be]||n(`${new Date().toISOString().slice(11,23)} ${s.toUpperCase().padEnd(5)} [${t}]`,...r)};return{debug:(...s)=>e("debug",console.debug,s),info:(...s)=>e("info",console.log,s),warn:(...s)=>e("warn",console.warn,s),error:(...s)=>e("error",console.error,s)}}function Ae(t,e){const s=t.endsWith("/")?t.slice(0,-1):t,n=e.startsWith("/")?e.slice(1):e;return`${s}/${n}`}class Te{constructor(e,s){M(this,"assetPathById");this.presentation=e,this.basePath=s,this.assetPathById=new Map(e.assets.map(n=>[n.id,Ae(s,n.path)]))}resolveAssetUrl(e){const s=this.assetPathById.get(e);if(!s)throw new Error(`asset_not_found:${e}`);return s}listAssetIds(){return[...this.assetPathById.keys()]}getPresentation(){return this.presentation}}function ye(t){return t.ships.map((e,s)=>({shipId:e.id,cells:Array.from({length:e.size}).map((n,r)=>({row:s,col:r}))}))}const ze=ge("client");class Me{constructor(e){M(this,"socket",null);M(this,"lastJoinEvent",null);M(this,"serverListeners",new Set);M(this,"clientListeners",new Set);M(this,"logListeners",new Set);M(this,"pendingEvents",[]);M(this,"reconnectTimer",null);M(this,"shouldReconnect",!0);this.socketFactory=e}connect(){this.socket&&this.socket.readyState===0||(this.socket=this.socketFactory(),this.emitLog("connect"),this.socket.onmessage=e=>{const s=JSON.parse(e.data);this.emitLog(`recv ${s.type}`);for(const n of this.serverListeners)n(s)},this.socket.onopen=()=>{this.emitLog("open"),this.flushPending()},this.socket.onclose=()=>{this.emitLog("close"),this.socket=null,this.shouldReconnect&&!this.reconnectTimer&&(this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null,this.connect()},1e3))},this.socket.onerror=()=>{this.emitLog("error")})}disconnect(){var e;this.shouldReconnect=!1,this.reconnectTimer&&(clearTimeout(this.reconnectTimer),this.reconnectTimer=null),this.emitLog("disconnect"),(e=this.socket)==null||e.close(),this.socket=null}reconnect(){var e;this.shouldReconnect=!0,this.reconnectTimer&&(clearTimeout(this.reconnectTimer),this.reconnectTimer=null),(e=this.socket)==null||e.close(),this.connect()}send(e){if(!this.socket)throw new Error("socket_not_connected");if((e.type==="session.join"||e.type==="session.create")&&(this.lastJoinEvent=e),this.emitLog(`send ${e.type}`),this.socket.readyState===1)this.socket.send(JSON.stringify(e));else{if(e.type==="session.join"||e.type==="session.create"){const s=this.pendingEvents.filter(n=>n.type!=="session.join"&&n.type!=="session.create");this.pendingEvents.splice(0,this.pendingEvents.length,...s,e)}else this.pendingEvents.push(e);this.emitLog(`send_queued readyState=${this.socket.readyState}`)}for(const s of this.clientListeners)s(e)}onServerEvent(e){return this.serverListeners.add(e),()=>this.serverListeners.delete(e)}onClientEvent(e){return this.clientListeners.add(e),()=>this.clientListeners.delete(e)}onLog(e){return this.logListeners.add(e),()=>this.logListeners.delete(e)}emitLog(e){ze.debug(e);for(const s of this.logListeners)s(e)}flushPending(){if(!(!this.socket||this.socket.readyState!==1))for(this.lastJoinEvent&&!this.pendingEvents.some(e=>e.type==="session.join"||e.type==="session.create")&&this.pendingEvents.unshift(this.lastJoinEvent);this.pendingEvents.length>0;){const e=this.pendingEvents.shift();if(!e)break;this.socket.send(JSON.stringify(e)),this.emitLog(`send_flushed ${e.type}`)}}}function De(t){const e=t;if(!(e!=null&&e.gameId)||!(e!=null&&e.presentationVersion))throw new Error("invalid_presentation_definition");if(!e.board||!e.board.boardType)throw new Error("invalid_presentation_definition");const s=e.assets??[],n=new Set(s.map(r=>r.id));for(const r of Object.values(e.pieceSprites??{}))if(!n.has(r))throw new Error(`unknown_asset_reference:${r}`);for(const r of Object.values(e.effects??{}))if(!n.has(r))throw new Error(`unknown_asset_reference:${r}`);return e}class Re{constructor(){M(this,"factories",new Map)}register(e,s){this.factories.set(e,s)}create(e){const s=this.factories.get(e);if(!s)throw new Error(`renderer_not_registered:${e}`);return s()}}function U(t){return`${t.row}:${t.col}`}const Ne=["A","B","C","D","E","F","G","H","I","J"];function ve(t){const e=Array.from({length:t},(s,n)=>`<div style="text-align:center;font-size:10px;font-weight:600;color:var(--text-muted);letter-spacing:0.04em;user-select:none;">${Ne[n]??n}</div>`).join("");return`<div style="display:grid;grid-template-columns:20px repeat(${t},1fr);gap:2px;margin-bottom:2px;">
    <div></div>${e}
  </div>`}function Oe(t){const e=new Set((t.ships??[]).flatMap(r=>r.cells.map(U))),s=new Set((t.hitsTaken??[]).map(U)),n=[];for(let r=0;r<t.rows;r+=1){const o=[];for(let l=0;l<t.cols;l+=1){const i=`${r}:${l}`;let a="cell water";e.has(i)&&s.has(i)?a="cell taken-hit":e.has(i)&&(a="cell ship"),o.push(`<button class="${a} own-cell" data-board="own" data-r="${r}" data-c="${l}" type="button" aria-label="Own ${r},${l}"></button>`)}const c=`<div style="font-size:10px;font-weight:600;color:var(--text-muted);display:flex;align-items:center;justify-content:center;user-select:none;">${r+1}</div>`;n.push(`<div style="display:grid;grid-template-columns:20px repeat(${t.cols},1fr);gap:2px;">${c}${o.join("")}</div>`)}return`
    <div>
      ${ve(t.cols)}
      <div style="display:flex;flex-direction:column;gap:2px;">${n.join("")}</div>
    </div>
  `}function Be(t){const e=new Set((t.shotsFired??[]).map(U)),s=new Set((t.knownHits??[]).map(U)),n=new Set((t.sunkShips??[]).flatMap(o=>o.cells.map(U))),r=[];for(let o=0;o<t.rows;o+=1){const c=[];for(let i=0;i<t.cols;i+=1){const a=`${o}:${i}`;let m="cell water",u="";n.has(a)?(m="cell attack-hit sunk-cell",u=' style="background:#dc2626;box-shadow:0 0 6px #dc2626,inset 0 0 4px #7f1d1d"'):e.has(a)&&s.has(a)?m="cell attack-hit":e.has(a)&&(m="cell attack-miss");const h=e.has(a)?"":" opponent-cell";c.push(`<button class="${m}${h}"${u} data-board="opponent" data-r="${o}" data-c="${i}" type="button" aria-label="Fire ${o},${i}"></button>`)}const l=`<div style="font-size:10px;font-weight:600;color:var(--text-muted);display:flex;align-items:center;justify-content:center;user-select:none;">${o+1}</div>`;r.push(`<div style="display:grid;grid-template-columns:20px repeat(${t.cols},1fr);gap:2px;">${l}${c.join("")}</div>`)}return`
    <div>
      ${ve(t.cols)}
      <div style="display:flex;flex-direction:column;gap:2px;">${r.join("")}</div>
    </div>
  `}class qe{render(e){const s=e??{},n=s.ownBoard??{rows:10,cols:10},r=s.opponentBoard??{rows:10,cols:10},o=(n.hitsTaken??[]).length,c=(n.ships??[]).reduce((a,m)=>a+m.cells.length,0),l=(r.knownHits??[]).length,i=(r.shotsFired??[]).length-l;return`
      <div class="board-root">
        <div class="board-columns">
          <section class="own-panel">
            <h3>Your Board</h3>
            <div class="board-wrapper">
              ${Oe(n)}
            </div>
            <div class="board-meta">
              <span>${o} hit${o!==1?"s":""} taken</span>
              <span>${c-o} cells intact</span>
            </div>
          </section>
          <section class="opponent-panel">
            <h3>Opponent Board — click to fire</h3>
            <div class="board-wrapper">
              ${Be(r)}
            </div>
            <div class="board-meta">
              <span style="color:#86efac">${l} hit${l!==1?"s":""}</span>
              <span>${i} miss${i!==1?"es":""}</span>
              <span>${(r.shotsFired??[]).length} shots fired</span>
            </div>
          </section>
        </div>
      </div>
    `}}function Fe(){return{sessionId:null,playerId:null,seatId:null,seatNames:{},synced:!1,seq:0,view:null,patch:null,pendingActionId:null,lastError:null,lastEvents:[],terminal:null}}function Ge(t,e){return t.sessionId?e.sessionId===t.sessionId:!0}function He(t,e){return Ge(t,e)?e.type==="session.created"?{...t,sessionId:e.sessionId,lastError:null}:e.type==="session.state_sync"?{...t,sessionId:e.sessionId,seatId:e.youAre??t.seatId,seatNames:e.seats??t.seatNames,synced:!0,seq:e.seq,view:e.view,patch:null,lastError:null}:e.type==="session.action_accepted"?{...t,seq:e.seq,pendingActionId:null,lastError:null,lastEvents:e.events}:e.type==="session.action_rejected"?{...t,pendingActionId:null,lastError:e.reason}:e.type==="session.state_patch"?{...t,seq:e.seq,patch:e.patch}:{...t,terminal:{winnerPlayerId:e.winnerPlayerId,reason:e.reason}}:t}function Ue(t,e,s,n){if(!t.sessionId||!t.playerId)throw new Error("session_or_player_missing");return{sessionId:t.sessionId,expectedSeq:t.seq,actorPlayerId:t.playerId,actionType:e,payload:s,clientActionId:n}}const ee=ge("controller");function We(t){let e=Fe(),s=0,n=null,r,o;t.subscribe(p=>{e=He(e,p)});function c(){return s+=1,`client-action-${s}`}function l(p,f,g,d,y){e={...e,sessionId:p,playerId:f,seatId:null,synced:!1,view:null,terminal:null,lastError:null,lastEvents:[]},g?(n=g,r=d,o=y,ee.info(`create ${p} (${g}) as "${f}" seats=${d??"default"} bots=${y??0}`),t.send({type:"session.create",sessionId:p,gameId:g,playerId:f,seatCount:d,bots:y})):(n=null,ee.info(`join ${p} as "${f}"`),t.send({type:"session.join",sessionId:p,playerId:f}))}function i(){if(!e.sessionId||!e.playerId)throw new Error("session_or_player_missing");n?t.send({type:"session.create",sessionId:e.sessionId,gameId:n,playerId:e.playerId,seatCount:r,bots:o}):t.send({type:"session.join",sessionId:e.sessionId,playerId:e.playerId})}function a(p,f){ee.debug(`submit ${p}`,f);const g=c();e={...e,pendingActionId:g},t.send({type:"action.submit",envelope:Ue(e,p,f,g)})}function m(p){a("place_ships",{placements:p})}function u(p){a("fire",p)}function h(){return e}return{join:l,rejoin:i,submitAction:a,submitPlaceShips:m,submitFire:u,getState:h}}function te(t){const e=De(t.presentation),s=new Te(e,t.baseAssetPath),n=new Re;n.register("grid",()=>new qe);const r=n.create(e.board.boardType),o=We(t.transport);return{presentation:e,assetManager:s,renderer:r,controller:o,rejoin:()=>{o.rejoin()}}}const Ve="battleship",Je="0.1.0",Ye={rows:10,cols:10},Ke=[{id:"carrier",size:5},{id:"battleship",size:4},{id:"cruiser",size:3},{id:"submarine",size:3},{id:"destroyer",size:2}],Xe=["setup","play","terminal"],Qe={gameId:Ve,version:Je,board:Ye,ships:Ke,phases:Xe},Ze="battleship",et="0.1.0",tt="0.2.0",st={boardType:"grid",rows:10,cols:10,cellSize:40},nt={name:"sea-command",colors:{bg:"#ecf8ff",grid:"#12517a",hit:"#d62828",miss:"#6b7f93"}},rt=[{id:"tile-water",kind:"image",path:"assets/external/sea-warfare-set/effects/water.png"},{id:"tile-hit",kind:"image",path:"assets/external/sea-warfare-set/effects/hit.png"},{id:"tile-miss",kind:"image",path:"assets/external/sea-warfare-set/effects/miss.png"},{id:"ship-carrier",kind:"image",path:"assets/external/sea-warfare-set/ships/carrier.png"},{id:"ship-battleship",kind:"image",path:"assets/external/sea-warfare-set/ships/battleship.png"},{id:"ship-cruiser",kind:"image",path:"assets/external/sea-warfare-set/ships/cruiser.png"},{id:"ship-submarine",kind:"image",path:"assets/external/sea-warfare-set/ships/submarine.png"},{id:"ship-destroyer",kind:"image",path:"assets/external/sea-warfare-set/ships/destroyer.png"}],ot={carrier:"ship-carrier",battleship:"ship-battleship",cruiser:"ship-cruiser",submarine:"ship-submarine",destroyer:"ship-destroyer"},it={"shot.hit":"tile-hit","shot.miss":"tile-miss"},at={gameId:Ze,version:et,presentationVersion:tt,board:st,theme:nt,assets:rt,pieceSprites:ot,effects:it},le={definition:Qe,presentation:at},lt="labyrinth",ct="0.1.0",dt="0.1.0",pt={boardType:"grid",rows:7,cols:7,cellSize:64},ut={name:"maze-vault",colors:{bg:"#f8f5eb",grid:"#5e4b37",path:"#d9c7a7",pawn:"#7f1d1d"}},ht=[{id:"tile-path",kind:"image",path:"assets/tiles/path.svg"},{id:"tile-wall",kind:"image",path:"assets/tiles/wall.svg"}],ft={pawn:"tile-path"},mt={"objective.collected":"tile-path"},bt={gameId:lt,version:ct,presentationVersion:dt,board:pt,theme:ut,assets:ht,pieceSprites:ft,effects:mt},gt={presentation:bt},yt="connect4",vt="0.1.0",$t="0.1.0",wt={boardType:"grid",rows:6,cols:7,cellSize:56},St={name:"arcade-drop",colors:{bg:"#0b1a2e",grid:"#1d3a5f",p1:"#ef4444",p2:"#facc15"}},It=[],Et={gameId:yt,version:vt,presentationVersion:$t,board:wt,theme:St,assets:It},kt={presentation:Et};function Lt(t,e,s,n){return`
    <section class="app-shell">
      ${`
    <nav class="top-nav" aria-label="Primary">
      <a class="brand" href="#/">Board Game Sim</a>
      <div class="top-nav-right">
        <span class="top-chip" id="copy-session-btn" style="cursor: pointer; user-select: none;" title="Click to copy session ID">⬡ ${s}</span>
        <span class="top-chip" title="Your player identity">● ${n}</span>
        ${e.name==="game"?'<button class="btn btn-ghost" id="nav-back-btn" style="padding:6px 12px;font-size:12px">← Hub</button>':""}
      </div>
    </nav>
  `}
      <main>${t}</main>
    </section>
  `}const $e=[{gameId:"battleship",name:"Battleship",subtitle:"Hidden fleet placement with tactical turn-based strikes.",status:"live",releaseTag:"Playable now",players:"2 players",turnStyle:"Alternating turns"},{gameId:"labyrinth",name:"Labyrinth",subtitle:"Shifting maze strategy with rotating board pathways.",status:"live",releaseTag:"Playable now",players:"2-4 players",turnStyle:"Board transform turns"},{gameId:"connect4",name:"Connect Four",subtitle:"Drop discs and connect four — beat a friend or the computer.",status:"live",releaseTag:"Playable now",players:"2 players (or vs AI)",turnStyle:"Alternating drops"},{gameId:"catan",name:"Catan",subtitle:"Resource trading and settlement growth on a hex island.",status:"coming-soon",releaseTag:"Coming soon: later milestone",players:"3-4 players",turnStyle:"Dice + trading rounds"}];function _t(t){return t==="catan"?null:{name:"game",gameId:t}}function xt(t){const e=t.status==="live",s=e?"Play now →":"Coming soon",n=t.gameId==="battleship"?"⚓":t.gameId==="labyrinth"?"🌀":"🎲";return`
    <article class="card game-card ${e?"":"is-disabled"}" aria-disabled="${e?"false":"true"}">
      <div class="game-card-head">
        <h2><span style="margin-right:6px">${n}</span>${t.name}</h2>
        <span class="status-pill ${e?"status-live":"status-soon"}">${e?"Live":"Soon"}</span>
      </div>
      <p class="game-subtitle">${t.subtitle}</p>
      <div class="meta-list">
        <span>${t.players}</span>
        <span>${t.turnStyle}</span>
      </div>
      <button class="btn ${e?"btn-primary":"btn-ghost"}" data-game-id="${t.gameId}" ${e?"":'disabled aria-disabled="true"'} style="margin-top:4px;width:100%">${s}</button>
    </article>
  `}function Pt(t){return`
    <section class="screen game-hub" aria-label="Game hub">
      <header class="hero">
        <p class="eyebrow">Board Game Sim</p>
        <h1>Choose Your Table</h1>
        <p>Play turn-based games with friends across cities from one shared command center.</p>
      </header>
      <section class="game-grid" id="game-hub-grid" aria-label="Available games">
        ${t}
      </section>
    </section>
  `}function jt(){const t=$e.map(xt).join("");return Pt(t)}function Ct(t){const e=$e.find(s=>s.gameId===t);return`
    <section class="screen coming-soon" aria-label="Coming soon">
      <article class="card panel">
        <p class="eyebrow">Roadmap</p>
        <h1>${(e==null?void 0:e.name)??t} is coming soon</h1>
        <p>${(e==null?void 0:e.subtitle)??"This module is planned for a future release."}</p>
        <button class="btn btn-primary" id="back-home-btn">Back to games</button>
      </article>
    </section>
  `}function At(t,e){return t?(e.phase??"setup")==="setup"?"setup":"gameplay":"lobby"}function B(t,e){switch(t.rotationDeg){case 0:return Array.from({length:e},(s,n)=>({row:t.row,col:t.col+n}));case 90:return Array.from({length:e},(s,n)=>({row:t.row+n,col:t.col}));case 180:return Array.from({length:e},(s,n)=>({row:t.row,col:t.col-n}));case 270:return Array.from({length:e},(s,n)=>({row:t.row-n,col:t.col}));default:return Array.from({length:e},(s,n)=>({row:t.row,col:t.col+n}))}}function ne(t,e){return t.every(s=>s.row>=0&&s.row<e.board.rows&&s.col>=0&&s.col<e.board.cols)}function ce(t){const e={};for(const s of t){const n=s.cells[0],r=s.cells[1]??n,o=n.row===r.row?"horizontal":"vertical";e[s.shipId]={row:n.row,col:n.col,rotationDeg:o==="horizontal"?0:90}}return e}function Tt(t){return(t+90)%360}function zt(t,e,s){const{rows:n,cols:r}=s.board;let o,c,l,i;switch(t.rotationDeg){case 0:o=0,c=n-1,l=0,i=r-e;break;case 90:o=0,c=n-e,l=0,i=r-1;break;case 180:o=0,c=n-1,l=e-1,i=r-1;break;case 270:o=e-1,c=n-1,l=0,i=r-1;break;default:o=0,c=n-1,l=0,i=r-e}return{...t,row:Math.min(Math.max(t.row,o),c),col:Math.min(Math.max(t.col,l),i)}}function Mt(t){const e=[...t.ships].sort((o,c)=>c.size-o.size),s=t.board.rows,n=t.board.cols,r=o=>`${o.row},${o.col}`;for(let o=0;o<200;o+=1){const c=new Set,l=[];let i=!0;for(const a of e){let m=!1;for(let u=0;u<200;u+=1){const h=Math.random()<.5?"horizontal":"vertical",p=h==="vertical"?s-a.size:s-1,f=h==="horizontal"?n-a.size:n-1,g=Math.floor(Math.random()*(p+1)),d=Math.floor(Math.random()*(f+1)),y=B({row:g,col:d,rotationDeg:h==="horizontal"?0:90},a.size);if(y.every(w=>!c.has(r(w)))){y.forEach(w=>c.add(r(w))),l.push({shipId:a.id,cells:y}),m=!0;break}}if(!m){i=!1;break}}if(i&&l.length===e.length)return l}return ye(t)}function de(t,e,s,n){const r=new Set;for(const o of t){if(o.id===s)continue;const c=e[o.id];if(c)for(const l of B(c,o.size))r.add(`${l.row},${l.col}`)}return n.every(o=>!r.has(`${o.row},${o.col}`))}function Dt(t,e,s){return t.map(n=>{const r=e[n.id];if(!r)throw new Error(`ship_not_placed_${n.id}`);const o=B(r,n.size);if(!ne(o,s))throw new Error(`ship_out_of_bounds_${n.id}`);return{shipId:n.id,cells:o}})}const Rt={session_full:"Game is full",session_not_found:"No game with that code",not_your_turn:"Not your turn",duplicate_shot:"You already fired there",reverse_insertion_forbidden:"You can't push the tile back where it just came from",illegal_action:"That move isn't allowed right now"};function V(t){return t?Rt[t]??t.replace(/_/g," "):""}function Nt(t){const e=t.match(/^(.*)-r(\d+)$/);return e?`${e[1]}-r${Number(e[2])+1}`:`${t}-r2`}function oe(t,e,s){const n=s.seatCount!==void 0?`
        <div class="lobby-field-group">
          <label for="seat-count">Players</label>
          <select id="seat-count">
            ${[2,3,4].map(r=>`<option value="${r}" ${r===s.seatCount?"selected":""}>${r} players</option>`).join("")}
          </select>
          <span class="field-hint">Only used when creating a new game</span>
        </div>`:"";return`
    <div class="card panel join-panel">
      <h2>${s.title}</h2>
      <div class="lobby-fields">
        <div class="lobby-field-group">
          <label for="session-id">Game Code</label>
          <div class="lobby-input-row">
            <input id="session-id" value="${t}" placeholder="e.g. my-game-123" autocomplete="off" spellcheck="false" />
            <button class="btn btn-ghost" id="new-session-btn" type="button" title="Generate a new random game code" style="padding:0 10px;font-size:16px;">⟳</button>
          </div>
          <span class="field-hint">Share this code with a friend to play together</span>
        </div>
        <div class="lobby-field-group">
          <label for="player-id">Your Name</label>
          <input id="player-id" value="${e}" placeholder="e.g. alice" autocomplete="off" spellcheck="false" />
          <span class="field-hint">Any name works — just use a different one in each tab</span>
        </div>
        ${n}
        ${s.vsBot?`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-secondary);">
              <input type="checkbox" id="vs-bot" style="width:16px;height:16px;accent-color:var(--accent-cyan);" />
              🤖 Play vs computer
            </label>`:""}
      </div>
      ${s.error?`<div class="error-text lobby-error" role="alert" style="margin-top:var(--sp-3)">${V(s.error)}</div>`:""}
      <div class="row-actions" style="margin-top:var(--sp-4)">
        <button class="btn btn-primary" id="create-btn" style="flex:1">Create game</button>
        <button class="btn btn-secondary" id="join-btn" style="flex:1">${s.joinLabel}</button>
        <button class="btn btn-ghost" id="back-home-btn">← Back</button>
      </div>
      ${s.hint?`<div class="hint">${s.hint}</div>`:""}
    </div>
  `}function Ot(t,e,s,n,r){const o=new Set;for(const u of e){const h=s[u.id];if(h)for(const p of B(h,u.size))o.add(`${p.row},${p.col}`)}const c=e.find(u=>u.id===n),l=c?s[n]:void 0,i=new Set;if(c&&l)for(const u of B(l,c.size))i.add(`${u.row},${u.col}`);const a=[];for(let u=0;u<t.board.rows;u+=1)for(let h=0;h<t.board.cols;h+=1){const p=["placement-cell"],f=`${u},${h}`;o.has(f)&&p.push("occupied"),i.has(f)&&p.push("selected-cell"),l&&l.row===u&&l.col===h&&p.push("selected-anchor"),a.push(`<button class="${p.join(" ")}" data-r="${u}" data-c="${h}" aria-label="Cell ${u},${h}"></button>`)}const m=e.map(u=>{const h=s[u.id];if(!h)return"";const p=h.rotationDeg%180===0,f=p?u.size:1,g=p?1:u.size,d=n===u.id;return`<div
        class="placement-ship ${d?"selected":""}"
        data-ship-id="${u.id}"
        style="--ship-row:${h.row};--ship-col:${h.col};--ship-width:${f};--ship-height:${g};"
        title="${u.id} — click to select, right-click board to rotate"
      >
        <span class="placement-ship-label" style="${p?"":"writing-mode:vertical-rl;"}">${u.id}</span>
        ${d?'<div class="ship-selected-ring"></div>':""}
      </div>`}).join("");return`
    <div class="placement-grid">${a.join("")}</div>
    <div class="placement-ships-layer">${m}</div>
  `}function Bt(t,e,s){return`
    <section class="screen battleship-screen">
      <div class="section-head">
        <h1>⚓ Battleship</h1>
        <p>Join a session with your fleet commander identity to start the battle.</p>
      </div>
      ${oe(t,e,{title:"Mission Lobby",joinLabel:"Join Mission",error:s,hint:"Open two browser windows with the same Game Code but different names to play locally."})}
    </section>
  `}function qt(t,e,s){return s?`<img src="${s}" alt="" style="width:auto;height:20px;image-rendering:pixelated;transform:rotate(90deg);opacity:${e?1:.7}" />`:Array.from({length:t},()=>`<div class="ship-block ${e?"active-block":""}"></div>`).join("")}function Ft(t,e,s,n,r,o,c,l,i){const a=t.ships.every(f=>!!r[f.id]),m=e,u={illegal_action:"⚠️ Action not allowed — the game may already be in progress. Try rejoining.",ship_out_of_bounds:"⚠️ Ship extends outside the board. Try a different position.",ship_overlap_collision:"⚠️ Ships can't overlap. Choose a clear area.",rotation_out_of_bounds:"⚠️ Not enough space to rotate here.",rotation_collision:"⚠️ Rotating would cause a collision.",setup_incomplete_or_invalid:"⚠️ All ships must be placed before submitting.",session_not_found:"⚠️ Session not found. Check the session ID and try rejoining."},h=l??i??"",p=h?u[h]??`⚠️ ${h}`:"";return m?`
      <section class="screen battleship-screen">
        <div class="section-head">
          <h1>⚓ Battleship Setup</h1>
        </div>
        <div class="waiting-banner">
          <div class="waiting-dot"></div>
          <span>Fleet submitted! Waiting for opponent to complete their setup…</span>
        </div>
      </section>
    `:`
    <section class="screen battleship-screen">
      <div class="section-head">
        <h1>⚓ Fleet Deployment</h1>
        <p>Position your fleet before the battle begins. <strong>Click a ship to select it</strong>, then click a cell to place it. Right-click to rotate.</p>
      </div>
      <div class="setup-layout">
        <aside class="card fleet-panel">
          <h3>Fleet Manifest</h3>
          <div class="fleet-ships">
            ${t.ships.map(f=>{const g=o===f.id,d=!!r[f.id];return`
                  <button class="fleet-row fleet-button ${g?"active":""}" data-ship-id="${f.id}">
                    <div class="fleet-icons">${qt(f.size,g,c[f.id]??"")}</div>
                    <span class="ship-name">${f.id}</span>
                    <span class="ship-size">×${f.size}</span>
                    <span class="ship-status-badge ${d?"placed":"unplaced"}">${d?"✓":"—"}</span>
                  </button>
                `}).join("")}
          </div>
          <div class="fleet-actions">
            <button class="btn btn-secondary" id="load-template-btn" style="width:100%">↓ Load Valid Fleet</button>
            <button class="btn btn-ghost" id="random-template-btn" style="width:100%">⚄ Randomize</button>
          </div>
        </aside>
        <section class="card setup-editor">
          <h3>Placement Grid</h3>
          <div class="setup-controls">
            <button class="btn btn-ghost" id="rotate-btn">↻ Rotate</button>
            <button class="btn btn-ghost" id="clear-ship-btn">✕ Clear</button>
            ${p?`<span class="error-text">${p}</span>`:""}
          </div>
          <div class="placement-board" id="placement-board">
            ${Ot(t,t.ships,r,o)}
          </div>
          <div class="row-actions" style="margin-top:12px">
            <button class="btn btn-primary" id="submit-setup-btn" ${a?"":'disabled aria-disabled="true"'}>
              ${a?"⚡ Submit Fleet":"Place all ships to continue"}
            </button>
            <button class="btn btn-ghost" id="rejoin-btn">⟲ Rejoin</button>
          </div>
        </section>
      </div>
    </section>
  `}function Gt(t){var s;let e="";for(const n of t){const r=n;if(r.eventType==="ship.sunk")return`Sunk their ${((s=r.payload)==null?void 0:s.shipId)??"ship"}!`;r.eventType==="shot.hit"?e="Hit!":r.eventType==="shot.miss"&&!e&&(e="Miss")}return e}function Ht(t,e,s,n,r,o,c={}){const l=t==="terminal",i=e.winnerPlayerId,a=f=>{var g;return f?((g=c.seatNames)==null?void 0:g[f])??f:""};if(l)return`
      <section class="screen battleship-screen">
        <div class="winner-overlay">
          <div class="winner-trophy">🏆</div>
          <h2>Game Over!</h2>
          <p>${i?`<strong>${a(i)}</strong> wins the battle!`:"It's a draw!"}</p>
          <div class="row-actions" style="justify-content:center">
            <button class="btn btn-primary" id="rematch-btn">⟲ Play Again</button>
            <a class="btn btn-ghost" href="#/">← Back to Hub</a>
          </div>
        </div>
      </section>
    `;const m=s?"your-turn":"their-turn",u=s?"🎯 Your turn — click on the <strong>Opponent Board</strong> to fire":`⏳ Waiting for <strong>${a(e.currentPlayerId)||"opponent"}</strong>`,h=V(c.lastError),p=Gt(c.lastEvents??[]);return`
    <section class="screen battleship-screen">
      <div class="section-head">
        <h1>⚓ Live Battle</h1>
        <div class="status-banner ${m}">
          <span>${u}</span>
        </div>
        ${p?`<div class="status-banner last-result"><span>${p}</span></div>`:""}
        ${h?`<div class="error-text" role="alert">${h}</div>`:""}
      </div>
      <div class="gameplay-screen">
        <div class="card board-panel" id="render-view">
          ${n}
        </div>
        <aside class="side-stack">
          <div class="card side-card">
            <h3>Battle Log</h3>
            <pre style="max-height:200px;overflow:auto;font-size:10px;color:var(--text-muted);font-family:'Inter',monospace;white-space:pre-wrap;line-height:1.5">${r.slice(0,20).join(`
`)||"No events yet"}</pre>
          </div>
        </aside>
      </div>
    </section>
  `}function Ut(t,e){const s=t.querySelector("#load-template-btn"),n=t.querySelector("#random-template-btn"),r=t.querySelector("#rotate-btn"),o=t.querySelector("#clear-ship-btn"),c=t.querySelector("#submit-setup-btn"),l=t.querySelector("#rejoin-btn"),i=t.querySelector("#render-view"),a=t.querySelector("#placement-board"),m=t.querySelector(".fleet-panel");s==null||s.addEventListener("click",()=>{e.setPlacementDraftMap(ce(ye(e.definition))),e.render()}),n==null||n.addEventListener("click",()=>{e.setPlacementDraftMap(ce(Mt(e.definition))),e.render()});const u=()=>{const h=e.placementDraftMap[e.selectedShipId]??{row:0,col:0,rotationDeg:0},p=e.shipSpecs.find(y=>y.id===e.selectedShipId);if(!p)return;const f={...h,rotationDeg:Tt(h.rotationDeg)},g=zt(f,p.size,e.definition),d=B(g,p.size);ne(d,e.definition)?de(e.shipSpecs,e.placementDraftMap,e.selectedShipId,d)?(e.setPlacementDraftMap({...e.placementDraftMap,[e.selectedShipId]:g}),e.setLocalError(null)):e.setLocalError("rotation_collision"):e.setLocalError("rotation_out_of_bounds"),e.render()};r==null||r.addEventListener("click",()=>u()),o==null||o.addEventListener("click",()=>{const{[e.selectedShipId]:h,...p}=e.placementDraftMap;e.setPlacementDraftMap(p),e.setLocalError(null),e.render()}),m==null||m.addEventListener("click",h=>{const f=h.target.closest("[data-ship-id]");f&&(e.setSelectedShipId(f.dataset.shipId??e.selectedShipId),e.render())}),a==null||a.addEventListener("click",h=>{var O;const p=h.target,f=p.closest(".placement-ship");if(f){const _=f.dataset.shipId;if(_){e.setSelectedShipId(_),e.setLocalError(null),e.render();return}}const g=p.closest(".placement-cell");if(!g)return;const d=Number(g.dataset.r??"-1"),y=Number(g.dataset.c??"-1");if(d<0||y<0)return;const w=e.shipSpecs.find(_=>_.id===e.selectedShipId);if(!w)return;const D=((O=e.placementDraftMap[e.selectedShipId])==null?void 0:O.rotationDeg)??0,E={row:d,col:y,rotationDeg:D},k=B(E,w.size);if(!ne(k,e.definition))e.setLocalError("ship_out_of_bounds");else if(!de(e.shipSpecs,e.placementDraftMap,e.selectedShipId,k))e.setLocalError("ship_overlap_collision");else{e.setPlacementDraftMap({...e.placementDraftMap,[e.selectedShipId]:E}),e.setLocalError(null);const _=e.shipSpecs.find(R=>R.id!==e.selectedShipId&&!{...e.placementDraftMap,[e.selectedShipId]:E}[R.id]);_&&e.setSelectedShipId(_.id)}e.render()}),a==null||a.addEventListener("contextmenu",h=>{h.preventDefault(),u()}),c==null||c.addEventListener("click",()=>{try{e.runtime.controller.submitPlaceShips(Dt(e.shipSpecs,e.placementDraftMap,e.definition)),e.setLocalError(null)}catch{e.setLocalError("setup_incomplete_or_invalid")}e.render()}),l==null||l.addEventListener("click",()=>{e.runtime.rejoin(),e.render()}),i==null||i.addEventListener("click",h=>{const f=h.target.closest(".opponent-cell");if(!f)return;const g=e.runtime.controller.getState(),d=g.view??{},y=d.phase??"setup",w=g.seatId??e.playerId;if(!(y==="play"&&d.currentPlayerId===w)){e.pushLog(`click_ignored not_your_turn_or_not_play phase=${y} current=${d.currentPlayerId??"-"}`);return}const E=Number(f.dataset.r??"-1"),k=Number(f.dataset.c??"-1");E>=0&&k>=0&&(e.pushLog(`click_fire row=${E} col=${k}`),e.runtime.controller.submitFire({row:E,col:k}),e.render())})}function Wt(t){return t?"gameplay":"lobby"}const we=["player-color-0","player-color-1","player-color-2","player-color-3"],Se=["P1","P2","P3","P4"];function Ie(t,e){const s="#0e2010",n="#4ade80",i=t.N||t.E||t.S||t.W;let a="";return i&&(a+=`<rect x="${50-28/2}" y="${50-28/2}" width="28" height="28" fill="${n}" rx="2"/>`),t.N&&(a+=`<rect x="${50-28/2}" y="0" width="28" height="50" fill="${n}"/>`),t.S&&(a+=`<rect x="${50-28/2}" y="50" width="28" height="50" fill="${n}"/>`),t.W&&(a+=`<rect x="0" y="${50-28/2}" width="50" height="28" fill="${n}"/>`),t.E&&(a+=`<rect x="50" y="${50-28/2}" width="50" height="28" fill="${n}"/>`),`<svg class="tile-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="${s}"/>
    ${a}
    ${e?'<circle cx="90" cy="10" r="6" fill="#fbbf24" opacity="0.9"/>':""}
  </svg>`}function Vt(t,e){var a,m,u,h,p,f,g;const s=t.board??[],n=new Set((((a=t.myState)==null?void 0:a.reachableCells)??[]).map(d=>`${d.row},${d.col}`)),r=t.players??[],o=((h=(u=(m=t.myState)==null?void 0:m.remainingObjectives)==null?void 0:u[0])==null?void 0:h.id)??null,c=((p=t.myState)==null?void 0:p.home)??null,l=new Map(r.map((d,y)=>[d.playerId,y])),i=[];for(let d=0;d<s.length;d+=1)for(let y=0;y<(((f=s[d])==null?void 0:f.length)??0);y+=1){const w=(g=s[d])==null?void 0:g[y],D=(w==null?void 0:w.openings)??{N:!1,E:!1,S:!1,W:!1},E=(w==null?void 0:w.objectiveId)??null,k=r.filter(A=>A.position.row===d&&A.position.col===y),O=n.has(`${d},${y}`),_=E!==null&&E===o,R=c!==null&&c.row===d&&c.col===y,b=["labyrinth-cell"];O&&b.push("reachable"),_&&b.push("next-objective");const x=k.map(A=>{const z=we[l.get(A.playerId)??0]??"player-color-0",$=Se[l.get(A.playerId)??0]??A.playerId.slice(0,2).toUpperCase();return`<div class="player-token ${z}">${$}</div>`}).join(""),S=_?' style="outline:2px solid #fbbf24;outline-offset:-2px;box-shadow:0 0 10px rgba(251,191,36,0.8);z-index:1;"':"",T=R?'<div class="home-marker" style="position:absolute;top:2px;left:2px;font-size:11px;pointer-events:none;">🏠</div>':"";i.push(`<button class="${b.join(" ")}"${S} data-lab-cell="1" data-r="${d}" data-c="${y}" title="${E?`🏆 ${E}`:""}">
          ${Ie(D,E)}
          ${T}
          ${x}
        </button>`)}return`<div class="labyrinth-grid">${i.join("")}</div>`}function Jt(t){if(!t.spareTile)return"";const e=t.spareTile,s=e.openings??{N:!1,E:!1,S:!1,W:!1};return`
    <div class="spare-tile-wrap">
      <div class="spare-tile-box">${Ie(s,e.objectiveId??null)}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.08em;">Spare Tile</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Insert from any arrow</div>
      </div>
    </div>
  `}function Yt(t,e,s,n=2){return`
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>🌀 Labyrinth</h1>
        <p>Navigate the shifting maze. Insert the spare tile, move your pawn, collect objectives and return home to win.</p>
      </div>
      ${oe(t,e,{title:"Maze Lobby",joinLabel:"Enter Maze",error:s,seatCount:n})}
    </section>
  `}const Kt={top:"bottom",bottom:"top",left:"right",right:"left"};function Xt(t,e,s,n,r={}){var x,S,T,A,z;const o=((x=t.config)==null?void 0:x.insertionIndexes)??[1,3,5],c=t.phase==="terminal",l=t.currentPlayerId===e,i=t.turnStage==="insert",a=t.turnStage==="move",m=((S=t.myState)==null?void 0:S.remainingObjectives)??[],u=t.players??[],h=$=>{var v;return $?((v=r.seatNames)==null?void 0:v[$])??$:""},p=t.lastInsertion,f=($,v)=>!!p&&Kt[p.edge]===$&&p.index===v;if(c)return`
      <section class="screen labyrinth-screen">
        <div class="winner-overlay">
          <div class="winner-trophy">🏆</div>
          <h2>Maze Conquered!</h2>
          <p>${t.winnerPlayerId?`<strong>${h(t.winnerPlayerId)}</strong> collected all objectives and returned home!`:"Someone found the way home!"}</p>
          <div class="row-actions" style="justify-content:center">
            <button class="btn btn-primary" id="rematch-btn">⟲ Play Again</button>
            <a class="btn btn-ghost" href="#/">← Back to Hub</a>
          </div>
        </div>
      </section>
    `;if(!t.board||t.board.length===0)return`
      <section class="screen labyrinth-screen">
        <div class="section-head">
          <h1>🌀 Labyrinth</h1>
        </div>
        <div class="card" style="max-width:500px;text-align:center;padding:var(--sp-8);">
          <div class="waiting-dot" style="margin:0 auto var(--sp-4);"></div>
          <h3>Waiting for the game to start…</h3>
          <p style="color:var(--text-muted);margin-top:8px;font-size:14px;">The maze will appear once all players have joined. Share the Session ID with your friends to begin.</p>
          <div style="margin-top:var(--sp-4);padding:var(--sp-3);background:rgba(0,212,255,0.06);border-radius:var(--r-md);border:1px solid var(--border-subtle);">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:4px;">Players joined</div>
            ${t.players&&t.players.length>0?t.players.map($=>`<div style="font-size:13px;color:var(--text-secondary);">${h($.playerId)}</div>`).join(""):'<div style="font-size:13px;color:var(--text-muted);">Waiting for players…</div>'}
          </div>
        </div>
      </section>
    `;let g="their-turn",d=`⏳ Waiting for <strong>${h(t.currentPlayerId)||"other player"}</strong>`;l&&i?(g="your-turn",d="🔀 Your turn — insert the spare tile using an arrow button"):l&&a&&(g="your-turn",d="🚶 Now move your pawn — click a highlighted cell");const y=((A=(T=t.board)==null?void 0:T[0])==null?void 0:A.length)??7,w=((z=t.board)==null?void 0:z.length)??7,D=Array.from({length:y},($,v)=>{const L=o.includes(v),P=!L||!l||!i||f("top",v)?"disabled":"";return L?`<button class="insert-btn labyrinth-insert-btn" data-edge="top" data-index="${v}" ${P} title="Insert top column ${v}">▼</button>`:"<div></div>"}).join(""),E=Array.from({length:y},($,v)=>{const L=o.includes(v),P=!L||!l||!i||f("bottom",v)?"disabled":"";return L?`<button class="insert-btn labyrinth-insert-btn" data-edge="bottom" data-index="${v}" ${P} title="Insert bottom column ${v}">▲</button>`:"<div></div>"}).join(""),k=Array.from({length:w},($,v)=>{const L=o.includes(v),P=!L||!l||!i||f("left",v)?"disabled":"";return L?`<button class="insert-btn labyrinth-insert-btn" data-edge="left" data-index="${v}" ${P} title="Insert left row ${v}">▶</button>`:"<div></div>"}).join(""),O=Array.from({length:w},($,v)=>{const L=o.includes(v),P=!L||!l||!i||f("right",v)?"disabled":"";return L?`<button class="insert-btn labyrinth-insert-btn" data-edge="right" data-index="${v}" ${P} title="Insert right row ${v}">◀</button>`:"<div></div>"}).join(""),_=new Map(u.map(($,v)=>[$.playerId,v])),R=u.map($=>{const v=we[_.get($.playerId)??0]??"player-color-0",L=Se[_.get($.playerId)??0]??$.playerId.slice(0,2).toUpperCase(),P=$.playerId===t.currentPlayerId,q=$.playerId===e;return`
        <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border:1px solid ${P?"rgba(0,212,255,0.4)":"var(--border-subtle)"};background:${P?"rgba(0,212,255,0.06)":"transparent"};">
          <div class="player-token ${v}" style="position:static;transform:none;width:28px;height:28px;font-size:10px;">${L}</div>
          <div>
            <div style="font-size:12px;font-weight:600;color:${q?"var(--accent-cyan)":"var(--text-primary)"};">${h($.playerId)}${q?" (you)":""}${P?" 🎯":""}</div>
            <div style="font-size:10px;color:var(--text-muted);">${$.objectivesRemainingCount} objective${$.objectivesRemainingCount!==1?"s":""} left</div>
          </div>
        </div>
      `}).join(""),b=m.length>0?`<div class="objectives-list">
          ${m.map(($,v)=>`<div class="objective-item" style="${v>0?"opacity:0.6":""}">
                  ${v===0?"Next: ":""}${$.id}
                </div>`).join("")}
        </div>`:'<div style="font-size:12px;color:var(--accent-green);font-weight:600;">✓ All collected! Return home!</div>';return`
    <section class="screen labyrinth-screen">
      <div class="section-head">
        <h1>🌀 Labyrinth</h1>
        <div class="status-banner ${g}">
          <span>${d}</span>
        </div>
        ${r.lastError?`<div class="error-text" role="alert">${V(r.lastError)}</div>`:""}
      </div>
      <div class="gameplay-screen">
        <div class="card board-panel">
          ${Jt(t)}
          <div style="margin-top:16px;" id="labyrinth-insert-controls">
            <div class="labyrinth-insert-ring">
              <div class="insert-row-top" style="display:flex;gap:3px;">${D}</div>
              <div class="insert-col-left" style="display:flex;flex-direction:column;gap:3px;">${k}</div>
              <div class="labyrinth-board-center" id="labyrinth-board">
                ${Vt(t)}
              </div>
              <div class="insert-col-right" style="display:flex;flex-direction:column;gap:3px;">${O}</div>
              <div class="insert-row-bottom" style="display:flex;gap:3px;">${E}</div>
            </div>
          </div>
        </div>
        <aside class="side-stack">
          <div class="card side-card">
            <h3>Players</h3>
            <div style="display:grid;gap:6px;">${R}</div>
          </div>
          <div class="card side-card">
            <h3>Your Objectives</h3>
            ${b}
          </div>
          <div class="card debug-panel">
            <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:8px;">Event Log</h3>
            <pre>${s.slice(0,15).join(`
`)||"No events yet"}</pre>
          </div>
        </aside>
      </div>
    </section>
  `}function Qt(t,e){const s=t.querySelector("#labyrinth-insert-controls"),n=t.querySelector("#labyrinth-board");s==null||s.addEventListener("click",r=>{const c=r.target.closest(".labyrinth-insert-btn");if(!c)return;const l=e.runtime.controller.getState(),i=l.view??{},a=l.seatId??e.playerId;if(i.currentPlayerId!==a||i.turnStage!=="insert"){e.pushLog("click_ignored labyrinth_insert_not_allowed");return}const m=c.dataset.edge,u=Number(c.dataset.index??"-1");u<0||(e.runtime.controller.submitAction("insert_tile",{edge:m,index:u}),e.render())}),n==null||n.addEventListener("click",r=>{const c=r.target.closest("[data-lab-cell='1']");if(!c)return;const l=e.runtime.controller.getState(),i=l.view??{},a=l.seatId??e.playerId;if(i.currentPlayerId!==a||i.turnStage!=="move"){e.pushLog("click_ignored labyrinth_move_not_allowed");return}const m=Number(c.dataset.r??"-1"),u=Number(c.dataset.c??"-1");m<0||u<0||(e.runtime.controller.submitAction("move_pawn",{row:m,col:u}),e.render())})}function Zt(t){return t?"gameplay":"lobby"}const pe=["c4-p1","c4-p2"];function es(t,e,s){return`
    <section class="screen connect4-screen">
      <div class="section-head">
        <h1>🔴 Connect Four</h1>
        <p>Drop discs, connect four in a row — down, across, or diagonally.</p>
      </div>
      ${oe(t,e,{title:"Arcade Lobby",joinLabel:"Join Game",error:s,vsBot:!0})}
    </section>
  `}function ts(t,e,s={}){var g;const n=t.players??[],r=t.grid??[],o=((g=t.config)==null?void 0:g.cols)??7,c=t.phase==="terminal",l=!c&&t.currentPlayerId===e,i=d=>d===null?"":pe[n.indexOf(d)]??"c4-p1",a=d=>{var y;return d?((y=s.seatNames)==null?void 0:y[d])??d:""},m=new Set((t.winningCells??[]).map(d=>`${d.row},${d.col}`)),u=t.lastDrop;if(c){const d=t.winnerPlayerId?t.winnerPlayerId===e?"You win! 🎉":`${a(t.winnerPlayerId)} wins!`:"It's a draw!";return`
      <section class="screen connect4-screen">
        <div class="winner-overlay">
          <div class="winner-trophy">${t.winnerPlayerId?"🏆":"🤝"}</div>
          <h2>${d}</h2>
          <div class="c4-board c4-board-small" id="connect4-board">${ue(r,o,i,m,u)}</div>
          <div class="row-actions" style="justify-content:center;margin-top:var(--sp-4)">
            <button class="btn btn-primary" id="rematch-btn">⟲ Play Again</button>
            <a class="btn btn-ghost" href="#/">← Back to Hub</a>
          </div>
        </div>
      </section>
    `}const h=l?"🎯 Your turn — click a column to drop your disc":`⏳ Waiting for <strong>${a(t.currentPlayerId)||"opponent"}</strong>`,p=n.map((d,y)=>`<span class="c4-seat ${d===t.currentPlayerId?"current":""}">
        <span class="c4-disc-mini ${pe[y]??"c4-p1"}"></span>${a(d)}${d===e?" (you)":""}
      </span>`).join(""),f=Array.from({length:o},(d,y)=>{var E;const w=((E=r[0])==null?void 0:E[y])!==null;return`<button class="c4-drop-btn" data-col="${y}" ${!l||w?"disabled":""} aria-label="Drop in column ${y+1}">▼</button>`}).join("");return`
    <section class="screen connect4-screen">
      <div class="section-head">
        <h1>🔴 Connect Four</h1>
        <div class="status-banner ${l?"your-turn":"their-turn"}"><span>${h}</span></div>
        ${s.lastError?`<div class="error-text" role="alert">${V(s.lastError)}</div>`:""}
      </div>
      <div class="card board-panel" style="max-width:560px;margin:0 auto;">
        <div class="c4-seats">${p}</div>
        <div class="c4-drop-row" id="connect4-drop-row" style="grid-template-columns:repeat(${o},1fr)">${f}</div>
        <div class="c4-board" id="connect4-board">${ue(r,o,i,m,u)}</div>
      </div>
    </section>
  `}function ue(t,e,s,n,r){return t.map((c,l)=>{const i=c.map((a,m)=>{const u=["c4-cell"],h=s(a);n.has(`${l},${m}`)&&u.push("winning");const p=r&&r.row===l&&r.col===m;return`<div class="${u.join(" ")}" data-col="${m}">
            ${a!==null?`<div class="c4-disc ${h} ${p?"last-drop":""}"></div>`:""}
          </div>`}).join("");return`<div class="c4-row" style="grid-template-columns:repeat(${e},1fr)">${i}</div>`}).join("")}function ss(t,e){var r,o;const s=c=>{const l=e.runtime.controller.getState(),i=l.view??{},a=l.seatId??e.playerId;if(i.phase!=="play"||i.currentPlayerId!==a){e.pushLog("click_ignored connect4_not_your_turn");return}e.runtime.controller.submitAction("drop",{col:c}),e.render()},n=c=>{const i=c.target.closest("[data-col]");if(!i||i.hasAttribute("disabled"))return;const a=Number(i.dataset.col??"-1");a>=0&&s(a)};(r=t.querySelector("#connect4-drop-row"))==null||r.addEventListener("click",n),(o=t.querySelector("#connect4-board"))==null||o.addEventListener("click",n)}const ns={"/games/battleship":"battleship","/games/labyrinth":"labyrinth","/games/connect4":"connect4","/games/catan":"catan"};function rs(t){const s=(t.startsWith("#")?t.slice(1):t)||"/";if(s==="/")return{name:"landing"};const n=ns[s];return n?{name:"game",gameId:n}:{name:"landing"}}function Ee(t){return t.name==="landing"?"#/":`#/games/${t.gameId}`}function he(t,e=window.location){e.hash=Ee(t)}const ke="bgs:";function Le(t,e){try{return localStorage.getItem(`${ke}${t}`)??e}catch{return e}}function W(t,e){try{localStorage.setItem(`${ke}${t}`,e)}catch{}}function re(){return Math.random().toString(16).slice(2,8).toUpperCase()}function fe(t){return Le(`sessionId:${t}`,re())}function me(){return Le("playerId","player-1")}function os(t,e){var R;const s=new Me(e.websocketFactory);s.connect();const n={send:b=>s.send(b),subscribe:b=>s.onServerEvent(b)},r={battleship:te({presentation:le.presentation,baseAssetPath:e.assetBasePath??"/",transport:n}),labyrinth:te({presentation:gt.presentation,baseAssetPath:e.assetBasePath??"/",transport:n}),connect4:te({presentation:kt.presentation,baseAssetPath:e.assetBasePath??"/",transport:n})},o={carrier:r.battleship.assetManager.resolveAssetUrl("ship-carrier"),battleship:r.battleship.assetManager.resolveAssetUrl("ship-battleship"),cruiser:r.battleship.assetManager.resolveAssetUrl("ship-cruiser"),submarine:r.battleship.assetManager.resolveAssetUrl("ship-submarine"),destroyer:r.battleship.assetManager.resolveAssetUrl("ship-destroyer")};let c=!1,l=null,i=fe("battleship"),a=me(),m=2;const u=le.definition,h=u.ships;let p={},f=((R=h[0])==null?void 0:R.id)??"",g=null;const d=[],y=b=>{d.unshift(`${new Date().toLocaleTimeString()} ${b}`),d.length>50&&d.pop(),console.info(`[web-client] ${b}`)},w=()=>rs(window.location.hash),D=()=>{c&&i&&a&&s.send({type:"session.leave",sessionId:i,playerId:a}),c=!1,l=null,he({name:"landing"})},E=b=>b.name==="game"&&b.gameId==="labyrinth"?r.labyrinth:b.name==="game"&&b.gameId==="connect4"?r.connect4:r.battleship;s.onLog(b=>y(b));const k=()=>{const b=w(),x=E(b),S=x.controller.getState(),T=S.view??{},A=T.phase??"setup";let z="";if(b.name==="landing")z=jt();else if(b.name==="game"&&b.gameId==="catan")z=Ct(b.gameId);else{const I=c&&S.synced&&S.sessionId===i,j=S.seatId??a,C={battleship:()=>{var ie,ae;const N=At(I&&l==="battleship",T),G=A==="play"&&T.currentPlayerId===j;return N==="lobby"?Bt(i,a,S.lastError):N==="setup"?Ft(u,(((ae=(ie=T.ownBoard)==null?void 0:ie.ships)==null?void 0:ae.length)??0)>0,i,a,p,f,o,g,S.lastError):Ht(A,T,G,x.renderer.render(T),d,JSON.stringify(S,null,2),{seatNames:S.seatNames,lastError:S.lastError,lastEvents:S.lastEvents})},labyrinth:()=>{const N=S.view??{};return Wt(I&&l==="labyrinth")==="lobby"?Yt(i,a,S.lastError,m):Xt(N,j,d,JSON.stringify(S,null,2),{seatNames:S.seatNames,lastError:S.lastError})},connect4:()=>{const N=S.view??{};return Zt(I&&l==="connect4")==="lobby"?es(i,a,S.lastError):ts(N,j,{seatNames:S.seatNames,lastError:S.lastError})}};b.gameId==="battleship"?z=C.battleship():b.gameId==="labyrinth"?z=C.labyrinth():b.gameId==="connect4"&&(z=C.connect4())}t.innerHTML=Lt(z,b,i,a);const $=t.querySelector("#game-hub-grid"),v=t.querySelector("#session-id"),L=t.querySelector("#player-id"),P=t.querySelector("#join-btn"),q=t.querySelector("#nav-back-btn"),J=t.querySelector("#back-home-btn"),F=t.querySelector("#copy-session-btn");q==null||q.addEventListener("click",()=>D()),J==null||J.addEventListener("click",()=>D()),F==null||F.addEventListener("click",()=>{navigator.clipboard.writeText(i).then(()=>{const I=F.innerText;F.innerText="✓ Copied!",setTimeout(()=>{F.innerText=I},1500)})}),$==null||$.addEventListener("click",I=>{const C=I.target.closest("button[data-game-id]");if(!C)return;const N=C.dataset.gameId,G=_t(N);G&&(c=!1,l=null,i=fe(N),a=me(),he(G))});const Y=t.querySelector("#new-session-btn");v==null||v.addEventListener("input",()=>{i=v.value;const I=w();I.name==="game"&&W(`sessionId:${I.gameId}`,i)}),Y==null||Y.addEventListener("click",()=>{i=re(),v&&(v.value=i);const I=w();I.name==="game"&&W(`sessionId:${I.gameId}`,i)}),L==null||L.addEventListener("input",()=>{a=L.value,W("playerId",a)});const H=t.querySelector("#seat-count");H==null||H.addEventListener("change",()=>{m=Number(H.value)||2});const K=(I,j)=>{var C;i=I,b.name==="game"&&W(`sessionId:${b.gameId}`,i),c=!0,l=b.name==="game"?b.gameId:null,p={},f=((C=h[0])==null?void 0:C.id)??"",g=null,j.create&&l?x.controller.join(i,a,l,j.seatCount,j.bots):x.controller.join(i,a),k()},X=t.querySelector("#create-btn");X==null||X.addEventListener("click",()=>{var C;const I=((C=t.querySelector("#vs-bot"))==null?void 0:C.checked)??!1,j=H?m:void 0;K(re(),{create:!0,seatCount:j,bots:I?(j??2)-1:void 0})}),P==null||P.addEventListener("click",()=>{K(i,{create:!1})});const Q=t.querySelector("#rematch-btn");Q==null||Q.addEventListener("click",()=>{const I=Object.keys(S.seatNames).length,j=Object.values(S.seatNames).filter(C=>C.startsWith("Computer")).length;K(Nt(i),{create:!0,seatCount:I>0?I:void 0,bots:j>0?j:void 0})}),b.name==="game"&&b.gameId==="battleship"&&Ut(t,{runtime:x,definition:u,shipSpecs:h,placementDraftMap:p,selectedShipId:f,localError:g,playerId:a,render:k,pushLog:y,setPlacementDraftMap:I=>{p=I},setSelectedShipId:I=>{f=I},setLocalError:I=>{g=I}}),b.name==="game"&&b.gameId==="labyrinth"&&Qt(t,{runtime:x,playerId:a,render:k,pushLog:y}),b.name==="game"&&b.gameId==="connect4"&&ss(t,{runtime:x,playerId:a,render:k,pushLog:y})},O=n.subscribe(()=>{const b=document.activeElement;if(b&&t.contains(b)&&(b.tagName==="INPUT"||b.tagName==="SELECT")){const x=E(w()).controller.getState();if(!(x.synced&&x.sessionId===i))return}k()}),_=()=>{k()};return window.addEventListener("hashchange",_),window.location.hash||(window.location.hash=Ee({name:"landing"})),k(),{runtime:r.battleship,dispose:()=>{O(),window.removeEventListener("hashchange",_),s.disconnect(),t.innerHTML=""}}}function is(t,e){return os(t,{websocketFactory:e})}const as=["debug","info","warn","error","silent"];function ls(t,e){const n=new URLSearchParams(t).get("log")??e;return n&&as.includes(n)?n:null}function cs(t,e){const s=new URL(e);return`${s.protocol==="https:"?"wss:":"ws:"}//${s.host}/realtime`}function ds(t,e){let s=null;try{const o=new URLSearchParams(window.location.search).get("log");o&&localStorage.setItem("bgs:log",o),s=localStorage.getItem("bgs:log")}catch{}const n=ls(window.location.search,s);n&&Ce(n);const r=cs(e,window.location.href);return is(t,()=>new WebSocket(r))}const _e=document.querySelector("#app");if(!_e)throw new Error("app_root_not_found");window.location.hash||(window.location.hash="#/");ds(_e,{});
