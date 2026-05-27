/* ----------------------------------------------------
   NEON STRIKER - Entity Classes
   All in-game vector entities (player, enemies, projectiles,
   pickups, particles, FX). Loaded after config.js so that
   CONFIG, LEVEL_DATABASE, and shared state are available.
   ---------------------------------------------------- */

// Player Space Fighter Class
class PlayerShip {
  constructor() {
    this.width = 44;
    this.height = 36;
    this.x = CONFIG.width / 2 - this.width / 2;
    this.y = CONFIG.height - 80;
    this.vx = 0;
    this.vy = 0;
    this.lastShotTime = 0;
    this.invulnFrames = 0;
  }

  update(dt) {
    // Process input keyboard movements
    if (keys['ArrowLeft'] || keys['KeyA']) {
      this.vx -= CONFIG.playerSpeed * 0.15;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      this.vx += CONFIG.playerSpeed * 0.15;
    }
    if (keys['ArrowUp'] || keys['KeyW']) {
      this.vy -= CONFIG.playerSpeed * 0.15;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      this.vy += CONFIG.playerSpeed * 0.15;
    }

    // Apply smooth inertia friction
    this.vx *= CONFIG.playerFriction;
    this.x += this.vx;
    this.vy *= CONFIG.playerFriction;
    this.y += this.vy;

    // Apply level specific physical constraint borders
    let minX = 15;
    let maxX = CONFIG.width - this.width - 15;
    let minY = 220; // Stop exactly at the horizontal horizon line
    // Bottom margin large enough that the ship can never enter the bottom
    // HUD strip (.hud-bottom occupies the lower ~48 CSS px / ~40 internal px
    // of the canvas). Without this clearance, the SHIELD / EMP widgets
    // (z-index 3, rgba(4,2,10,0.65) background) visually obscure the ship
    // at its max-Y position.
    let maxY = CONFIG.height - this.height - 55;
    
    const lvlData = LEVEL_DATABASE[currentLevel] || {};
    if (lvlData.trenchWalls) {
      // Trench Run constrains player to middle corridor (200px to 600px)
      minX = 210;
      maxX = 590 - this.width;
    }

    // Boundary check clamping
    if (this.x < minX) {
      this.x = minX;
      this.vx = 0;
    }
    if (this.x > maxX) {
      this.x = maxX;
      this.vx = 0;
    }
    if (this.y < minY) {
      this.y = minY;
      this.vy = 0;
    }
    if (this.y > maxY) {
      this.y = maxY;
      this.vy = 0;
    }

    // Interstellar Black Hole gravity pull towards center (400px X coordinate)
    if (lvlData.blackHole) {
      let pullForce = 0.16;
      if (selectedDifficulty === 'cadet') pullForce = 0.08;
      else if (selectedDifficulty === 'elite') pullForce = 0.22;
      
      const pullDir = player.x + player.width / 2 < 400 ? 1 : -1;
      this.vx += pullDir * pullForce;
    }

    // Shooting cannon fires
    if (keys['Space']) {
      this.shoot();
    }

    // Auto launcher homing rocket trigger — uses shared frameNow (set
    // once per frame in gameTick) instead of Date.now() so all per-frame
    // cooldown checks stay phase-locked with each other.
    if (playerUpgrades.homing > 0 && gameActive && !gamePaused) {
      if (frameNow >= nextHomingLaunchTime) {
        this.fireHomingMissile();
        nextHomingLaunchTime = frameNow + 1800; // Auto fires every 1.8 seconds
      }
    }

    if (this.invulnFrames > 0) {
      this.invulnFrames--;
    }
  }

