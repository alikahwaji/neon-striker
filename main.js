/* ----------------------------------------------------
   NEON STRIKER - Main Loop & Level/Lifecycle Control
   The rAF game tick, per-frame entity updates, level
   loading + wave spawning, and start/continue/pause/
   game-over orchestration.
   ---------------------------------------------------- */

/* ----------------------------------------------------
   SPAWNING ENEMY WAVES & LEVELS SYSTEM
   ---------------------------------------------------- */
function handleWaveSpawning(dt) {
  // Level cleared checks
  if (enemies.length === 0 && asteroids.length === 0 && scrapItems.length === 0) {
    if (!inShop && !inIntro) {
      triggerLevelClear();
    }
  }

  // Random Asteroid drops check (Level 2, 8, 9)
  const lvlData = LEVEL_DATABASE[currentLevel] || {};
  if (lvlData.asteroidChance && gameActive && !gamePaused) {
    if (Math.random() < lvlData.asteroidChance) {
      const rx = Math.random() * (CONFIG.width - 80) + 40;
      asteroids.push(new Asteroid(rx, -40, 'large'));
    }
  }

  // Level 12 Creepy Egg pulser drops chance
  if (lvlData.hatchingPods && gameActive && !gamePaused && enemies.length < 5) {
    if (Math.random() < 0.005) {
      const rx = Math.random() * (CONFIG.width - 100) + 50;
      enemies.push(new HatchingPod(rx, -40));
    }
  }

  // Level 15 Spice Cloud spawners
  if (lvlData.spiceClouds && gameActive && !gamePaused) {
    if (Math.random() < 0.015) {
      const rx = Math.random() * (CONFIG.width - 60) + 30;
      powerUps.push(new SpiceCloud(rx, -40));
    }
  }

  // Trench Wall Turrets Spawning (Level 11)
  if (lvlData.trenchWalls && gameActive && !gamePaused) {
    if (Math.random() < 0.008) {
      const side = Math.random() > 0.5 ? 'left' : 'right';
      const rx = side === 'left' ? 176 : 600;
      wallTurrets.push(new WallTurret(rx, -40, side));
    }
  }
}

function triggerLevelClear() {
  gameActive = false;
  GameAudio.playLevelClearSound();

  // Achievement check fires BEFORE we open the shop — the level_cleared
  // payload carries currentLevel, and Untouchable inspects perRun damage
  // counters which startLevel() reset at the start of this level.
  if (window.Achievements) Achievements.notify('level_cleared', { level: currentLevel });

  // Save current stats to upgrade hangar
  document.getElementById('shop-scrap').innerText = `⚙️ ${scrapCredits}`;

  // Transition to Nanotech Upgrade Hangar Shop Modal
  setTimeout(() => {
    openUpgradeHangar();
  }, 1000);
}


function loadAndStartLevel() {
  inIntro = true;

  // Levels 1-20 come from the hand-curated LEVEL_DATABASE. Anything beyond
  // that drops into endless mode and gets a generated sector data object
  // with escalating difficulty — see generateEndlessLevel() below.
  const lvlData = LEVEL_DATABASE[currentLevel] || generateEndlessLevel(currentLevel);

  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('level_start', { level: currentLevel, theme: lvlData.theme, endless: currentLevel > 20 });
  }
  
  // Set Soundtrack BGM Theme
  GameAudio.setTheme(lvlData.theme);
  GameAudio.startBackgroundMusic();

  // Reset collections
  playerLasers = [];
  enemyLasers = [];
  enemies = [];
  powerUps = [];
  particles = [];
  floatingTexts = [];
  scrapItems = [];
  asteroids = [];
  homingMissiles = [];
  wallTurrets = [];
  wingmanDrones = [];
  empShockwaves = [];
  debrisList = [];
  matrixStreams = [];
  dsLaserState = 'off';
  dsLaserTimer = 4000;
  empCooldownTimer = 0;

  // Reset player position
  if (player) {
    player.x = CONFIG.width / 2 - player.width / 2;
    player.y = CONFIG.height - 80;
    player.vx = 0;
    player.vy = 0;
  }

  // Display Level Intro screen
  const introScreen = document.getElementById('level-intro-screen');
  document.getElementById('level-intro-title').innerText = lvlData.title;
  document.getElementById('level-intro-subtitle').innerText = lvlData.subtitle;
  document.getElementById('level-intro-quote').innerText = lvlData.quote;

  introScreen.classList.remove('hidden');

  setTimeout(() => {
    // Fade out intro, start combat loop
    introScreen.classList.add('hidden');
    inIntro = false;
    document.getElementById('hud').classList.remove('hidden');
    gameActive = true;
    gamePaused = false;

    spawnCampaignForces(lvlData);
    if (window.Achievements) {
      Achievements.startLevel();
      Achievements.notify('level_started', { level: currentLevel });
    }
    maybeShowPauseHint();
  }, 3200);
}

