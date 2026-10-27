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
  return Math.sqrt(getSquaredDistanceToSegment(px, py, x1, y1, x2, y2));
}

// Squared distance from point to segment. Use for collision *tests* where
// you compare against a radius² constant; avoids the sqrt and ~doubles
// throughput in hot loops like light-cycle trail vs player. Direction
// vectors that need a unit length should still go through getDistance*().
function getSquaredDistanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clampedT = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - (x1 + clampedT * dx);
  const ey = py - (y1 + clampedT * dy);
  return ex * ex + ey * ey;
}

function spawnDebris(x, y, color) {
  const count = Math.floor(Math.random() * 5) + 6; // 6 to 10 shards
  for (let i = 0; i < count; i++) {
    debrisList.push(new Debris(x, y, color));
  }
}

// Freeze the simulation for `ms` (the longest pending stop wins). Used
// sparingly — boss kills, bombs, EMP, taking a hit — never for routine
// kills, which happen constantly and would make the game stutter.
function hitStop(ms) {
  hitStopTimer = Math.max(hitStopTimer, ms);
}

function triggerPlayerEMP() {
  if (!player) return;
  empShockwaves.push(new EMPShockwave(player.x + player.width / 2, player.y + player.height / 2));
  empCooldownTimer = 8000; // 8 seconds cooldown
  padRumble(0.6, 0.9, 260);
  hitStop(50);
}

// Average distance of an asteroid's drawn outline from its centre, as a
// fraction of .radius (Asteroid.draw: 0.8 + sin(i * 1.7) * 0.15 per vertex).
const ASTEROID_DRAWN_RADIUS = 0.8;

// Is point (px, py) inside the player's drawn triangle — nose at top
// centre, wing tips at the bottom corners — grown by `pad` px?
function pointInShip(ship, px, py, pad) {
  if (py < ship.y - pad || py > ship.y + ship.height + pad) return false;
  const t = Math.min(1, Math.max(0, (py - ship.y) / ship.height)); // 0 nose .. 1 wings
  const halfWidth = (ship.width / 2) * t + pad;
  return Math.abs(px - (ship.x + ship.width / 2)) <= halfWidth;
}

// Enemy laser vs ship: the laser is drawn centred on (x, y), width x
// height. Sample its centre and both ends against the ship triangle,
// padded by half the laser's width.
function laserHitsShip(laser, ship) {
  const pad = laser.width / 2;
  const half = laser.height / 2;
  return pointInShip(ship, laser.x, laser.y, pad) ||
         pointInShip(ship, laser.x, laser.y - half, pad) ||
         pointInShip(ship, laser.x, laser.y + half, pad);
}

// A destroyed asteroid breaks into two smaller pieces (large -> medium ->
// small); a small one drops scrap. Shared by the laser and homing-missile
// paths, which had drifted apart (missile kills never dropped scrap).
// Pieces are marked isFragment: they exist because the player shot their
// parent, so letting them drift off-screen doesn't cost shield (see the
// escape check in main.js). Otherwise shooting a rock made things worse:
// one large escaping costs 10, its seven fragments could cost 70.
function splitAsteroid(ast) {
  spawnImpactBurst(ast.x, ast.y, ast.color, ast.radius);
  let pieces = [];
  if (ast.size === 'large') {
    pieces = [new Asteroid(ast.x - 15, ast.y, 'medium', -1.2, ast.vy + 0.3),
              new Asteroid(ast.x + 15, ast.y, 'medium', 1.2, ast.vy + 0.3)];
  } else if (ast.size === 'medium') {
    pieces = [new Asteroid(ast.x - 10, ast.y, 'small', -1.8, ast.vy + 0.5),
              new Asteroid(ast.x + 10, ast.y, 'small', 1.8, ast.vy + 0.5)];
  } else {
    scrapItems.push(new ScrapCredit(ast.x, ast.y));
  }
  for (const p of pieces) {
    p.isFragment = true;
    asteroids.push(p);
  }
}

