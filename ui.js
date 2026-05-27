/* ----------------------------------------------------
   NEON STRIKER - UI Layer
   Leaderboard rendering + persistence, Hangar shop UI,
   and the load-time DOM event wiring for menu, settings,
   shop, pause, game-over, and cheat-code consoles.
   ---------------------------------------------------- */

/* ----------------------------------------------------
   LEADERBOARD STORAGE HANDLERS
   ---------------------------------------------------- */
function getLeaderboard() {
  let board = localStorage.getItem('neon_striker_high_scores');
  if (!board) {
    board = [
      { name: 'CPU', score: 85000 },
      { name: 'DM2', score: 62000 },
      { name: 'RET', score: 48000 },
      { name: 'ADA', score: 35000 },
      { name: 'SYN', score: 20000 }
    ];
    localStorage.setItem('neon_striker_high_scores', JSON.stringify(board));
  } else {
    board = JSON.parse(board);
  }
  return board.sort((a, b) => b.score - a.score);
}

function saveHighScore(name, scoreVal) {
  let taggedName = name;
  if (selectedDifficulty === 'elite') {
    taggedName = `[ELITE] ${name}`;
  } else if (selectedDifficulty === 'cadet') {
    taggedName = `[CADET] ${name}`;
  }

  // Always save locally first as double-redundancy safety net
  const board = getLeaderboard();
  board.push({ name: taggedName.toUpperCase().slice(0, 18), score: scoreVal });
  const sorted = board.sort((a, b) => b.score - a.score).slice(0, 8);
  localStorage.setItem('neon_striker_high_scores', JSON.stringify(sorted));

  // If Firebase database is active, push the score to Firestore globally!
  if (window.firebaseEnabled) {
    window.saveGlobalHighScore(taggedName, scoreVal);
  }
}

function checkNewHighScore(scoreVal) {
  const board = getLeaderboard();
  if (board.length < 8) return true;
  return scoreVal > board[board.length - 1].score;
}

async function updateLeaderboardUI() {
  const body = document.getElementById('leaderboard-body');
  body.innerHTML = '';
  
  // If Firebase is enabled, attempt to load global scores
  if (window.firebaseEnabled) {
    body.innerHTML = `
      <tr>
        <td colspan="3" class="text-center font-mono neon-blue blinking-text" style="padding: 2.5rem 0;">
          🌐 SYNCING SECTOR ARCHIVES...
        </td>
      </tr>
    `;
    
    try {
      const globalScores = await window.getGlobalHighScores();
      if (globalScores && globalScores.length > 0) {
        body.innerHTML = '';
        globalScores.forEach((record, index) => {
          const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
          body.innerHTML += `
            <tr>
              <td class="${rankClass}">#${index + 1}</td>
              <td class="${rankClass}">🌐 ${record.name}</td>
              <td class="text-right ${rankClass}">${parseInt(record.score).toLocaleString()}</td>
            </tr>
          `;
        });
        return; // Success! We successfully rendered global scores.
      }
    } catch (e) {
      console.warn("Failed to load Firebase scores, falling back to browser archives:", e);
    }
  }
  
  // Local Backup Fallback
  const board = getLeaderboard();
  body.innerHTML = '';
  board.forEach((record, index) => {
    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
    body.innerHTML += `
      <tr>
        <td class="${rankClass}">#${index + 1}</td>
        <td class="${rankClass}">${record.name}</td>
        <td class="text-right ${rankClass}">${record.score.toLocaleString()}</td>
      </tr>
    `;
  });
}

/* ----------------------------------------------------
   HANGAR UPGRADE SHOP UI
   ---------------------------------------------------- */
function openUpgradeHangar() {
  inShop = true;
  document.getElementById('hud').classList.add('hidden');
  
  // Update shop text variables
  document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
  updateHangarUI();
  
  document.getElementById('shop-menu').classList.remove('hidden');
}

