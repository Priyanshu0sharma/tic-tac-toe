// Firebase DB
let db = firebase.database();
let roomId = localStorage.getItem('currentRoomId');
let mySymbol = localStorage.getItem('mySymbol');
if(!roomId || !mySymbol) location.href="online.html";

const roomRef = db.ref('rooms/' + roomId);
const roomIdDisplay = document.getElementById('roomIdDisplay');
const waitingInfo = document.getElementById('waitingInfo');

roomIdDisplay.textContent = roomId;

roomRef.on('value', snap => {
  const data = snap.val();
  if(!data) return;

  if(data.joinerName && data.creatorName && data.joinerName!==''){
    // Both players are ready → start game
    window.location.href='online-game.html';
  }
});