  draw() {
    if (this.invulnFrames > 0 && Math.floor(frameNow / 80) % 2 === 0) {
      return;
    }

    let primary = '#00f0ff';
    let secondary = '#ff00aa';
    let fill = '#01152a';

    if (selectedSkin === 'toxic') {
      primary = '#39ff14';
      secondary = '#ffffff';
      fill = '#011c05';
    } else if (selectedSkin === 'solar') {
      primary = '#ffea00';
      secondary = '#ff003c';
      fill = '#1f1300';
    } else if (selectedSkin === 'void') {
      primary = '#bd00ff';
      secondary = '#00f0ff';
      fill = '#0f001f';
    } else if (selectedSkin === 'rainbow') {
      primary = `hsl(${Math.floor(frameNow / 12) % 360}, 100%, 60%)`;
      secondary = `hsl(${Math.floor(frameNow / 12 + 180) % 360}, 100%, 50%)`;
      fill = '#000000';
    }

    // Flying Saucer cheat skin
    if (selectedSkin === 'saucer') {
      const sx = this.x + this.width / 2;
      const sy = this.y + this.height / 2;
      const radius = 22;
      
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#bd00ff';
      ctx.strokeStyle = '#bd00ff';
      ctx.fillStyle = '#0f001f';
      ctx.lineWidth = 3;
      
      // Main saucer dome
      ctx.beginPath();
      ctx.ellipse(sx, sy, radius, radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Upper cockpit dome
      ctx.strokeStyle = '#00f0ff';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(sx, sy - 4, 8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Spinning core lights
      const numLights = 6;
      ctx.fillStyle = '#ffea00';
      const angleOffset = frameNow * 0.005;
      for (let i = 0; i < numLights; i++) {
        const angle = (i / numLights) * Math.PI * 2 + angleOffset;
        const lx = sx + Math.cos(angle) * (radius * 0.7);
        const ly = sy + Math.sin(angle) * (radius * 0.3);
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // God mode pulsing barrier
      if (cheatGod) {
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 3.5 + Math.sin(frameNow / 100) * 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 34, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = CONFIG.playerShieldActive() ? '#8b00ff' : primary;
    ctx.lineWidth = 2.5;

    // Draw main hull shape
    ctx.strokeStyle = primary;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y); // Nose
    ctx.lineTo(this.x + this.width, this.y + this.height); // Wing tip right
    ctx.lineTo(this.x + this.width - 10, this.y + this.height - 8);
    ctx.lineTo(this.x + 10, this.y + this.height - 8);
    ctx.lineTo(this.x, this.y + this.height); // Wing tip left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw secondary details
    ctx.strokeStyle = secondary;
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y + 8);
    ctx.lineTo(this.x + this.width - 12, this.y + this.height - 10);
    ctx.lineTo(this.x + 12, this.y + this.height - 10);
    ctx.closePath();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + 16, 4, 0, Math.PI * 2);
    ctx.fill();

    // Homing Pod shoulder wings
    if (playerUpgrades.homing > 0) {
      ctx.strokeStyle = '#ffea00';
      ctx.strokeRect(this.x - 6, this.y + 18, 6, 8);
      ctx.strokeRect(this.x + this.width, this.y + 18, 6, 8);
    }

    // Engine flame
    const flameLen = Math.random() * 15 + 10;
    ctx.fillStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(this.x + 15, this.y + this.height - 6);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height - 6 + flameLen);
    ctx.lineTo(this.x + this.width - 15, this.y + this.height - 6);
    ctx.closePath();
    ctx.fill();

    // Shield bubble
    if (cheatGod) {
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 3.5 + Math.sin(frameNow / 100) * 1.5;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 34, 0, Math.PI * 2);
      ctx.stroke();
    } else if (CONFIG.playerShieldActive()) {
      ctx.strokeStyle = '#ff00aa';
      ctx.shadowColor = '#ff00aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 32, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  shoot() {
    // Shared per-frame timestamp (set in gameTick) — phase-locks the
    // shoot cooldown with other per-frame time effects.
    const now = frameNow;
    let cooldown = CONFIG.laserCooldown;

    if (activePowerUps['RAPID_FIRE']) {
      cooldown = CONFIG.laserCooldown * 0.45;
    }

    // DEATH BLOSSOM (Konami code unlock) overrides everything — fires an
    // 8-way radial spread at a very fast cadence regardless of tier or
    // other power-ups. Short-circuit here so the rest of the tier ladder
    // doesn't also run.
    if (activePowerUps['DEATH_BLOSSOM']) {
      const blossomCD = Math.max(80, cooldown * 0.35);
      if (now - this.lastShotTime >= blossomCD) {
        this.lastShotTime = now;
        GameAudio.playLaserSound(1.6);
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const speed = CONFIG.laserSpeed;
        // 8 evenly-spaced lasers, starting upward so the spread reads
        // naturally as 'flower blooming outward from the ship'.
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          playerLasers.push(new Laser(cx, cy, vx, vy, '#ff6ad5', 2.0, 5, 14));
        }
      }
      return;
    }

    if (now - this.lastShotTime >= cooldown) {
      this.lastShotTime = now;

      GameAudio.playLaserSound(activePowerUps['RAPID_FIRE'] ? 1.3 : 1.0);

      const tier = playerUpgrades.cooldown;
      if (activePowerUps['TRIPLE_SHOT']) {
        if (tier === 1) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#ffea00', 1, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -2.5, -CONFIG.laserSpeed + 1, '#ffea00', 1, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2.5, -CONFIG.laserSpeed + 1, '#ffea00', 1, 4, 16));
        } else if (tier === 2) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#0088ff', 1.3, 6, 18));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -2.5, -CONFIG.laserSpeed + 1, '#0088ff', 1.3, 6, 18));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2.5, -CONFIG.laserSpeed + 1, '#0088ff', 1.3, 6, 18));
        } else if (tier === 3) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 5, -2, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 5, 2, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -4, -CONFIG.laserSpeed + 1, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 4, -CONFIG.laserSpeed + 1, '#00ff88', 1.2, 4, 16));
        } else if (tier === 4) {
          playerLasers.push(new Laser(this.x + this.width / 2 - 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width / 2 + 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -2.5, -CONFIG.laserSpeed + 1, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 2.5, -CONFIG.laserSpeed + 1, '#ff003c', 1.4, 4, 16));
        } else {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
          playerLasers.push(new Laser(this.x + 5, this.y + 10, -1.5, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 10, 1.5, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
        }
      } else {
        if (tier === 1) {
          playerLasers.push(new Laser(this.x + 12, this.y, 0, -CONFIG.laserSpeed, '#00f0ff', 1, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 12, this.y, 0, -CONFIG.laserSpeed, '#00f0ff', 1, 4, 16));
        } else if (tier === 2) {
          playerLasers.push(new Laser(this.x + 10, this.y, 0, -CONFIG.laserSpeed, '#0088ff', 1.3, 6, 18));
          playerLasers.push(new Laser(this.x + this.width - 10, this.y, 0, -CONFIG.laserSpeed, '#0088ff', 1.3, 6, 18));
        } else if (tier === 3) {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y, 0, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + 5, this.y + 5, -1.8, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 5, this.y + 5, 1.8, -CONFIG.laserSpeed, '#00ff88', 1.2, 4, 16));
        } else if (tier === 4) {
          playerLasers.push(new Laser(this.x + 4, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 12, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
          playerLasers.push(new Laser(this.x + this.width - 4, this.y, 0, -CONFIG.laserSpeed, '#ff003c', 1.4, 4, 16));
        } else {
          playerLasers.push(new Laser(this.x + this.width / 2, this.y - 8, 0, -CONFIG.laserSpeed, '#bd00ff', 4.0, 28, 32, true));
        }
      }
    }
  }

  fireHomingMissile() {
    if (enemies.length === 0) return;

    // Find closest active enemy — squared distance + plain for-loop
    // (avoids per-call closure alloc + the unnecessary Math.sqrt that
    // only ever fed a comparison).
    let closestEnemy = null;
    let minDistSq = Infinity;
    const cx = this.x + this.width / 2;
    const cy = this.y;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.y > 0 && enemy.y < CONFIG.height) {
        const dx = enemy.x + enemy.width / 2 - cx;
        const dy = enemy.y + enemy.height / 2 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDistSq) {
          minDistSq = d2;
          closestEnemy = enemy;
        }
      }
    }

    if (closestEnemy) {
      GameAudio.playHomingLaunchSound();
      // Launch a rocket from left and right shoulders alternatively
      const rx = Math.random() > 0.5 ? this.x - 3 : this.x + this.width + 3;
      homingMissiles.push(new HomingMissile(rx, this.y + 18, closestEnemy));
    }
  }
}

// Homing Seek Missile
class HomingMissile {
  constructor(x, y, target) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.vx = 0;
    this.vy = -3;
    this.speed = 7.5;
    this.width = 6;
    this.height = 16;
    this.color = '#39ff14'; // Bright green fire
    this.trailTimer = 0;
  }

  update() {
    // Seek Target Vector calculation
    if (this.target && this.target.health > 0 && enemies.includes(this.target)) {
      const tx = this.target.x + this.target.width / 2;
      const ty = this.target.y + this.target.height / 2;
      
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist > 10) {
        const targetVx = (dx / dist) * this.speed;
        const targetVy = (dy / dist) * this.speed;
        
        // Steering factor (curves the rocket trajectory smoothly)
        this.vx += (targetVx - this.vx) * 0.15;
        this.vy += (targetVy - this.vy) * 0.15;
      }
    } else {
      // Find new target if current is destroyed. Squared distance only —
      // we never use the actual distance, just compare them, so no sqrt
      // needed. Plain for-loop instead of forEach to skip the per-call
      // closure allocation that ran every frame for every orphaned missile.
      let closest = null;
      let minDistSq = Infinity;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDistSq) {
          minDistSq = d2;
          closest = e;
        }
      }
      if (closest) this.target = closest;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Rocket particles trail
    this.trailTimer++;
    if (this.trailTimer % 2 === 0) {
      particles.push(new Particle(this.x, this.y, '#ffea00'));
    }
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    
    // Rotate missile facing travel vector
    const angle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    
    // Flame nose cone
    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.moveTo(-this.width/2, -this.height/2);
    ctx.lineTo(0, -this.height/2 - 5);
    ctx.lineTo(this.width/2, -this.height/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  isOutOfBounds() {
    return this.y < -30 || this.y > CONFIG.height + 30 || this.x < -30 || this.x > CONFIG.width + 30;
  }
}

