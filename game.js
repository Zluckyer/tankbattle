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
    { x: 0, y: -1 },  // UP
    { x: 1, y: 0 },   // RIGHT
    { x: 0, y: 1 },   // DOWN
    { x: -1, y: 0 }   // LEFT
];

class Bullet {
    constructor(x, y, direction, isPlayer) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.speed = 6;
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
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isPlayer ? '#FFEB3B' : '#FF5722';
        ctx.fill();
        ctx.closePath();
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
        this.cooldown = 0;
        this.maxCooldown = isPlayer ? 15 : 60;
        this.alive = true;
        this.moveTimer = 0;
        this.shootTimer = 0;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    move(direction, walls) {
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

        this.x = newX;
        this.y = newY;
        return true;
    }

    shoot() {
        if (this.cooldown > 0) return null;
        this.cooldown = this.maxCooldown;
        const vec = DIRECTION_VECTORS[this.direction];
        const offset = this.width / 2 + 8;
        return new Bullet(
            this.x + vec.x * offset,
            this.y + vec.y * offset,
            this.direction,
            this.isPlayer
        );
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.direction * Math.PI / 2);

        // 坦克身体
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // 坦克边框
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // 炮塔
        ctx.fillStyle = this.isPlayer ? '#66BB6A' : '#EF5350';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        // 炮管
        ctx.fillStyle = '#555';
        ctx.fillRect(0, -4, 22, 8);

