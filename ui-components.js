// UI Components for Tic Tac Toe

// ---------- Floating Message ----------
function showFloatingMessage(text, type='info') {
  let el = document.getElementById('gameMessage');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gameMessage';
    el.style.position = 'fixed';
    el.style.top = '10%';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.padding = '14px 22px';
    el.style.borderRadius = '12px';
    el.style.fontSize = '1.15rem';
    el.style.zIndex = '9999';
    el.style.opacity = '0';
    el.style.transition = 'transform .35s ease, opacity .35s ease';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.className = type;
  
  // Theme colors are handled by CSS usually, but here we force some defaults if not styled
  if(type==='win') { el.style.background='var(--success-color, #2ecc71)'; el.style.color='#fff'; }
  else if(type==='lose'){ el.style.background='var(--accent-color, #ff7979)'; el.style.color='#fff'; }
  else{ el.style.background='var(--card-bg, #333)'; el.style.color='var(--text-color, #fff)'; }

  el.style.opacity='1';
  el.style.transform='translateX(-50%) translateY(0)';
  
  clearTimeout(el._hideTO);
  el._hideTO = setTimeout(()=>{
    el.style.opacity='0';
    el.style.transform='translateX(-50%) translateY(-10px)';
  }, 3500);
}

// ---------- Timer UI ----------
let turnTimer = null;
function startTurnTimer(seconds, callback) {
  const display = document.getElementById('timerDisplay');
  if(!display) return;
  
  let timeLeft = seconds;
  display.textContent = `⏱ ${timeLeft}s`;
  display.style.display = 'block';
  
  clearInterval(turnTimer);
  turnTimer = setInterval(()=>{
    timeLeft--;
    display.textContent = `⏱ ${timeLeft}s`;
    if(timeLeft<=0){
      clearInterval(turnTimer);
      display.textContent = 'Time Up!';
      if(callback) callback();
    }
  },1000);
}

function stopTurnTimer() {
  clearInterval(turnTimer);
  const display = document.getElementById('timerDisplay');
  if(display) display.style.display = 'none';
}

// ---------- Theme System ----------
const themes = ['light', 'dark', 'neon', 'retro'];

function applyTheme(themeName) {
  if (!themes.includes(themeName)) themeName = 'light';
  
  // Set attribute on body
  if (themeName === 'light') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', themeName);
  }
  
  // Update selector if exists
  const select = document.getElementById('themeSelect');
  if (select) select.value = themeName;
  
  // Save
  localStorage.setItem('ttt_theme', themeName);
}

function initThemeSystem() {
  // Load saved
  const saved = localStorage.getItem('ttt_theme') || 'light';
  applyTheme(saved);
  
  // Listener for Dropdown
  const select = document.getElementById('themeSelect');
  if (select) {
    select.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }
}

// ---------- History UI ----------
function renderHistoryList(containerId, limit = 20) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const history = JSON.parse(localStorage.getItem('ttt_history') || '[]');
  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = '<div class="history-item" style="justify-content:center; opacity:0.7;">No matches played yet</div>';
    return;
  }
  
  history.slice(0, limit).forEach(h => {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    let icon = '👥';
    if(h.mode === 'robot') icon = '🤖';
    if(h.mode === 'online') icon = '🌐';
    
    let resultClass = '';
    if(h.winner === 'Draw') resultClass = 'draw';
    else if(h.winner === h.p1 || h.winner === 'You') resultClass = 'win';
    
    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:1.2rem;">${icon}</span>
        <div>
          <div style="font-weight:bold;">${h.mode.toUpperCase()}</div>
          <div style="font-size:0.8rem; opacity:0.7;">${h.date}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:bold; color: ${h.winner==='Draw'?'var(--secondary-color)':'var(--success-color)'}">
          ${h.winner === 'Draw' ? 'DRAW' : '🏆 ' + h.winner}
        </div>
        <div style="font-size:0.8rem;">${h.p1} vs ${h.p2}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

// Auto-init Theme
document.addEventListener('DOMContentLoaded', initThemeSystem);