/* ----------------------------------------------------
   ENDLESS MODE — procedural sectors past Level 20
   ----------------------------------------------------
   The hand-curated campaign ends at LEVEL_DATABASE[20]. Past that we
   synthesise level data so the player can keep going indefinitely.
   Every 5 sectors is a boss fight; difficulty scales with tier
   (every 5 levels = +1 tier of enemy variety and density). Themes
   cycle through the available BGM tracks for visual variety. */
const ENDLESS_THEMES = ['standard', 'trench', 'organic', 'gargantua', 'spice', 'tron', 'matrix', 'wey_sentry', 'ds_core'];
const ENDLESS_BOSS_TYPES = ['boss', 'boss2', 'sandworm', 'unicron'];

function generateEndlessLevel(n) {
  const endlessIdx = n - 20;           // 1, 2, 3, ...
  const tier = Math.floor((endlessIdx - 1) / 5); // 0..N, bumps every 5 sectors
  const isBossSector = endlessIdx % 5 === 0;
  const themeIdx = (endlessIdx - 1) % ENDLESS_THEMES.length;

  if (isBossSector) {
    return {
      title: `ENDLESS ${n}`,
      subtitle: `WORLD-DEVOURER MK ${tier + 2}`,
      theme: 'unicron', // always the heavy-metal track for boss intervals
      quote: '⚠️ ENDLESS BOSS ENGAGEMENT ⚠️\nThe void keeps producing new threats. How deep can you go?',
      bossType: ENDLESS_BOSS_TYPES[endlessIdx % ENDLESS_BOSS_TYPES.length]
    };
  }

  return {
    title: `ENDLESS ${n}`,
    subtitle: `SECTOR XX — TIER ${tier + 1}`,
    theme: ENDLESS_THEMES[themeIdx],
    quote: `Sector ${n}: hostiles continue to mount. No retreat, no resupply, no end.`,
    // Asteroid density and grid size both scale with tier — capped so the
    // canvas doesn't get carpet-bombed past playability.
    asteroidChance: Math.min(0.04, 0.008 + tier * 0.006),
    enemyGrid: {
      rows: Math.min(5, 2 + Math.floor(tier / 2)),
      cols: Math.min(7, 4 + Math.floor(tier / 3)),
      scouts: true,
      swarmers: tier >= 1,
      kamikazes: tier >= 2,
      phaseShips: tier >= 3,
      heatSeekers: tier >= 2,
      snipers: tier >= 4,
      shieldBlockers: tier >= 3,
      lightCycles: tier >= 4
    }
  };
}

// First-ever-session reminder that P pauses the game. Shown once per
// browser profile and silenced via localStorage flag; auto-hides after
// 4 s OR on the first P press.
function maybeShowPauseHint() {
  let alreadySeen = false;
  try {
    alreadySeen = !!localStorage.getItem('neon_striker_pause_hint_seen_v1');
  } catch (e) { /* localStorage may throw in private mode — fail open */ }
  if (alreadySeen) return;

  const toast = document.getElementById('pause-hint-toast');
  if (!toast) return;
  toast.classList.remove('hidden');

  const markSeen = () => {
    toast.classList.add('hidden');
    try { localStorage.setItem('neon_striker_pause_hint_seen_v1', '1'); } catch (e) {}
    window.removeEventListener('keydown', dismissOnPause);
  };
  const dismissOnPause = (e) => { if (e.code === 'KeyP') markSeen(); };
  window.addEventListener('keydown', dismissOnPause);
  setTimeout(markSeen, 4000);
}