function updateHangarUI() {
  // Update speed stats
  const speedLvl = playerUpgrades.speed;
  const speedCost = upgradeCosts.speed[speedLvl - 1] || 'MAX';
  document.getElementById('lvl-speed').innerText = `LVL ${speedLvl}`;
  document.getElementById('price-speed').innerText = speedLvl >= 5 ? 'MAXED' : `⚙️ ${speedCost}`;
  document.getElementById('btn-buy-speed').disabled = speedLvl >= 5 || scrapCredits < speedCost;

  // Update shield stats
  const shieldLvl = playerUpgrades.shield;
  const shieldCost = upgradeCosts.shield[shieldLvl - 1] || 'MAX';
  document.getElementById('lvl-shield').innerText = `LVL ${shieldLvl}`;
  document.getElementById('price-shield').innerText = shieldLvl >= 5 ? 'MAXED' : `⚙️ ${shieldCost}`;
  document.getElementById('btn-buy-shield').disabled = shieldLvl >= 5 || scrapCredits < shieldCost;

  // Update cooldown stats
  const cooldownLvl = playerUpgrades.cooldown;
  const cooldownCost = upgradeCosts.cooldown[cooldownLvl - 1] || 'MAX';
  document.getElementById('lvl-cooldown').innerText = `LVL ${cooldownLvl}`;
  document.getElementById('price-cooldown').innerText = cooldownLvl >= 5 ? 'MAXED' : `⚙️ ${cooldownCost}`;
  document.getElementById('btn-buy-cooldown').disabled = cooldownLvl >= 5 || scrapCredits < cooldownCost;

  // Update Homing Launcher stats
  const homingCost = upgradeCosts.homing;
  const unlocked = playerUpgrades.homing > 0;
  document.getElementById('lvl-homing').innerText = unlocked ? 'UNLOCKED' : 'LOCKED';
  document.getElementById('price-homing').innerText = unlocked ? 'MAXED' : `⚙️ ${homingCost}`;
  document.getElementById('btn-buy-homing').disabled = unlocked || scrapCredits < homingCost;

  // Update Wingman stats
  const wingmanCost = upgradeCosts.wingman;
  const wingmanUnlocked = playerUpgrades.wingman > 0;
  document.getElementById('lvl-wingman').innerText = wingmanUnlocked ? 'UNLOCKED' : 'LOCKED';
  document.getElementById('price-wingman').innerText = wingmanUnlocked ? 'MAXED' : `⚙️ ${wingmanCost}`;
  document.getElementById('btn-buy-wingman').disabled = wingmanUnlocked || scrapCredits < wingmanCost;

  // Update EMP stats
  const empCost = upgradeCosts.emp;
  const empUnlocked = playerUpgrades.emp > 0;
  document.getElementById('lvl-emp').innerText = empUnlocked ? 'UNLOCKED' : 'LOCKED';
  document.getElementById('price-emp').innerText = empUnlocked ? 'MAXED' : `⚙️ ${empCost}`;
  document.getElementById('btn-buy-emp').disabled = empUnlocked || scrapCredits < empCost;

  // Update Magnet stats
  const magnetCost = upgradeCosts.magnet;
  const magnetUnlocked = playerUpgrades.magnet > 0;
  document.getElementById('lvl-magnet').innerText = magnetUnlocked ? 'UNLOCKED' : 'LOCKED';
  document.getElementById('price-magnet').innerText = magnetUnlocked ? 'MAXED' : `⚙️ ${magnetCost}`;
  document.getElementById('btn-buy-magnet').disabled = magnetUnlocked || scrapCredits < magnetCost;
}

function exitHangarAndLaunch() {
  document.getElementById('shop-menu').classList.add('hidden');
  inShop = false;
  
  // Sector Level advance!
  currentLevel++;
  if (currentLevel > 20) {
    // Campaign victory loop reset harder
    currentLevel = 1;
  }
  
  loadAndStartLevel();
}

/* ----------------------------------------------------
   WINDOW EVENT WIRINGS (DOM bootstrap)
   ---------------------------------------------------- */
