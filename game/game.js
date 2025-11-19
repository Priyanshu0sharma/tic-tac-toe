// game.js — full: local + robot (easy/hard) + online + highlights + win/lose animations

// ---------- Elements ----------
const boardElement = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

// Robot mode elements (may be null on online/local pages)
const easyBtn = document.getElementById('easyBtn');
const hardBtn = document.getElementById('hardBtn');
const startBtn = document.getElementById('startBtn');
const difficultyContainer = document.getElementById('difficultyContainer');
const startContainer = document.getElementById('startContainer');

// Online mode elements (may be null)
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinInput = document.getElementById('joinInput');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const creatorInfo = document.getElementById('creatorInfo');
const joinInfo = document.getElementById('joinInfo');

// A floating message element we will create for winner/loser animations
let messageEl = null;

// ---------- Game state ----------
let board = Array(9).fill('');
let currentPlayer = 'X';        // whose turn it is (X or O)
let isGameOver = false;
let gameMode = 'local';         // 'local' | 'robot' | 'online'
let difficulty = 'easy';        // robot difficulty
// Online-specific
let db = null;
let roomRef = null;
let roomId = null;
let isCreator = false;
let mySymbol = null;            // 'X' or 'O' (for this client) or null

// ---------- Helpers ----------
function ensureDb() {
  if (db) return true;
  if (typeof firebase === 'undefined' || !firebase.database) {
    console.error('Firebase SDK not loaded.');
    return false;
  }
  db = firebase.database();
  return true;
}

function clearBoardUI() {
  cells.forEach(c => {
    c.textContent = '';
    c.style.pointerEvents = 'auto';
    c.style.background = '';
    c.classList.remove('win');
  });
}

function updateBoardUIFromState() {
  cells.forEach((c, i) => {
    c.textContent = board[i] || '';
    c.style.pointerEvents = board[i] ? 'none' : 'auto';
  });
}

// Create floating message area (if not present)
function ensureMessageEl() {
  if (messageEl) return messageEl;
  messageEl = document.createElement('div');
  messageEl.id = 'gameMessage';
  messageEl.className = 'message';
  // basic inline styles (if your CSS doesn't include these)
  messageEl.style.position = 'fixed';
  messageEl.style.left = '50%';
  messageEl.style.top = '10%';
  messageEl.style.transform = 'translateX(-50%)';
  messageEl.style.padding = '14px 22px';
  messageEl.style.borderRadius = '12px';
  messageEl.style.fontSize = '1.15rem';
  messageEl.style.zIndex = '9999';
  messageEl.style.opacity = '0';
  messageEl.style.transition = 'transform .35s ease, opacity .35s ease';
  document.body.appendChild(messageEl);
  return messageEl;
}

function showMessage(text, type = 'info') {
  const el = ensureMessageEl();
  el.textContent = text;
  el.classList.remove('win','lose','info');
  el.classList.add(type);
  // style variations
  if (type === 'win') {
    el.style.background = '#2ecc71';
    el.style.color = '#042a16';
  } else if (type === 'lose') {
    el.style.background = '#ff7979';
    el.style.color = '#322';
  } else {
    el.style.background = '#333';
    el.style.color = '#fff';
  }
  // animate in
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  // auto hide after 3.5s
  clearTimeout(el._hideTO);
  el._hideTO = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 3500);
}

// ---------- Start / Reset ----------
function startGameLocalOrRobot() {
  board = Array(9).fill('');
  currentPlayer = 'X';
  isGameOver = false;
  clearBoardUI();
  if (boardElement) boardElement.style.display = 'grid';
  if (resetBtn) resetBtn.style.display = 'inline-block';
  if (startContainer) startContainer.style.display = 'none';
  statusElement.textContent = '';
}

function startGame() {
  // For online mode we will update DB instead of just local start
  if (gameMode === 'online' && roomRef) {
    // push current empty board to DB and ensure turn is X and gameOver false
    roomRef.update({ board: Array(9).fill(''), turn: 'X', gameOver: false });
  } else {
    startGameLocalOrRobot();
  }
}

