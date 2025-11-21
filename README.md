# Advanced Tic-Tac-Toe 🎮

A feature-rich, modern Tic-Tac-Toe web application supporting Local, Robot (AI), and Real-time Online Multiplayer modes. Built with vanilla JavaScript and Firebase.

## ✨ Features

### 🕹️ Game Modes

- **Local PvP**: Play against a friend on the same device.
- **Robot (AI)**: Challenge the AI with **Easy** (Random) and **Hard** (Minimax) difficulties.
  - _Note: Robot mode features random starting turns (X or O)._
- **Online Multiplayer**: Real-time gameplay with friends or strangers.

### 🌐 Online Features

- **Random Matchmaking**: "WinZO-style" finding player popup with animations and auto-connect.
- **Private Rooms**: Create or join custom rooms via Room ID.
- **Real-time Sync**: Instant board updates, turn management, and win detection.
- **Leaderboard**: Global leaderboard tracking wins and games played.
- **Smart UI**: 15s turn timer, auto-move on timeout, and "Play Again" voting system.

### 🎨 Customization & System

- **Themes System**: 4 distinct themes switchable instantly:
  - ☀️ **Classic Light**
  - 🌑 **Dark Mode**
  - 💠 **Neon Blue**
  - 👾 **Pixel Retro**
- **Match History**: Tracks the last 20 games across all modes with timestamps and results.
- **Responsive Design**: Fully optimized for Desktop and Mobile.

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (CSS Variables, Flexbox/Grid, Animations), JavaScript (ES6+).
- **Backend**: Firebase Realtime Database (for matchmaking, game state, and leaderboard).
- **Storage**: LocalStorage (for themes, history, and user preferences).

## 📂 Project Structure

```
/
├── index.html          # Main Menu / Landing Page
├── style.css           # Global Styles & Menu Styles
├── script.js           # Main Menu Logic
├── README.md           # Documentation
└── game/               # Game Core Files
    ├── game.js         # Local & Robot Logic
    ├── online.js       # Online Matchmaking & Game Logic
    ├── ui-components.js# Shared UI (Themes, History, Popups)
    ├── firebase-config.js # Firebase Configuration
    ├── game.css        # Game Board & Component Styles
    ├── theme.css       # Theme Definitions (CSS Variables)
    ├── local.html      # Local Game Page
    ├── robot.html      # Robot Game Page
    ├── online.html     # Online Lobby Page
    ├── online-game.html# Online Match Page
    ├── history.html    # Full History Page
    └── leaderboard.html# Leaderboard Page
```

## 🚀 Setup & Installation

1.  **Clone/Download** the repository.
2.  **Firebase Configuration**:
    - Create a project at [Firebase Console](https://console.firebase.google.com/).
    - Enable **Realtime Database**.
    - Copy your web app configuration.
    - Open `game/firebase-config.js` and paste your config object:
      ```javascript
      const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        databaseURL: "YOUR_DB_URL",
        projectId: "YOUR_PROJECT_ID",
        // ...
      };
      ```
3.  **Run**:
    - Simply open `index.html` in any modern web browser.
    - _Optional_: Use a local server (e.g., Live Server in VS Code) for better performance.

## 🔒 Database Rules (Firebase)

For the online mode to work securely, set your Firebase Realtime Database rules to:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

_(Note: For production, you should restrict these rules further based on authentication)._

## 👨‍💻 Author

Developed by **Priyanshuu**.