// Window Event Listeners Wires
window.addEventListener('load', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  canvas.width = CONFIG.width;
  canvas.height = CONFIG.height;

  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    keys[e.code] = true;

    if (e.code === 'KeyP') {
      togglePause();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  // UI Button listener hooks
  document.getElementById('btn-start').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
  });

  document.getElementById('btn-settings-back').addEventListener('click', () => {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  document.getElementById('btn-scores').addEventListener('click', () => {
    updateLeaderboardUI();
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
  });

  document.getElementById('btn-scores-back').addEventListener('click', () => {
    document.getElementById('leaderboard-menu').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-continue').addEventListener('click', () => {
    continueGame();
  });

  document.getElementById('btn-main-menu').addEventListener('click', () => {
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  document.getElementById('hud-pause-btn').addEventListener('click', () => {
    togglePause();
  });

  document.getElementById('btn-pause-resume').addEventListener('click', () => {
    togglePause();
  });

  document.getElementById('btn-pause-abort').addEventListener('click', () => {
    gameActive = false;
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  // High score submit
  document.getElementById('btn-submit-score').addEventListener('click', () => {
    const input = document.getElementById('pilot-name');
    const name = input.value.trim() || 'ACE';
    saveHighScore(name, score);
    if (window.logAnalyticsEvent) {
      window.logAnalyticsEvent('submit_score', { pilot: name, score: score });
    }
    document.getElementById('high-score-input-container').classList.add('hidden');
    
    document.getElementById('game-over-screen').classList.add('hidden');
    updateLeaderboardUI();
    document.getElementById('leaderboard-menu').classList.remove('hidden');
  });

  document.getElementById('pilot-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('btn-submit-score').click();
    }
  });

  // Hangar shop upgrade click buttons triggers
  document.getElementById('btn-buy-speed').addEventListener('click', () => {
    const lvl = playerUpgrades.speed;
    const cost = upgradeCosts.speed[lvl - 1];
    if (scrapCredits >= cost && lvl < 5) {
      scrapCredits -= cost;
      playerUpgrades.speed++;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'speed', level: playerUpgrades.speed });
      }
      
      // Permanently adjust ship properties
      CONFIG.playerSpeed = CONFIG.playerSpeedBase * (1.0 + playerUpgrades.speed * 0.15);
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-shield').addEventListener('click', () => {
    const lvl = playerUpgrades.shield;
    const cost = upgradeCosts.shield[lvl - 1];
    if (scrapCredits >= cost && lvl < 5) {
      scrapCredits -= cost;
      playerUpgrades.shield++;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'shield', level: playerUpgrades.shield });
      }
      
      // Permanently adjust ship shielding pools
      maxHealth = 100 + (playerUpgrades.shield - 1) * 20;
      health = maxHealth; // Heal completely
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-cooldown').addEventListener('click', () => {
    const lvl = playerUpgrades.cooldown;
    const cost = upgradeCosts.cooldown[lvl - 1];
    if (scrapCredits >= cost && lvl < 5) {
      scrapCredits -= cost;
      playerUpgrades.cooldown++;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'cooldown', level: playerUpgrades.cooldown });
      }
      
      // Permanently reduce fire CD
      CONFIG.laserCooldown = CONFIG.laserCooldownBase * (1.0 - (playerUpgrades.cooldown - 1) * 0.12);
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-homing').addEventListener('click', () => {
    const cost = upgradeCosts.homing;
    if (scrapCredits >= cost && playerUpgrades.homing === 0) {
      scrapCredits -= cost;
      playerUpgrades.homing = 1;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'homing', level: playerUpgrades.homing });
      }
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-wingman').addEventListener('click', () => {
    const cost = upgradeCosts.wingman;
    if (scrapCredits >= cost && playerUpgrades.wingman === 0) {
      scrapCredits -= cost;
      playerUpgrades.wingman = 1;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'wingman', level: playerUpgrades.wingman });
      }
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-emp').addEventListener('click', () => {
    const cost = upgradeCosts.emp;
    if (scrapCredits >= cost && playerUpgrades.emp === 0) {
      scrapCredits -= cost;
      playerUpgrades.emp = 1;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'emp', level: playerUpgrades.emp });
      }
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  document.getElementById('btn-buy-magnet').addEventListener('click', () => {
    const cost = upgradeCosts.magnet;
    if (scrapCredits >= cost && playerUpgrades.magnet === 0) {
      scrapCredits -= cost;
      playerUpgrades.magnet = 1;
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('purchase_upgrade', { type: 'magnet', level: playerUpgrades.magnet });
      }
      
      GameAudio.playPowerUpSound();
      updateHangarUI();
      document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;
    }
  });

  // Hangar launch launch
  document.getElementById('btn-shop-launch').addEventListener('click', () => {
    exitHangarAndLaunch();
  });

  // Settings inputs
  const sliderMusic = document.getElementById('slider-music');
  const sliderSfx = document.getElementById('slider-sfx');
  const toggleShake = document.getElementById('toggle-shake');
  const toggleScanlines = document.getElementById('toggle-scanlines');

  sliderMusic.addEventListener('input', e => {
    const val = e.target.value;
    document.getElementById('music-vol-val').innerText = `${val}%`;
    GameAudio.setMusicVolume(val);
  });

  sliderSfx.addEventListener('input', e => {
    const val = e.target.value;
    document.getElementById('sfx-vol-val').innerText = `${val}%`;
    GameAudio.setSfxVolume(val);
  });

  toggleShake.addEventListener('change', e => {
    CONFIG.shakeEnabled = e.target.checked;
  });

  toggleScanlines.addEventListener('change', e => {
    const lines = document.querySelector('.scanlines');
    if (e.target.checked) {
      lines.classList.remove('scanlines-disabled');
    } else {
      lines.classList.add('scanlines-disabled');
    }
  });

  const toggleBezel = document.getElementById('toggle-bezel');
  if (toggleBezel) {
    toggleBezel.addEventListener('change', e => {
      const container = document.getElementById('game-container');
      if (e.target.checked) {
        container.classList.add('crt-bezel-active');
      } else {
        container.classList.remove('crt-bezel-active');
      }
    });
    
    // Set initial state
    const container = document.getElementById('game-container');
    if (toggleBezel.checked) {
      container.classList.add('crt-bezel-active');
    } else {
      container.classList.remove('crt-bezel-active');
    }
  }

  // --- All-Ages Expansion UI Listeners ---

  // 1. Difficulty Selector setup
  const diffBtns = document.querySelectorAll('.diff-btn');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      diffBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedDifficulty = e.target.getAttribute('data-diff');
      
      GameAudio.playPowerUpSound();
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('select_difficulty', { difficulty: selectedDifficulty });
      }
    });
  });

  // 2. Skin / Paint Selector setup
  const paintBtns = document.querySelectorAll('.paint-btn');
  paintBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      paintBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedSkin = e.target.getAttribute('data-skin');
      
      GameAudio.playPowerUpSound();
      
      if (window.logAnalyticsEvent) {
        window.logAnalyticsEvent('select_skin', { skin: selectedSkin });
      }
    });
  });

  // 3. Cheat Code Console Wires
  const btnSubmitCheat = document.getElementById('btn-submit-cheat');
  const cheatInput = document.getElementById('cheat-input');
  const cheatMsg = document.getElementById('cheat-msg');
  
  function applyCheat() {
    const code = cheatInput.value.trim().toLowerCase();
    if (!code) return;
    
    if (code === 'saucer') {
      selectedSkin = 'saucer';
      paintBtns.forEach(b => b.classList.remove('active'));
      cheatMsg.style.color = 'var(--neon-cyan)';
      cheatMsg.innerText = 'CODENAME: UFO SAUCER ACTIVATED!';
      GameAudio.playPowerUpSound();
    } else if (code === 'rainbow') {
      cheatRainbow = true;
      cheatMsg.style.color = 'var(--neon-cyan)';
      cheatMsg.innerText = 'CODENAME: RAINBOW WEAPONS ACTIVE!';
      GameAudio.playPowerUpSound();
    } else if (code === 'god') {
      cheatGod = true;
      cheatMsg.style.color = 'var(--neon-cyan)';
      cheatMsg.innerText = 'CODENAME: NEON GOD SHIELD ONLINE!';
      GameAudio.playPowerUpSound();
    } else if (code === 'matrix') {
      cheatMatrix = true;
      cheatMsg.style.color = 'var(--neon-cyan)';
      cheatMsg.innerText = 'CODENAME: SYSTEM CODE OVERRIDE!';
      GameAudio.playPowerUpSound();
    } else {
      cheatMsg.style.color = 'var(--neon-red)';
      cheatMsg.innerText = 'ERROR: INVALID ACCESS CODE';
      GameAudio.playExplosionSound(0.5);
    }
    cheatInput.value = '';
  }
  
  if (btnSubmitCheat && cheatInput) {
    btnSubmitCheat.addEventListener('click', () => {
      applyCheat();
    });
    cheatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        applyCheat();
      }
    });
  }

  requestAnimationFrame(gameTick);
});