// Laser class
class Laser {
  constructor(x, y, vx, vy, color = '#00f0ff', damage = 1, width = 4, height = 16, piercing = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    
    // Cheat Rainbow or Saucer skin projectile overrides
    if (vy < 0 && cheatRainbow) {
      this.color = `hsl(${Math.floor(frameNow / 4) % 360}, 100%, 60%)`;
    } else if (vy < 0 && selectedSkin === 'saucer') {
      this.color = '#bd00ff';
    } else {
      this.color = color;
    }
    
    this.damage = damage;
    this.width = (vy < 0 && selectedSkin === 'saucer') ? 12 : width;
    this.height = (vy < 0 && selectedSkin === 'saucer') ? 12 : height;
    this.piercing = piercing;
  }

  update(isPlayerLaser = false, dt) {
    let mult = 1.0;
    if (bulletTimeActive && !isPlayerLaser) {
      mult = 0.4;
    }

    // Scale enemy bullet speed by difficulty
    if (!isPlayerLaser) {
      if (selectedDifficulty === 'cadet') {
        mult *= 0.7; // 30% slower
      } else if (selectedDifficulty === 'elite') {
        mult *= 1.25; // 25% faster
      }
    }

    // dt-normalised so lasers travel at the same on-screen speed
    // on 60/144 Hz displays. Defaults to 1.0 mult when dt isn't
    // supplied (back-compat with any caller still on the old API).
    const dtMult = (dt || 16.667) / 16.667;
    this.x += this.vx * mult * dtMult;
    this.y += this.vy * mult * dtMult;
  }

  draw() {
    // shadowBlur was the dominant per-frame cost on Laser draws — with
    // 60+ lasers on screen during Triple Shot + Rapid Fire, the offscreen
    // Gaussian-blur rasterise per laser was burning 5-10% of frame time.
    // Replaced with a cheap halo overdraw: a wider faint coloured pass
    // behind the bright core. Same visual punch, ~10× faster.
    if (this.width === this.height) {
      // Energy ring projectile (saucer skin / piercing tier-5 cores).
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4.5;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standard rectangular laser — halo + core pass.
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(this.x - this.width / 2 - 2, this.y - this.height / 2 - 2,
                   this.width + 4, this.height + 4);
      ctx.globalAlpha = 1;
      ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2,
                   this.width, this.height);
    }
  }

  isOutOfBounds() {
    return this.y < -30 || this.y > CONFIG.height + 30 || this.x < -30 || this.x > CONFIG.width + 30;
  }
}

// Splitting Physics-Based Asteroid Class
class Asteroid {
  constructor(x, y, size = 'large', vx = null, vy = null) {
    this.x = x;
    this.y = y;
    this.size = size; // 'large', 'medium', 'small'
    this.vy = vy !== null ? vy : Math.random() * 1.5 + 1.2;
    this.vx = vx !== null ? vx : (Math.random() * 1.5 - 0.75);
    
    this.spin = 0;
    this.spinSpeed = Math.random() * 0.04 - 0.02;

    if (size === 'large') {
      this.radius = 35;
      this.maxHealth = 4;
      this.scoreValue = 300;
      this.color = '#00f0ff'; // Neon ice blue rocks
    } else if (size === 'medium') {
      this.radius = 22;
      this.maxHealth = 2;
      this.scoreValue = 150;
      this.color = '#ff00aa'; // Pink
    } else if (size === 'small') {
      this.radius = 12;
      this.maxHealth = 1;
      this.scoreValue = 75;
      this.color = '#ffea00'; // Yellow
    }

    this.health = this.maxHealth;
    this.width = this.radius * 2;
    this.height = this.radius * 2;
  }

  update(dt) {
    // dt-scaled for refresh-rate independence (was tied to rAF cadence).
    const m = (dt || 16.667) / 16.667;
    this.x += this.vx * m;
    this.y += this.vy * m;
    this.spin += this.spinSpeed * m;

    // Bounce horizontally off side walls
    if (this.x < this.radius || this.x > CONFIG.width - this.radius) {
      this.vx = -this.vx;
    }
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#050314';
    ctx.lineWidth = 2.0;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    
    // Draw rigid multi-sided vector asteroid outline
    ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      // Stagger radius to create rough rocky shapes
      const variance = 0.8 + (Math.sin(i * 1.7) * 0.15);
      const rx = Math.cos(angle) * this.radius * variance;
      const ry = Math.sin(angle) * this.radius * variance;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cracks details
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-this.radius/3, this.radius/4);
    ctx.moveTo(0,0);
    ctx.lineTo(this.radius/2, -this.radius/3);
    ctx.stroke();

    ctx.restore();
  }

  takeDamage(amount) {
    this.health -= amount;
    floatingTexts.push(new FloatingText(this.x, this.y, `-${amount}`, this.color));
    
    if (this.health <= 0) {
      return true;
    }
    GameAudio.playHitSound();
    return false;
  }
}