function spawnCampaignForces(lvlData) {
  if (lvlData.bossType) {
    // Spawn designated sector boss Cruiser
    enemies.push(new Enemy(CONFIG.width / 2 - 80, -120, lvlData.bossType === 'sandworm' ? 'sandworm' : lvlData.bossType === 'cyber_commander' ? 'boss2' : 'boss'));
  } 
  else if (lvlData.enemyGrid) {
    const grid = lvlData.enemyGrid;
    const spacingX = 75;
    const spacingY = 55;
    const startX = CONFIG.width / 2 - ((grid.cols - 1) * spacingX) / 2;

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const x = startX + c * spacingX;
        const y = 60 + r * spacingY;
        
        let type = 'scout';
        if (grid.phaseShips && Math.random() < 0.3) {
          type = 'phase';
        } else if (grid.heatSeekers && Math.random() < 0.25) {
          type = 'heatSeeker';
        } else if (grid.swarmers && r === 0) {
          type = 'swarmer';
        } else if (grid.kamikazes) {
          type = 'kamikaze';
        } else if (grid.lightCycles && Math.random() < 0.38) {
          type = 'lightCycle';
        } else if (grid.shieldBlockers && Math.random() < 0.28) {
          type = 'shieldBlocker';
        } else if (grid.snipers && Math.random() < 0.25) {
          type = 'sniper';
        } else if (grid.sentries && r === 0) {
          type = 'sentry';
        }

        enemies.push(new Enemy(x, y - 250, type, c * 0.45));
      }
    }
  }

  // Pre-spawn asteroid grids in high blitz levels
  if (currentLevel === 8) {
    asteroids.push(new Asteroid(150, -60, 'large'));
    asteroids.push(new Asteroid(450, -180, 'medium'));
    asteroids.push(new Asteroid(650, -100, 'large'));
  }
}

function triggerScreenShake(intensity) {
  if (!CONFIG.shakeEnabled) return;
  traumaLevel = Math.min(traumaLevel + intensity, 1.0);
}

/* ----------------------------------------------------
   GAME CORE UPDATE LOOP
   ---------------------------------------------------- */