// ---------- Click handlers ----------
startBtn?.addEventListener('click', () => {
  startGame();
});

resetBtn?.addEventListener('click', () => {
  // If online and creator, remove room; if joiner, just leave listener
  if (gameMode === 'online' && roomRef) {
    if (isCreator) {
      // delete room
      roomRef.remove().catch(()=>{});
      showMessage('Room closed', 'info');
      cleanupOnline();
    } else {
      cleanupOnline();
      showMessage('Left room', 'info');
    }
  } else {
    // local reset
    startGameLocalOrRobot();
  }
});

// Cell clicks
cells.forEach(cell => {
  cell.addEventListener('click', async () => {
    const index = Number(cell.dataset.index);
    if (isGameOver) return;
    if (gameMode === 'online') {
      if (!ensureDb() || !roomRef) return;
      // We must read current remote state to validate turn & cell
      const snap = await roomRef.once('value');
      const data = snap.val();
      if (!data) { showMessage('Room not found', 'info'); return; }
      const remoteBoard = data.board || Array(9).fill('');
      const remoteTurn = data.turn || 'X';
      if (remoteBoard[index] !== '') { showMessage('Cell taken', 'info'); return; }
      if (!mySymbol) { showMessage('Not assigned symbol', 'info'); return; }
      if (remoteTurn !== mySymbol) { showMessage('Not your turn', 'info'); return; }
      // make move locally and push to DB (transaction safe)
      await roomRef.transaction(r => {
        if (!r) return r;
        r.board = r.board || Array(9).fill('');
        if (r.board[index] === '') {
          r.board[index] = mySymbol;
          r.turn = mySymbol === 'X' ? 'O' : 'X';
          // check winner server-side? we will let clients compute and set gameOver
          const winner = checkWinnerForMinimax(r.board);
          if (winner) r.gameOver = true;
        }
        return r;
      });
      // listener will sync UI
    } else {
      // local / robot flow
      if (board[index] === '') {
        makeMove(index, currentPlayer);
        if (!isGameOver && gameMode === 'robot' && currentPlayer === 'O') {
          setTimeout(robotMove, 300);
        }
      }
    }
  });
});

// ---------- Make move ----------
function makeMove(index, player) {
  board[index] = player;
  // update UI for that cell
  const c = cells[index];
  if (c) {
    c.textContent = player;
    c.style.pointerEvents = 'none';
  }
  const winner = checkWinner(); // will highlight and set isGameOver
  if (winner) {
    // If local/robot mode, show appropriate messages
    handleEndDisplay(winner);
  }
  // swap turn only if game not ended
  if (!isGameOver) currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';
}

// ---------- Robot AI ----------
function robotMove() {
  if (difficulty === 'easy') {
    const empties = board.map((v,i)=>v===''?i:null).filter(v=>v!==null);
    if (empties.length===0) return;
    const idx = empties[Math.floor(Math.random() * empties.length)];
    makeMove(idx, 'O');
  } else {
    const idx = getBestMove();
    if (idx !== undefined) makeMove(idx, 'O');
  }
}

// ---------- Minimax for hard ----------
function getBestMove() {
  let bestScore = -Infinity, move;
  for (let i = 0; i < 9; i++) {
    if (board[i] === '') {
      board[i] = 'O';
      let score = minimax(board.slice(), 0, false);
      board[i] = '';
      if (score > bestScore) { bestScore = score; move = i; }
    }
  }
  return move;
}
function minimax(bd, depth, isMax) {
  const winner = checkWinnerForMinimax(bd);
  if (winner !== null) {
    if (winner === 'O') return 10 - depth;
    if (winner === 'X') return depth - 10;
    if (winner === 'draw') return 0;
  }
  if (isMax) {
    let best = -Infinity;
    for (let i=0;i<9;i++){
      if (bd[i]===''){ bd[i]='O'; best = Math.max(best, minimax(bd, depth+1, false)); bd[i]=''; }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i=0;i<9;i++){
      if (bd[i]===''){ bd[i]='X'; best = Math.min(best, minimax(bd, depth+1, true)); bd[i]=''; }
    }
    return best;
  }
}