// Enemy Spacecraft class
class Enemy {
  constructor(x, y, type = 'scout', offset = 0) {
    this.x = x;
    this.y = y;
    this.type = type; // 'scout', 'swarmer', 'kamikaze', 'phase', 'heatSeeker', 'boss', 'boss2', 'sandworm'
    this.offset = offset;
    this.shootTimer = Math.random() * 2000;
    this.stunTimer = 0;
    
    this.maxHealth = 1;
    this.scoreValue = 100;
    this.width = 30;
    this.height = 25;
    this.color = '#ff00aa';
    this.speed = 1;
    this.phase = Math.random() * Math.PI;

    // Boss & Sandworm parameters
    this.bossDirection = 1;
    this.teleportTimer = 0;
    this.alpha = 1.0; // Phase ships transparency
    this.shieldActive = false; // Sandworm shields

    if (type === 'scout') {
      this.maxHealth = 1;
      this.scoreValue = 150;
      this.color = '#ff00aa';
      this.width = 32;
      this.height = 26;
      this.speed = 1.6;
    } else if (type === 'swarmer') {
      this.maxHealth = 3;
      this.scoreValue = 350;
      this.color = '#ffea00';
      this.width = 36;
      this.height = 32;
      this.speed = 1.0;
    } else if (type === 'kamikaze') {
      this.maxHealth = 1;
      this.scoreValue = 250;
      this.color = '#ff003c';
      this.width = 28;
      this.height = 28;
      this.speed = 2.8;
    } else if (type === 'phase') { // Level 6 Quantum phase ship
      this.maxHealth = 2;
      this.scoreValue = 400;
      this.color = '#00f0ff';
      this.width = 34;
      this.height = 28;
      this.speed = 1.4;
    } else if (type === 'heatSeeker') { // Level 7 tracking laser shooter
      this.maxHealth = 2;
      this.scoreValue = 500;
      this.color = '#8b00ff';
      this.width = 38;
      this.height = 32;
      this.speed = 1.1;
    } else if (type === 'boss') { // Sector 5 Boss Dreadnought
      this.maxHealth = 60 + currentLevel * 15;
      this.scoreValue = 5000;
      this.color = '#8b00ff';
      this.width = 160;
      this.height = 90;
      this.speed = 1.3;
    } else if (type === 'boss2') { // Sector 10 Boss Cyber Commander
      this.maxHealth = 100 + currentLevel * 20;
      this.scoreValue = 10000;
      this.color = '#ff003c';
      this.width = 180;
      this.height = 100;
      this.speed = 1.5;
    } else if (type === 'sandworm') { // Sector 15 Dune Sandworm Serpentine Boss
      this.maxHealth = 150;
      this.scoreValue = 20000;
      this.color = '#ffb700'; // Gold Sandworm
      this.width = 90;
      this.height = 90;
      this.speed = 2.4;
      this.serpentinePhase = 0;
    } else if (type === 'shieldBlocker') {
      this.maxHealth = 4;
      this.scoreValue = 400;
      this.color = '#00f0ff';
      this.width = 34;
      this.height = 28;
      this.speed = 1.0;
    } else if (type === 'sniper') {
      this.maxHealth = 2;
      this.scoreValue = 500;
      this.color = '#ff003c';
      this.width = 32;
      this.height = 26;
      this.speed = 0.7;
      this.chargeTimer = 0;
    } else if (type === 'lightCycle') {
      this.maxHealth = 2;
      this.scoreValue = 300;
      this.color = '#00f0ff';
      this.width = 32;
      this.height = 24;
      this.speed = 1.8;
      this.directionX = (Math.random() < 0.5 ? -1 : 1);
      this.trail = [];
      this.trailTimer = 0;
    } else if (type === 'sentry') {
      this.maxHealth = 3;
      this.scoreValue = 400;
      this.color = '#ffea00';
      this.width = 36;
      this.height = 20;
      this.speed = 0;
      this.angle = Math.PI / 2;
      this.sweepDirection = 1;
      this.shootCooldown = 0;
    } else if (type === 'unicron') {
      this.maxHealth = 300;
      this.scoreValue = 30000;
      this.color = '#ffea00';
      this.width = 220;
      this.height = 140;
      this.speed = 0.8;
      this.bossDirection = 1;
      this.phase2 = false;
    }

    this.health = this.maxHealth;
    // Pre-compute the boss flag once at construction so collision code
    // doesn't have to do `enemy.type.startsWith('boss') || === 'sandworm'
    // || === 'unicron'` 4× per damage event + per asteroid-vs-enemy pair
    // (was a hot path on Lvl 9 / endless / boss fights).
    this.isBoss = (type === 'boss' || type === 'boss2' || type === 'sandworm' || type === 'unicron');
  }