function updateGame(dt) {
  const lvlData = LEVEL_DATABASE[currentLevel] || {};

  // Bullet-Time active checks in Level 17 Matrix theme:
  if (lvlData.theme === 'matrix' && gameActive && !gamePaused) {
    bulletTimeActive = keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyE'] || keys['KeyQ'];
  } else {
    bulletTimeActive = false;
  }

  // trauma decay
  if (traumaLevel > 0) {
    traumaLevel -= 0.04;
    if (traumaLevel < 0) traumaLevel = 0;
  }

  // Critical-health heartbeat. The SHIELD HUD bar already flashes red below
  // 25% but combat is intense and players miss it visually — a periodic low
  // beep keeps them aware. Cadence is set in audio.js; we just drive it
  // here while the player is alive and the warning band applies.
  if (health > 0 && health <= maxHealth * 0.25 && !gamePaused) {
    criticalHeartbeatTimer -= dt;
    if (criticalHeartbeatTimer <= 0) {
      GameAudio.playCriticalHealthBeep();
      criticalHeartbeatTimer = 1100; // ms between beeps
    }
  } else {
    criticalHeartbeatTimer = 0; // reset so first hit into critical band beeps immediately
  }

  // Warp drive scrolling timer update
  if (isWarping) {
    let mult = bulletTimeActive ? 0.4 : 1.0;
    warpTimer -= dt * mult;
    if (warpTimer <= 0) {
      isWarping = false;
    }
  }

  // Update Player
  if (player) {
    player.update(dt);

    // Active EMP Shockwave trigger — edge-detected on initial press only.
    // On Matrix levels (theme === 'matrix') Shift / E also engage bullet-time
    // while held, so polling keys[...] every frame here would re-fire the EMP
    // the instant its cooldown hit zero with no way for the player to stop it.
    // Reading keysPressed instead means one press = at most one EMP attempt.
    if (playerUpgrades.emp > 0 && gameActive && !gamePaused && empCooldownTimer <= 0) {
      if (keysPressed['KeyE'] || keysPressed['ShiftLeft'] || keysPressed['ShiftRight']) {
        triggerPlayerEMP();
      }
    }
  }

  // Consume all one-shot key edges. Anything triggered on press above must run
  // before this line; anything new added later should follow the same pattern.
  keysPressed = {};

  // Push HUD state to the DOM, skipping writes when nothing changed.
  // Avoids a parse+reflow per element per frame for values that update
  // only on score/level/health events.
  updateHud(dt);

  // Update Projectiles
  for (let i = playerLasers.length - 1; i >= 0; i--) {
    const laser = playerLasers[i];
    laser.update(true); // Player lasers are NOT slowed down by bullet-time
    if (laser.isOutOfBounds()) playerLasers.splice(i, 1);
  }

  for (let i = enemyLasers.length - 1; i >= 0; i--) {
    const laser = enemyLasers[i];
    laser.update(false); // Enemy lasers ARE slowed down by bullet-time
    if (laser.isOutOfBounds()) enemyLasers.splice(i, 1);
  }

  // Update Homing Missiles
  for (let i = homingMissiles.length - 1; i >= 0; i--) {
    const missile = homingMissiles[i];
    missile.update();
    if (missile.isOutOfBounds()) homingMissiles.splice(i, 1);
  }

  // Update Asteroids
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const ast = asteroids[i];
    ast.update();
    
    if (ast.y > CONFIG.height + 40) {
      asteroids.splice(i, 1);
      // Damaging structural base
      damagePlayer(10);
    }
  }

  // Update Wall Turrets
  for (let i = wallTurrets.length - 1; i >= 0; i--) {
    const turret = wallTurrets[i];
    turret.update(dt);
    if (turret.y > CONFIG.height + 40) {
      wallTurrets.splice(i, 1);
    }
  }

  // Update Nanotech scrap drops
  for (let i = scrapItems.length - 1; i >= 0; i--) {
    const scrap = scrapItems[i];
    scrap.update();
    if (scrap.y > CONFIG.height + 40) {
      scrapItems.splice(i, 1);
    }
  }

  // Update Escort Wingman Drones if active
  if (player && playerUpgrades.wingman > 0) {
    if (wingmanDrones.length === 0) {
      wingmanDrones.push(new WingmanDrone(0));
      wingmanDrones.push(new WingmanDrone(Math.PI)); // Double escorts!
    }
    wingmanDrones.forEach(drone => drone.update(dt));
  } else {
    wingmanDrones = [];
  }

  // Update EMP Shockwaves
  for (let i = empShockwaves.length - 1; i >= 0; i--) {
    const emp = empShockwaves[i];
    emp.update(dt);
    if (emp.radius >= emp.maxRadius) {
      empShockwaves.splice(i, 1);
    }
  }

  // Update Vector Debris
  for (let i = debrisList.length - 1; i >= 0; i--) {
    const debris = debrisList[i];
    debris.update(dt);
    if (debris.alpha <= 0) {
      debrisList.splice(i, 1);
    }
  }

  // Death Star Superlaser Core updates (Level 19)
  if (lvlData.dsCoreLaser && gameActive && !gamePaused) {
    let mult = bulletTimeActive ? 0.4 : 1.0;
    dsLaserTimer -= dt * mult;
    if (dsLaserTimer <= 0) {
      if (dsLaserState === 'off') {
        dsLaserState = 'charging';
        dsLaserTimer = 2200; // charge for 2.2 seconds
        GameAudio.playLaserSound(0.5); // heavy charging hum sound
      } else if (dsLaserState === 'charging') {
        dsLaserState = 'firing';
        dsLaserTimer = 1600; // fire for 1.6 seconds
        GameAudio.playBombSound(); // massive laser blast
        triggerScreenShake(0.8);
      } else if (dsLaserState === 'firing') {
        dsLaserState = 'off';
        dsLaserTimer = Math.random() * 5000 + 4000; // cool down, fire again in 4 to 9 seconds
      }
    }

    // If firing, check collision with player ship!
    if (dsLaserState === 'firing' && player) {
      const centerX = CONFIG.width / 2;
      const laserW = 90; // massive 90px wide laser!
      if (player.x + player.width > centerX - laserW / 2 && player.x < centerX + laserW / 2) {
        damagePlayer(1.5); // continuous heavy damage
        triggerScreenShake(0.15);
      }
    }
  }

  // Update Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    
    // Custom logic for Light Cycles
    if (enemy.type === 'lightCycle') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      
      // Update light cycle trail
      if (!enemy.trailTimer) enemy.trailTimer = 0;
      enemy.trailTimer += dt * mult;
      if (enemy.trailTimer >= 100) {
        if (!enemy.trail) enemy.trail = [];
        enemy.trail.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          birth: Date.now()
        });
        enemy.trailTimer = 0;
      }
      
      // Filter out segments older than 4 seconds
      const now = Date.now();
      if (enemy.trail) {
        enemy.trail = enemy.trail.filter(pt => now - pt.birth < 4000);
      }
      
      // Collide trail with player ship — squared-distance test, and break on
      // the first hit. Each trail can hold ~40 segments × N cycles, so the
      // previous version called Math.sqrt for every segment and re-damaged
      // (and re-shook the camera) on every overlapping segment in the same
      // frame, which spikes both perf and felt-difficulty.
      if (player && enemy.trail) {
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const TRAIL_HIT_RADIUS_SQ = 18 * 18;
        for (let t = 0; t < enemy.trail.length - 1; t++) {
          const p1 = enemy.trail[t];
          const p2 = enemy.trail[t + 1];
          if (getSquaredDistanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y) < TRAIL_HIT_RADIUS_SQ) {
            damagePlayer(0.35); // continuous trail damage
            triggerScreenShake(0.06);
            if (Math.random() < 0.1) {
              particles.push(new Particle(px, py, '#00ffff'));
            }
            break; // one hit per cycle per frame is enough
          }
        }
      }
    }
    
    // Custom logic for Ceiling Sentries
    if (enemy.type === 'sentry') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      
      if (player && gameActive && !gamePaused) {
        const sx = enemy.x + enemy.width / 2;
        const sy = enemy.y + enemy.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = px - sx;
        const dy = py - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angleToPlayer = Math.atan2(dy, dx);
        
        let diff = angleToPlayer - enemy.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        if (dist < 450 && Math.abs(diff) < Math.PI / 12) {
          enemy.detected = true;
          if (!enemy.shootCooldown) enemy.shootCooldown = 0;
          enemy.shootCooldown -= dt * mult;
          if (enemy.shootCooldown <= 0) {
            const vx = Math.cos(angleToPlayer) * 7.5;
            const vy = Math.sin(angleToPlayer) * 7.5;
            enemyLasers.push(new Laser(sx, sy, vx, vy, '#ffea00'));
            enemy.shootCooldown = 180; // fire every 180ms
            GameAudio.playLaserSound(1.8);
          }
        } else {
          enemy.detected = false;
        }
      }
    }

    enemy.update(dt);
    
    if (enemy.y > CONFIG.height + 40) {
      enemies.splice(i, 1);
      // Route through damagePlayer so god mode / SHIELD pickup / invuln frames
      // all apply — previously this branch decremented health directly and
      // ignored every defensive system, which silently killed cheat 'god' runs.
      damagePlayer(15);
    }
  }

  // Update Floating Texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const txt = floatingTexts[i];
    txt.update();
    if (txt.alpha <= 0) floatingTexts.splice(i, 1);
  }

  // Update Power-ups
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pup = powerUps[i];
    pup.update();
    if (pup.y > CONFIG.height + 40) powerUps.splice(i, 1);
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.alpha <= 0) particles.splice(i, 1);
  }

  // Check Collisions
  if (gameActive) {
    handleCollisions();
    handleWaveSpawning(dt);
  }
}

