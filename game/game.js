/* game.js - unified local / robot / online
   - Requires firebase compat SDK + firebase-config.js loaded before this file for online mode.
*/

/* Elements */
const boardElement = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const creatorInfo = document.getElementById('creatorInfo');
const joinInfo = document.getElementById('joinInfo');

/* Robot / Local elements if present (on robot/local pages) */
const easyBtn = document.getElementById('easyBtn');
const hardBtn = document.getElementById('hardBtn');
const startBtn = document.getElementById('startBtn');
const difficultyContainer = document.getElementById('difficultyContainer');
const startContainer = document.getElementById('startContainer');

/* state */
let board = Array(9).fill('');
let currentPlayer = 'X';
let isGameOver = false;
let gameMode = 'local'; // 'local' | 'robot' | 'online'
let difficulty = 'easy';

/* online state */
let db = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
let roomRef = null;
let roomId = null;
let mySymbol = null; // 'X' or 'O'
let unsub = null;

/* ---------------------- utility ---------------------- */
function showBoard() {
  if (boardElement) boardElement.style.display = 'grid';
  if (resetBtn) resetBtn.style.display = 'inline-block';
}
function hideBoard() {
  if (boardElement) boardElement.style.display = 'none';
  if (resetBtn) resetBtn.style.display = 'none';
}
function setStatus(text){ if(statusElement) statusElement.textContent = text; }

/* ---------------------- start / reset ---------------------- */
function startGameLocal() {
  board = Array(9).fill('');
  currentPlayer = 'X';
  isGameOver = false;
  setStatus('');
  cells.forEach((cell, i)=>{
    cell.textContent = '';
    cell.classList.remove('taken','win','lose');
    cell.style.pointerEvents = 'auto';
  });
  showBoard();
  if(startContainer) startContainer.style.display = 'none';
}

/* Only auto-start local page */
if (window.location.pathname.includes('local.html')) startGameLocal();

/* reset button */
resetBtn?.addEventListener('click', ()=>{
  if(gameMode === 'online') {
    // online: if creator -> delete room; otherwise just leave
    if(roomRef && mySymbol === 'X') {
      roomRef.remove().catch(()=>{});
      cleanupOnline();
      setStatus('Room closed.');
    } else {
      cleanupOnline();
      setStatus('Left the room.');
    }
  } else {
    startGameLocal();
  }
});

/* ---------------------- cell click ---------------------- */
cells.forEach((cell)=>{
  cell.addEventListener('click', async ()=>{
    const idx = parseInt(cell.dataset.index);
    if (isGameOver) return;

    if (gameMode === 'online') {
      if (!roomRef) return;
      // Only allow if it's this player's symbol's turn
      if (mySymbol !== currentPlayer) {
        setStatus("Not your turn.");
        return;
      }
      // ensure cell empty
      if (board[idx] !== '') return;
      board[idx] = mySymbol;
      await writeRoomState(board, mySymbol === 'X' ? 'O' : 'X', false);
      // local UI update will come via listener
      return;
    }

    // local/robot
    if (board[idx] === '') {
      board[idx] = currentPlayer;
      updateLocalUI();
      const winner = checkWinnerAndHandle();
      if (!winner) {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        if (gameMode === 'robot' && currentPlayer === 'O') {
          setTimeout(robotMove, 300);
        }
      }
    }
  });
});

/* ---------------------- update UI (local) ---------------------- */
function updateLocalUI(){
  cells.forEach((c,i)=> {
    c.textContent = board[i] || '';
    c.classList.toggle('taken', !!board[i]);
    c.style.pointerEvents = board[i] ? 'none' : 'auto';
  });
}

/* ---------------------- make robot move ---------------------- */
function robotMove(){
  const empty = board.map((v,i)=> v===''?i:null).filter(v=>v!==null);
  if(empty.length === 0) return;
  if(difficulty === 'easy') {
    const idx = empty[Math.floor(Math.random()*empty.length)];
    board[idx] = 'O';
  } else {
    const idx = getBestMove();
    if(typeof idx === 'number') board[idx] = 'O';
  }
  updateLocalUI();
  checkWinnerAndHandle();
  currentPlayer = 'X';
}