  update(dt) {
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    this.phase += 0.035;

    // Movement Behavior AI based on type
    if (this.type === 'scout') {
      this.y += this.speed * 0.8;
      this.x += Math.sin(this.phase) * 1.5;
    } 
    else if (this.type === 'swarmer') {
      this.y += this.speed * 0.55;
      this.x += Math.sin(this.phase * 0.5) * 0.6;
    } 
    else if (this.type === 'kamikaze') {
      this.y += this.speed;
      if (player && this.y < player.y - 120) {
        const targetDx = player.x + player.width / 2 - this.x;
        this.x += Math.sign(targetDx) * 1.4;
      }
    } 
    else if (this.type === 'phase') {
      // Slowly drift down, occasionally fading out of visibility
      this.y += this.speed * 0.7;
      this.x += Math.sin(this.phase * 0.8) * 1.8;
      this.alpha = 0.2 + Math.abs(Math.sin(this.phase * 2)) * 0.8;
    } 
    else if (this.type === 'heatSeeker') {
      // Slowly swoops, homing coordinates
      this.y += this.speed * 0.6;
      this.x += Math.sin(this.phase) * 1.2;
    } 
    else if (this.type === 'boss' || this.type === 'boss2') {
      // Horizontal hover loops
      this.x += this.speed * this.bossDirection;
      if (this.x < 40) {
        this.x = 40;
        this.bossDirection = 1;
      }
      if (this.x > CONFIG.width - this.width - 40) {
        this.x = CONFIG.width - this.width - 40;
        this.bossDirection = -1;
      }
      this.y = 80 + Math.sin(this.phase) * 12;
    } 
    else if (this.type === 'sandworm') {
      // Serpentine wavy flying maneuvers across canvas!
      this.serpentinePhase += 0.02;
      this.x = CONFIG.width / 2 - this.width / 2 + Math.sin(this.serpentinePhase * 2) * (CONFIG.width / 2 - 80);
      this.y = 120 + Math.cos(this.serpentinePhase) * 60;
      
      // Dune sandworm shield flashes periodically
      this.shieldActive = Math.sin(this.serpentinePhase * 4) > 0.4;
    } 
    else if (this.type === 'shieldBlocker') {
      this.y += this.speed * 0.7;
    } 
    else if (this.type === 'sniper') {
      if (this.y < 120) {
        this.y += this.speed * 1.2;
      }
      if (player) {
        const targetDx = player.x + player.width / 2 - (this.x + this.width / 2);
        this.x += Math.sign(targetDx) * 0.9;
      }
      let mult = bulletTimeActive ? 0.4 : 1.0;
      this.chargeTimer += dt * mult;
      if (this.chargeTimer >= 1800) {
        this.shoot();
        this.chargeTimer = 0;
      }
    } 
    else if (this.type === 'lightCycle') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      this.y += this.speed * 0.5 * mult;
      this.x += this.speed * this.directionX * 1.5 * mult;
      if (this.x < 15) {
        this.x = 15;
        this.directionX = 1;
      }
      if (this.x > CONFIG.width - this.width - 15) {
        this.x = CONFIG.width - this.width - 15;
        this.directionX = -1;
      }
    } 
    else if (this.type === 'sentry') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      const sweepSpeed = 0.008 * mult;
      this.angle += sweepSpeed * this.sweepDirection;
      if (this.angle > (Math.PI * 3) / 4) {
        this.angle = (Math.PI * 3) / 4;
        this.sweepDirection = -1;
      }
      if (this.angle < Math.PI / 4) {
        this.angle = Math.PI / 4;
        this.sweepDirection = 1;
      }
    } 
    else if (this.type === 'unicron') {
      let mult = bulletTimeActive ? 0.4 : 1.0;
      this.x += this.speed * this.bossDirection * mult;
      if (this.x < 40) {
        this.x = 40;
        this.bossDirection = 1;
      }
      if (this.x > CONFIG.width - this.width - 40) {
        this.x = CONFIG.width - this.width - 40;
        this.bossDirection = -1;
      }
      this.y = 80 + Math.sin(this.phase * 0.5) * 8;
      
      if (this.health <= this.maxHealth / 2) {
        this.phase2 = true;
        this.color = '#ff003c';
        this.speed = 1.3;
      }
      
      if (this.phase2 && player && gameActive && !gamePaused) {
        const mx = this.x + this.width / 2;
        const my = this.y + this.height * 0.7;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = mx - px;
        const dy = my - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 20) {
          const pullStrength = 0.08 * mult;
          player.vx += (dx / dist) * pullStrength;
          if (player.y > 220) {
            player.y += (dy / dist) * pullStrength * 1.5;
          }
        }
      }
    }

    // Firing checks
    if (gameActive && this.type !== 'kamikaze' && this.type !== 'sniper' && this.type !== 'sentry') {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shoot();
        
        let baseTimer = 2200 + Math.random() * 2500;
        if (this.type === 'boss' || this.type === 'boss2') {
          baseTimer = 1400 - currentLevel * 80;
        } else if (this.type === 'sandworm') {
          baseTimer = 800; // Super fast firing rate
        }
        
        if (selectedDifficulty === 'cadet') {
          baseTimer *= 1.35; // 35% slower reload
        } else if (selectedDifficulty === 'elite') {
          baseTimer *= 0.8; // 20% faster reload
        }
        this.shootTimer = baseTimer;
      }
    }
  }

  shoot() {
    if (this.y < 30 || this.y > CONFIG.height - 120) return;

    if (this.type === 'boss') {
      GameAudio.playBossLaserSound();
      const centerX = this.x + this.width / 2;
      const bottomY = this.y + this.height - 10;
      enemyLasers.push(new Laser(centerX - 40, bottomY, -1.8, 6, '#8b00ff'));
      enemyLasers.push(new Laser(centerX - 10, bottomY, 0, 7, '#ff003c'));
      enemyLasers.push(new Laser(centerX + 10, bottomY, 0, 7, '#ff003c'));
      enemyLasers.push(new Laser(centerX + 40, bottomY, 1.8, 6, '#8b00ff'));
    } 
    else if (this.type === 'boss2') {
      GameAudio.playBossLaserSound();
      const centerX = this.x + this.width / 2;
      const bottomY = this.y + this.height - 10;
      
      // Cyber commander shoots circular waves of lasers (5 lasers radial sweep)
      enemyLasers.push(new Laser(centerX, bottomY, 0, 7.5, '#ff003c'));
      enemyLasers.push(new Laser(centerX, bottomY, -2.5, 6.5, '#ff003c'));
      enemyLasers.push(new Laser(centerX, bottomY, 2.5, 6.5, '#ff003c'));
      enemyLasers.push(new Laser(centerX, bottomY, -4.5, 4.5, '#8b00ff'));
      enemyLasers.push(new Laser(centerX, bottomY, 4.5, 4.5, '#8b00ff'));
    } 
    else if (this.type === 'sandworm') {
      GameAudio.playBossLaserSound();
      // Dune Sandworm fires golden plasma cascade
      enemyLasers.push(new Laser(this.x + this.width/2, this.y + this.height, 0, 7, '#ffb700'));
      enemyLasers.push(new Laser(this.x + this.width/2, this.y + this.height, -1.5, 6.5, '#ffb700'));
      enemyLasers.push(new Laser(this.x + this.width/2, this.y + this.height, 1.5, 6.5, '#ffb700'));
    } 
    else if (this.type === 'heatSeeker') {
      // Fires heat-seeking bullet that moves with horizontal angle towards player's current X
      let targetDx = 0;
      if (player) {
        const dx = player.x + player.width/2 - this.x;
        targetDx = Math.sign(dx) * 1.5;
      }
      enemyLasers.push(new Laser(this.x + this.width / 2, this.y + this.height, targetDx, 5, '#ff00aa'));
    }
    else if (this.type === 'sniper') {
      GameAudio.playLaserSound(0.5); // deep charge shot
      const sx = this.x + this.width / 2;
      const sy = this.y + this.height - 4;
      enemyLasers.push(new Laser(sx, sy, 0, 11, '#ff003c', 2, 8, 22));
      for (let i = 0; i < 8; i++) {
        const spark = new Particle(sx, sy, '#ff003c');
        spark.vy = Math.random() * -3 - 1;
        particles.push(spark);
      }
    }
    else if (this.type === 'unicron') {
      GameAudio.playBossLaserSound();
      const centerX = this.x + this.width / 2;
      const bottomY = this.y + this.height - 15;
      
      if (!this.phase2) {
        const bulletCount = 7;
        const speed = 6.5;
        const spreadAngle = Math.PI / 1.5;
        for (let i = 0; i < bulletCount; i++) {
          const angle = Math.PI / 2 - spreadAngle / 2 + (i / (bulletCount - 1)) * spreadAngle;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          enemyLasers.push(new Laser(centerX, bottomY, vx, vy, '#ffea00'));
        }
        
        if (player) {
          const dx = player.x + player.width/2 - centerX;
          const dy = player.y + player.height/2 - bottomY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 0) {
            enemyLasers.push(new Laser(centerX, bottomY, (dx / dist) * 5.5, (dy / dist) * 5.5, '#8b00ff'));
          }
        }
      } else {
        const bulletCount = 9;
        const speed = 7.5;
        const spreadAngle = Math.PI / 1.2;
        for (let i = 0; i < bulletCount; i++) {
          const angle = Math.PI / 2 - spreadAngle / 2 + (i / (bulletCount - 1)) * spreadAngle;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          enemyLasers.push(new Laser(centerX, bottomY, vx, vy, '#ff003c'));
        }
        
        if (asteroids.length < 12) {
          asteroids.push(new Asteroid(centerX + (Math.random() * 40 - 20), bottomY + 20, 'medium', Math.random() * 2.4 - 1.2, 3));
        }
      }
    }
    else {
      // Standard small lasers
      enemyLasers.push(new Laser(this.x + this.width / 2, this.y + this.height, 0, 5.2, this.color));
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#060312';
    ctx.lineWidth = 2.0;

    if (this.type === 'boss') {
      // Dreadnought shape
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width / 2 + 35, this.y + this.height - 20);
      ctx.lineTo(this.x + this.width - 25, this.y + this.height - 10);
      ctx.lineTo(this.x + this.width, this.y + 15);
      ctx.lineTo(this.x + this.width - 40, this.y);
      ctx.lineTo(this.x + 40, this.y);
      ctx.lineTo(this.x, this.y + 15);
      ctx.lineTo(this.x + 25, this.y + this.height - 10);
      ctx.lineTo(this.x + this.width / 2 - 35, this.y + this.height - 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Energy core
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + 35, 16 + Math.sin(this.phase * 2) * 4, 0, Math.PI * 2);
      ctx.fill();
    } 
    else if (this.type === 'boss2') {
      // Cyber Commander flagship (sharp red outline)
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width - 15, this.y + this.height - 30);
      ctx.lineTo(this.x + this.width, this.y + 20);
      ctx.lineTo(this.x + this.width - 20, this.y);
      ctx.lineTo(this.x + 20, this.y);
      ctx.lineTo(this.x, this.y + 20);
      ctx.lineTo(this.x + 15, this.y + this.height - 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shield wings lines
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.x + 30, this.y + 20, this.width - 60, 4);
    } 
    else if (this.type === 'sandworm') {
      // Serpentine Dune sandworm visual segmented body
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Golden outer rings
      ctx.strokeStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 40, 0, Math.PI * 2);
      ctx.stroke();

      // Inner maw
      ctx.fillStyle = '#ff003c';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 14 + Math.sin(this.phase * 3) * 3, 0, Math.PI * 2);
      ctx.fill();

      // Shield indicator ring if active
      if (this.shieldActive) {
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 48, 0, Math.PI * 2);
        ctx.stroke();
      }
    } 
    else if (this.type === 'shieldBlocker') {
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width, this.y + 4);
      ctx.lineTo(this.x + this.width - 6, this.y);
      ctx.lineTo(this.x + 6, this.y);
      ctx.lineTo(this.x, this.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height + 6, this.width / 2 + 4, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.restore();
    }
    else if (this.type === 'sniper') {
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width, this.y);
      ctx.lineTo(this.x, this.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x + this.width / 2 - 3, this.y + this.height, 6, 6);
      
      if (player && gameActive && !gamePaused) {
        ctx.save();
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const sx = this.x + this.width / 2;
        const sy = this.y + this.height;
        
        const progress = this.chargeTimer / 1800;
        ctx.strokeStyle = `rgba(255, ${Math.floor(255 * progress)}, ${Math.floor(60 * progress)}, ${0.15 + progress * 0.65})`;
        ctx.shadowColor = '#ff003c';
        ctx.shadowBlur = progress * 10;
        ctx.lineWidth = 1 + progress * 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.restore();
      }
    }
    else if (this.type === 'lightCycle') {
      if (this.trail && this.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let t = 1; t < this.trail.length; t++) {
          ctx.lineTo(this.trail[t].x, this.trail[t].y);
        }
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(this.x + 8, this.y + this.height / 2, 6, 0, Math.PI * 2);
      ctx.arc(this.x + this.width - 8, this.y + this.height / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(this.x + 6, this.y + 6);
      ctx.lineTo(this.x + this.width - 6, this.y + 6);
      ctx.lineTo(this.x + this.width - 2, this.y + this.height - 6);
      ctx.lineTo(this.x + 2, this.y + this.height - 6);
      ctx.closePath();
      ctx.stroke();
    }
    else if (this.type === 'sentry') {
      const sx = this.x + this.width / 2;
      const sy = this.y + this.height / 2;
      
      ctx.fillStyle = '#1c1a27';
      ctx.fillRect(this.x, this.y, this.width, 6);
      ctx.strokeRect(this.x, this.y, this.width, 6);
      
      ctx.beginPath();
      ctx.moveTo(sx - 4, this.y + 6);
      ctx.lineTo(sx - 4, sy);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx + 4, this.y + 6);
      ctx.stroke();
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.angle);
      
      const coneLength = 320;
      const coneHalfSpread = Math.PI / 12;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(coneHalfSpread) * coneLength, Math.sin(coneHalfSpread) * coneLength);
      ctx.lineTo(Math.cos(-coneHalfSpread) * coneLength, Math.sin(-coneHalfSpread) * coneLength);
      ctx.closePath();
      
      const isLocked = this.detected;
      let coneGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, coneLength);
      if (isLocked) {
        coneGrad.addColorStop(0, 'rgba(255, 0, 60, 0.45)');
        coneGrad.addColorStop(1, 'rgba(255, 0, 60, 0.0)');
        ctx.fillStyle = coneGrad;
      } else {
        coneGrad.addColorStop(0, 'rgba(255, 234, 0, 0.22)');
        coneGrad.addColorStop(1, 'rgba(255, 234, 0, 0.0)');
        ctx.fillStyle = coneGrad;
      }
      ctx.fill();
      
      ctx.restore();
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.angle);
      ctx.strokeStyle = this.color;
      ctx.fillStyle = '#0f0c1b';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(0, -2, 14, 4);
      ctx.strokeRect(0, -2, 14, 4);
      ctx.restore();
    }
    else if (this.type === 'unicron') {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height * 0.4;
      const radius = 62;
      
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy - radius + 15);
      ctx.quadraticCurveTo(cx - 85, cy - radius - 20, cx - 110, cy - radius + 25);
      ctx.quadraticCurveTo(cx - 80, cy - radius + 10, cx - radius + 4, cy - 20);
      
      ctx.moveTo(cx + 30, cy - radius + 15);
      ctx.quadraticCurveTo(cx + 85, cy - radius - 20, cx + 110, cy - radius + 25);
      ctx.quadraticCurveTo(cx + 80, cy - radius + 10, cx + radius - 4, cy - 20);
      ctx.stroke();
      
      ctx.fillStyle = '#100b1d';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.save();
      ctx.strokeStyle = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowColor = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - radius + 5);
      ctx.lineTo(cx - 20, cy + radius - 25);
      ctx.moveTo(cx + 20, cy - radius + 5);
      ctx.lineTo(cx + 20, cy + radius - 25);
      ctx.moveTo(cx - radius + 10, cy - 15);
      ctx.lineTo(cx + radius - 10, cy - 15);
      ctx.moveTo(cx - radius + 10, cy + 15);
      ctx.lineTo(cx + radius - 10, cy + 15);
      ctx.stroke();
      ctx.restore();
      
      const mawRadius = this.phase2 ? 24 + Math.sin(this.phase * 5) * 5 : 14 + Math.sin(this.phase * 2) * 2;
      ctx.save();
      ctx.fillStyle = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowColor = this.phase2 ? '#ff003c' : '#ff7a00';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(cx, cy + 25, mawRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + 25, mawRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      if (this.phase2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 60, 0.7)';
        ctx.shadowColor = '#ff003c';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 2.0;
        const voidRing = (frameNow / 15) % 110;
        ctx.beginPath();
        ctx.arc(cx, cy + 25, voidRing, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    else {
      // Standard small alien shapes
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x + this.width, this.y);
      ctx.lineTo(this.x + this.width / 2, this.y + 6);
      ctx.lineTo(this.x, this.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Health bar above for Bosses
    if (this.type === 'boss' || this.type === 'boss2' || this.type === 'sandworm' || this.type === 'unicron') {
      const barW = this.width;
      const barH = 6;
      const fillW = barW * (this.health / this.maxHealth);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(this.x, this.y - 18, barW, barH);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y - 18, fillW, barH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(this.x, this.y - 18, barW, barH);
    }

    ctx.restore();
  }

  takeDamage(amount) {
    if (this.type === 'sandworm' && this.shieldActive) {
      // Sandworm shield active - absorbs damage
      floatingTexts.push(new FloatingText(this.x + this.width/2, this.y, 'BLOCKED', '#00f0ff'));
      GameAudio.playHitSound();
      return false;
    }

    this.health -= amount;
    floatingTexts.push(new FloatingText(this.x + this.width / 2, this.y, `-${amount}`, this.color));
    
    if (this.health <= 0) {
      return true;
    }
    GameAudio.playHitSound();
    return false;
  }
}

// Organic Hatching Pod Egg class (Level 12 Alien theme)
class HatchingPod {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 38;
    this.height = 42;
    this.vy = 1.0;
    this.vx = Math.random() * 0.8 - 0.4;
    this.color = '#39ff14'; // Pulsing green eggs
    this.health = 2;
    this.phase = Math.random() * Math.PI;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.phase += 0.05;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#030d04';
    ctx.lineWidth = 2.0;

    // Draw pulsing oval pod
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    ctx.scale(1.0 + Math.sin(this.phase) * 0.05, 1.0);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Petal lips details top
    ctx.fillStyle = '#ff00aa';
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(0, -18, 8, -12);
    ctx.quadraticCurveTo(0, -6, -8, -12);
    ctx.fill();

    ctx.restore();
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) return true;
    GameAudio.playHitSound();
    return false;
  }
}

