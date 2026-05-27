/* ----------------------------------------------------
   NEON STRIKER - Collisions, Damage, FX Spawners
   Per-frame collision resolution between every pair of
   active entity arrays, plus the damage funnel and
   particle/debris spawn helpers used across the codebase.
   ---------------------------------------------------- */

/* ----------------------------------------------------
   COLLISIONS HANDLING ALGORITHMS
   ---------------------------------------------------- */
function getDistanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const closestX = x1 + clampedT * dx;
  const closestY = y1 + clampedT * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

function spawnDebris(x, y, color) {
  const count = Math.floor(Math.random() * 5) + 6; // 6 to 10 shards
  for (let i = 0; i < count; i++) {
    debrisList.push(new Debris(x, y, color));
  }
}

function triggerPlayerEMP() {
  if (!player) return;
  empShockwaves.push(new EMPShockwave(player.x + player.width / 2, player.y + player.height / 2));
  empCooldownTimer = 8000; // 8 seconds cooldown
}

function destroyEnemy(enemy, eIndex) {
  enemies.splice(eIndex, 1);
  score += enemy.scoreValue;
  GameAudio.playExplosionSound(enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 2.2 : 0.85);
  triggerScreenShake(enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 0.9 : 0.25);
  
  spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 60 : 15);
  spawnDebris(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);

  // Egg Hatch facehugger drones! (Level 12 Alien)
  if (enemy instanceof HatchingPod) {
    spawnFacehuggerDrones(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
  } 
  else {
    // Drop Nanotech scrap credits drops
    const dropCount = enemy.type.startsWith('boss') || enemy.type === 'unicron' ? 12 : enemy.type === 'swarmer' ? 3 : 1;
    for (let d = 0; d < dropCount; d++) {
      scrapItems.push(new ScrapCredit(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
    }

    // Powerups drops chance
    if (Math.random() < 0.12) {
      const types = ['TRIPLE_SHOT', 'SHIELD', 'RAPID_FIRE', 'BOMB'];
      const randType = types[Math.floor(Math.random() * types.length)];
      powerUps.push(new PowerUp(enemy.x + enemy.width/2, enemy.y + enemy.height/2, randType));
    }
  }
}

function handleCollisions() {
  if (!player) return;

  // 1. Player lasers vs Enemies / Eggs
  for (let l = playerLasers.length - 1; l >= 0; l--) {
    const laser = playerLasers[l];
    let hitSomething = false;

    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];

      if (laser.x + laser.width > enemy.x &&
          laser.x - laser.width < enemy.x + enemy.width &&
          laser.y + laser.height > enemy.y &&
          laser.y - laser.height < enemy.y + enemy.height) {
        
        // Frontal deflection check for blockers
        if (enemy.type === 'shieldBlocker' && laser.vy < 0) {
          if (laser.piercing) {
            if (!laser.hitEnemies) laser.hitEnemies = new Set();
            if (!laser.hitEnemies.has(enemy)) {
              laser.hitEnemies.add(enemy);
              floatingTexts.push(new FloatingText(laser.x, laser.y - 10, "DEFLECTED", '#00f0ff'));
              GameAudio.playHitSound();
            }
            continue;
          } else {
            playerLasers.splice(l, 1);
            hitSomething = true;
            floatingTexts.push(new FloatingText(laser.x, laser.y - 10, "DEFLECTED", '#00f0ff'));
            GameAudio.playHitSound();
            break;
          }
        }

        if (laser.piercing) {
          if (!laser.hitEnemies) laser.hitEnemies = new Set();
          if (laser.hitEnemies.has(enemy)) continue;
          laser.hitEnemies.add(enemy);
        } else {
          playerLasers.splice(l, 1);
          hitSomething = true;
        }
        
        const destroyed = enemy.takeDamage(laser.damage || 1);
        spawnSparkParticles(laser.x, laser.y, enemy.color);

        if (destroyed) {
          destroyEnemy(enemy, e);
        }
        if (!laser.piercing) break;
      }
    }

    if (hitSomething) continue;

    // Player lasers vs Asteroids
    for (let a = asteroids.length - 1; a >= 0; a--) {
      const ast = asteroids[a];
      const dist = Math.sqrt(Math.pow(laser.x - ast.x, 2) + Math.pow(laser.y - ast.y, 2));
      
      if (dist < ast.radius + laser.width) {
        if (laser.piercing) {
          if (!laser.hitAsteroids) laser.hitAsteroids = new Set();
          if (laser.hitAsteroids.has(ast)) continue;
          laser.hitAsteroids.add(ast);
        } else {
          playerLasers.splice(l, 1);
        }
        
        const destroyed = ast.takeDamage(laser.damage || 1);
        spawnSparkParticles(laser.x, laser.y, ast.color);

        if (destroyed) {
          asteroids.splice(a, 1);
          score += ast.scoreValue;
          GameAudio.playExplosionSound(ast.size === 'large' ? 1.4 : 0.8);
          triggerScreenShake(ast.size === 'large' ? 0.5 : 0.25);
          
          spawnExplosionParticles(ast.x, ast.y, ast.color, ast.size === 'large' ? 25 : 12);
          spawnDebris(ast.x, ast.y, ast.color);
          
          // Split asteroid physics
          if (ast.size === 'large') {
            asteroids.push(new Asteroid(ast.x - 15, ast.y, 'medium', -1.2, ast.vy + 0.3));
            asteroids.push(new Asteroid(ast.x + 15, ast.y, 'medium', 1.2, ast.vy + 0.3));
          } else if (ast.size === 'medium') {
            asteroids.push(new Asteroid(ast.x - 10, ast.y, 'small', -1.8, ast.vy + 0.5));
            asteroids.push(new Asteroid(ast.x + 10, ast.y, 'small', 1.8, ast.vy + 0.5));
          } else {
            // Drop credits on small ones
            scrapItems.push(new ScrapCredit(ast.x, ast.y));
          }
        }
        if (!laser.piercing) break;
      }
    }
  }

  // 2. Homing Missiles vs Enemies / Asteroids
  for (let m = homingMissiles.length - 1; m >= 0; m--) {
    const missile = homingMissiles[m];
    let exploded = false;

    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      
      if (missile.x > enemy.x && missile.x < enemy.x + enemy.width &&
          missile.y > enemy.y && missile.y < enemy.y + enemy.height) {
        
        homingMissiles.splice(m, 1);
        exploded = true;
        
        const destroyed = enemy.takeDamage(3); // Homing missile deals massive damage
        spawnExplosionParticles(missile.x, missile.y, '#ffea00', 8);

        if (destroyed) {
          destroyEnemy(enemy, e);
        }
        break;
      }
    }

    if (exploded) continue;

    // Homing Missile vs Asteroids
    for (let a = asteroids.length - 1; a >= 0; a--) {
      const ast = asteroids[a];
      const dist = Math.sqrt(Math.pow(missile.x - ast.x, 2) + Math.pow(missile.y - ast.y, 2));
      
      if (dist < ast.radius + 3) {
        homingMissiles.splice(m, 1);
        
        const destroyed = ast.takeDamage(3);
        spawnExplosionParticles(missile.x, missile.y, ast.color, 12);

        if (destroyed) {
          asteroids.splice(a, 1);
          score += ast.scoreValue;
          GameAudio.playExplosionSound(ast.size === 'large' ? 1.4 : 0.8);
          triggerScreenShake(ast.size === 'large' ? 0.5 : 0.25);
          spawnExplosionParticles(ast.x, ast.y, ast.color, ast.size === 'large' ? 25 : 12);
          spawnDebris(ast.x, ast.y, ast.color);
          
          if (ast.size === 'large') {
            asteroids.push(new Asteroid(ast.x - 15, ast.y, 'medium', -1.2, ast.vy + 0.3));
            asteroids.push(new Asteroid(ast.x + 15, ast.y, 'medium', 1.2, ast.vy + 0.3));
          } else if (ast.size === 'medium') {
            asteroids.push(new Asteroid(ast.x - 10, ast.y, 'small', -1.8, ast.vy + 0.5));
            asteroids.push(new Asteroid(ast.x + 10, ast.y, 'small', 1.8, ast.vy + 0.5));
          }
        }
        break;
      }
    }
  }

  // 3. Enemy Lasers vs Player
  for (let l = enemyLasers.length - 1; l >= 0; l--) {
    const laser = enemyLasers[l];
    
    if (laser.x + laser.width > player.x &&
        laser.x - laser.width < player.x + player.width &&
        laser.y + laser.height > player.y &&
        laser.y - laser.height < player.y + player.height) {
      
      enemyLasers.splice(l, 1);
      damagePlayer(15);
    }
  }

  // 4. Floating Scrap Capsule Collection
  for (let s = scrapItems.length - 1; s >= 0; s--) {
    const scrap = scrapItems[s];
    
    if (scrap.x + scrap.width > player.x &&
        scrap.x < player.x + player.width &&
        scrap.y + scrap.height > player.y &&
        scrap.y < player.y + player.height) {
      
      scrapItems.splice(s, 1);
      scrapCredits += 10;
      floatingTexts.push(new FloatingText(scrap.x, scrap.y - 10, "+10 ⚙️", '#39ff14'));
      GameAudio.playHitSound();
    }
  }

  // 5. Spice Clouds collections (Dune)
  for (let p = powerUps.length - 1; p >= 0; p--) {
    const pup = powerUps[p];
    if (pup instanceof SpiceCloud) {
      const dist = Math.sqrt(Math.pow(player.x + player.width/2 - pup.x, 2) + Math.pow(player.y + player.height/2 - pup.y, 2));
      if (dist < pup.radius + 18) {
        powerUps.splice(p, 1);
        GameAudio.playPowerUpSound();
        floatingTexts.push(new FloatingText(player.x + player.width/2, player.y - 15, "SPICE WEAPON OVERCHARGE!", '#ffea00'));
        activePowerUps['RAPID_FIRE'] = 4000;
        activePowerUps['TRIPLE_SHOT'] = 4000;
      }
    } 
    else if (player.x + player.width > pup.x &&
             player.x < pup.x + pup.width &&
             player.y + player.height > pup.y &&
             player.y < pup.y + pup.height) {
      
      powerUps.splice(p, 1);
      applyPowerUp(pup.type);
    }
  }

  // 6. Monolith Slabs Collide and Block Player/Lasers (HAL-9000 level 14)
  for (let m = asteroids.length - 1; m >= 0; m--) {
    const ast = asteroids[m];
    if (ast instanceof Monolith) {
      // Monolith vs Player lasers blocks
      for (let l = playerLasers.length - 1; l >= 0; l--) {
        const laser = playerLasers[l];
        if (laser.x > ast.x && laser.x < ast.x + ast.width &&
            laser.y > ast.y && laser.y < ast.y + ast.height) {
          playerLasers.splice(l, 1);
          spawnSparkParticles(laser.x, laser.y, '#ff003c');
          GameAudio.playHitSound();
        }
      }
      
      // Monolith vs Player Ship bounds collide
      if (player.x + player.width > ast.x && player.x < ast.x + ast.width &&
          player.y + player.height > ast.y && player.y < ast.y + ast.height) {
        damagePlayer(25);
        // Force bounce push-back
        player.vx = player.x + player.width/2 < ast.x + ast.width/2 ? -5 : 5;
      }
    }
  }

  // 7. Physical Asteroids Collisions vs Player / Enemies
  for (let a = asteroids.length - 1; a >= 0; a--) {
    const ast = asteroids[a];
    if (ast instanceof Monolith) continue;
    
    // Asteroid vs Player
    const distPlayer = Math.sqrt(Math.pow(player.x + player.width/2 - ast.x, 2) + Math.pow(player.y + player.height/2 - ast.y, 2));
    if (distPlayer < ast.radius + 18) {
      asteroids.splice(a, 1);
      spawnExplosionParticles(ast.x, ast.y, ast.color, 12);
      damagePlayer(ast.size === 'large' ? 35 : ast.size === 'medium' ? 22 : 12);
      continue;
    }

    // Asteroid vs Enemies physical crash (highly tactical and exciting!)
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (enemy.type.startsWith('boss') || enemy.type === 'sandworm' || enemy.type === 'unicron') continue;

      const distEnemy = Math.sqrt(Math.pow(enemy.x + enemy.width/2 - ast.x, 2) + Math.pow(enemy.y + enemy.height/2 - ast.y, 2));
      if (distEnemy < ast.radius + enemy.width/2) {
        asteroids.splice(a, 1);
        enemies.splice(e, 1);
        
        spawnExplosionParticles(ast.x, ast.y, ast.color, 10);
        spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 10);
        
        GameAudio.playExplosionSound(0.7);
        floatingTexts.push(new FloatingText(ast.x, ast.y, 'COLLISION DESTROY', '#ff003c'));
        break;
      }
    }
  }

  // 8. Wall Conduit Collisions (Trench Run)
  const lvlData = LEVEL_DATABASE[currentLevel] || {};
  if (lvlData.trenchWalls) {
    if (player.x < 205 || player.x + player.width > 595) {
      damagePlayer(2); // Trench wall thermal friction damage
      triggerScreenShake(0.08);
    }
  }
}