/* ---------------------- minimax for hard robot ---------------------- */
function getBestMove(){
  let bestScore = -Infinity, move;
  for(let i=0;i<9;i++){
    if(board[i] === '') {
      board[i] = 'O';
      let score = minimax(board,0,false);
      board[i] = '';
      if(score > bestScore) { bestScore = score; move = i; }
    }
  }
  return move;
}
function minimax(bd, depth, isMax){
  const w = winnerForMinimax(bd);
  if(w !== null) {
    if(w === 'O') return 10 - depth;
    if(w === 'X') return depth - 10;
    if(w === 'draw') return 0;
  }
  if(isMax){
    let best = -Infinity;
    for(let i=0;i<9;i++){
      if(bd[i] === ''){
        bd[i] = 'O';
        let s = minimax(bd, depth+1, false);
        bd[i] = '';
        best = Math.max(best, s);
      }
    }
    return best;
  } else {
    let best = Infinity;
    for(let i=0;i<9;i++){
      if(bd[i] === ''){
        bd[i] = 'X';
        let s = minimax(bd, depth+1, true);
        bd[i] = '';
        best = Math.min(best, s);
      }
    }
    return best;
  }
}

/* ---------------------- winner check (shared) ---------------------- */
function highlightCells(indices, cls){
  indices.forEach(i=>{
    const el = cells[i];
    if(el) el.classList.add(cls);
  });
}
function checkWinnerAndHandle(){
  const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const combo of combos){
    const [a,b,c] = combo;
    if(board[a] && board[a] === board[b] && board[a] === board[c]) {
      // winner found
      highlightCells([a,b,c], 'win');
      // also mark others as lose style (as you requested both showing green; we'll mark losers with .lose class)
      const other = [...Array(9).keys()].filter(i => ![a,b,c].includes(i) && board[i] !== '');
      highlightCells(other, 'lose');
      isGameOver = true;
      const who = board[a];
      // show animated modal
      if(gameMode === 'online') {
        // find if current client is winner or loser
        const iAmWinner = (mySymbol && mySymbol === who);
        showResultModal(iAmWinner ? 'win' : 'lose', who);
      } else {
        // local/robot
        showResultModal('win', who); // show who won (you can deduce)
      }
      return who;
    }
  }
  if(!board.includes('')) {
    isGameOver = true;
    showResultModal('draw', null);
    return 'draw';
  }
  return null;
}
function winnerForMinimax(bd){
  const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const combo of combos){
    const [a,b,c] = combo;
    if(bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) return bd[a];
  }
  if(!bd.includes('')) return 'draw';
  return null;
}