// Glowing nanotech green scrap drops
class ScrapCredit {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 12;
    this.height = 12;
    this.vy = 1.5;
    this.vx = Math.random() * 2 - 1;
    this.color = '#39ff14'; // Neon Green
    this.phase = Math.random() * Math.PI;
  }

  update() {
    // Magnetism pull to Player ship
    if (player) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      const dx = px - this.x;
      const dy = py - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (playerUpgrades.magnet > 0 && dist < 240) { // Magnet radius 240px
        const magnetSpeed = 8.5;
        this.vx += (dx / dist) * magnetSpeed - this.vx;
        this.vy += (dy / dist) * magnetSpeed - this.vy;
      } else {
        // Slow float
        this.vx *= 0.95;
        this.vy = 1.5;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    this.phase += 0.08;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.phase);
    
    // Draw spinning gear/screw shape
    ctx.fillRect(-4, -4, 8, 8);
    ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

// Floating Golden Spice Clouds (Level 15 Dune Theme)
class SpiceCloud {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = Math.random() * 10 + 15;
    this.vy = 1.2;
    this.vx = Math.random() * 0.6 - 0.3;
    this.color = '#ffea00'; // Shimmering Gold
    this.phase = Math.random() * Math.PI;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.phase += 0.03;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(this.phase) * 0.15;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Indestructible Monolith block shields (Level 14 - 2001 Space Odyssey)
class Monolith {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 50;
    this.height = 110; // Tall rectangular slab
    this.vy = 1.2;
    this.vx = 0;
    this.color = '#000'; // Completely Pitch Black!
  }

  update() {
    this.y += this.vy;
  }

  draw() {
    ctx.save();
    // High-tech thin cybernetic borders
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 1.5;
    
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    
    // Core glowing monolith central circuit strip
    ctx.fillStyle = '#ff003c';
    ctx.fillRect(this.x + this.width/2 - 1, this.y + 10, 2, this.height - 20);
    ctx.restore();
  }
}

// Side wall glowing defense turrets (Level 11 Trench Run)
class WallTurret {
  constructor(x, y, side = 'left') {
    this.x = x;
    this.y = y;
    this.side = side;
    this.width = 24;
    this.height = 36;
    this.color = '#39ff14'; // Neon Green
    this.shootTimer = 1000 + Math.random() * 2000;
  }

  update(dt) {
    this.y += 1.8; // Grid scroll speed match
    
    if (gameActive && !gamePaused) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shoot();
        this.shootTimer = 1800 + Math.random() * 1500;
      }
    }
  }

  shoot() {
    if (this.y < 30 || this.y > CONFIG.height - 120) return;
    
    GameAudio.playBossLaserSound();
    // Fires horizontal laser beams sweeping from walls!
    const vxDir = this.side === 'left' ? 7.5 : -7.5;
    enemyLasers.push(new Laser(this.x + (this.side === 'left' ? 24 : -6), this.y + 18, vxDir, 0, '#ff003c'));
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#050c05';
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    if (this.side === 'left') {
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.width, this.y + 10);
      ctx.lineTo(this.x + this.width, this.y + this.height - 10);
      ctx.lineTo(this.x, this.y + this.height);
    } else {
      ctx.moveTo(this.x + this.width, this.y);
      ctx.lineTo(this.x, this.y + 10);
      ctx.lineTo(this.x, this.y + this.height - 10);
      ctx.lineTo(this.x + this.width, this.y + this.height);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Turret cannon nozzle pointing inwards
    ctx.strokeStyle = '#ff003c';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    if (this.side === 'left') {
      ctx.moveTo(this.x + this.width, this.y + 18);
      ctx.lineTo(this.x + this.width + 12, this.y + 18);
    } else {
      ctx.moveTo(this.x, this.y + 18);
      ctx.lineTo(this.x - 12, this.y + 18);
    }
    ctx.stroke();

    ctx.restore();
  }
}