/* ----------------------------------------------------
   GAME STATE CONTROL MACHINE & INTERACTIVE WIRINGS
   ---------------------------------------------------- */
function gameTick(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const rawDt = timestamp - lastTime;
  lastTime = timestamp;

  // Clamp dt so the first frame (lastTime initialised to 0) and frames after
  // a tab-throttle return don't dump hundreds of ms into the dt-scaled timers
  // (shootTimer, chargeTimer, dsLaserTimer, activePowerUps[*]) all at once.
  // 50ms covers ~3 dropped frames at 60Hz, which is more than enough headroom.
  const dt = Math.min(rawDt, 50);

  if (gameActive && !gamePaused) {
    updateGame(dt);
  }

  drawGame();
  requestAnimationFrame(gameTick);
}

function startGame() {
  GameAudio.init();
  GameAudio.resume();

  // Reset upgraded statistics to base
  score = 0;
  currentLevel = 1;
  scrapCredits = 0;
  maxHealth = 100;
  health = 100;
  
  playerUpgrades.speed = 1;
  playerUpgrades.shield = 1;
  playerUpgrades.cooldown = 1;
  playerUpgrades.homing = 0;
  playerUpgrades.wingman = 0;
  playerUpgrades.emp = 0;
  playerUpgrades.magnet = 0; // Reset with the rest so Cadet/Elite runs start clean

  CONFIG.playerSpeed = CONFIG.playerSpeedBase;
  CONFIG.laserCooldown = CONFIG.laserCooldownBase;

  // Reset per-run achievement scratch state. Cross-run counters (totals,
  // skinsTried, unlocked set) survive untouched — only the per-run
  // upgrade-types set and damage / scrap counters get cleared.
  if (window.Achievements) Achievements.startRun(selectedDifficulty);

  player = new PlayerShip();
  
  const records = getLeaderboard();
  highScore = records.length > 0 ? records[0].score : 0;

  // Toggle Screen Views
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('shop-menu').classList.add('hidden');
  
  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('game_start', { timestamp: Date.now() });
  }
  
  loadAndStartLevel();
}

