/* ----------------------------------------------------
   NEON STRIKER - Rendering Pipeline
   Background grid + per-frame canvas composition.
   Reads shared state from config.js + entities.js.
   ---------------------------------------------------- */

// Pre-computed RGBA strings for matrix-rain trail chars, indexed by
// alpha bucket (0 = transparent, 10 = opaque). Replaces the per-char
// template-literal allocation that was the dominant string-alloc
// source in the render loop (~500-1250 strings/frame on Lvl 17).
const MATRIX_RAIN_COLOURS = [
  'rgba(0, 255, 65, 0.0)', 'rgba(0, 255, 65, 0.1)', 'rgba(0, 255, 65, 0.2)',
  'rgba(0, 255, 65, 0.3)', 'rgba(0, 255, 65, 0.4)', 'rgba(0, 255, 65, 0.5)',
  'rgba(0, 255, 65, 0.6)', 'rgba(0, 255, 65, 0.7)', 'rgba(0, 255, 65, 0.8)',
  'rgba(0, 255, 65, 0.9)', 'rgba(0, 255, 65, 1.0)'
];

/* ----------------------------------------------------
   BACKGROUND SCROLLING GRID RENDER
   ---------------------------------------------------- */
function drawSynthwaveBackground() {
  const lvlData = activeLevelData || {};
  
  // Set backdrop colors based on level style
  if (lvlData.theme === 'spice') {
    ctx.fillStyle = '#0d0801'; // Gold Sand Orbit backdrop
  } else if (lvlData.theme === 'organic') {
    ctx.fillStyle = '#010603'; // Alien dark green nest backdrop
  } else if (lvlData.theme === 'matrix' || cheatMatrix) {
    ctx.fillStyle = '#000802'; // Dark Matrix green backdrop
  } else if (lvlData.theme === 'tron') {
    ctx.fillStyle = '#02000c'; // TRON dark neon purple/blue backdrop
  } else if (lvlData.theme === 'ds_core') {
    ctx.fillStyle = '#0a0a0f'; // Grey reactor backdrop
  } else if (lvlData.theme === 'unicron') {
    ctx.fillStyle = '#0f0502'; // Orange circuit board backdrop
  } else {
    ctx.fillStyle = '#03010b';
  }
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

  // Render drifting stars
  stars.forEach(star => {
    let currentSpeed = star.speed;
    if (isWarping) currentSpeed *= 15;
    
    star.y += currentSpeed;
    if (star.y > CONFIG.height) {
      star.y = 0;
      star.x = Math.random() * CONFIG.width;
    }
    
    if (lvlData.theme === 'spice') {
      ctx.fillStyle = '#ffea00'; // Gold star sand particles
    } else {
      ctx.fillStyle = star.color;
    }
    
    if (isWarping) {
      let starLength = star.speed * 12;
      ctx.fillRect(star.x, star.y, star.size, starLength);
    } else {
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  });

  // Matrix digital code rain in background
  if (lvlData.theme === 'matrix' || cheatMatrix) {
    if (matrixStreams.length === 0) {
      const cols = Math.floor(CONFIG.width / 16);
      for (let i = 0; i < cols; i++) {
        matrixStreams.push({
          x: i * 16,
          y: Math.random() * -CONFIG.height,
          speed: Math.random() * 3 + 2,
          length: Math.floor(Math.random() * 15) + 10
        });
      }
    }
    
    ctx.save();
    ctx.font = '14px monospace';
    matrixStreams.forEach(stream => {
      let speedMult = bulletTimeActive ? 0.4 : 1.0;
      stream.y += stream.speed * speedMult;
      if (stream.y - stream.length * 16 > CONFIG.height) {
        stream.y = Math.random() * -200;
        stream.speed = Math.random() * 3 + 2;
        stream.length = Math.floor(Math.random() * 15) + 10;
      }
      
      for (let j = 0; j < stream.length; j++) {
        const cy = stream.y - j * 16;
        if (cy < 0 || cy > CONFIG.height) continue;

        const charCode = 0x30A0 + Math.floor(Math.random() * 96);
        const char = String.fromCharCode(charCode);

        const isLeading = j === 0;
        if (isLeading) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00ff41';
          ctx.shadowBlur = 10;
        } else {
          // Quantise alpha to nearest 0.1 and look up the colour string
          // from a precomputed table. Previously we built a fresh
          // `rgba(0,255,65,${alpha})` template literal for every char —
          // ~500-1250 string allocations per frame for the matrix rain
          // alone. The LUT cuts allocations to zero in the steady state.
          const a = 1.0 - j / stream.length;
          ctx.fillStyle = MATRIX_RAIN_COLOURS[Math.min(10, Math.max(0, Math.round(a * 10)))];
          ctx.shadowBlur = 0;
        }
        ctx.fillText(char, stream.x, cy);
      }
    });
    ctx.restore();
  }

  const horizonY = 220;

  // Interstellar central black hole event horizon
  if (lvlData.blackHole) {
    ctx.save();
    const cx = 400;
    const cy = horizonY;
    
    // Event horizon accretion disk radial swirl
    const swirl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 140);
    swirl.addColorStop(0, '#000');
    swirl.addColorStop(0.2, '#000');
    swirl.addColorStop(0.28, '#ffea00'); // Accretion disk edge
    swirl.addColorStop(0.55, 'rgba(139, 0, 255, 0.15)');
    swirl.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = swirl;
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.fill();
    
    // Pitch black sphere center hole
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }

  // 2001 HAL 9000 glowing red sensor lens on horizon center
  if (lvlData.halEye) {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff003c';
    ctx.fillStyle = '#ff003c';
    ctx.beginPath();
    ctx.arc(CONFIG.width / 2, horizonY - 10, 15 + Math.sin(frameNow / 200) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(CONFIG.width / 2, horizonY - 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Set grid lines colors
  let gridLineCol1 = 'rgba(255, 0, 170, 0.18)';
  let gridLineCol2 = 'rgba(0, 240, 255, ';
  
  if (lvlData.theme === 'spice') {
    gridLineCol1 = 'rgba(255, 183, 0, 0.2)';
    gridLineCol2 = 'rgba(255, 234, 0, ';
  } else if (lvlData.theme === 'organic') {
    gridLineCol1 = 'rgba(57, 255, 20, 0.15)';
    gridLineCol2 = 'rgba(0, 240, 255, ';
  } else if (lvlData.theme === 'tron') {
    gridLineCol1 = 'rgba(0, 240, 255, 0.35)'; // Bright cyan
    gridLineCol2 = 'rgba(0, 240, 255, ';
  } else if (lvlData.theme === 'matrix' || cheatMatrix) {
    gridLineCol1 = 'rgba(0, 255, 65, 0.08)'; // Dim green
    gridLineCol2 = 'rgba(0, 255, 65, ';
  } else if (lvlData.theme === 'wey_sentry') {
    gridLineCol1 = 'rgba(100, 100, 120, 0.15)';
    gridLineCol2 = 'rgba(100, 100, 120, ';
  } else if (lvlData.theme === 'ds_core') {
    gridLineCol1 = 'rgba(57, 255, 20, 0.2)'; // Green power conduits
    gridLineCol2 = 'rgba(57, 255, 20, ';
  } else if (lvlData.theme === 'unicron') {
    gridLineCol1 = 'rgba(255, 68, 0, 0.22)'; // Orange circuit board
    gridLineCol2 = 'rgba(255, 68, 0, ';
  }

  // Radial grid sky gradient glow
  if (!lvlData.blackHole) {
    const glowGrad = ctx.createRadialGradient(
      CONFIG.width / 2, horizonY, 0, 
      CONFIG.width / 2, horizonY, CONFIG.height - horizonY
    );
    if (lvlData.theme === 'spice') {
      glowGrad.addColorStop(0, 'rgba(255, 183, 0, 0.2)');
    } else {
      glowGrad.addColorStop(0, 'rgba(139, 0, 255, 0.25)');
    }
    glowGrad.addColorStop(0.5, 'rgba(255, 0, 170, 0.05)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, horizonY, CONFIG.width, CONFIG.height - horizonY);
  }

  // Grid offsets
  gridOffset += 1.8;
  if (gridOffset >= 60) gridOffset = 0;

  ctx.strokeStyle = gridLineCol1;
  ctx.lineWidth = 1.5;

  // 1. Perspective Converging Vertical Lines
  const centerLineX = CONFIG.width / 2;
  const numLines = 14;
  for (let i = -numLines; i <= numLines; i++) {
    const spacing = 65;
    const startX = centerLineX + i * spacing * 4.5;
    ctx.beginPath();
    ctx.moveTo(centerLineX + i * 2, horizonY);
    ctx.lineTo(startX, CONFIG.height);
    ctx.stroke();
  }

  // 2. Scrolling Exponential Horizontal Lines
  for (let y = 0; y < 14; y++) {
    const py = Math.pow(y / 14, 2.5) * (CONFIG.height - horizonY) + horizonY + gridOffset;
    if (py <= CONFIG.height && py >= horizonY) {
      const alpha = ((py - horizonY) / (CONFIG.height - horizonY)) * 0.28;
      ctx.strokeStyle = `${gridLineCol2}${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(CONFIG.width, py);
      ctx.stroke();
    }
  }

  // Draw Trench walls borders for Level 11 (Star Wars Conduit)
  if (lvlData.trenchWalls) {
    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#39ff14';

    // Left wall
    ctx.beginPath();
    ctx.moveTo(200, 0);
    ctx.lineTo(200, CONFIG.height);
    ctx.stroke();

    // Right wall
    ctx.beginPath();
    ctx.moveTo(600, 0);
    ctx.lineTo(600, CONFIG.height);
    ctx.stroke();

    // Left wall horizontal cross indicators
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.25)';
    ctx.lineWidth = 1;
    for (let py = 0; py < CONFIG.height; py += 40) {
      ctx.beginPath();
      ctx.moveTo(0, py + (gridOffset % 40));
      ctx.lineTo(200, py + (gridOffset % 40));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(600, py + (gridOffset % 40));
      ctx.lineTo(CONFIG.width, py + (gridOffset % 40));
      ctx.stroke();
    }

    ctx.restore();
  }

  // Horizon Line
  ctx.save();
  ctx.strokeStyle = lvlData.theme === 'spice' ? '#ffea00' : '#ff00aa';
  ctx.shadowBlur = 10;
  ctx.shadowColor = lvlData.theme === 'spice' ? '#ffea00' : '#ff00aa';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(CONFIG.width, horizonY);
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------------------------------
   CANVAS DRAWING / RENDERING STAGE
   ---------------------------------------------------- */
function drawGame() {
  ctx.save();

  if (traumaLevel > 0) {
    const shakeX = (Math.random() * 2 - 1) * traumaLevel * 14;
    const shakeY = (Math.random() * 2 - 1) * traumaLevel * 14;
    ctx.translate(shakeX, shakeY);
  }

  // Draw scrolling backgrounds
  drawSynthwaveBackground();

  const lvlData = activeLevelData || {};

  // Draw Death Star Reactor Beam (Level 19)
  if (lvlData.dsCoreLaser && (dsLaserState === 'charging' || dsLaserState === 'firing')) {
    ctx.save();
    const centerX = CONFIG.width / 2; // screen-bisecting massive vertical beam
    
    if (dsLaserState === 'charging') {
      // Pulsing warning thin targeting lines
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.5 + Math.sin(frameNow / 30) * 1.0;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#39ff14';
      ctx.globalAlpha = 0.4 + Math.sin(frameNow / 50) * 0.3;
      
      // Draw 2 thin charging bounds lines
      ctx.beginPath();
      ctx.moveTo(centerX - 45, 0);
      ctx.lineTo(centerX - 45, CONFIG.height);
      ctx.moveTo(centerX + 45, 0);
      ctx.lineTo(centerX + 45, CONFIG.height);
      ctx.stroke();
      
      // Pulsing energy spark particles charging inside the column
      ctx.fillStyle = '#39ff14';
      for (let i = 0; i < 4; i++) {
        const ry = Math.random() * CONFIG.height;
        const rx = centerX + (Math.random() * 90 - 45);
        ctx.beginPath();
        ctx.arc(rx, ry, Math.random() * 3 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dsLaserState === 'firing') {
      // A massive screen-bisecting white-hot green reactor beam
      ctx.fillStyle = '#39ff14';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#39ff14';
      
      ctx.fillRect(centerX - 45, 0, 90, CONFIG.height);
      
      // White-hot core
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(centerX - 20, 0, 40, CONFIG.height);
      
      // Spark particles along the column during the firing state
      ctx.fillStyle = '#39ff14';
      for (let i = 0; i < 8; i++) {
        const ry = Math.random() * CONFIG.height;
        const rx = centerX + (Math.random() * 130 - 65);
        ctx.beginPath();
        ctx.arc(rx, ry, Math.random() * 4 + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Draw Wall Turrets (Trench Level)
  wallTurrets.forEach(turret => turret.draw());

  // Draw Vector Debris under ships/lasers for clean layering
  debrisList.forEach(debris => debris.draw());

  // Draw EMP Shockwaves
  empShockwaves.forEach(emp => emp.draw());

  // Draw Enemy lasers
  enemyLasers.forEach(laser => laser.draw());

  // Draw Player lasers
  playerLasers.forEach(laser => laser.draw());

  // Draw Homing Missiles
  homingMissiles.forEach(missile => missile.draw());

  // Draw Powerups / clouds
  powerUps.forEach(pup => pup.draw());

  // Draw Nanotech credits drops
  scrapItems.forEach(scrap => scrap.draw());

  // Draw Wingman Drones next to player ship
  wingmanDrones.forEach(drone => drone.draw());

  // Draw Enemies / Eggs
  enemies.forEach(enemy => enemy.draw());

  // Draw Asteroids / Monoliths
  asteroids.forEach(ast => ast.draw());

  // Draw Floating texts
  floatingTexts.forEach(txt => txt.draw());

  // Draw Particles
  particles.forEach(p => p.draw());

  // Draw Player ship
  if (player && health > 0) {
    player.draw();
  }

  ctx.restore();
}
