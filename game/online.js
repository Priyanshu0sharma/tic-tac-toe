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
    let name = localStorage.getItem('playerName');
    
    // 2. DEVICE-BASED USERNAME ID
    if (!name) {
        const randomId = Math.floor(10000 + Math.random() * 90000);
        name = `guest${randomId}`;
        localStorage.setItem('playerName', name);
    }
    
    let uid = localStorage.getItem('playerUid');
    if (!uid) {
      uid = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('playerUid', uid);
    }
    this.user = { name, uid };
    
    // Update input if exists
    if(nameInput) {
        if(!nameInput.value) nameInput.value = name;
        nameInput.addEventListener('change', () => {
            this.user.name = nameInput.value;
            localStorage.setItem('playerName', this.user.name);
        });
    }
  },

  // --- Matchmaking (Fixed) ---
  
  findMatch: async function() {
    if(!this.user.name) { showFloatingMessage('Please enter your name', 'error'); return; }
    
    this.showFindingPopup();
    
    // Delay for UI effect
    const delay = 2000 + Math.random() * 2000;
    const startTime = Date.now();
    
    // Generate Room ID upfront
    const myRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const queueRef = this.db.ref('queue/waitingPlayer');
    
    // 3. RANDOM ONLINE MATCH - Not Connecting Issue Fix
    // Use 'matched' state in queue to sync players
    const result = await queueRef.transaction(current => {
      if (current === null) {
        // Queue empty: I wait
        return { uid: this.user.uid, name: this.user.name, state: 'waiting', timestamp: Date.now() };
      } else if (current.state === 'waiting' && current.uid !== this.user.uid) {
        // Someone waiting: I match with them
        return { ...current, state: 'matched', matcher: { uid: this.user.uid, name: this.user.name }, roomId: myRoomId };
      }
      return; // Abort
    });

    if (result.committed) {
      const val = result.snapshot.val();
      
      // Wait for delay before proceeding
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, delay - elapsed);
      
      setTimeout(() => {
          if (val.uid === this.user.uid && val.state === 'waiting') {
            // I am waiting
            this.listenForMatch();
          } else if (val.state === 'matched' && val.matcher.uid === this.user.uid) {
            // I matched! (I am B)
            const opponent = { name: val.name, uid: val.uid };
            this.createRoom(opponent, myRoomId);
          }
      }, remaining);
    } else {
      setTimeout(() => this.findMatch(), 500);
    }
  },

  listenForMatch: function() {
    const queueRef = this.db.ref('queue/waitingPlayer');
    
    // Listen to queue node for 'matched' state
    const listener = queueRef.on('value', snap => {
      const val = snap.val();
      if (val && val.uid === this.user.uid && val.state === 'matched') {
        // I was matched!
        queueRef.off('value', listener);
        queueRef.remove(); // Clear queue
        this.cancelSearch(true); // Hide popup only
        this.joinGame(val.roomId, 'O'); // Waiter is O
      } else if (val === null) {
          // Queue cleared (maybe I disconnected or manual cancel)
          // If I didn't cancel, this is weird.
      }
    });
    
    // Timeout 20s
    setTimeout(() => {
        queueRef.once('value', snap => {
            if(snap.val() && snap.val().uid === this.user.uid && snap.val().state === 'waiting') {
                queueRef.remove();
                this.cancelSearch();
                showFloatingMessage('No players found. Try again.', 'error');
            }
        });
    }, 20000);
  },

  createRoom: async function(opponent, predefinedRoomId) {
    const roomId = predefinedRoomId || Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = this.db.ref('rooms/' + roomId);
    
    await roomRef.set({
      board: Array(9).fill(''),
      turn: 'X',
      lastStarter: 'X', // Track starter for swap
      gameOver: false,
      creator: { name: this.user.name, uid: this.user.uid },
      joiner: { name: opponent.name, uid: opponent.uid },
      lastMove: Date.now()
    });
    
    // If not random match (predefined), notify via user node (legacy/private support)
    if (!predefinedRoomId) {
        await this.db.ref('users/' + opponent.uid + '/match').set(roomId);
    }
    
    this.cancelSearch(true);
    this.joinGame(roomId, 'X');
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
          document.getElementById('cancelSearchBtn').addEventListener('click', () => this.cancelSearch());
      }
      popup.style.display = 'flex';
  },
  
  cancelSearch: function(hideOnly = false) {
      const popup = document.getElementById('findingPopup');
      if(popup) popup.style.display = 'none';
      
      if (!hideOnly) {
          const queueRef = this.db.ref('queue/waitingPlayer');
          queueRef.transaction(current => {
              if(current && current.uid === this.user.uid) return null;
              return current;
          });
          showFloatingMessage('Search cancelled', 'info');
      }
  },

  // --- Private Rooms ---
  createPrivateRoom: async function() {
    if(!this.user.name) { showFloatingMessage('Enter name first', 'error'); return; }
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = this.db.ref('rooms/' + roomId);
    
    await roomRef.set({
      board: Array(9).fill(''),
      turn: 'X',
      lastStarter: 'X',
      gameOver: false,
      creator: { name: this.user.name, uid: this.user.uid },
      joiner: null,
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
    if(!this.init()) return;
    
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
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    if(roomIdDisplay) roomIdDisplay.textContent = 'Room: ' + this.roomId;
    
    cells.forEach(c => c.addEventListener('click', (e) => {
        const idx = e.target.dataset.index;
        this.makeMove(idx);
    }));
    
    // Sync
    this.roomRef.on('value', snap => {
        const data = snap.val();
        if(!data) return;
        
        if(!data.joiner && this.mySymbol === 'X') {
             statusEl.textContent = "Waiting for opponent to join...";
             return;
        }
        
        this.renderBoard(data.board);
        this.updateStatus(data);
        
        if(data.gameOver) {
            this.handleGameOver(data);
        } else {
            // Clear popup if game restarted
            const popup = document.getElementById('endPopup');
            if(popup) popup.style.display = 'none';
            
            if(data.turn === this.mySymbol) {
                startTurnTimer(15, () => this.autoMove(data.board));
            } else {
                stopTurnTimer();
            }
        }
        
        // Play Again Sync
        if(data.rematch && data.rematch.X && data.rematch.O) {
            this.resetGame(data);
        }
    });
    
    this.roomRef.onDisconnect().remove();
  },
  
  renderBoard: function(board) {
      const cells = document.querySelectorAll('.cell');
      board = board || Array(9).fill('');
      cells.forEach((c, i) => {
          c.textContent = board[i];
          c.className = 'cell';
          if(board[i]) c.classList.add('disabled');
      });
  },
  
  updateStatus: function(data) {
      const statusEl = document.getElementById('status');
      if(data.gameOver) return;
      
      if(!data.joiner) { statusEl.textContent = "Waiting for opponent..."; return; }
      
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
          if(!room.joiner) return;
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
          
          if(this.mySymbol === 'X' && !data.statsUpdated) {
              const winnerUid = data.winner === 'X' ? data.creator.uid : data.joiner.uid;
              this.updateLeaderboard(winnerUid);
              this.roomRef.update({ statsUpdated: true });
              this.saveOnlineHistory(data);
          }
      }
      
      this.showEndPopup(data);
  },
  
  saveOnlineHistory: function(data) {
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
            </div>
          `;
          document.body.appendChild(popup);
          document.getElementById('popupPlayAgain').addEventListener('click', () => this.votePlayAgain());
      }
      
      popup.style.display = 'flex';
      const winnerName = data.winner === 'Draw' ? 'Draw' : (data.winner==='X'?data.creator.name:data.joiner.name);
      document.getElementById('popupTitle').textContent = data.winner === 'Draw' ? 'Draw!' : 'Winner!';
      document.getElementById('popupMessage').textContent = data.winner === 'Draw' ? 'No one won.' : `${winnerName} won the match!`;
      
      // 1. ONLINE MODE - Play Again Issue (Removed Timer)
      document.getElementById('popupPlayAgain').textContent = 'Play Again';
  },
  
  votePlayAgain: function() {
      const btn = document.getElementById('popupPlayAgain');
      if(btn) btn.textContent = 'Waiting...';
      this.roomRef.child('rematch').child(this.mySymbol).set(true);
  },
  
  resetGame: function(data) {
      // 1. ONLINE MODE - Play Again Issue (Turn Swap)
      if(this.mySymbol === 'X') {
          const nextStarter = (data.lastStarter === 'X') ? 'O' : 'X';
          this.roomRef.update({
              board: Array(9).fill(''),
              turn: nextStarter,
              lastStarter: nextStarter,
              gameOver: false,
              winner: null,
              winLine: null,
              rematch: null,
              statsUpdated: null
          });
      }
      
      // UI Reset
      const popup = document.getElementById('endPopup');
      if(popup) popup.style.display = 'none';
      
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
