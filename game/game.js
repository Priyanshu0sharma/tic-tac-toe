// Local & Robot Game Logic

// Elements
const boardElement = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

// State
let board = Array(9).fill('');
let currentPlayer = 'X';
let isGameOver = false;
let gameMode = 'local'; // local | robot
let difficulty = 'easy';
let playerNames = { X: 'Player 1', O: 'Player 2' };

// Init
document.addEventListener('DOMContentLoaded', () => {
    if(window.location.pathname.includes('local.html')) {
        gameMode = 'local';
        startGame();
    } else if(window.location.pathname.includes('robot.html')) {
        gameMode = 'robot';
        setupRobotMode();
    }
    
    // Listeners
    cells.forEach(cell => cell.addEventListener('click', onCellClick));
    if(resetBtn) resetBtn.addEventListener('click', startGame);
});

function setupRobotMode() {
    const easyBtn = document.getElementById('easyBtn');
    const hardBtn = document.getElementById('hardBtn');
    const startBtn = document.getElementById('startBtn');
    const diffContainer = document.getElementById('difficultyContainer');
    const startContainer = document.getElementById('startContainer');
    const boardContainer = document.getElementById('board');
    
    if(easyBtn) easyBtn.addEventListener('click', () => { difficulty='easy'; showStart(); });
    if(hardBtn) hardBtn.addEventListener('click', () => { difficulty='hard'; showStart(); });
    
    function showStart() {
        diffContainer.style.display = 'none';
        startContainer.style.display = 'block';
    }
    
    if(startBtn) startBtn.addEventListener('click', () => {
        startContainer.style.display = 'none';
        boardContainer.style.display = 'grid';
        resetBtn.style.display = 'inline-block';
        playerNames = { X: 'You', O: 'Robot' };
        startGame();
    });
}

function startGame() {
    board = Array(9).fill('');
    isGameOver = false;
    
    // Random turn for Robot mode, X for Local
    if (gameMode === 'robot') {
        currentPlayer = Math.random() > 0.5 ? 'X' : 'O';
    } else {
        currentPlayer = 'X';
    }
    
    cells.forEach(c => {
        c.textContent = '';
        c.classList.remove('win');
        c.style.pointerEvents = 'auto';
    });
    updateStatus();
    
    // If Robot (O) starts, make move
    if(gameMode === 'robot' && currentPlayer === 'O') {
        setTimeout(robotMove, 500);
    }
}

function onCellClick(e) {
    const idx = e.target.dataset.index;
    if(board[idx] !== '' || isGameOver) return;
    
    makeMove(idx, currentPlayer);
    
    if(!isGameOver && gameMode === 'robot' && currentPlayer === 'O') {
        setTimeout(robotMove, 500);
    }
}

function makeMove(idx, player) {
    board[idx] = player;
    cells[idx].textContent = player;
    cells[idx].style.pointerEvents = 'none';
    
    const winInfo = checkWinner(board);
    if(winInfo.winner) {
        endGame(winInfo);
    } else if(!board.includes('')) {
        endGame({ winner: 'Draw' });
    } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        updateStatus();
    }
}

function updateStatus() {
    if(isGameOver) return;
    statusElement.textContent = `${playerNames[currentPlayer]}'s Turn (${currentPlayer})`;
}

function endGame(winInfo) {
    isGameOver = true;
    if(winInfo.winner === 'Draw') {
        statusElement.textContent = "It's a Draw!";
        saveHistory('Draw');
    } else {
        statusElement.textContent = `${playerNames[winInfo.winner]} Wins!`;
        winInfo.line.forEach(i => cells[i].classList.add('win'));
        saveHistory(winInfo.winner);
    }
}

// Robot Logic
function robotMove() {
    if(isGameOver) return;
    let idx;
    if(difficulty === 'easy') {
        const empties = board.map((v,i) => v===''?i:null).filter(v=>v!==null);
        idx = empties[Math.floor(Math.random() * empties.length)];
    } else {
        idx = minimax(board, 'O').index;
    }
    makeMove(idx, 'O');
}

function minimax(newBoard, player) {
    const availSpots = newBoard.map((v,i) => v===''?i:null).filter(v=>v!==null);
    const winInfo = checkWinner(newBoard);
    
    if(winInfo.winner === 'O') return { score: 10 };
    if(winInfo.winner === 'X') return { score: -10 };
    if(availSpots.length === 0) return { score: 0 };
    
    const moves = [];
    for(let i=0; i<availSpots.length; i++) {
        const move = {};
        move.index = availSpots[i];
        newBoard[availSpots[i]] = player;
        
        if(player === 'O') {
            const result = minimax(newBoard, 'X');
            move.score = result.score;
        } else {
            const result = minimax(newBoard, 'O');
            move.score = result.score;
        }
        
        newBoard[availSpots[i]] = '';
        moves.push(move);
    }
    
    let bestMove;
    if(player === 'O') {
        let bestScore = -10000;
        for(let i=0; i<moves.length; i++) {
            if(moves[i].score > bestScore) {
                bestScore = moves[i].score;
                bestMove = i;
            }
        }
    } else {
        let bestScore = 10000;
        for(let i=0; i<moves.length; i++) {
            if(moves[i].score < bestScore) {
                bestScore = moves[i].score;
                bestMove = i;
            }
        }
    }
    return moves[bestMove];
}

function checkWinner(bd) {
    const wins = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for(let i=0; i<wins.length; i++) {
        const [a,b,c] = wins[i];
        if(bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) {
            return { winner: bd[a], line: wins[i] };
        }
    }
    return { winner: null };
}

// Shared History Helper (if not in ui-components)
// We assume ui-components.js is loaded for renderHistoryList, but saveHistory is logic.
// We'll keep saveHistory here for Local/Robot.
function saveHistory(winner){
  let history = JSON.parse(localStorage.getItem('ttt_history')||'[]');
  const date = new Date().toLocaleString();
  
  let p1Name = playerNames.X;
  let p2Name = playerNames.O;
  let winnerName = winner === 'Draw' ? 'Draw' : playerNames[winner];

  const entry = {
    mode: gameMode,
    winner: winnerName,
    p1: p1Name,
    p2: p2Name,
    date: date,
    timestamp: Date.now()
  };
  
  history.unshift(entry);
  if(history.length > 20) history.pop();
  localStorage.setItem('ttt_history', JSON.stringify(history));
}