function continueGame() {
  GameAudio.init();
  GameAudio.resume();

  // Reset health to full and score to 0 (classic arcade style)
  health = maxHealth;
  if (selectedDifficulty !== 'cadet') {
    score = 0;
  }
  
  // Re-create player ship
  player = new PlayerShip();

  // Hide Game Over Screen
  document.getElementById('game-over-screen').classList.add('hidden');
  
  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('game_start', { timestamp: Date.now(), mode: 'continue', level: currentLevel });
  }

  loadAndStartLevel();
}

function togglePause() {
  if (!gameActive || inShop || inIntro) return;
  gamePaused = !gamePaused;
  
  const pauseScreen = document.getElementById('pause-screen');
  if (gamePaused) {
    pauseScreen.classList.remove('hidden');
    GameAudio.stopBackgroundMusic();
  } else {
    pauseScreen.classList.add('hidden');
    GameAudio.startBackgroundMusic();
  }
}

function showGameOverScreen() {
  GameAudio.stopBackgroundMusic();
  document.getElementById('hud').classList.add('hidden');
  
  if (window.logAnalyticsEvent) {
    window.logAnalyticsEvent('game_over', { score: score, level_reached: currentLevel });
  }
  
  const finalScoreEl = document.getElementById('final-score');
  const finalWaveEl = document.getElementById('final-wave');
  
  finalScoreEl.innerText = String(score).padStart(6, '0');
  finalWaveEl.innerText = currentLevel;

  const inputContainer = document.getElementById('high-score-input-container');
  if (checkNewHighScore(score)) {
    inputContainer.classList.remove('hidden');
    document.getElementById('pilot-name').value = '';
    document.getElementById('pilot-name').focus();
  } else {
    inputContainer.classList.add('hidden');
  }

  // Handle Continue button visibility
  const btnContinue = document.getElementById('btn-continue');
  if (currentLevel > 1 && selectedDifficulty !== 'elite') {
    btnContinue.innerText = `CONTINUE SECTOR ${currentLevel}`;
    btnContinue.classList.remove('hidden');
  } else {
    btnContinue.classList.add('hidden');
  }

  document.getElementById('game-over-screen').classList.remove('hidden');
}

/* ----------------------------------------------------
   HUD UPDATE (cached refs + dirty-write batching)
   ---------------------------------------------------- */
// Lazily-initialised DOM lookups so getElementById runs once, not 60×/sec.
let hudRefs = null;
// Last values pushed to the DOM, so we only write when something changed.
const hudLast = {
  score: -1, level: -1, scrap: -1, high: -1,
  healthPct: -1, healthCls: '',
  empVisible: null, empFillPct: -1, empReady: null,
  powerupsSig: ''
};

