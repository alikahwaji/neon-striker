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

// Currently-selected scope; flipped by the tab buttons. 'all' shows the
// global all-time leaderboard, 'daily' shows today's UTC daily challenge.
let leaderboardScope = 'all';

function setLeaderboardScope(scope) {
  leaderboardScope = scope === 'daily' ? 'daily' : 'all';
  document.querySelectorAll('.lb-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-scope') === leaderboardScope);
  });
  updateLeaderboardUI();
}

async function updateLeaderboardUI() {
  const body = document.getElementById('leaderboard-body');
  body.innerHTML = '';

  // Loading shimmer.
  body.innerHTML = `
    <tr>
      <td colspan="3" class="text-center font-mono neon-blue blinking-text" style="padding: 2.5rem 0;">
        ${leaderboardScope === 'daily' ? '🌙 LOADING TODAY\'S RUNS...' : '🌐 SYNCING SECTOR ARCHIVES...'}
      </td>
    </tr>
  `;

  // Daily scope: query the daily Firestore collection filtered by today's
  // UTC date. There's no localStorage fallback for daily because it's an
  // inherently networked competition — fall back to an empty-state message.
  if (leaderboardScope === 'daily') {
    if (!window.firebaseEnabled) {
      body.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'text-center font-mono';
      td.style.padding = '2.5rem 0';
      td.style.color = '#b0aebf';
      td.textContent = 'Daily Challenge requires online connection.';
      tr.append(td);
      body.append(tr);
      return;
    }
    try {
      const dailyScores = await window.getDailyHighScores(todayDateUTC());
      body.innerHTML = '';
      if (dailyScores && dailyScores.length > 0) {
        dailyScores.forEach((record, index) => {
          renderLeaderboardRow(body, index, `🌙 ${record.name}`, parseInt(record.score, 10) || 0);
        });
      } else {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.className = 'text-center font-mono';
        td.style.padding = '2.5rem 0';
        td.style.color = '#b0aebf';
        td.textContent = 'No daily runs yet — be the first pilot today.';
        tr.append(td);
        body.append(tr);
      }
    } catch (e) {
      console.warn('Failed to load daily scores:', e);
    }
    return;
  }

  // All-time scope: existing Firebase + local fallback path.
  if (window.firebaseEnabled) {
    try {
      const globalScores = await window.getGlobalHighScores();
      if (globalScores && globalScores.length > 0) {
        body.innerHTML = '';
        globalScores.forEach((record, index) => {
          // Globe prefix marks scores fetched from the public Firestore.
          // Firestore writes are unauthenticated, so record.name is hostile
          // by default — render every field via textContent, never template
          // interpolation into innerHTML, to neutralise stored XSS payloads.
          renderLeaderboardRow(body, index, `🌐 ${record.name}`, parseInt(record.score, 10) || 0);
        });
        return;
      }
    } catch (e) {
      console.warn("Failed to load Firebase scores, falling back to browser archives:", e);
    }
  }

  // Local Backup Fallback (offline / Firebase disabled).
  const board = getLeaderboard();
  body.innerHTML = '';
  board.forEach((record, index) => {
    renderLeaderboardRow(body, index, record.name, record.score);
  });
}