        // 履带细节
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.width / 2 + 2, -this.height / 2 + 2, 6, this.height - 4);
        ctx.fillRect(this.width / 2 - 8, -this.height / 2 + 2, 6, this.height - 4);

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
        this.move(this.direction, walls);

        // 如果撞墙了，随机换方向
        if (this.x === oldX && this.y === oldY) {
            this.direction = Math.floor(Math.random() * 4);
        }

        // 避免和其他坦克重叠
        for (const tank of tanks) {
            if (tank !== this && tank.alive && rectIntersect(this.getBounds(), tank.getBounds())) {
                this.x = oldX;
                this.y = oldY;
                this.direction = Math.floor(Math.random() * 4);
            }
        }

        // 随机射击
        if (this.shootTimer <= 0 && Math.random() < 0.02) {
            this.shootTimer = 120;
            return this.shoot();
        }

        // 如果玩家在同一直线上，尝试射击
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if ((absDx < 20 || absDy < 20) && Math.random() < 0.1) {
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
            ctx.fillStyle = this.health > 1 ? '#8D6E63' : '#BCAAA4';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#5D4037';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            // 砖块纹理
            ctx.strokeStyle = '#5D4037';
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
            ctx.fillStyle = '#757575';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#424242';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            // 钢铁纹理
            ctx.fillStyle = '#9E9E9E';
            ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
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
        this.keys = {};
        this.enemySpawnTimer = 0;
        this.maxEnemies = 4;
        this.enemiesKilled = 0;
        this.enemiesToKill = 10;

        this.setupInput();
        this.restart();
        this.loop();
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ' || e.key.toLowerCase() === 'p') {
                e.preventDefault();
            }
            if (e.key.toLowerCase() === 'p') {
                this.paused = !this.paused;
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // 移动端虚拟按键
        const touchButtons = document.querySelectorAll('[data-key]');
        for (const btn of touchButtons) {
            const key = btn.dataset.key;
            const startHandler = (e) => {
                e.preventDefault();
                this.keys[key] = true;
                if (key === 'p') {
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

        // 防止页面滚动
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
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
        document.getElementById('gameOver').style.display = 'none';
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

    spawnEnemy() {
        if (this.enemies.length >= this.maxEnemies) return;
        if (this.enemiesKilled + this.enemies.length >= this.enemiesToKill) return;

        const spawnPoints = [
            { x: 60, y: 60 },
            { x: 400, y: 60 },
            { x: 740, y: 60 }
        ];

        const point = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        const enemy = new Tank(point.x, point.y, false);
        enemy.speed = 1 + this.level * 0.3;
        this.enemies.push(enemy);
    }

    spawnParticles(x, y, color) {
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 30,
                color: color
            });
        }
    }

    update() {
        if (this.paused || this.gameOver) return;

        // 玩家移动
        if (this.keys['w'] || this.keys['arrowup']) {
            this.player.move(DIRECTIONS.UP, this.walls);
        } else if (this.keys['s'] || this.keys['arrowdown']) {
            this.player.move(DIRECTIONS.DOWN, this.walls);
        } else if (this.keys['a'] || this.keys['arrowleft']) {
            this.player.move(DIRECTIONS.LEFT, this.walls);
        } else if (this.keys['d'] || this.keys['arrowright']) {
            this.player.move(DIRECTIONS.RIGHT, this.walls);
        }

        // 玩家射击
        if (this.keys[' ']) {
            const bullet = this.player.shoot();
            if (bullet) this.bullets.push(bullet);
        }

        this.player.update();

        // 生成敌人
        this.enemySpawnTimer--;
        if (this.enemySpawnTimer <= 0) {
            this.spawnEnemy();
            this.enemySpawnTimer = 180 - Math.min(this.level * 10, 100);
        }

        // 敌人AI
        for (const enemy of this.enemies) {
            const bullet = enemy.aiUpdate(this.player, this.walls, [...this.enemies, this.player]);
            if (bullet) this.bullets.push(bullet);
            enemy.update();
        }

        // 更新子弹
        for (const bullet of this.bullets) {
            bullet.update();
        }
        this.bullets = this.bullets.filter(b => b.active);

        // 子弹碰撞检测
        for (const bullet of this.bullets) {
            if (!bullet.active) continue;

            // 检测与墙的碰撞
            for (let i = this.walls.length - 1; i >= 0; i--) {
                const wall = this.walls[i];
                if (rectIntersect(bullet.getBounds(), wall.getBounds())) {
                    bullet.active = false;
                    this.spawnParticles(bullet.x, bullet.y, '#FF9800');
                    if (wall.hit()) {
                        this.walls.splice(i, 1);
                    }
                    break;
                }
            }

            if (!bullet.active) continue;

            // 检测与坦克的碰撞
            if (bullet.isPlayer) {
                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    const enemy = this.enemies[i];
                    if (enemy.alive && rectIntersect(bullet.getBounds(), enemy.getBounds())) {
                        bullet.active = false;
                        enemy.alive = false;
                        this.enemies.splice(i, 1);
                        this.score += 100;
                        this.enemiesKilled++;
                        this.spawnParticles(enemy.x, enemy.y, '#f44336');
                        break;
                    }
                }
            } else {
                if (rectIntersect(bullet.getBounds(), this.player.getBounds())) {
                    bullet.active = false;
                    this.lives--;
                    this.spawnParticles(this.player.x, this.player.y, '#4CAF50');
                    if (this.lives <= 0) {
                        this.gameOver = true;
                        document.getElementById('finalScore').textContent = this.score;
                        document.getElementById('gameOver').style.display = 'block';
                    } else {
                        this.player.x = 60;
                        this.player.y = 520;
                        this.player.direction = DIRECTIONS.UP;
                    }
                }
            }
        }

        // 更新粒子
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        // 检查过关
        if (this.enemiesKilled >= this.enemiesToKill && this.enemies.length === 0) {
            this.nextLevel();
        }

        this.updateUI();
    }

    updateUI() {
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
    }

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制网格背景
        ctx.strokeStyle = '#1a1a1a';
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

        // 绘制墙壁
        for (const wall of this.walls) {
            wall.draw();
        }

        // 绘制坦克
        this.player.draw();
        for (const enemy of this.enemies) {
            enemy.draw();
        }

        // 绘制子弹
        for (const bullet of this.bullets) {
            bullet.draw();
        }

        // 绘制粒子
        for (const p of this.particles) {
            ctx.globalAlpha = p.life / 30;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;

        // 暂停提示
        if (this.paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 48px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText('暂停', canvas.width / 2, canvas.height / 2);
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

const game = new Game();