// ---------- Winner check (UI highlight + returns winner symbol or 'draw' or null) ----------
function checkWinner() {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      // highlight cells (both players should see these highlighted)
      [a,b,c].forEach(i => {
        const el = cells[i];
        if (el) {
          el.style.background = '#4CAF50';
          el.classList.add('win');
        }
      });
      isGameOver = true;
      // set all cells non-clickable
      cells.forEach(cell => cell.style.pointerEvents = 'none');
      return board[a]; // 'X' or 'O'
    }
  }
  if (!board.includes('')) {
    isGameOver = true;
    return 'draw';
  }
  return null;
}

// Minimx helper (non-UI) used by minimax
function checkWinnerForMinimax(bd) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of wins) {
    if (bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) return bd[a];
  }
  if (!bd.includes('')) return 'draw';
  return null;
}

// ---------- Display end animation & messages ----------
function handleEndDisplay(winnerSymbol) {
  if (winnerSymbol === 'draw') {
    showMessage('Draw! 🤝', 'info');
    return;
  }
  // highlight already done in checkWinner(); now show animated messages
  if (gameMode === 'online') {
    // online: decide per client whether this client won or lost
    if (!mySymbol) {
      // observers? just show who won
      showMessage(`${winnerSymbol} Wins!`, 'info');
    } else {
      if (winnerSymbol === mySymbol) {
        showMessage(`You win! 😊`, 'win');
        // highlight winner cells green already done
        // also optionally pulse winner cells
        animateWinningCells();
      } else {
        showMessage(`You lose 😢`, 'lose');
        // highlight winner cells green for both; also highlight loser cells? user asked: "losser wala box bhi green ho"
        // We'll also briefly pulse the player's own symbol cells and then leave winner highlight green
        animateLosingCells();
      }
    }
  } else {
    // local or robot
    if (winnerSymbol === 'X' || winnerSymbol === 'O') {
      if (gameMode === 'robot' && winnerSymbol === 'O') {
        if (mySymbol === 'O') showMessage(`You win! 😊`, 'win');
        else showMessage(`${winnerSymbol} Wins!`, 'info');
      } else {
        showMessage(`${winnerSymbol} Wins!`, 'info');
      }
      animateWinningCells();
    } else {
      showMessage('Draw! 🤝', 'info');
    }
  }
}

// small animations
function animateWinningCells() {
  cells.forEach(c => c.classList.remove('pulse'));
  const winEls = cells.filter(c => c.classList.contains('win'));
  winEls.forEach((el, idx) => {
    el.style.transition = 'transform .25s ease';
    el.style.transform = 'scale(1.06)';
    setTimeout(()=> el.style.transform = 'scale(1)', 300 + idx*100);
  });
}
function animateLosingCells() {
  // pulse all cells containing mySymbol so player feels loss
  if (!mySymbol) return;
  const myEls = cells.filter((c,i)=> c.textContent === mySymbol);
  myEls.forEach((el, idx) => {
    el.style.transition = 'transform .2s ease';
    el.style.transform = 'scale(0.95)';
    setTimeout(()=> el.style.transform = 'scale(1)', 300 + idx*80);
  });
}

// ---------- Difficulty selection (robot)
if (easyBtn) easyBtn.addEventListener('click', ()=> {
  difficulty = 'easy';
  gameMode = 'robot';
  if (difficultyContainer) difficultyContainer.style.display = 'none';
  if (startContainer) startContainer.style.display = 'block';
});
if (hardBtn) hardBtn.addEventListener('click', ()=> {
  difficulty = 'hard';
  gameMode = 'robot';
  if (difficultyContainer) difficultyContainer.style.display = 'none';
  if (startContainer) startContainer.style.display = 'block';
});

