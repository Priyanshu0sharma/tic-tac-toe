// COMMON ELEMENTS
const boardElement = document.getElementById("board");
const cells = document.querySelectorAll(".cell");
const statusElement = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");

// Robot Mode
const easyBtn = document.getElementById("easyBtn");
const hardBtn = document.getElementById("hardBtn");
const startBtn = document.getElementById("startBtn");
const difficultyContainer = document.getElementById("difficultyContainer");
const startContainer = document.getElementById("startContainer");

// Online Mode
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const joinInput = document.getElementById("joinInput");
const roomIdDisplay = document.getElementById("roomIdDisplay");

let board = Array(9).fill("");
let currentPlayer = "X";
let isGameOver = false;
let gameMode = "local";

// Firebase (If online mode page)
let db = null;
if (typeof firebase !== "undefined") {
    db = firebase.database();
}

// ==========================
// START GAME (common)
// ==========================
function startGame() {
    board = Array(9).fill("");
    currentPlayer = "X";
    isGameOver = false;

    cells.forEach(c => {
        c.textContent = "";
        c.style.background = "";
        c.style.pointerEvents = "auto";
    });

    if (boardElement) boardElement.style.display = "grid";
    if (resetBtn) resetBtn.style.display = "inline-block";

    if (startContainer) startContainer.style.display = "none";

    if (gameMode === "online") updateRoom();
}

resetBtn?.addEventListener("click", startGame);

// ==========================
// LOCAL / ROBOT CLICK
// ==========================
cells.forEach(cell => {
    cell.addEventListener("click", () => {
        let index = cell.dataset.index;

        if (board[index] !== "" || isGameOver) return;

        if (gameMode === "online" && myTurn() === false) return;

        makeMove(index, currentPlayer);

        if (gameMode === "robot" && currentPlayer === "O") {
            setTimeout(robotMove, 300);
        }

        if (gameMode === "online") updateRoom();
    });
});

// =======================
// MAKE MOVE
// =======================
function makeMove(i, player) {
    board[i] = player;
    cells[i].textContent = player;
    cells[i].style.pointerEvents = "none";
    checkWinner();
    currentPlayer = currentPlayer === "X" ? "O" : "X";
}

// =======================
// ROBOT MODE
// =======================
if (easyBtn)
    easyBtn.onclick = () => { gameMode = "robot"; startContainer.style.display = "block"; difficultyContainer.style.display = "none"; };

if (hardBtn)
    hardBtn.onclick = () => { gameMode = "robot"; startContainer.style.display = "block"; difficultyContainer.style.display = "none"; };

startBtn?.addEventListener("click", startGame);

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
            cells[a].style.background = "#4CAF50";
            cells[b].style.background = "#4CAF50";
            cells[c].style.background = "#4CAF50";
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

// ========================================================
// ONLINE MODE (Create & Join)
// ========================================================
let roomId = null;
let mySymbol = "";

if (createBtn) createBtn.onclick = createRoom;
if (joinBtn) joinBtn.onclick = joinRoom;

function createRoom() {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    mySymbol = "X";
    gameMode = "online";

    db.ref("rooms/" + roomId).set({
        board: board,
        turn: "X",
        gameOver: false
    });

    roomIdDisplay.textContent = roomId;

    startOnlineListening();
}

function joinRoom() {
    roomId = joinInput.value.trim().toUpperCase();
    if (!roomId) return;

    mySymbol = "O";
    gameMode = "online";

    startOnlineListening();
}

function myTurn() {
    return currentPlayer === mySymbol;
}

function updateRoom() {
    if (!roomId) return;
    db.ref("rooms/" + roomId).update({
        board,
        turn: currentPlayer,
        gameOver: isGameOver
    });
}

function startOnlineListening() {
    boardElement.style.display = "grid";

    db.ref("rooms/" + roomId).on("value", snap => {
        let data = snap.val();
        if (!data) return;

        board = data.board;
        currentPlayer = data.turn;
        isGameOver = data.gameOver;

        for (let i = 0; i < 9; i++) {
            cells[i].textContent = board[i];
            cells[i].style.pointerEvents = board[i] ? "none" : "auto";
        }
    });
}

// =======================
// AUTO START ONLY LOCAL
// =======================
if (window.location.pathname.includes("local.html")) startGame();