// Floating Capsules Powerup
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'TRIPLE_SHOT', 'SHIELD', 'RAPID_FIRE', 'BOMB'
    this.width = 24;
    this.height = 24;
    this.speed = 1.8;
    this.color = '#39ff14';
    this.label = 'P';
    this.phase = 0;

    if (type === 'TRIPLE_SHOT') { this.color = '#ffea00'; this.label = 'T'; }
    else if (type === 'SHIELD') { this.color = '#ff00aa'; this.label = 'S'; }
    else if (type === 'RAPID_FIRE') { this.color = '#00f0ff'; this.label = 'R'; }
    else if (type === 'BOMB') { this.color = '#8b00ff'; this.label = '💣'; }
  }

  update() {
    this.y += this.speed;
    this.phase += 0.05;
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2.0;

    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y + Math.sin(this.phase) * 2);
    ctx.lineTo(this.x + this.width, this.y + this.height / 2 + Math.sin(this.phase) * 2);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height + Math.sin(this.phase) * 2);
    ctx.lineTo(this.x, this.y + this.height / 2 + Math.sin(this.phase) * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2 + Math.sin(this.phase) * 2);

    ctx.restore();
  }
}

// Particle System Element (sparks/debris)
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 2.5 + 1;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4.5 + 1.5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    this.alpha = 1.0;
    this.decay = Math.random() * 0.02 + 0.015;
    this.gravity = 0.06;
  }

  update(dt) {
    // dt-normalised integration — keeps particles consistent across
    // 60/144 Hz displays and prevents the 'slow frame keeps particles on
    // screen longer → next frame even slower → snowball' feedback loop.
    const m = (dt || 16.667) / 16.667;
    this.x += this.vx * m;
    this.y += this.vy * m;
    this.vy += this.gravity * m;
    this.alpha -= this.decay * m;
  }

  draw() {
    // Pseudo-glow without shadowBlur: a soft halo at lower alpha behind
    // a bright core. Visually similar to a shadowBlur=6 fill but ~10×
    // cheaper — shadowBlur forces an offscreen rasterise + Gaussian
    // blur per particle. With 200-400 particles on screen during heavy
    // combat / boss kills, this is the single biggest frame-time win.
    ctx.globalAlpha = this.alpha * 0.35;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Vector Debris polygonal shard explosion particle
class Debris {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3.2 + 1.2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    this.points = [];
    const sides = Math.floor(Math.random() * 3) + 3; // 3 to 5 sides
    const size = Math.random() * 8 + 4;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      this.points.push({
        x: Math.cos(a) * size,
        y: Math.sin(a) * size
      });
    }
    
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.15;
    this.alpha = 1.0;
    this.decay = Math.random() * 0.012 + 0.01;
  }

  update(dt) {
    let mult = 1.0;
    if (bulletTimeActive) mult = 0.4;
    
    this.x += this.vx * mult;
    this.y += this.vy * mult;
    this.rotation += this.rotSpeed * mult;
    this.alpha -= this.decay * mult;
  }

  draw() {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Halo pass at low alpha (no shadowBlur — see Particle.draw for why).
    ctx.globalAlpha = this.alpha * 0.4;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Bright core pass on top of the halo.
    ctx.globalAlpha = this.alpha;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
}