// ---------- ONLINE MODE (create / join / listen / update) ----------
if (createBtn) {
  createBtn.addEventListener('click', async () => {
    if (!ensureDb()) return;
    // create short uppercase id
    roomId = Math.random().toString(36).substring(2,8).toUpperCase();
    isCreator = true;
    mySymbol = 'X';
    gameMode = 'online';
    // initial room state
    roomRef = db.ref('rooms/' + roomId);
    await roomRef.set({
      board: Array(9).fill(''),
      turn: 'X',
      gameOver: false,
      createdAt: Date.now()
    });
    roomIdDisplay && (roomIdDisplay.textContent = roomId);
    creatorInfo && (creatorInfo.textContent = 'Share this ID with your friend');
    // start listening
    listenRoom(roomId);
    startGame(); // will push to DB in listen handler if needed
  });
}

if (joinBtn) {
  joinBtn.addEventListener('click', async () => {
    if (!ensureDb()) return;
    const id = (joinInput && joinInput.value || '').trim().toUpperCase();
    if (!id) { joinInfo && (joinInfo.textContent = 'Enter Room ID'); return; }
    roomId = id;
    isCreator = false;
    mySymbol = 'O';
    gameMode = 'online';
    roomRef = db.ref('rooms/' + roomId);
    const snap = await roomRef.once('value');
    if (!snap.exists()) { joinInfo && (joinInfo.textContent = 'Room not found'); return; }
    // set status to playing (optional)
    await roomRef.update({ gameOver: false });
    roomIdDisplay && (roomIdDisplay.textContent = roomId);
    joinInfo && (joinInfo.textContent = 'Joined. Good luck!');
    listenRoom(roomId);
  });
}

function listenRoom(id) {
  if (!ensureDb()) return;
  if (!roomRef) roomRef = db.ref('rooms/' + id);
  // remove old listener if any
  roomRef.off('value');
  roomRef.on('value', snap => {
    const data = snap.val();
    if (!data) return;
    // sync board
    board = data.board || Array(9).fill('');
    currentPlayer = data.turn || 'X';
    isGameOver = !!data.gameOver;
    updateBoardUIFromState();
    // If gameOver in DB, call end handler so clients show messages
    const winner = checkWinnerForMinimax(board);
    if (winner === 'draw') {
      isGameOver = true;
      showMessage('Draw! 🤝', 'info');
    } else if (winner) {
      // highlight winning cells locally (we compute combos)
      // we must set board and then call checkWinner-like highlight
      // We'll run a helper to highlight winning combo from board
      highlightWinningComboFromBoard(board);
      // show per-client message
      if (mySymbol) {
        if (winner === mySymbol) showMessage('You win! 😊', 'win');
        else showMessage('You lose 😢', 'lose');
      } else {
        showMessage(`${winner} Wins!`, 'info');
      }
    }
  });
  // show board UI
  if (boardElement) boardElement.style.display = 'grid';
  if (resetBtn) resetBtn.style.display = 'inline-block';
}

// helper to highlight winning combo from a board array
function highlightWinningComboFromBoard(bd) {
  // clear previous highlights
  cells.forEach(c => { c.style.background = ''; c.classList.remove('win'); });
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of wins) {
    if (bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) {
      [a,b,c].forEach(i => {
        const el = cells[i];
        if (el) {
          el.style.background = '#4CAF50';
          el.classList.add('win');
        }
      });
      // disable clicks
      cells.forEach(cell => cell.style.pointerEvents = 'none');
      return;
    }
  }
}

// ---------- Utility: when leaving room / cleanup ----------
function cleanupOnline() {
  if (roomRef) {
    try { roomRef.off(); } catch(e) {}
    roomRef = null;
  }
  roomId = null;
  isCreator = false;
  mySymbol = null;
  gameMode = 'local';
  // reset local board UI
  board = Array(9).fill('');
  clearBoardUI();
  if (boardElement) boardElement.style.display = 'none';
  if (resetBtn) resetBtn.style.display = 'none';
  if (roomIdDisplay) roomIdDisplay.textContent = '';
  if (creatorInfo) creatorInfo.textContent = '';
  if (joinInfo) joinInfo.textContent = '';
  statusElement.textContent = '';
}

// ---------- Auto-start ONLY for local.html ----------
if (window.location.pathname.includes('local.html')) {
  gameMode = 'local';
  startGameLocalOrRobot();
}

// If no robot controls found and not local, ensure board not auto-started
// (prevent null errors when loading online.html or robot.html)
