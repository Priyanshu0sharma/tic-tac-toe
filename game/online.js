// Online Game Logic

const online = {
  db: null,
  user: null,
  roomRef: null,
  roomId: null,
  isCreator: false,
  mySymbol: null,
  
  // Initialize
  init: function() {
    if (typeof firebase === 'undefined' || !firebase.database) {
      console.error("Firebase not loaded");
      return false;
    }
    this.db = firebase.database();
    this.loadUser();
    return true;
  },

  loadUser: function() {
    const nameInput = document.getElementById('playerNameInput');
    let name = localStorage.getItem('playerName') || 'Guest';
    if(nameInput && nameInput.value) name = nameInput.value;
    
    let uid = localStorage.getItem('playerUid');
    if (!uid) {
      uid = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('playerUid', uid);
    }
    this.user = { name, uid };
    
    // Update input if exists
    if(nameInput && !nameInput.value) nameInput.value = name;
    
    // Save name on change
    if(nameInput) {
        nameInput.addEventListener('change', () => {
            this.user.name = nameInput.value;
            localStorage.setItem('playerName', this.user.name);
        });
    }
  },

  // --- Matchmaking ---
  

  // --- Matchmaking ---
  
  findMatch: async function() {
    if(!this.user.name) { showFloatingMessage('Please enter your name', 'error'); return; }
    
    // Show UI
    this.showFindingPopup();
    
    // Simulate delay for "Finding Player" effect (2-4 seconds)
    const delay = 2000 + Math.random() * 2000;
    
    // We start the actual search after a short delay to let the animation play
    // or we can start it immediately but wait to show result.
    // Let's start immediately but enforce minimum wait time.
    const startTime = Date.now();
    
    const queueRef = this.db.ref('queue/waitingPlayer');
    
    // Transaction to atomically check/claim queue
    const result = await queueRef.transaction(current => {
      if (current === null) {
        // Queue is empty, add self
        return { name: this.user.name, uid: this.user.uid, timestamp: Date.now() };
      } else {
        // Someone is waiting
        if (current.uid === this.user.uid) return; // Already in queue
        return null; // Remove them to claim match
      }
    });

    if (result.committed) {
      const val = result.snapshot.val();
      if (val && val.uid === this.user.uid) {
        // We are now waiting
        console.log("Added to queue. Waiting...");
        this.listenForMatch(startTime, delay);
      } else {
        // We matched! 'val' is the opponent who WAS in the queue
        const opponent = val; 
        console.log("Matched with", opponent.name);
        
        // Ensure we wait at least the delay time before starting
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, delay - elapsed);
        
        setTimeout(() => {
            this.createRoom(opponent);
        }, remaining);
      }
    } else {
      // Transaction failed (race condition), try again
      setTimeout(() => this.findMatch(), 500);
    }
  },

  showFindingPopup: function() {
      let popup = document.getElementById('findingPopup');
      if(!popup) {
          popup = document.createElement('div');
          popup.id = 'findingPopup';
          popup.className = 'finding-popup';
          popup.innerHTML = `
            <div class="finding-content">
                <div class="spinner-container">
                    <div class="spinner"></div>
                    <div class="avatar-pulse">👤</div>
                </div>
                <div class="finding-title">Finding Player<span class="finding-dots"></span></div>
                <div style="font-size: 0.9rem; opacity: 0.7;">Searching for a worthy opponent...</div>
                <button class="cancel-search-btn" id="cancelSearchBtn">Cancel Search</button>
            </div>
          `;
          document.body.appendChild(popup);
          
          document.getElementById('cancelSearchBtn').addEventListener('click', () => {
             this.cancelSearch(); 
          });
      }
      popup.style.display = 'flex';
  },
  
  cancelSearch: function() {
      // Remove from queue if in it
      const queueRef = this.db.ref('queue/waitingPlayer');
      queueRef.transaction(current => {
          if(current && current.uid === this.user.uid) return null;
          return current;
      });
      
      // Stop listening
      const myMatchRef = this.db.ref('users/' + this.user.uid + '/match');
      myMatchRef.off();
      
      // Hide popup
      const popup = document.getElementById('findingPopup');
      if(popup) popup.style.display = 'none';
      
      showFloatingMessage('Search cancelled', 'info');
  },

  listenForMatch: function(startTime, minDelay) {
    const queueRef = this.db.ref('queue/waitingPlayer');
    
    // Listen to our own match node
    const myMatchRef = this.db.ref('users/' + this.user.uid + '/match');
    myMatchRef.on('value', snap => {
      const roomId = snap.val();
      if (roomId) {
        // Match found!
        myMatchRef.remove(); // Clear match info
        queueRef.off(); // Stop listening to queue
        
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDelay - elapsed);
        
        setTimeout(() => {
            this.joinGame(roomId, 'O'); // Waiter is always O (Joiner)
        }, remaining);
      }
    });
    
    // Timeout after 20s
    setTimeout(() => {
        queueRef.once('value', snap => {
            if(snap.val() && snap.val().uid === this.user.uid) {
                queueRef.remove();
                this.cancelSearch(); // Reuse cancel logic to hide popup
                showFloatingMessage('No players found. Try again.', 'error');
            }
        });
    }, 20000);
  },

  createRoom: async function(opponent) {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = this.db.ref('rooms/' + roomId);
    
    await roomRef.set({
      board: Array(9).fill(''),
      turn: 'X',
      gameOver: false,
      creator: { name: this.user.name, uid: this.user.uid },
      joiner: { name: opponent.name, uid: opponent.uid },
      lastMove: Date.now()
    });
    
    // Notify opponent
    await this.db.ref('users/' + opponent.uid + '/match').set(roomId);
    
    // Join as Creator (X)
    this.joinGame(roomId, 'X');
  },
  
  // --- Private Rooms ---
  
  createPrivateRoom: async function() {
    if(!this.user.name) { showFloatingMessage('Enter name first', 'error'); return; }
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = this.db.ref('rooms/' + roomId);
    
    await roomRef.set({
      board: Array(9).fill(''),
      turn: 'X',
      gameOver: false,
      creator: { name: this.user.name, uid: this.user.uid },
      joiner: null, // Waiting for joiner
      isPrivate: true
    });
    
    this.joinGame(roomId, 'X');
  },
  
  joinPrivateRoom: async function() {
    const input = document.getElementById('joinInput');
    const roomId = input.value.trim().toUpperCase();
    if(!roomId) { showFloatingMessage('Enter Room ID', 'error'); return; }
    
    const roomRef = this.db.ref('rooms/' + roomId);
    const snap = await roomRef.once('value');
    if(!snap.exists()) { showFloatingMessage('Room not found', 'error'); return; }
    
    const data = snap.val();
    if(data.joiner) { showFloatingMessage('Room is full', 'error'); return; }
    
    await roomRef.update({
      joiner: { name: this.user.name, uid: this.user.uid }
    });
    
    this.joinGame(roomId, 'O');
  },

  // --- Navigation ---
  
  joinGame: function(roomId, symbol) {
    sessionStorage.setItem('currentRoomId', roomId);
    sessionStorage.setItem('mySymbol', symbol);
    window.location.href = 'online-game.html';
  },
  
  // --- Leaderboard ---
  
  updateLeaderboard: function(winnerUid) {
      if(!winnerUid) return;
      const ref = this.db.ref('leaderboard/' + winnerUid);
      ref.transaction(current => {
          if(!current) return { name: 'Unknown', wins: 1, games: 1 };
          return { ...current, wins: (current.wins||0)+1, games: (current.games||0)+1 };
      });
  },

  // --- Game Logic ---
  
  initGame: function() {
    if(!this.init()) return; // Ensure DB is ready
    
    this.roomId = sessionStorage.getItem('currentRoomId');
    this.mySymbol = sessionStorage.getItem('mySymbol');
    
    if(!this.roomId || !this.mySymbol) {
      window.location.href = 'online.html';
      return;
    }
    
    this.roomRef = this.db.ref('rooms/' + this.roomId);
    
    // UI Elements
    const cells = document.querySelectorAll('.cell');
    const statusEl = document.getElementById('status');
    const resetBtn = document.getElementById('resetBtn'); // Play Again
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    if(roomIdDisplay) roomIdDisplay.textContent = 'Room: ' + this.roomId;
    
    // Listeners
    cells.forEach(c => c.addEventListener('click', (e) => {
        const idx = e.target.dataset.index;
        this.makeMove(idx);
    }));
    
    if(resetBtn) resetBtn.addEventListener('click', () => this.votePlayAgain());
    
    // Sync
    this.roomRef.on('value', snap => {
        const data = snap.val();
        if(!data) return;
        
        // Check if opponent joined (for private rooms)
        if(!data.joiner && this.mySymbol === 'X') {
             statusEl.textContent = "Waiting for opponent to join...";
             return;
        }
        
        this.renderBoard(data.board);
        this.updateStatus(data);
        
        if(data.gameOver) {
            this.handleGameOver(data);
        } else {
            // Timer logic
            if(data.turn === this.mySymbol) {
                startTurnTimer(15, () => this.autoMove(data.board));
            } else {
                stopTurnTimer();
            }
        }
        
        // Play Again Sync
        if(data.rematch && data.rematch.X && data.rematch.O) {
            this.resetGame();
        }
    });
    
    // Handle disconnect
    this.roomRef.onDisconnect().remove(); // Or mark as abandoned
  },
  
  renderBoard: function(board) {
      const cells = document.querySelectorAll('.cell');
      board = board || Array(9).fill('');
      cells.forEach((c, i) => {
          c.textContent = board[i];
          c.className = 'cell'; // Reset classes
          if(board[i]) c.classList.add('disabled');
      });
  },
  
  updateStatus: function(data) {
      const statusEl = document.getElementById('status');
      if(data.gameOver) return; // Handled in handleGameOver
      
      if(!data.joiner) {
           statusEl.textContent = "Waiting for opponent...";
           return;
      }
      
      const myName = this.mySymbol === 'X' ? data.creator.name : data.joiner.name;
      const oppName = this.mySymbol === 'X' ? (data.joiner?data.joiner.name:'Waiting...') : data.creator.name;
      
      if(data.turn === this.mySymbol) {
          statusEl.textContent = `Your Turn (${this.mySymbol})`;
          statusEl.style.color = 'var(--primary-color)';
      } else {
          statusEl.textContent = `${oppName}'s Turn (${data.turn})`;
          statusEl.style.color = 'var(--text-color)';
      }
  },
  
  makeMove: function(idx) {
      this.roomRef.transaction(room => {
          if(!room || room.gameOver || room.turn !== this.mySymbol) return;
          if(!room.joiner) return; // Cannot play alone
          if(!room.board) room.board = Array(9).fill('');
          if(room.board[idx] !== '') return;
          
          room.board[idx] = this.mySymbol;
          room.turn = this.mySymbol === 'X' ? 'O' : 'X';
          room.lastMove = Date.now();
          
          const win = this.checkWinner(room.board);
          if(win.winner) {
              room.gameOver = true;
              room.winner = win.winner;
              room.winLine = win.line;
          } else if(!room.board.includes('')) {
              room.gameOver = true;
              room.winner = 'Draw';
          }
          
          return room;
      });
  },
  
  autoMove: function(board) {
      const empties = board.map((v,i)=>v===''?i:null).filter(v=>v!==null);
      if(empties.length > 0) {
          const idx = empties[Math.floor(Math.random()*empties.length)];
          this.makeMove(idx);
      }
  },
  
  checkWinner: function(bd) {
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for(let i=0; i<wins.length; i++) {
          const [a,b,c] = wins[i];
          if(bd[a] && bd[a]===bd[b] && bd[a]===bd[c]) return { winner: bd[a], line: wins[i] };
      }
      return { winner: null };
  },
  
  handleGameOver: function(data) {
      stopTurnTimer();
      const statusEl = document.getElementById('status');
      const cells = document.querySelectorAll('.cell');
      
      if(data.winner === 'Draw') {
          statusEl.textContent = "It's a Draw!";
      } else {
          const winnerName = data.winner === 'X' ? data.creator.name : data.joiner.name;
          statusEl.textContent = `${winnerName} Wins!`;
          if(data.winLine) {
              data.winLine.forEach(i => cells[i].classList.add('win'));
          }
          
          // Update Leaderboard only once (Creator handles it to avoid double writes)
          if(this.mySymbol === 'X' && !data.statsUpdated) {
              const winnerUid = data.winner === 'X' ? data.creator.uid : data.joiner.uid;
              this.updateLeaderboard(winnerUid);
              this.roomRef.update({ statsUpdated: true });
              
              // Save History
              this.saveOnlineHistory(data);
          }
      }
      
      // Show Popup
      this.showEndPopup(data);
  },
  
  saveOnlineHistory: function(data) {
      // This saves to localStorage of the browser running this function
      // But we want both players to save history.
      // So actually both should call saveHistory locally.
      // Let's do it in showEndPopup or separate local call.
      // We'll use the shared saveHistory logic but adapted.
      
      // Actually, let's just call a local helper.
      const winnerName = data.winner === 'Draw' ? 'Draw' : (data.winner==='X'?data.creator.name:data.joiner.name);
      const entry = {
          mode: 'online',
          winner: winnerName,
          p1: data.creator.name,
          p2: data.joiner.name,
          date: new Date().toLocaleString(),
          timestamp: Date.now()
      };
      
      let history = JSON.parse(localStorage.getItem('ttt_history')||'[]');
      history.unshift(entry);
      if(history.length>20) history.pop();
      localStorage.setItem('ttt_history', JSON.stringify(history));
  },
  
  showEndPopup: function(data) {
      // Create or show popup
      let popup = document.getElementById('endPopup');
      if(!popup) {
          popup = document.createElement('div');
          popup.id = 'endPopup';
          popup.className = 'modal';
          popup.style.display = 'flex';
          popup.innerHTML = `
            <div class="modal-content fade-pop">
                <h2 id="popupTitle">Game Over</h2>
                <p id="popupMessage"></p>
                <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                    <button id="popupPlayAgain">Play Again</button>
                    <button class="secondary" onclick="window.location.href='online.html'">Exit</button>
                </div>
                <div id="popupTimer" style="margin-top:10px; font-size:0.9rem; opacity:0.7;"></div>
            </div>
          `;
          document.body.appendChild(popup);
          document.getElementById('popupPlayAgain').addEventListener('click', () => this.votePlayAgain());
      }
      
      popup.style.display = 'flex';
      const winnerName = data.winner === 'Draw' ? 'Draw' : (data.winner==='X'?data.creator.name:data.joiner.name);
      document.getElementById('popupTitle').textContent = data.winner === 'Draw' ? 'Draw!' : 'Winner!';
      document.getElementById('popupMessage').textContent = data.winner === 'Draw' ? 'No one won.' : `${winnerName} won the match!`;
      
      // Auto exit timer
      let timeLeft = 10;
      const timerEl = document.getElementById('popupTimer');
      const interval = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Auto exit in ${timeLeft}s`;
          if(timeLeft<=0) {
              clearInterval(interval);
              window.location.href = 'online.html';
          }
      }, 1000);
      popup._timer = interval;
      
      // Save history locally for the joiner too (since creator saved it in handleGameOver)
      // Wait, handleGameOver runs for BOTH.
      // But I put the saveOnlineHistory inside `if(this.mySymbol === 'X' && !data.statsUpdated)`
      // So only Creator saves it? No, that was for Leaderboard.
      // I should move saveOnlineHistory OUTSIDE that block so both save it.
      
      this.saveOnlineHistory(data);
  },
  
  votePlayAgain: function() {
      const btn = document.getElementById('popupPlayAgain');
      if(btn) btn.textContent = 'Waiting...';
      this.roomRef.child('rematch').child(this.mySymbol).set(true);
  },
  
  resetGame: function() {
      // Reset room data
      if(this.mySymbol === 'X') { // Only creator resets to avoid race
          this.roomRef.update({
              board: Array(9).fill(''),
              turn: 'X',
              gameOver: false,
              winner: null,
              winLine: null,
              rematch: null,
              statsUpdated: null
          });
      }
      
      // Reset UI
      const popup = document.getElementById('endPopup');
      if(popup) {
          popup.style.display = 'none';
          clearInterval(popup._timer);
          document.getElementById('popupPlayAgain').textContent = 'Play Again';
      }
      const cells = document.querySelectorAll('.cell');
      cells.forEach(c => {
          c.classList.remove('win');
          c.classList.remove('disabled');
          c.textContent = '';
      });
  }
};

// Bind buttons
document.addEventListener('DOMContentLoaded', () => {
    if(online.init()) {
        const randomBtn = document.getElementById('randomMatchBtn');
        if(randomBtn) randomBtn.addEventListener('click', () => online.findMatch());
        
        const createBtn = document.getElementById('createBtn');
        if(createBtn) createBtn.addEventListener('click', () => online.createPrivateRoom());
        
        const joinBtn = document.getElementById('joinBtn');
        if(joinBtn) joinBtn.addEventListener('click', () => online.joinPrivateRoom());
    }
    
    // Auto init if on game page
    if(window.location.pathname.includes('online-game.html')) {
        online.initGame();
    }
});
