const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 40;
const COLS = 20;
const ROWS = 15;

const DIRECTIONS = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

const DIRECTION_VECTORS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
];

function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

class Bullet {
    constructor(x, y, direction, isPlayer) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.speed = isPlayer ? 7 : 5;
        this.isPlayer = isPlayer;
        this.radius = 4;
        this.active = true;
    }

    update() {
        const vec = DIRECTION_VECTORS[this.direction];
        this.x += vec.x * this.speed;
        this.y += vec.y * this.speed;

        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.active = false;
        }
    }

    draw() {
        ctx.save();
        ctx.shadowColor = this.isPlayer ? '#FFEB3B' : '#FF5722';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isPlayer ? '#FFEB3B' : '#FF5722';
        ctx.fill();
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x - this.radius,
            y: this.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
    }
}

class Tank {
    constructor(x, y, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.width = 36;
        this.height = 36;
        this.direction = DIRECTIONS.UP;
        this.speed = isPlayer ? 3 : 1.5;
        this.isPlayer = isPlayer;
        this.color = isPlayer ? '#4CAF50' : '#f44336';
        this.darkColor = isPlayer ? '#2E7D32' : '#b71c1c';
        this.cooldown = 0;
        this.maxCooldown = isPlayer ? 12 : 50;
        this.alive = true;
        this.moveTimer = 0;
        this.shootTimer = 0;
        this.muzzleFlash = 0;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    move(direction, walls, enemies = []) {
        this.direction = direction;
        const vec = DIRECTION_VECTORS[direction];
        const newX = this.x + vec.x * this.speed;
        const newY = this.y + vec.y * this.speed;

        const bounds = {
            x: newX - this.width / 2,
            y: newY - this.height / 2,
            width: this.width,
            height: this.height
        };

        if (bounds.x < 0 || bounds.x + bounds.width > canvas.width ||
            bounds.y < 0 || bounds.y + bounds.height > canvas.height) {
            return false;
        }

        for (const wall of walls) {
            if (rectIntersect(bounds, wall.getBounds())) {
                return false;
            }
        }

        for (const enemy of enemies) {
            if (enemy !== this && enemy.alive && rectIntersect(bounds, enemy.getBounds())) {
                return false;
            }
        }

        this.x = newX;
        this.y = newY;
        return true;
    }

    shoot() {
        if (this.cooldown > 0) return null;
        this.cooldown = this.maxCooldown;
        const vec = DIRECTION_VECTORS[this.direction];
        const offset = 28;
        this.muzzleFlash = 5;
        return new Bullet(
            this.x + vec.x * offset,
            this.y + vec.y * offset,
            this.direction,
            this.isPlayer
        );
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;
        if (this.muzzleFlash > 0) this.muzzleFlash--;
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        // 关键修复：旋转偏移 -1，使炮管朝向与移动方向一致
        ctx.rotate((this.direction - 1) * Math.PI / 2);

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, -this.width/2 + 3, -this.height/2 + 3, this.width, this.height, 4);
        ctx.fill();

        // 左侧履带
        ctx.fillStyle = '#2c2c2c';
        roundRect(ctx, -this.width/2 + 1, -this.height/2 + 2, 8, this.height - 4, 2);
        ctx.fill();
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 右侧履带
        ctx.fillStyle = '#2c2c2c';
        roundRect(ctx, this.width/2 - 9, -this.height/2 + 2, 8, this.height - 4, 2);
        ctx.fill();
        ctx.stroke();

        // 履带纹理
        ctx.fillStyle = '#1a1a1a';
        for (let i = -this.height/2 + 6; i < this.height/2 - 2; i += 5) {
            ctx.fillRect(-this.width/2 + 1, i, 8, 2);
            ctx.fillRect(this.width/2 - 9, i, 8, 2);
        }

        // 车体
        const hullGrad = ctx.createLinearGradient(-this.width/2, -this.height/2, this.width/2, this.height/2);
        hullGrad.addColorStop(0, this.color);
        hullGrad.addColorStop(1, this.darkColor);
        ctx.fillStyle = hullGrad;
        roundRect(ctx, -this.width/2 + 11, -this.height/2 + 5, this.width - 22, this.height - 10, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 车体装甲线
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-5, -this.height/2 + 5);
        ctx.lineTo(-5, this.height/2 - 5);
        ctx.moveTo(5, -this.height/2 + 5);
        ctx.lineTo(5, this.height/2 - 5);
        ctx.stroke();

        // 炮塔底座
        ctx.fillStyle = this.darkColor;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 炮管
        ctx.fillStyle = '#3a3a3a';
        roundRect(ctx, 12, -3.5, 18, 7, 2);
        ctx.fill();
        // 炮管高光
        ctx.fillStyle = '#555';
        roundRect(ctx, 12, -3.5, 18, 2.5, 1);
        ctx.fill();

        // 炮口制退器
        ctx.fillStyle = '#222';
        ctx.fillRect(28, -4.5, 5, 9);

        // 炮口火焰
        if (this.muzzleFlash > 0) {
            const flashAlpha = this.muzzleFlash / 5;
            ctx.fillStyle = `rgba(255, 200, 50, ${flashAlpha})`;
            ctx.beginPath();
            ctx.arc(34, 0, 6 + Math.random() * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 200, ${flashAlpha})`;
            ctx.beginPath();
            ctx.arc(34, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 炮塔穹顶
        const turretGrad = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10);
        turretGrad.addColorStop(0, this.color);
        turretGrad.addColorStop(1, this.darkColor);
        ctx.fillStyle = turretGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // 徽章
        if (this.isPlayer) {
            ctx.fillStyle = '#FFEB3B';
            this.drawStar(0, 0, 5, 4, 2);
        } else {
            ctx.fillStyle = '#FFCDD2';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath();
            ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    aiUpdate(player, walls, tanks) {
        if (!this.alive) return;
        this.moveTimer--;
        this.shootTimer--;

        if (this.moveTimer <= 0) {
            this.moveTimer = Math.random() * 60 + 30;
            this.direction = Math.floor(Math.random() * 4);
        }

        const oldX = this.x;
        const oldY = this.y;
        this.move(this.direction, walls, tanks);

        if (this.x === oldX && this.y === oldY) {
            this.direction = Math.floor(Math.random() * 4);
        }

        for (const tank of tanks) {
            if (tank !== this && tank.alive && rectIntersect(this.getBounds(), tank.getBounds())) {
                this.x = oldX;
                this.y = oldY;
                this.direction = Math.floor(Math.random() * 4);
            }
        }

        if (this.shootTimer <= 0 && Math.random() < 0.02) {
            this.shootTimer = 100;
            return this.shoot();
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if ((absDx < 20 || absDy < 20) && Math.random() < 0.08) {
            if (absDx < absDy) {
                this.direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            } else {
                this.direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            }
            return this.shoot();
        }

        return null;
    }
}

class Wall {
    constructor(x, y, destructible = false) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE;
        this.height = TILE_SIZE;
        this.destructible = destructible;
        this.health = destructible ? 2 : Infinity;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    hit() {
        if (this.destructible) {
            this.health--;
            if (this.health <= 0) return true;
        }
        return false;
    }

    draw() {
        if (this.destructible) {
            const colors = ['#8D6E63', '#A1887F'];
            ctx.fillStyle = colors[Math.max(0, this.health - 1)];
            roundRect(ctx, this.x, this.y, this.width, this.height, 2);
            ctx.fill();
            ctx.strokeStyle = '#5D4037';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.strokeStyle = 'rgba(93, 64, 55, 0.5)';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width, this.y + this.height / 2);
            ctx.moveTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
            ctx.moveTo(this.x + this.width / 4, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width / 4, this.y + this.height);
            ctx.moveTo(this.x + this.width * 3 / 4, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width * 3 / 4, this.y + this.height);
            ctx.stroke();
        } else {
            const grad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
            grad.addColorStop(0, '#757575');
            grad.addColorStop(0.5, '#9E9E9E');
            grad.addColorStop(1, '#616161');
            ctx.fillStyle = grad;
            roundRect(ctx, this.x, this.y, this.width, this.height, 2);
            ctx.fill();
            ctx.strokeStyle = '#424242';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            roundRect(ctx, this.x + 5, this.y + 5, this.width - 10, this.height - 10, 1);
            ctx.fill();
        }
    }
}

function rectIntersect(r1, r2) {
    return !(r2.x >= r1.x + r1.width ||
             r2.x + r2.width <= r1.x ||
             r2.y >= r1.y + r1.height ||
             r2.y + r2.height <= r1.y);
}

class Game {
    constructor() {
        this.player = null;
        this.enemies = [];
        this.walls = [];
        this.bullets = [];
        this.particles = [];
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.paused = false;
        this.gameOver = false;
        this.started = false;
        this.keys = {};
        this.enemySpawnTimer = 0;
        this.maxEnemies = 4;
        this.enemiesKilled = 0;
        this.enemiesToKill = 10;

        this.setupInput();
        this.updateUI();
        this.loop();
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ' || e.key.toLowerCase() === 'p') {
                e.preventDefault();
            }
            if (e.key.toLowerCase() === 'p' && this.started) {
                this.paused = !this.paused;
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        const touchButtons = document.querySelectorAll('[data-key]');
        for (const btn of touchButtons) {
            const key = btn.dataset.key;
            const startHandler = (e) => {
                e.preventDefault();
                this.keys[key] = true;
                if (key === 'p' && this.started) {
                    this.paused = !this.paused;
                    this.keys[key] = false;
                }
            };
            const endHandler = (e) => {
                e.preventDefault();
                this.keys[key] = false;
            };
            btn.addEventListener('touchstart', startHandler, { passive: false });
            btn.addEventListener('touchend', endHandler, { passive: false });
            btn.addEventListener('touchcancel', endHandler, { passive: false });
            btn.addEventListener('mousedown', startHandler);
            btn.addEventListener('mouseup', endHandler);
            btn.addEventListener('mouseleave', endHandler);
        }

        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }

    start() {
        this.started = true;
        document.getElementById('startScreen').classList.remove('active');
        this.restart();
    }

    generateMap() {
        this.walls = [];
        const mapLayout = [
            "####################",
            "#..................#",
            "#..##..##..##..##..#",
            "#..##..##..##..##..#",
            "#..................#",
            "#..##....##....##..#",
            "#..##....##....##..#",
            "#..................#",
            "#..##..##..##..##..#",
            "#..##..##..##..##..#",
            "#..................#",
            "#..##....##....##..#",
            "#..##....##....##..#",
            "#..................#",
            "####################"
        ];

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const char = mapLayout[row][col];
                const x = col * TILE_SIZE;
                const y = row * TILE_SIZE;
                if (char === '#') {
                    this.walls.push(new Wall(x, y, false));
                } else if (Math.random() < 0.15 && !(row > 10 && col > 14)) {
                    this.walls.push(new Wall(x, y, true));
                }
            }
        }
    }

    restart() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        this.enemiesKilled = 0;
        this.enemiesToKill = 10;
        this.bullets = [];
        this.particles = [];
        this.enemies = [];

        this.player = new Tank(60, 520, true);
        this.generateMap();
        this.updateUI();
        document.getElementById('gameOver').classList.remove('active');
    }

    nextLevel() {
        this.level++;
        this.enemiesKilled = 0;
        this.enemiesToKill = 10 + this.level * 2;
        this.bullets = [];
        this.particles = [];
        this.enemies = [];
        this.player.x = 60;
        this.player.y = 520;
        this.player.direction = DIRECTIONS.UP;
        this.generateMap();
        this.updateUI();
    }

    isPositionFree(x, y, radius) {
        const bounds = { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 };
        for (const wall of this.walls) {
            if (rectIntersect(bounds, wall.getBounds())) return false;
        }
        for (const enemy of this.enemies) {
            if (enemy.alive && rectIntersect(bounds, enemy.getBounds())) return false;
        }
        if (this.player && rectIntersect(bounds, this.player.getBounds())) return false;
        return true;
    }

    spawnEnemy() {
        if (this.enemies.length >= this.maxEnemies) return;
        if (this.enemiesKilled + this.enemies.length >= this.enemiesToKill) return;

        const spawnPoints = [
            { x: 60, y: 60 },
            { x: 400, y: 60 },
            { x: 740, y: 60 }
        ];

        const available = spawnPoints.filter(p => this.isPositionFree(p.x, p.y, 25));
        if (available.length === 0) return;

        const point = available[Math.floor(Math.random() * available.length)];
        const enemy = new Tank(point.x, point.y, false);
        enemy.speed = 1 + this.level * 0.3;
        this.enemies.push(enemy);
    }

    spawnParticles(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 25 + Math.random() * 15,
                maxLife: 40,
                color: color,
                size: Math.random() * 3 + 2
            });
        }
    }

    update() {
        if (!this.started || this.paused || this.gameOver) return;

        if (this.keys['w'] || this.keys['arrowup']) {
            this.player.move(DIRECTIONS.UP, this.walls, this.enemies);
        } else if (this.keys['s'] || this.keys['arrowdown']) {
            this.player.move(DIRECTIONS.DOWN, this.walls, this.enemies);
        } else if (this.keys['a'] || this.keys['arrowleft']) {
            this.player.move(DIRECTIONS.LEFT, this.walls, this.enemies);
        } else if (this.keys['d'] || this.keys['arrowright']) {
            this.player.move(DIRECTIONS.RIGHT, this.walls, this.enemies);
        }

        if (this.keys[' ']) {
            const bullet = this.player.shoot();
            if (bullet) this.bullets.push(bullet);
        }

        this.player.update();

        this.enemySpawnTimer--;
        if (this.enemySpawnTimer <= 0) {
            this.spawnEnemy();
            this.enemySpawnTimer = 180 - Math.min(this.level * 10, 100);
        }

        for (const enemy of this.enemies) {
            const bullet = enemy.aiUpdate(this.player, this.walls, [...this.enemies, this.player]);
            if (bullet) this.bullets.push(bullet);
            enemy.update();
        }

        for (const bullet of this.bullets) {
            bullet.update();
        }
        this.bullets = this.bullets.filter(b => b.active);

        for (const bullet of this.bullets) {
            if (!bullet.active) continue;

            for (let i = this.walls.length - 1; i >= 0; i--) {
                const wall = this.walls[i];
                if (rectIntersect(bullet.getBounds(), wall.getBounds())) {
                    bullet.active = false;
                    this.spawnParticles(bullet.x, bullet.y, '#FF9800', 6);
                    if (wall.hit()) {
                        this.walls.splice(i, 1);
                        this.spawnParticles(wall.x + wall.width/2, wall.y + wall.height/2, '#8D6E63', 8);
                    }
                    break;
                }
            }

            if (!bullet.active) continue;

            if (bullet.isPlayer) {
                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    const enemy = this.enemies[i];
                    if (enemy.alive && rectIntersect(bullet.getBounds(), enemy.getBounds())) {
                        bullet.active = false;
                        enemy.alive = false;
                        this.enemies.splice(i, 1);
                        this.score += 100;
                        this.enemiesKilled++;
                        this.spawnParticles(enemy.x, enemy.y, '#f44336', 16);
                        break;
                    }
                }
            } else {
                if (rectIntersect(bullet.getBounds(), this.player.getBounds())) {
                    bullet.active = false;
                    this.lives--;
                    this.spawnParticles(this.player.x, this.player.y, '#4CAF50', 14);
                    if (this.lives <= 0) {
                        this.gameOver = true;
                        document.getElementById('finalScore').textContent = this.score;
                        document.getElementById('gameOver').classList.add('active');
                    } else {
                        this.player.x = 60;
                        this.player.y = 520;
                        this.player.direction = DIRECTIONS.UP;
                    }
                }
            }
        }

        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.life--;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        if (this.enemiesKilled >= this.enemiesToKill && this.enemies.length === 0) {
            this.nextLevel();
        }

        this.updateUI();
    }

    updateUI() {
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        const livesBar = document.getElementById('livesBar');
        if (livesBar) {
            livesBar.style.width = (this.lives / 3 * 100) + '%';
        }
    }

    drawBackground() {
        ctx.fillStyle = '#0d1b0d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(76, 175, 80, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(76, 175, 80, 0.04)';
        for (let i = 0; i < 60; i++) {
            const px = (i * 137) % canvas.width;
            const py = (i * 91) % canvas.height;
            ctx.fillRect(px, py, 2, 2);
        }
    }

    draw() {
        this.drawBackground();

        for (const wall of this.walls) {
            wall.draw();
        }

        if (this.player && this.player.alive) {
            this.player.draw();
        }

        for (const enemy of this.enemies) {
            enemy.draw();
        }

        for (const bullet of this.bullets) {
            bullet.draw();
        }

        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        for (let y = 0; y < canvas.height; y += 3) {
            ctx.fillRect(0, y, canvas.width, 1);
        }

        if (this.paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#4CAF50';
            ctx.font = 'bold 52px Microsoft YaHei, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂停', canvas.width / 2, canvas.height / 2);
            ctx.font = '18px Microsoft YaHei, sans-serif';
            ctx.fillStyle = '#aaa';
            ctx.fillText('点击 P 或 暂停按钮 继续', canvas.width / 2, canvas.height / 2 + 45);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

const game = new Game();