// Build a single leaderboard row via DOM APIs so untrusted name strings
// (especially from the open Firestore collection) cannot inject markup.
function renderLeaderboardRow(tbody, index, name, score) {
  const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
  const tr = document.createElement('tr');

  const rankTd = document.createElement('td');
  if (rankClass) rankTd.className = rankClass;
  rankTd.textContent = `#${index + 1}`;

  const nameTd = document.createElement('td');
  if (rankClass) nameTd.className = rankClass;
  nameTd.textContent = name;

  const scoreTd = document.createElement('td');
  scoreTd.className = ('text-right ' + rankClass).trim();
  scoreTd.textContent = (Number(score) || 0).toLocaleString();

  tr.append(rankTd, nameTd, scoreTd);
  tbody.appendChild(tr);
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

  // Sector Level advance — past Level 20 we drop into endless mode where
  // generateEndlessLevel(n) in main.js synthesises sector data on demand.
  // No upper cap; the player decides when their run ends.
  currentLevel++;

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

  // Restore prior session's settings before any listeners wire up so the
  // controls' visual state matches the values we just pushed into the game.
  applyPersistedSettings(loadPersistedSettings());

  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    // Don't intercept M / P while the cheat-code input is focused — typing
    // 'matrix' or any code containing those letters would otherwise mute or
    // pause the game underneath the modal.
    const typingInForm = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    // Record a one-shot edge only on the initial press, not on key-repeat,
    // so a held Shift on Matrix levels doesn't auto-trigger EMP every frame.
    if (!keys[e.code]) {
      keysPressed[e.code] = true;
    }
    keys[e.code] = true;

    if (!typingInForm && e.code === 'KeyP') {
      togglePause();
    }
    if (!typingInForm && e.code === 'KeyM' && !e.repeat) {
      const nowMuted = GameAudio.toggleMute();
      document.getElementById('mute-indicator').classList.toggle('hidden', !nowMuted);
    }
    // Konami code detection — must run before the form-input guard so it
    // works on the main menu (no input focused there).
    if (!typingInForm && !e.repeat) {
      checkKonamiSequence(e.code);
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  // UI Button listener hooks
  document.getElementById('btn-start').addEventListener('click', () => {
    // Clean handoff: any prior mode (daily / boss rush) is cleared so the
    // next INITIATE GAME is a vanilla campaign.
    dailyMode = false;
    dailyDate = null;
    deactivateDailySeed();
    bossRushMode = false;
    bossRushIndex = 0;
    startGame();
  });

  document.getElementById('btn-daily').addEventListener('click', () => {
    // Daily Challenge: seed Math.random with today's UTC date so every
    // pilot today faces the same spawn timings, asteroid drops, etc.
    // Difficulty is locked to Hero for fairness.
    dailyMode = true;
    dailyDate = todayDateUTC();
    activateDailySeed(dailyDate);
    selectedDifficulty = 'hero';
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-diff') === 'hero');
    });
    if (window.Achievements) Achievements.notify('daily_started', { date: dailyDate });
    startGame();
  });

  document.getElementById('btn-bossrush').addEventListener('click', () => {
    // Boss Rush: 4 bosses back-to-back, no shop, no continues. Other modes
    // get cleared so this is a pure gauntlet.
    bossRushMode = true;
    bossRushIndex = 0;
    dailyMode = false;
    dailyDate = null;
    deactivateDailySeed();
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
    // Reset to All-Time tab on every panel open so the player starts from
    // the familiar global view.
    setLeaderboardScope('all');
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
  });

  document.getElementById('btn-scores-back').addEventListener('click', () => {
    document.getElementById('leaderboard-menu').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      setLeaderboardScope(e.target.getAttribute('data-scope'));
    });
  });

  document.getElementById('btn-achievements').addEventListener('click', () => {
    renderPilotProfile();
    renderAchievementsUI();
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('achievements-menu').classList.remove('hidden');
  });

  document.getElementById('btn-achievements-back').addEventListener('click', () => {
    document.getElementById('achievements-menu').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  // Subscribe to achievement unlocks once. The Achievements module dispatches
  // every newly-unlocked def to all listeners; we render a transient toast +
  // chime so the player notices mid-game.
  if (window.Achievements) {
    Achievements.on('unlocked', def => showAchievementToast(def));
  }

  document.getElementById('btn-restart').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-continue').addEventListener('click', () => {
    continueGame();
  });

  document.getElementById('btn-share').addEventListener('click', () => {
    const pilotName = (document.getElementById('pilot-name') && document.getElementById('pilot-name').value.trim()) || 'ACE';
    generateShareImage({
      name: pilotName,
      score,
      level: currentLevel,
      mode: bossRushMode ? 'BOSS RUSH' : dailyMode ? 'DAILY' : 'CAMPAIGN',
      difficulty: selectedDifficulty.toUpperCase()
    });
  });

  document.getElementById('btn-main-menu').addEventListener('click', () => {
    // Returning to the main menu always exits any special mode, so the
    // next INITIATE GAME starts a normal campaign with real RNG.
    dailyMode = false;
    dailyDate = null;
    deactivateDailySeed();
    bossRushMode = false;
    bossRushIndex = 0;
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
    // Aborting mid-run also exits daily / boss-rush modes cleanly.
    dailyMode = false;
    dailyDate = null;
    deactivateDailySeed();
    bossRushMode = false;
    bossRushIndex = 0;
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  // High score submit
  document.getElementById('btn-submit-score').addEventListener('click', () => {
    const input = document.getElementById('pilot-name');
    const name = input.value.trim() || 'ACE';
    saveHighScore(name, score);

    // Daily mode: also dual-write to the dated leaderboard collection so
    // the score competes against today's pilots only, and notify the
    // achievement system so 'Daily Pilot' can fire.
    if (dailyMode && dailyDate && window.saveDailyHighScore) {
      window.saveDailyHighScore(name, score, dailyDate);
      if (window.Achievements) Achievements.notify('daily_score_submitted', { date: dailyDate });
    }

    if (window.logAnalyticsEvent) {
      window.logAnalyticsEvent('submit_score', { pilot: name, score: score, daily: !!dailyMode });
    }
    document.getElementById('high-score-input-container').classList.add('hidden');

    document.getElementById('game-over-screen').classList.add('hidden');
    // If the player just submitted a daily score, open the leaderboard on
    // the Today tab so they see their rank immediately.
    setLeaderboardScope(dailyMode ? 'daily' : 'all');
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

      if (window.Achievements) Achievements.notify('upgrade_purchased', { type: 'speed' });
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

      if (window.Achievements) Achievements.notify('upgrade_purchased', { type: 'shield' });
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

      if (window.Achievements) Achievements.notify('upgrade_purchased', { type: 'cooldown' });
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

      if (window.Achievements) Achievements.notify('upgrade_purchased', { type: 'homing' });
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

      if (window.Achievements) Achievements.notify('upgrade_purchased', { type: 'wingman' });
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

      if (window.Achievements) Achievements.notify('upgrade_purchased', { type: 'emp' });
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

      if (window.Achievements) Achievements.notify('upgrade_purchased', { type: 'magnet' });
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
    persistSettings();
  });

  sliderSfx.addEventListener('input', e => {
    const val = e.target.value;
    document.getElementById('sfx-vol-val').innerText = `${val}%`;
    GameAudio.setSfxVolume(val);
    persistSettings();
  });

  toggleShake.addEventListener('change', e => {
    CONFIG.shakeEnabled = e.target.checked;
    persistSettings();
  });

  toggleScanlines.addEventListener('change', e => {
    const lines = document.querySelector('.scanlines');
    if (e.target.checked) {
      lines.classList.remove('scanlines-disabled');
    } else {
      lines.classList.add('scanlines-disabled');
    }
    persistSettings();
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
      persistSettings();
    });

    // Set initial state — only if persistence didn't already apply it.
    // applyPersistedSettings sets both the checkbox and the class; only
    // run this fallback when no settings were restored (toggleBezel.checked
    // reflects the HTML 'checked' attribute on fresh sessions).
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
      persistSettings();

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

      if (window.Achievements) Achievements.notify('skin_selected', { skin: selectedSkin });
      GameAudio.playPowerUpSound();
      persistSettings();

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

    let recognised = true;
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
      recognised = false;
      cheatMsg.style.color = 'var(--neon-red)';
      cheatMsg.innerText = 'ERROR: INVALID ACCESS CODE';
      GameAudio.playExplosionSound(0.5);
    }
    if (recognised) {
      persistSettings();
      if (window.Achievements) Achievements.notify('cheat_entered', { code });
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

/* ----------------------------------------------------
   SHARE SCORE → PNG
   ----------------------------------------------------
   Compose a synthwave-styled score card on an off-screen canvas, then
   trigger a download. No external image assets — everything is drawn
   procedurally to match the in-game CRT aesthetic.
*/
function generateShareImage({ name, score, level, mode, difficulty }) {
  const W = 1200, H = 630; // social-share-friendly 1.9:1 ratio (Twitter/OG)
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  // Background — vertical gradient matching the game's synthwave palette.
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#03010b');
  bg.addColorStop(0.55, '#1a0532');
  bg.addColorStop(1, '#06010f');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // Horizon line + perspective grid floor (the iconic synthwave look).
  const horizonY = Math.floor(H * 0.55);
  // Star field above horizon.
  for (let i = 0; i < 80; i++) {
    c.fillStyle = Math.random() > 0.5 ? '#ff00aa' : '#00f0ff';
    c.globalAlpha = Math.random() * 0.8 + 0.2;
    const sx = Math.random() * W;
    const sy = Math.random() * horizonY;
    c.fillRect(sx, sy, Math.random() * 2 + 1, Math.random() * 2 + 1);
  }
  c.globalAlpha = 1;

  // Magenta horizon line.
  c.fillStyle = '#ff00aa';
  c.shadowColor = '#ff00aa';
  c.shadowBlur = 18;
  c.fillRect(0, horizonY, W, 3);

  // Perspective grid below horizon — converging verticals + scrolling horizontals.
  c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255, 0, 170, 0.35)';
  c.lineWidth = 1.5;
  const cx = W / 2;
  for (let i = -16; i <= 16; i++) {
    c.beginPath();
    c.moveTo(cx + i * 4, horizonY);
    c.lineTo(cx + i * 120, H);
    c.stroke();
  }
  c.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  for (let y = 0; y < 12; y++) {
    const py = Math.pow(y / 12, 2.4) * (H - horizonY) + horizonY;
    c.beginPath();
    c.moveTo(0, py);
    c.lineTo(W, py);
    c.stroke();
  }

  // Brand title — big skewed Orbitron-style block.
  c.save();
  c.translate(W / 2, 110);
  c.transform(1, 0, -0.08, 1, 0, 0); // 5deg skew
  c.font = '900 84px Orbitron, sans-serif';
  c.textAlign = 'center';
  c.fillStyle = '#fff';
  c.shadowColor = '#ff00aa';
  c.shadowBlur = 24;
  c.fillText('NEON STRIKER', 0, 0);
  c.restore();

  // Subtitle bar.
  c.font = '600 22px "Share Tech Mono", monospace';
  c.fillStyle = '#00f0ff';
  c.shadowColor = '#00f0ff';
  c.shadowBlur = 8;
  c.letterSpacing = '6px';
  c.fillText(`${mode} // ${difficulty} PILOT`, W / 2, 160);

  // Pilot codename — central headline.
  c.shadowBlur = 0;
  c.font = '900 56px Orbitron, sans-serif';
  c.fillStyle = '#ffea00';
  c.shadowColor = '#ffea00';
  c.shadowBlur = 18;
  c.fillText(`👨‍🚀 ${name}`, W / 2, 270);

  // Score — the hero number.
  c.shadowBlur = 0;
  c.font = '600 26px "Share Tech Mono", monospace';
  c.fillStyle = '#b0aebf';
  c.fillText('FINAL SCORE', W / 2, 330);

  c.font = '900 110px Orbitron, sans-serif';
  c.fillStyle = '#00f0ff';
  c.shadowColor = '#00f0ff';
  c.shadowBlur = 30;
  // Share image uses comma-grouped number for late-game scores; falls
  // back to 3-digit padding for early-game runs (mirrors formatScore()
  // in main.js so the share card matches the in-game HUD).
  c.fillText(score < 1000 ? String(score).padStart(3, '0') : score.toLocaleString(), W / 2, 440);

  // Sector reached — secondary stat.
  c.shadowBlur = 0;
  c.font = '600 22px "Share Tech Mono", monospace';
  c.fillStyle = '#b0aebf';
  c.fillText(`SECTOR ${level}`, W / 2, 490);

  // Bottom CTA + brand URL.
  c.font = '600 16px "Share Tech Mono", monospace';
  c.fillStyle = 'rgba(255, 255, 255, 0.55)';
  c.fillText('alikahwaji.github.io/neon-striker', W / 2, H - 38);

  // Outer neon-purple frame so the image reads as a 'CRT screenshot'.
  c.shadowBlur = 0;
  c.strokeStyle = 'rgba(139, 0, 255, 0.6)';
  c.lineWidth = 4;
  c.strokeRect(8, 8, W - 16, H - 16);

  // Trigger download — synthesise a temporary anchor with the data URL.
  cv.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = name.replace(/[^A-Z0-9]/gi, '_').slice(0, 12) || 'PILOT';
    a.href = url;
    a.download = `neon-striker-${safeName}-${score}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');

  // Confirmation toast on the existing achievement-toast element so the
  // player knows the download fired.
  const toast = document.getElementById('achievement-toast');
  if (toast) {
    document.getElementById('ach-toast-icon').textContent = '📸';
    document.getElementById('ach-toast-name').textContent = 'SCORE CARD DOWNLOADED';
    toast.classList.remove('hidden');
    if (achToastTimer) clearTimeout(achToastTimer);
    achToastTimer = setTimeout(() => { toast.classList.add('hidden'); achToastTimer = null; }, 2500);
  }
}

/* ----------------------------------------------------
   KONAMI CODE — DEATH BLOSSOM unlock
   ----------------------------------------------------
   ↑↑↓↓←→←→BA, the classic arcade easter egg. Rolling buffer of the
   last 10 keypresses; on match we activate the 8-way DEATH_BLOSSOM
   power-up for 8 seconds and fire an achievement. Works on the main
   menu AND mid-gameplay so players can re-summon it.
*/
const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
const konamiBuffer = [];

function checkKonamiSequence(code) {
  konamiBuffer.push(code);
  if (konamiBuffer.length > KONAMI_SEQUENCE.length) konamiBuffer.shift();
  // Cheap full-array compare — sequence is only 10 entries.
  for (let i = 0; i < KONAMI_SEQUENCE.length; i++) {
    if (konamiBuffer[i] !== KONAMI_SEQUENCE[i]) return;
  }
  triggerDeathBlossom();
  konamiBuffer.length = 0; // reset so the next match starts clean
}

function triggerDeathBlossom() {
  activePowerUps['DEATH_BLOSSOM'] = 8000; // 8 second window
  GameAudio.playLevelClearSound();
  if (player && typeof FloatingText !== 'undefined') {
    floatingTexts.push(new FloatingText(
      player.x + player.width / 2,
      player.y - 25,
      '🌸 DEATH BLOSSOM!',
      '#ff6ad5'
    ));
  }
  // Trigger a quick screen-shake burst for impact.
  if (typeof triggerScreenShake === 'function') triggerScreenShake(0.6);
  if (window.Achievements) Achievements.notify('konami_entered', {});
}

/* ----------------------------------------------------
   PILOT PROFILE — career stats + achievement grid
   ---------------------------------------------------- */
// Build the stat tiles at the top of the panel from the Stats module's
// snapshot. Called from the same panel-open path as renderAchievementsUI
// so both update together.
function renderPilotProfile() {
  if (!window.Stats) return;
  const s = Stats.getSnapshot();
  const host = document.getElementById('pilot-stats-grid');
  if (!host) return;
  while (host.firstChild) host.removeChild(host.firstChild);

  const fav = Stats.getFavouriteSkin();
  const tiles = [
    { label: 'Total Kills', value: s.totalKills.toLocaleString() },
    { label: 'Total Scrap', value: '⚙ ' + s.totalScrap.toLocaleString() },
    { label: 'Runs Started', value: s.runsStarted.toString() },
    { label: 'Campaigns Won', value: s.runsCompleted.toString() },
    { label: 'Deepest Sector', value: s.longestRunLevel.toString() },
    { label: 'Best Combo', value: `×${s.bestCombo}` },
    { label: 'Playtime', value: Stats.formatPlaytime(s.totalPlaytime) },
    { label: 'Favourite Skin', value: fav ? fav.toUpperCase() : '—' }
  ];

  tiles.forEach(t => {
    const tile = document.createElement('div');
    tile.className = 'stat-tile';
    const lbl = document.createElement('span');
    lbl.className = 'stat-label';
    lbl.textContent = t.label;
    const val = document.createElement('span');
    val.className = 'stat-value';
    val.textContent = t.value;
    tile.append(lbl, val);
    host.appendChild(tile);
  });
}

/* ----------------------------------------------------
   ACHIEVEMENTS PANEL + TOAST
   ---------------------------------------------------- */
// Build the achievements grid each time the panel opens so unlock state
// reflects the latest Achievements.notify() calls. Locked cards render
// greyed-out so progress is visible at a glance.
function renderAchievementsUI() {
  if (!window.Achievements) return;
  const defs = Achievements.getDefs();
  const unlocked = Achievements.getUnlocked();
  const host = document.getElementById('achievements-grid');
  while (host.firstChild) host.removeChild(host.firstChild);

  defs.forEach(def => {
    const isUnlocked = unlocked.has(def.id);
    const card = document.createElement('div');
    card.className = 'ach-card ' + (isUnlocked ? 'unlocked' : 'locked');

    const header = document.createElement('div');
    header.className = 'ach-header';
    const icon = document.createElement('span');
    icon.className = 'ach-icon';
    // Locked cards show a question mark so the metadata for unmet
    // achievements is hinted at but not fully spoiled.
    icon.textContent = isUnlocked ? def.icon : '❓';
    const name = document.createElement('span');
    name.className = 'ach-name';
    name.textContent = def.name;
    header.append(icon, name);

    const desc = document.createElement('div');
    desc.className = 'ach-desc';
    desc.textContent = def.description;

    card.append(header, desc);
    host.appendChild(card);
  });

  const progress = document.getElementById('achievements-progress');
  if (progress) progress.textContent = `🏅 ${unlocked.size} / ${defs.length} ACHIEVEMENTS UNLOCKED`;
}

// Per-toast hide timer so consecutive unlocks queue and replace cleanly
// instead of fighting each other for screen time.
let achToastTimer = null;
function showAchievementToast(def) {
  const toast = document.getElementById('achievement-toast');
  if (!toast) return;
  document.getElementById('ach-toast-icon').textContent = def.icon || '🏆';
  document.getElementById('ach-toast-name').textContent = def.name;
  toast.classList.remove('hidden');
  // Subtle audio confirmation — reuse the existing power-up chime to keep
  // the synth palette consistent.
  if (window.GameAudio && typeof GameAudio.playPowerUpSound === 'function') {
    GameAudio.playPowerUpSound();
  }
  if (achToastTimer) clearTimeout(achToastTimer);
  achToastTimer = setTimeout(() => {
    toast.classList.add('hidden');
    achToastTimer = null;
  }, 4000);
}

/* ----------------------------------------------------
   SETTINGS PERSISTENCE
   ---------------------------------------------------- */
// Versioned key so future schema bumps don't crash on stale payloads.
const SETTINGS_KEY = 'neon_striker_settings_v1';

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch (e) {
    console.warn('Failed to load Neon Striker settings:', e);
    return null;
  }
}

function persistSettings() {
  try {
    const s = {
      musicVol: parseInt(document.getElementById('slider-music').value, 10),
      sfxVol: parseInt(document.getElementById('slider-sfx').value, 10),
      shake: document.getElementById('toggle-shake').checked,
      scanlines: document.getElementById('toggle-scanlines').checked,
      bezel: (document.getElementById('toggle-bezel') || {}).checked,
      difficulty: selectedDifficulty,
      skin: selectedSkin,
      cheats: { rainbow: cheatRainbow, god: cheatGod, matrix: cheatMatrix }
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('Failed to persist Neon Striker settings:', e);
  }
}

function applyPersistedSettings(s) {
  if (!s) return;

  // Volume sliders — push to the DOM and the audio engine.
  if (typeof s.musicVol === 'number' && s.musicVol >= 0 && s.musicVol <= 100) {
    document.getElementById('slider-music').value = s.musicVol;
    document.getElementById('music-vol-val').innerText = `${s.musicVol}%`;
    GameAudio.setMusicVolume(s.musicVol);
  }
  if (typeof s.sfxVol === 'number' && s.sfxVol >= 0 && s.sfxVol <= 100) {
    document.getElementById('slider-sfx').value = s.sfxVol;
    document.getElementById('sfx-vol-val').innerText = `${s.sfxVol}%`;
    GameAudio.setSfxVolume(s.sfxVol);
  }

  // Toggles — checkbox state + side-effect on game/CSS class.
  if (typeof s.shake === 'boolean') {
    document.getElementById('toggle-shake').checked = s.shake;
    CONFIG.shakeEnabled = s.shake;
  }
  if (typeof s.scanlines === 'boolean') {
    document.getElementById('toggle-scanlines').checked = s.scanlines;
    const lines = document.querySelector('.scanlines');
    lines.classList.toggle('scanlines-disabled', !s.scanlines);
  }
  if (typeof s.bezel === 'boolean') {
    const cb = document.getElementById('toggle-bezel');
    if (cb) {
      cb.checked = s.bezel;
      document.getElementById('game-container').classList.toggle('crt-bezel-active', s.bezel);
    }
  }

  // Difficulty — restore active class on the matching button.
  if (s.difficulty && ['cadet', 'hero', 'elite'].includes(s.difficulty)) {
    selectedDifficulty = s.difficulty;
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-diff') === s.difficulty);
    });
  }

  // Skin — restore active class on the matching paint button (saucer has
  // no button so the active-class toggle is a no-op for that one — the
  // selectedSkin assignment below is what actually drives the rendering).
  if (s.skin) {
    selectedSkin = s.skin;
    document.querySelectorAll('.paint-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-skin') === s.skin);
    });
  }

  // Cheats — booleans only, no UI state to update (they manifest in-game).
  if (s.cheats && typeof s.cheats === 'object') {
    cheatRainbow = !!s.cheats.rainbow;
    cheatGod = !!s.cheats.god;
    cheatMatrix = !!s.cheats.matrix;
  }
}