// Orbiting escort fighter drone wingman
class WingmanDrone {
  constructor(angleOffset = 0) {
    this.angle = angleOffset;
    this.width = 14;
    this.height = 14;
    this.color = '#bd00ff';
    this.lastFireTime = 0;
    this.x = 0;
    this.y = 0;
  }

  update(dt) {
    if (!player) return;
    
    let rotationSpeed = 0.04;
    if (bulletTimeActive) rotationSpeed *= 0.4;
    this.angle += rotationSpeed;
    
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    this.x = px + Math.cos(this.angle) * 45 - this.width / 2;
    this.y = py + Math.sin(this.angle) * 45 - this.height / 2;
    
    if (frameNow - this.lastFireTime > 450) {
      this.fire();
      this.lastFireTime = frameNow;
    }
  }

  fire() {
    if (!gameActive || gamePaused) return;
    playerLasers.push(new Laser(
      this.x + this.width / 2 - 2, 
      this.y - 4, 
      0, 
      -9, 
      '#bd00ff',
      1.1,
      4,
      16,
      false
    ));
    GameAudio.playLaserSound(1.4);
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#110121';
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height * 0.65, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

// Expanding high-voltage tactical electromagnetic pulse shockwave ring
class EMPShockwave {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.maxRadius = 350;
    this.speed = 12;
    this.damage = 2;
    this.hitEnemies = new Set();
    
    GameAudio.playBombSound();
    traumaLevel = Math.min(1.0, traumaLevel + 0.4);

    // Trigger CSS glitch effect — uses cached container ref + debounced
    // timer (same pattern as notifyBaseHit in main.js) so multiple EMP
    // shocks in quick succession don't stack timeouts.
    const container = (typeof getGameContainerEl === 'function')
      ? getGameContainerEl()
      : document.getElementById('game-container');
    if (container) {
      container.classList.add('hit-flash');
      if (this._hitFlashTimer) clearTimeout(this._hitFlashTimer);
      this._hitFlashTimer = setTimeout(() => container.classList.remove('hit-flash'), 400);
    }
  }

  update(dt) {
    let mult = 1.0;
    if (bulletTimeActive) mult = 0.4;
    
    this.radius += this.speed * mult;
    
    // Clear active hostile energy bolts inside expanding ring
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
      const laser = enemyLasers[i];
      const dx = laser.x - this.x;
      const dy = laser.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.radius) {
        for (let j = 0; j < 3; j++) {
          particles.push(new Particle(laser.x, laser.y, laser.color || '#ff00aa'));
        }
        enemyLasers.splice(i, 1);
      }
    }
    
    // Stunning and damaging close enemies
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (this.hitEnemies.has(enemy)) continue;
      
      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const dx = ex - this.x;
      const dy = ey - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= this.radius) {
        this.hitEnemies.add(enemy);
        const destroyed = enemy.takeDamage(this.damage);
        
        for (let j = 0; j < 6; j++) {
          const spark = new Particle(ex + (Math.random() * 20 - 10), ey + (Math.random() * 20 - 10), '#00f0ff');
          spark.vy -= 1;
          particles.push(spark);
        }
        
        if (destroyed) {
          destroyEnemy(enemy, e);
        } else {
          enemy.stunTimer = 1800; // 1.8 seconds stun
        }
      }
    }
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00f0ff';
    ctx.lineWidth = 4 * (1.0 - this.radius / this.maxRadius) + 1;
    ctx.globalAlpha = 1.0 - this.radius / this.maxRadius;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }
}

// Floating Damage Numbers
class FloatingText {
  constructor(x, y, text, color = '#00f0ff') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.vy = -1.2;
    this.alpha = 1.0;
    this.decay = 0.025;
    this.fontSize = 13;
  }

  update() {
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.shadowBlur = 4;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.fontSize}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
