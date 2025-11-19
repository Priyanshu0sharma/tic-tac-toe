// =======================
// ELEMENTS
// =======================
const boardElement = document.getElementById("board");
const cells = document.querySelectorAll(".cell");
const statusElement = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

// Robot mode buttons
const easyBtn = document.getElementById("easyBtn");
const hardBtn = document.getElementById("hardBtn");
const startBtn = document.getElementById("startBtn");
const difficultyContainer = document.getElementById("difficultyContainer");
const startContainer = document.getElementById("startContainer");

// Online mode buttons
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const joinInput = document.getElementById("joinInput");
const roomIdDisplay = document.getElementById("roomIdDisplay");

let board = Array(9).fill("");
let currentPlayer = "X";
let isGameOver = false;

let gameMode = "";        // "local", "robot", or "online"
let difficulty = "easy";

let roomId = null;
let mySymbol = "";
let db;

// =======================
// Firebase (only if online.html)
// =======================
if (typeof firebase !== "undefined") {
    db = firebase.database();
}

// =======================
// ROBOT MODE
// =======================
if (easyBtn) {
    easyBtn.onclick = () => {
        gameMode = "robot";
        difficulty = "easy";
        difficultyContainer.style.display = "none";
        startContainer.style.display = "block";
    };
}

if (hardBtn) {
    hardBtn.onclick = () => {
        gameMode = "robot";
        difficulty = "hard";
        difficultyContainer.style.display = "none";
        startContainer.style.display = "block";
    };
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
        updateRoom();
    }
}

resetBtn?.addEventListener("click", startGame);

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

            if (gameMode === "robot" && currentPlayer === "O") {
                setTimeout(robotMove, 300);
            }

            if (gameMode === "online") {
                updateRoom();
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
// ROBOT MOVE
// =======================
function robotMove() {
    let empty = board
        .map((v, i) => (v === "" ? i : null))
        .filter(v => v !== null);

    let idx =
        difficulty === "easy"
            ? empty[Math.floor(Math.random() * empty.length)]
            : empty[0]; // simple (you can add minimax later)

    makeMove(idx, "O");
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

// =======================
// ONLINE MODE — CREATE
// =======================
createBtn?.addEventListener("click", () => {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    mySymbol = "X";
    gameMode = "online";

    db.ref("rooms/" + roomId).set({
        board,
        turn: "X",
        gameOver: false
    });

    roomIdDisplay.textContent = roomId;

    boardElement.style.display = "grid";
    resetBtn.style.display = "inline-block";

    listenRoom();
});

// =======================
// ONLINE MODE — JOIN
// =======================
joinBtn?.addEventListener("click", () => {
    roomId = joinInput.value.trim().toUpperCase();
    if (!roomId) return;

    mySymbol = "O";
    gameMode = "online";

    listenRoom();
});

// =======================
// UPDATE ROOM
// =======================
function updateRoom() {
    db.ref("rooms/" + roomId).update({
        board,
        turn: currentPlayer,
        gameOver: isGameOver
    });
}

// =======================
// LISTEN ROOM
// =======================
function listenRoom() {
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

        boardElement.style.display = "grid";
        resetBtn.style.display = "inline-block";
    });
}

// ===========================
// ONLY LOCAL AUTOSTART
// ===========================
if (window.location.pathname.includes("local.html")) {
    gameMode = "local";
    startGame();
}
