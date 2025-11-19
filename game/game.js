// =======================
// ELEMENTS
// =======================
const boardElement = document.getElementById("board");
const cells = document.querySelectorAll(".cell");
const statusElement = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

// Robot Mode Controls
const easyBtn = document.getElementById("easyBtn");
const hardBtn = document.getElementById("hardBtn");
const startBtn = document.getElementById("startBtn");
const difficultyContainer = document.getElementById("difficultyContainer");
const startContainer = document.getElementById("startContainer");

// Online Mode Controls
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const joinInput = document.getElementById("joinInput");
const roomIdDisplay = document.getElementById("roomIdDisplay");

let board = Array(9).fill("");
let currentPlayer = "X";
let isGameOver = false;
let gameMode = "local";
let difficulty = "easy";
let roomId = null;
let mySymbol = "";
let db = firebase.database();

// =======================
// ROBOT MODE
// =======================
if (easyBtn) easyBtn.onclick = () => { difficulty = "easy"; prepareStart(); };
if (hardBtn) hardBtn.onclick = () => { difficulty = "hard"; prepareStart(); };

function prepareStart() {
    difficultyContainer.style.display = "none";
    startContainer.style.display = "block";
    gameMode = "robot";
}

startBtn?.addEventListener("click", startGame);

// =======================
// START GAME
// =======================
function startGame() {
    board = Array(9).fill("");
    currentPlayer = "X";
    isGameOver = false;
    statusElement.textContent = "";

    cells.forEach(c => {
        c.textContent = "";
        c.style.background = "";
        c.style.pointerEvents = "auto";
    });

    boardElement.style.display = "grid";
    resetBtn.style.display = "inline-block";

    if (startContainer) startContainer.style.display = "none";

    if (gameMode === "online") {
        updateRoom(board, currentPlayer, false);
    }
}

resetBtn?.addEventListener("click", () => {
    if (gameMode === "online") {
        startGame();
    } else startGame();
});

// =======================
// CELL CLICK
// =======================
cells.forEach(cell => {
    cell.onclick = () => {
        const idx = cell.dataset.index;

        if (gameMode === "online") {
            if (mySymbol !== currentPlayer) return;
        }

        if (board[idx] === "" && !isGameOver) {
            makeMove(idx, currentPlayer);

            if (gameMode === "robot" && currentPlayer === "O")
                setTimeout(robotMove, 300);

            if (gameMode === "online") {
                updateRoom(board, currentPlayer, isGameOver);
            }
        }
    };
});

// =======================
// MAKE MOVE
// =======================
function makeMove(index, player) {
    board[index] = player;
    cells[index].textContent = player;
    cells[index].style.pointerEvents = "none";

    checkWinner();

    currentPlayer = currentPlayer === "X" ? "O" : "X";
}

// =======================
// ROBOT AI
// =======================
function robotMove() {
    let emptyCells = board.map((v, i) => v === "" ? i : null).filter(v => v !== null);
    let index = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    makeMove(index, "O");
}

// =======================
// CHECK WINNER
// =======================
function checkWinner() {
    const wins = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];

    for (let [a,b,c] of wins) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            [a,b,c].forEach(i => cells[i].style.background = "#4CAF50");
            statusElement.textContent = `${board[a]} Wins!`;
            isGameOver = true;
            return;
        }
    }

    if (!board.includes("")) {
        statusElement.textContent = "Draw!";
        isGameOver = true;
    }
}

// ============================
// ONLINE MODE — CREATE ROOM
// ============================
createBtn?.addEventListener("click", () => {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    mySymbol = "X";
    gameMode = "online";

    db.ref("rooms/" + roomId).set({
        board: board,
        turn: "X",
        gameOver: false
    });

    roomIdDisplay.textContent = roomId;
    boardElement.style.display = "grid";
    resetBtn.style.display = "inline-block";

    listenRoom(roomId);
});

// ============================
// ONLINE MODE — JOIN ROOM
// ============================
joinBtn?.addEventListener("click", () => {
    roomId = joinInput.value.trim().toUpperCase();
    if (!roomId) return;

    mySymbol = "O";
    gameMode = "online";

    listenRoom(roomId);
});

// ============================
// ONLINE MODE — UPDATE ROOM
// ============================
function updateRoom(board, turn, gameOver) {
    db.ref("rooms/" + roomId).update({
        board: board,
        turn: currentPlayer,
        gameOver: isGameOver
    });
}

// ============================
// ONLINE MODE — LISTEN ROOM
// ============================
function listenRoom(roomId) {
    db.ref("rooms/" + roomId).on("value", snap => {
        let data = snap.val();
        if (!data) return;

        board = data.board;
        currentPlayer = data.turn;
        isGameOver = data.gameOver;

        for (let i = 0; i < 9; i++) {
            cells[i].textContent = board[i];
            cells[i].style.pointerEvents = board[i] === "" ? "auto" : "none";
        }
    });

    boardElement.style.display = "grid";
    resetBtn.style.display = "inline-block";
}

// =======================
// AUTO-START ONLY LOCAL
// =======================
if (window.location.pathname.includes("local.html")) startGame();
// Auto-start only for local and robot pages
if (window.location.pathname.includes("local.html")) {
    gameMode = "local";
    startGame();
}

if (window.location.pathname.includes("robot.html")) {
    // robot mode me difficulty screen honi chahiye
    gameMode = "robot";
}