/* ---------------------- RESULT MODAL (animated) ---------------------- */
function showResultModal(resultType, who){
  // resultType: 'win' | 'lose' | 'draw'
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const card = document.createElement('div');
  card.className = 'result-card';

  const title = document.createElement('div');
  title.className = 'result-title';
  const emoji = document.createElement('div');
  emoji.className = 'result-emoji';
  const sub = document.createElement('div');
  sub.className = 'result-sub';

  if(resultType === 'win'){
    title.textContent = 'You Win!';
    emoji.textContent = '😄';
    sub.textContent = `Winner: ${who || ''}`;
    card.style.border = '3px solid rgba(76,175,80,0.25)';
  } else if(resultType === 'lose'){
    title.textContent = 'You Lose';
    emoji.textContent = '😢';
    sub.textContent = `Winner: ${who || ''}`;
    card.style.border = '3px solid rgba(255,100,100,0.08)';
  } else { // draw
    title.textContent = "It's a Draw";
    emoji.textContent = '🤝';
    sub.textContent = `No winner`;
    card.style.border = '3px solid rgba(200,200,200,0.06)';
  }

  card.appendChild(emoji);
  card.appendChild(title);
  card.appendChild(sub);

  // add a "Close / Play Again" button
  const again = document.createElement('button');
  again.textContent = 'Play Again';
  again.style.marginTop = '12px';
  again.onclick = () => {
    document.body.removeChild(overlay);
    if(gameMode === 'online') {
      // reset only local view; game state in DB remains final; creator can remove room via reset button
    } else {
      startGameLocal();
    }
  };
  card.appendChild(again);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

/* ---------------------- ROBOT controls if present ---------------------- */
if(easyBtn) easyBtn.addEventListener('click', ()=>{
  difficulty = 'easy';
  gameMode = 'robot';
  if(difficultyContainer) difficultyContainer.style.display = 'none';
  if(startContainer) startContainer.style.display = 'block';
});
if(hardBtn) hardBtn.addEventListener('click', ()=>{
  difficulty = 'hard';
  gameMode = 'robot';
  if(difficultyContainer) difficultyContainer.style.display = 'none';
  if(startContainer) startContainer.style.display = 'block';
});
startBtn?.addEventListener('click', () => {
  gameMode = 'robot';
  startGameLocal();
});

/* ---------------------- ONLINE: create / join / listen / write ---------------------- */
createBtn?.addEventListener('click', async ()=>{
  if(!db) { setStatus('Firebase not initialized.'); return; }
  roomId = Math.random().toString(36).substr(2,6).toUpperCase();
  mySymbol = 'X';
  gameMode = 'online';
  // initial room state
  const initial = {
    board: Array(9).fill(''),
    turn: 'X',
    finished: false,
    createdAt: Date.now()
  };
  roomRef = db.ref('rooms/' + roomId);
  await roomRef.set(initial);
  roomIdDisplay.textContent = roomId;
  creatorInfo.textContent = 'Share ID with friend';
  listenRoom(roomId);
  showBoard();
});

joinBtn?.addEventListener('click', async ()=>{
  if(!db) { setStatus('Firebase not initialized.'); return; }
  const id = (joinInput?.value || '').trim().toUpperCase();
  if(!id) { joinInfo.textContent = 'Enter Room ID'; return; }
  roomId = id;
  roomRef = db.ref('rooms/' + roomId);
  const snap = await roomRef.once('value');
  if(!snap.exists() || !snap.val()) { joinInfo.textContent = 'Room not found'; return; }
  // join as O
  mySymbol = 'O';
  gameMode = 'online';
  joinInfo.textContent = 'Joined!';
  roomIdDisplay.textContent = roomId;
  listenRoom(roomId);
  showBoard();
});

/* write room state (atomic-ish) */
async function writeRoomState(bd, nextTurn, finished){
  if(!roomRef) return;
  try {
    await roomRef.update({
      board: bd,
      turn: nextTurn,
      finished: finished || false,
      lastUpdate: Date.now()
    });
  } catch(e){
    console.error(e);
  }
}

/* listen for updates */
function listenRoom(rid) {
  if(!db) { setStatus('Firebase not available'); return; }
  if(unsub && roomRef) roomRef.off('value', unsub);
  roomRef = db.ref('rooms/' + rid);
  roomRef.on('value', snap => {
    const data = snap.val();
    if(!data) {
      setStatus('Room closed');
      cleanupOnline();
      return;
    }
    board = data.board || Array(9).fill('');
    currentPlayer = data.turn || 'X';
    isGameOver = data.finished || false;
    // update UI
    cells.forEach((c, i) => {
      c.textContent = board[i] || '';
      c.classList.toggle('taken', !!board[i]);
      c.style.pointerEvents = (board[i] || isGameOver) ? 'none' : 'auto';
      c.classList.remove('win','lose');
    });
    // check for winner locally (highlight)
    const w = winnerForMinimax(board);
    if(w && w !== 'draw') {
      // find winning combo to highlight
      const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for(const combo of combos){
        const [a,b,c] = combo;
        if(board[a] && board[a] === board[b] && board[a] === board[c]) {
          // mark winner combo as win
          [a,b,c].forEach(i => cells[i].classList.add('win'));
          // mark other taken cells as lose
          cells.forEach((el, idx) => {
            if(![a,b,c].includes(idx) && board[idx]) el.classList.add('lose');
          });
          break;
        }
      }
      // show result modal to this user
      const iAmWinner = (mySymbol && mySymbol === w);
      showResultModal(iAmWinner ? 'win' : 'lose', w);
    } else if(w === 'draw') {
      showResultModal('draw', null);
    } else {
      // ongoing game: update status
      setStatus(`Turn: ${currentPlayer}`);
    }
  });
}

/* cleanup online state */
function cleanupOnline(){
  if(roomRef && unsub) roomRef.off('value', unsub);
  roomRef = null;
  roomId = null;
  mySymbol = null;
  gameMode = 'local';
  isGameOver = false;
  board = Array(9).fill('');
  cells.forEach(c=>{ c.textContent=''; c.classList.remove('taken','win','lose'); c.style.pointerEvents='auto';});
  hideBoard();
}

/* ---------------------- helper for local winner detection (for minimax) ---------------------- */
function winnerForMinimax(bd) {
  const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const combo of combos){
    const [a,b,c] = combo;
    if(bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) return bd[a];
  }
  if(!bd.includes('')) return 'draw';
  return null;
}

/* ---------------------- Done ---------------------- */