function destroyEnemy(enemy, eIndex) {
  enemies.splice(eIndex, 1);
  // Combo multiplier — chain kills within 2 s for ×2/×3/×4/×5 score.
  // Bump first so the multiplier reflects this kill's chain position.
  comboKills++;
  comboTimer = COMBO_WINDOW_MS;
  const mult = getComboMultiplier();
  score += enemy.scoreValue * mult;
  // Floating combo flair on milestone hits — at ×2, ×3, ×4, ×5 the player
  // sees a bright tier label pop. Skip ×1 to avoid spam.
  if (mult >= 2 && (comboKills === 3 || comboKills === 7 || comboKills === 12 || comboKills === 20)) {
    floatingTexts.push(new FloatingText(enemy.x + enemy.width / 2, enemy.y - 12, `×${mult} COMBO!`, '#ffea00'));
  }
  if (window.Achievements) Achievements.notify('enemy_destroyed', { type: enemy.type, combo: comboKills });
  if (window.Stats) Stats.notify('enemy_destroyed', { combo: comboKills });
  // Pre-computed isBoss flag (set once in Enemy ctor) replaces the
  // 4× repeated `startsWith('boss') || === 'unicron'` string scans below.
  const big = enemy.isBoss;
  if (big) hitStop(140);
  GameAudio.playExplosionSound(big ? 2.2 : 0.85);
  triggerScreenShake(big ? 0.9 : 0.25);

  spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, big ? 60 : 15);
  spawnDebris(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color);
  spawnImpactBurst(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, big ? 120 : enemy.width);

  // Egg Hatch facehugger drones! (Level 12 Alien)
  if (enemy instanceof HatchingPod) {
    spawnFacehuggerDrones(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
  }
  else {
    // Drop Nanotech scrap credits drops
    const dropCount = big ? 12 : enemy.type === 'swarmer' ? 3 : 1;
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
            // Plain object keyed by entity.id replaces Set — avoids
            // allocator + .has/.add overhead on each pierce/laser pair.
            if (!laser.hitEnemies) laser.hitEnemies = Object.create(null);
            if (!laser.hitEnemies[enemy.id]) {
              laser.hitEnemies[enemy.id] = true;
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
          if (!laser.hitEnemies) laser.hitEnemies = Object.create(null);
          if (laser.hitEnemies[enemy.id]) continue;
          laser.hitEnemies[enemy.id] = true;
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

    // Player lasers vs Asteroids — compare squared distances so we avoid
    // sqrt per (laser × asteroid) per frame.
    for (let a = asteroids.length - 1; a >= 0; a--) {
      const ast = asteroids[a];
      const ldx = laser.x - ast.x;
      const ldy = laser.y - ast.y;
      const reach = ast.radius + laser.width;

      if (ldx * ldx + ldy * ldy < reach * reach) {
        if (laser.piercing) {
          if (!laser.hitAsteroids) laser.hitAsteroids = Object.create(null);
          if (laser.hitAsteroids[ast.id]) continue;
          laser.hitAsteroids[ast.id] = true;
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
          
          splitAsteroid(ast);
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

    // Homing Missile vs Asteroids — squared-distance test.
    for (let a = asteroids.length - 1; a >= 0; a--) {
      const ast = asteroids[a];
      const mdx = missile.x - ast.x;
      const mdy = missile.y - ast.y;
      const reach = ast.radius + 3;

      if (mdx * mdx + mdy * mdy < reach * reach) {
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
          
          splitAsteroid(ast);
        }
        break;
      }
    }
  }

  // 3. Enemy Lasers vs Player — tested against the ship's drawn triangle,
  // using the laser's drawn size. The old test grew each laser by its FULL
  // width / height on every side (lasers are drawn centred, so 2x their
  // real size) against the ship's bounding box, whose top corners beside
  // the nose are empty — shots visibly passing the nose still hit.
  for (let l = enemyLasers.length - 1; l >= 0; l--) {
    const laser = enemyLasers[l];
    
    if (laserHitsShip(laser, player)) {
      
      enemyLasers.splice(l, 1);
      // Heavy bolts (sniper charge shots carry damage 2) hit harder than
      // standard fire — matches their long charge-up telegraph. Previously
      // every enemy laser dealt a flat 15 and the sniper's damage stat was
      // silently ignored.
      damagePlayer(laser.damage >= 2 ? 25 : 15);
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
      if (window.Achievements) Achievements.notify('scrap_collected', { amount: 10 });
      if (window.Stats) Stats.notify('scrap_collected', { amount: 10 });
      floatingTexts.push(new FloatingText(scrap.x, scrap.y - 10, "+10 ⚙️", '#39ff14'));
      GameAudio.playHitSound();
    }
  }

  // 5. Spice Clouds collections (Dune)
  for (let p = powerUps.length - 1; p >= 0; p--) {
    const pup = powerUps[p];
    if (pup instanceof SpiceCloud) {
      const sdx = player.x + player.width / 2 - pup.x;
      const sdy = player.y + player.height / 2 - pup.y;
      const reach = pup.radius + 18;
      if (sdx * sdx + sdy * sdy < reach * reach) {
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
    
    // Asteroid vs Player — squared-distance test. Uses the rock's drawn
    // size: its outline sits at 66-95% of .radius (ASTEROID_DRAWN_RADIUS),
    // so the full radius registered hits ~7px before a large rock visibly
    // touched the ship.
    {
      const pdx = player.x + player.width / 2 - ast.x;
      const pdy = player.y + player.height / 2 - ast.y;
      const pReach = ast.radius * ASTEROID_DRAWN_RADIUS + 18;
      if (pdx * pdx + pdy * pdy < pReach * pReach) {
        asteroids.splice(a, 1);
        spawnExplosionParticles(ast.x, ast.y, ast.color, 12);
        damagePlayer(ast.size === 'large' ? 35 : ast.size === 'medium' ? 22 : 12);
        continue;
      }
    }

    // Asteroid vs Enemies physical crash (highly tactical and exciting!)
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (enemy.isBoss) continue;

      const edx = enemy.x + enemy.width / 2 - ast.x;
      const edy = enemy.y + enemy.height / 2 - ast.y;
      const eReach = ast.radius + enemy.width / 2;
      if (edx * edx + edy * edy < eReach * eReach) {
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
  const lvlData = activeLevelData || {};
  if (lvlData.trenchWalls) {
    if (player.x < trenchLeft() + 5 || player.x + player.width > trenchRight() - 5) {
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
    // A hit absorbed by god mode still counts as "hit" for the damage-free
    // rewards, or invincibility would farm Untouchable and the PERFECT
    // SECTOR bonus every level. Skip during i-frames so a single overlap
    // isn't reported every frame.
    if (player.invulnFrames <= 0) {
      levelDamageTaken = true;
      if (window.Achievements) Achievements.notify('damage_taken', { amount });
    }
    floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 20, 'GOD MODE ACTIVE', '#ffffff'));
    GameAudio.playPowerUpSound();
    player.invulnFrames = 30;
    return;
  }

  if (player.invulnFrames > 0) return;

  if (CONFIG.playerShieldActive()) {
    delete activePowerUps['SHIELD'];
    floatingTexts.push(new FloatingText(player.x + player.width / 2, player.y - 15, 'SHIELD ABSORBED', '#ff00aa'));
    // Distinct alarm vs playPowerUpSound() (the pickup chime) so the
    // player can tell by ear that the shield dropped rather than picked up.
    GameAudio.playShieldDownAlarm();
    player.invulnFrames = 30;
    return;
  }

  // Achievement tracker — flagging that this level is no longer 'untouchable'.
  if (window.Achievements) Achievements.notify('damage_taken', { amount });

  // Reset the combo chain on any damage that actually lands. Players have
  // to play perfectly to keep their multiplier — that's the skill expression.
  comboKills = 0;
  comboTimer = 0;

  // Hull damage landed → this sector no longer qualifies for the
  // PERFECT SECTOR clear bonus (see triggerLevelClear in main.js).
  levelDamageTaken = true;

  health = Math.max(0, health - amount);
  triggerScreenShake(0.5);
  padRumble(0.8, 0.5, 180);
  hitStop(60);
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
    padRumble(1.0, 1.0, 400);
    hitStop(80);
    GameAudio.playBombSound();
    
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      // BOMB clears non-bosses outright; bosses just take 25 dmg (see else).
      if (!enemy.isBoss) {
        enemies.splice(e, 1);
        score += enemy.scoreValue;
        // Bomb kills are real kills: report them like destroyEnemy does, so
        // they count toward the Pilot Profile and kill achievements. They
        // deliberately don't advance the combo (one bomb on a full grid
        // would otherwise jump straight to x5 and multiply its own score).
        if (window.Achievements) Achievements.notify('enemy_destroyed', { type: enemy.type, combo: comboKills });
        if (window.Stats) Stats.notify('enemy_destroyed', { combo: comboKills });
        spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 12);
        
        // Add credits
        scrapItems.push(new ScrapCredit(enemy.x + enemy.width/2, enemy.y + enemy.height/2));
      } else if (enemy.takeDamage(25)) {
        // Same kill path as a laser: the old code ignored this return, so a
        // boss bombed to <=0 HP kept fighting until hit again.
        destroyEnemy(enemy, e);
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

// Explosion accents: an expanding shockwave ring plus fast spark streaks.
// size: radius-ish scale of the thing that blew up (enemy width, rock
// radius, boss ~ 120). Rings are capped so a bomb clearing a full grid
// doesn't stack dozens of them.
const MAX_IMPACT_RINGS = 24;
function spawnImpactBurst(x, y, color, size) {
  if (impactRings.length < MAX_IMPACT_RINGS) {
    impactRings.push(new ImpactRing(x, y, color, Math.min(160, size * 1.6)));
  }
  const streaks = size > 80 ? 14 : 6;
  for (let i = 0; i < streaks; i++) {
    const p = new Particle(x, y, i % 2 ? '#ffffff' : color);
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 4;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.gravity = 0.02;
    p.decay = 0.045;
    p.radius = 1.4;
    p.streak = true;
    particles.push(p);
  }
}

function spawnExplosionParticles(x, y, color, count = 15) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function triggerPlayerExplosion() {
  gameActive = false;
  padRumble(1.0, 1.0, 700);
  GameAudio.playBombSound();
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#00f0ff', 50);
  spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff00aa', 30);
  spawnImpactBurst(player.x + player.width / 2, player.y + player.height / 2, '#00f0ff', 120);
  
  setTimeout(() => {
    showGameOverScreen();
  }, 1200);
}