function getHudRefs() {
  if (hudRefs) return hudRefs;
  hudRefs = {
    score: document.getElementById('hud-score'),
    wave: document.getElementById('hud-wave'),
    scrap: document.getElementById('hud-scrap'),
    high: document.getElementById('hud-high-score'),
    healthFill: document.getElementById('hud-health-fill'),
    empContainer: document.getElementById('hud-emp-container'),
    empFill: document.getElementById('hud-emp-fill'),
    powerups: document.getElementById('hud-powerups')
  };
  return hudRefs;
}

function updateHud(dt) {
  const r = getHudRefs();

  // Counter values — write only when changed.
  if (score !== hudLast.score) {
    r.score.innerText = String(score).padStart(6, '0');
    hudLast.score = score;
  }
  if (currentLevel !== hudLast.level) {
    r.wave.innerText = currentLevel;
    hudLast.level = currentLevel;
  }
  if (scrapCredits !== hudLast.scrap) {
    r.scrap.innerText = `⚙️ ${String(scrapCredits).padStart(3, '0')}`;
    hudLast.scrap = scrapCredits;
  }
  const highRecord = Math.max(score, highScore);
  if (highRecord !== hudLast.high) {
    r.high.innerText = String(highRecord).padStart(6, '0');
    hudLast.high = highRecord;
  }

  // Shield/health bar — only restyle when the band changes.
  const healthPercent = (health / maxHealth) * 100;
  if (healthPercent !== hudLast.healthPct) {
    r.healthFill.style.width = `${healthPercent}%`;
    hudLast.healthPct = healthPercent;
  }
  const healthCls = healthPercent > 50
    ? 'hud-health-fill shield-active'
    : healthPercent > 25
      ? 'hud-health-fill warning'
      : 'hud-health-fill critical';
  if (healthCls !== hudLast.healthCls) {
    r.healthFill.className = healthCls;
    hudLast.healthCls = healthCls;
  }

  // EMP cooldown bar — visibility, tick-down, and fill class.
  const empWanted = playerUpgrades.emp > 0;
  if (empWanted !== hudLast.empVisible) {
    if (r.empContainer) r.empContainer.classList.toggle('hidden', !empWanted);
    hudLast.empVisible = empWanted;
  }
  if (empWanted) {
    if (empCooldownTimer > 0) {
      const mult = bulletTimeActive ? 0.4 : 1.0;
      empCooldownTimer -= dt * mult;
      if (empCooldownTimer < 0) empCooldownTimer = 0;
    }
    if (r.empFill) {
      const fillPct = empCooldownTimer > 0 ? (1.0 - empCooldownTimer / 8000) * 100 : 100;
      if (fillPct !== hudLast.empFillPct) {
        r.empFill.style.width = `${fillPct}%`;
        hudLast.empFillPct = fillPct;
      }
      const empReady = empCooldownTimer <= 0;
      if (empReady !== hudLast.empReady) {
        r.empFill.classList.toggle('emp-ready', empReady);
        hudLast.empReady = empReady;
      }
    }
  }

  // Active power-up badges — tick down first, then rebuild only when the
  // set of (type, seconds-remaining) tuples has actually changed. A frame
  // where every badge's displayed second-bucket is the same does zero DOM
  // work instead of clearing + re-parsing the subtree.
  Object.keys(activePowerUps).forEach(key => {
    if (activePowerUps[key] > 0) {
      activePowerUps[key] -= dt;
      if (activePowerUps[key] <= 0) delete activePowerUps[key];
    }
  });

  let sig = '';
  Object.keys(activePowerUps).forEach(key => {
    sig += `${key}:${Math.ceil(activePowerUps[key] / 1000)};`;
  });

  if (sig !== hudLast.powerupsSig) {
    hudLast.powerupsSig = sig;
    const host = r.powerups;
    while (host.firstChild) host.removeChild(host.firstChild);
    Object.keys(activePowerUps).forEach(key => {
      const secondsLeft = Math.ceil(activePowerUps[key] / 1000);
      const label = key === 'TRIPLE_SHOT' ? 'TRIPLE'
                  : key === 'RAPID_FIRE' ? 'BOOST'
                  : 'SHIELD';
      const badge = document.createElement('div');
      badge.className = 'powerup-badge';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = label;
      const timerSpan = document.createElement('span');
      timerSpan.className = 'badge-timer';
      timerSpan.textContent = `${secondsLeft}s`;
      badge.append(nameSpan, timerSpan);
      host.appendChild(badge);
    });
  }
}