function spawnFacehuggerDrones(x, y) {
  GameAudio.playExplosionSound(0.6);
  floatingTexts.push(new FloatingText(x, y, 'HATCHED!', '#39ff14'));
  
  // Spawns 3 ultra-fast facehugger kamikazes charging from hatched egg
  enemies.push(new Enemy(x - 20, y, 'kamikaze'));
  enemies.push(new Enemy(x, y, 'kamikaze'));
  enemies.push(new Enemy(x + 20, y, 'kamikaze'));
}

function damagePlayer(amount) {
  if (cheatGod) {
    floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 20, 'GOD MODE ACTIVE', '#ffffff'));
    GameAudio.playPowerUpSound();
    player.invulnFrames = 30;
    return;
  }

  if (player.invulnFrames > 0) return;

  if (CONFIG.playerShieldActive()) {
    delete activePowerUps['SHIELD'];
    floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 15, 'SHIELD ABSORBED', '#ff00aa'));
    GameAudio.playPowerUpSound();
    player.invulnFrames = 30;
    return;
  }

  health = Math.max(0, health - amount);
  triggerScreenShake(0.5);
  GameAudio.playExplosionSound(0.8);
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff003c', 15);
  player.invulnFrames = 60;

  if (health <= 0) {
    triggerPlayerExplosion();
  }
}

function applyPowerUp(type) {
  GameAudio.playPowerUpSound();
  floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 20, type.replace('_', ' '), '#39ff14'));
  
  if (type === 'BOMB') {
    triggerScreenShake(1.0);
    GameAudio.playBombSound();
    
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (!enemy.type.startsWith('boss') && enemy.type !== 'sandworm') {
        enemies.splice(e, 1);
        score += enemy.scoreValue;
        spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 12);
        
        // Add credits
        scrapItems.push(new ScrapCredit(enemy.x + enemy.width/2, enemy.y + enemy.height/2));
      } else {
        enemy.takeDamage(25);
      }
    }
    enemyLasers = [];
  } 
  else {
    activePowerUps[type] = 8000;
  }
}

function spawnSparkParticles(x, y, color) {
  for (let i = 0; i < 4; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function spawnExplosionParticles(x, y, color, count = 15) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function triggerPlayerExplosion() {
  gameActive = false;
  GameAudio.playBombSound();
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#00f0ff', 50);
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff00aa', 30);
  
  setTimeout(() => {
    showGameOverScreen();
  }, 1200);
}
