const BASE_MAP_SIZE = 6000;
const TOTAL_BOTS_FFA = 50;
const TOTAL_BOTS_BR = 50;
const BONUS_PER_WIN = 50;

const MIN_MASS_SPLIT = 36;
const MIN_MASS_EJECT = 36;
const EJECT_MASS_LOSS = 16;
const EJECT_MASS_GAIN = 12;

// Temps de regroupement rapide
const MERGE_TIME_BASE = 2;

const app = new PIXI.Application({
    resizeTo: window,
    backgroundColor: 0x050510,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
});
document.body.appendChild(app.view);

// COUCHES
const starsLayer = new PIXI.Container();
const gameLayer = new PIXI.Container();
const borderLayer = new PIXI.Container();
const uiLayer = new PIXI.Container();

app.stage.addChild(starsLayer);
app.stage.addChild(gameLayer);
gameLayer.addChild(borderLayer);
app.stage.addChild(uiLayer);

gameLayer.sortableChildren = true;

// -- MINIMAP SETUP --
const minimapContainer = new PIXI.Container();
const minimapBg = new PIXI.Graphics();
const minimapDots = new PIXI.Graphics();
minimapContainer.addChild(minimapBg);
minimapContainer.addChild(minimapDots);
minimapContainer.x = 20;
minimapContainer.y = 20;
uiLayer.addChild(minimapContainer);

const MINIMAP_SIZE = 120;

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();
let bgMusic = new Audio('music.mp3');
bgMusic.loop = true; bgMusic.volume = 0.3;

function playNote(freq, startTime, duration, type = 'square') {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(startTime);
    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration - 0.05);
    osc.stop(startTime + duration);
}

function playSynthSound(type) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    if (type === 'eat') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'split') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'triangle'; osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(300, now); osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'win') {
        let t = now;
        [392, 523, 659, 783, 1046, 1318].forEach(f => { playNote(f, t, 0.15); t+=0.15; });
        playNote(1567, t, 0.4); t+=0.4; playNote(1318, t, 0.6);
    } else if (type === 'loose') {
        let t = now;
        [493, 698, 698, 698, 659, 587].forEach(f => { playNote(f, t, 0.18); t+=0.18; });
        playNote(523, t, 0.4);
    }
}

const KEY_MAX_MASS = 'orbital_max_mass';
const KEY_BR_WINS = 'orbital_br_wins';
let gameMode = 'FFA';
let currentMapSize = BASE_MAP_SIZE;
let isPaused = false;
let recordMass = parseInt(localStorage.getItem(KEY_MAX_MASS)) || 0;
let brWins = parseInt(localStorage.getItem(KEY_BR_WINS)) || 0;

const BOT_NAMES = ["NoobMaster", "ProKiller", "AgarKing", "Nebula", "Vortex", "BlackHole", "Winner", "Loser", "Guest_99", "Covid-19", "Mars", "Zeus", "Hades", "Titan", "Goliath", "David", "Slayer", "Ghost", "Ninja", "Shinobi", "Banana", "Apple", "Elon Musk", "NASA", "SpaceX", "UFO", "Alien"];
const SKINS = [
    { name: "Astéroïde", req: 0, color: '#7f8c8d', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Phobos_colour_2008.jpg/240px-Phobos_colour_2008.jpg' },
    { name: "Lune", req: 200, color: '#bdc3c7', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/240px-FullMoon2010.jpg' },
    { name: "Mars", req: 500, color: '#d35400', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/240px-OSIRIS_Mars_true_color.jpg' },
    { name: "Terre", req: 1000, color: '#2980b9', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/240px-The_Earth_seen_from_Apollo_17.jpg' },
    { name: "Jupiter", req: 2000, color: '#d35400', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Jupiter_and_its_shrunken_Great_Red_Spot.jpg/240px-Jupiter_and_its_shrunken_Great_Red_Spot.jpg' },
    { name: "Soleil", req: 5000, color: '#f1c40f', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg/240px-The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg' },
    { name: "Trou Noir", req: 10000, color: '#000000', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Black_hole_-_Messier_87_crop_max_res.jpg/240px-Black_hole_-_Messier_87_crop_max_res.jpg' }
];

let skinIndex = 0;
let entities = [], foods = [], ejectedMasses = [], myCells = [];
let gameRunning = false;
let mouse = { x: 0, y: 0 };
let lbTimer = 0, brShrinkTimer = 0;
let camera = { x: 0, y: 0, z: 1, tz: 1 };

function setMode(mode) {
    gameMode = mode;
    document.getElementById('btn-ffa').className = 'mode-btn' + (mode === 'FFA' ? ' active' : '');
    document.getElementById('btn-br').className = 'mode-btn' + (mode === 'BR' ? ' active-br' : '');
    const bonusDisplay = document.getElementById('br-bonus-display');
    if (mode === 'BR' && brWins > 0) {
        bonusDisplay.style.display = 'block';
        document.getElementById('bonus-val').innerText = brWins * BONUS_PER_WIN;
    } else { bonusDisplay.style.display = 'none'; }
}

function updateMenu() {
    const s = SKINS[skinIndex];
    const isLocked = s.req > recordMass;
    const imgEl = document.getElementById('preview-img');
    const fallbackEl = document.getElementById('preview-fallback');

    imgEl.style.display = 'block'; fallbackEl.style.display = 'none';
    imgEl.src = s.url || "";
    if(!s.url) { imgEl.style.display='none'; fallbackEl.style.display='block'; fallbackEl.style.backgroundColor = s.color; }

    document.getElementById('skin-name').innerText = s.name;
    const playBtn = document.getElementById('play-btn');
    const lockEl = document.getElementById('lock-overlay');
    const reqText = document.getElementById('skin-req');

    if (isLocked) {
        lockEl.style.display = 'flex'; playBtn.disabled = true; playBtn.innerText = "BLOQUÉ";
        reqText.innerText = `Débloquer: ${s.req} masse`; reqText.style.color = "#ff0055";
    } else {
        lockEl.style.display = 'none'; playBtn.disabled = false; playBtn.innerText = "JOUER";
        reqText.innerText = s.req === 0 ? "Base" : "DÉBLOQUÉ"; reqText.style.color = "#2ecc71";
    }
}

function changeSkin(dir) {
    skinIndex = (skinIndex + dir + SKINS.length) % SKINS.length;
    updateMenu();
}
updateMenu(); setMode('FFA');

function createStars() {
    starsLayer.removeChildren();
    for(let i=0; i<800; i++) {
        const star = new PIXI.Graphics();
        star.beginFill(0xffffff, Math.random() * 0.3 + 0.1);
        star.drawCircle(0, 0, Math.random() * 2);
        star.endFill();
        star.x = (Math.random()-0.5) * BASE_MAP_SIZE * 2;
        star.y = (Math.random()-0.5) * BASE_MAP_SIZE * 2;
        star.zDepth = Math.random() * 2;
        starsLayer.addChild(star);
    }
}

class Food {
    constructor() {
        this.val = Math.random() < 0.9 ? 1 : 5;
        this.radius = this.val === 1 ? 8 : 14;
        this.color = this.val === 1 ? Math.floor(Math.random()*0xffffff) : 0xffffff;

        this.graphics = new PIXI.Graphics();
        this.redraw();
        this.graphics.x = (Math.random()-0.5)*currentMapSize;
        this.graphics.y = (Math.random()-0.5)*currentMapSize;
        gameLayer.addChild(this.graphics);
    }
    redraw() {
        this.graphics.clear();
        this.graphics.beginFill(this.color);
        if(this.val > 2) {
            this.graphics.lineStyle(2, 0xffff00);
        }
        this.graphics.drawCircle(0, 0, this.radius);
        this.graphics.endFill();
    }
    remove() {
        gameLayer.removeChild(this.graphics);
        this.graphics.destroy();
    }
}

class EjectedMass {
    constructor(x, y, angle, color, parent) {
        this.x = x; this.y = y;
        this.val = EJECT_MASS_GAIN;
        this.radius = 20;
        this.vx = Math.cos(angle) * 700;
        this.vy = Math.sin(angle) * 700;
        this.parent = parent;
        this.bornTime = Date.now();
        this.color = color;

        this.graphics = new PIXI.Graphics();
        this.graphics.lineStyle(2, 0x000000);
        this.graphics.beginFill(this.color);
        this.graphics.drawCircle(0,0, this.radius);
        this.graphics.endFill();
        this.graphics.x = x; this.graphics.y = y;
        gameLayer.addChild(this.graphics);
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.9; this.vy *= 0.9;
        this.graphics.x = this.x;
        this.graphics.y = this.y;
    }
    remove() {
        gameLayer.removeChild(this.graphics);
        this.graphics.destroy();
    }
}

class Entity {
    constructor(x, y, isPlayer, name, mass, skinDef) {
        this.id = Math.random();
        this.x = x; this.y = y; this.mass = mass;
        this.isPlayer = isPlayer; this.name = name;
        this.skin = skinDef || SKINS[Math.floor(Math.random()*SKINS.length)];

        this.color = parseInt(this.skin.color.replace('#', '0x'));

        this.angle = Math.random()*6;
        this.dead = false;
        this.vx = 0; this.vy = 0;
        this.mergeTimer = 0; this.canMerge = true; this.maxMergeTime = 0;
        this.eatDistortion = 0; this.aiTimer = 0;

        this.container = new PIXI.Container();
        this.container.x = x; this.container.y = y;
        this.container.zIndex = mass;

        this.body = new PIXI.Graphics();
        this.container.addChild(this.body);

        this.sprite = new PIXI.Sprite();
        this.sprite.anchor.set(0.5);
        this.maskGraphic = new PIXI.Graphics();
        this.sprite.mask = this.maskGraphic;
        this.container.addChild(this.maskGraphic);
        this.container.addChild(this.sprite);

        if(this.skin.url) {
            PIXI.Assets.load(this.skin.url).then(texture => {
                if(!this.dead && this.sprite) {
                    this.sprite.texture = texture;
                    this.redrawVisuals();
                }
            }).catch(()=>{});
        }

        const styleName = new PIXI.TextStyle({
            fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: '#ffffff',
            stroke: '#000000', strokeThickness: 3, align: 'center'
        });
        this.textName = new PIXI.Text(this.name, styleName);
        this.textName.anchor.set(0.5);
        this.container.addChild(this.textName);

        this.textMass = new PIXI.Text(Math.floor(this.mass), { ...styleName, fontSize: 10 });
        this.textMass.anchor.set(0.5);
        this.container.addChild(this.textMass);

        this.mergeBar = new PIXI.Graphics();
        this.container.addChild(this.mergeBar);

        gameLayer.addChild(this.container);
        this.redrawVisuals();
    }

    getRadius() { return Math.sqrt(this.mass * 100); }

    redrawVisuals() {
        if(this.dead) return;
        const r = this.getRadius();

        this.body.clear();
        this.body.beginFill(this.color);
        if(this.isPlayer) this.body.lineStyle(3, 0x00ffcc);
        else this.body.lineStyle(3, 0xffffff, 0.5);
        this.body.drawCircle(0, 0, r);
        this.body.endFill();

        this.maskGraphic.clear();
        this.maskGraphic.beginFill(0xffffff);
        this.maskGraphic.drawCircle(0, 0, r);
        this.maskGraphic.endFill();

        if(this.sprite.texture) {
            this.sprite.width = r * 2;
            this.sprite.height = r * 2;
        }

        this.textName.y = -r * 0.2;
        this.textName.style.fontSize = Math.max(12, r * 0.4);
        this.textName.visible = (this.mass > 20);

        this.textMass.text = Math.floor(this.mass);
        this.textMass.y = r * 0.35;
        this.textMass.style.fontSize = Math.max(10, r * 0.25);
        this.textMass.visible = (this.mass > 20);

        this.container.zIndex = this.mass;
    }

    update(dt) {
        if(this.dead) {
            if(this.container.parent) this.container.parent.removeChild(this.container);
            this.container.destroy({ children: true });
            return;
        }

        const r = this.getRadius();
        if (this.mass > 200) this.mass -= this.mass * 0.001 * dt * 2;

        let baseSpeed = 700 * Math.pow(this.mass, -0.4);

        // MODIF: FRICTION FORTE pour un arrêt "collé"
        // Le 0.85 permet de glisser un tout petit peu mais de s'arrêter net à côté
        this.vx *= 0.85; this.vy *= 0.85;
        this.eatDistortion *= 0.9;

        if (!this.canMerge) {
            this.mergeTimer -= dt;
            if (this.mergeTimer <= 0) { this.canMerge = true; this.mergeTimer = 0; }
        }

        this.mergeBar.clear();
        if (!this.canMerge && this.mergeTimer > 0) {
            const barW = r * 1.5;
            const prog = this.mergeTimer / this.maxMergeTime;
            this.mergeBar.beginFill(0x000000, 0.5);
            this.mergeBar.drawRect(-barW/2, r+5, barW, 6);
            this.mergeBar.beginFill(0xffff00);
            this.mergeBar.drawRect(-barW/2, r+5, barW*prog, 6);
        }

        let targetAngle = this.angle;
        if(this.isPlayer) {
            let dx = mouse.x - window.innerWidth/2;
            let dy = mouse.y - window.innerHeight/2;
            if(Math.hypot(dx,dy) > 10) targetAngle = Math.atan2(dy, dx);
        } else {
            this.aiTimer += dt;
            if(Math.random() < 0.02) targetAngle += (Math.random()-0.5)*2;
            if (this.aiTimer > 0.2) {
                this.aiTimer = 0;
                let bestPrey = null; let minDistSq = Infinity;
                entities.forEach(other => {
                    if (other === this || other.dead || other.name === this.name) return;
                    let distSq = (other.x - this.x)**2 + (other.y - this.y)**2;
                    if (distSq < 800*800 && other.mass < this.mass * 0.75) {
                        if(distSq < minDistSq) { minDistSq = distSq; bestPrey = other; }
                    }
                });
                if (bestPrey) {
                    targetAngle = Math.atan2(bestPrey.y - this.y, bestPrey.x - this.x);
                    let dist = Math.sqrt(minDistSq);
                    if (this.mass > MIN_MASS_SPLIT * 2 && dist < 400 && dist > r + 50 && Math.random() < 0.05) {
                        this.angle = targetAngle; splitEntity(this);
                    }
                }
                if(Math.hypot(this.x, this.y) > currentMapSize/2 - 200) targetAngle = Math.atan2(-this.y, -this.x);
            }
        }

        let diff = targetAngle - this.angle;
        while(diff < -Math.PI) diff += Math.PI*2;
        while(diff > Math.PI) diff -= Math.PI*2;
        this.angle += diff * 0.1;

        this.x += Math.cos(this.angle) * baseSpeed * dt + this.vx * dt;
        this.y += Math.sin(this.angle) * baseSpeed * dt + this.vy * dt;

        let limit = currentMapSize/2 - r;
        if (this.x < -limit) this.x = -limit; if (this.x > limit) this.x = limit;
        if (this.y < -limit) this.y = -limit; if (this.y > limit) this.y = limit;

        const oldMass = parseInt(this.textMass.text);
        if(Math.floor(this.mass) !== oldMass) this.redrawVisuals();

        let scaleFactor = 1 + this.eatDistortion * Math.sin(Date.now() / 40);
        this.container.scale.set(scaleFactor);
        this.container.x = this.x;
        this.container.y = this.y;
    }
    triggerEatEffect() { this.eatDistortion = 0.15; }
}

function splitEntity(cell) {
    if (cell.dead || cell.mass < MIN_MASS_SPLIT) return;
    if(cell.isPlayer) playSynthSound('split');

    let newMass = cell.mass / 2;
    cell.mass = newMass;
    cell.redrawVisuals();

    let splitCell = new Entity(cell.x, cell.y, cell.isPlayer, cell.name, newMass, cell.skin);
    let angle = cell.angle;

    // MODIF: Distance d'apparition réduite.
    // Au lieu d'apparaître complètement dehors (r*2), elle apparaît juste au bord (r),
    // créant un chevauchement initial pour éviter le "trou".
    let dist = cell.getRadius();

    splitCell.x += Math.cos(angle) * dist;
    splitCell.y += Math.sin(angle) * dist;

    // MODIF: Vitesse réduite (1000 -> 750)
    // Pour ne pas qu'elle parte trop loin malgré la friction.
    splitCell.vx = Math.cos(angle) * 750;
    splitCell.vy = Math.sin(angle) * 750;

    let mTime = MERGE_TIME_BASE + (newMass * 0.002);

    cell.canMerge = false; cell.mergeTimer = mTime; cell.maxMergeTime = mTime;
    splitCell.canMerge = false; splitCell.mergeTimer = mTime; splitCell.maxMergeTime = mTime;

    entities.push(splitCell);
    if(cell.isPlayer) myCells.push(splitCell);
}

function splitPlayer() {
    if (!gameRunning || isPaused || myCells.length === 0) return;
    if (myCells.length >= 16) return;
    [...myCells].forEach(cell => splitEntity(cell));
}

function ejectMass() {
    if (!gameRunning || isPaused || myCells.length === 0) return;
    myCells.forEach(cell => {
        if (cell.mass >= MIN_MASS_EJECT) {
            cell.mass -= EJECT_MASS_LOSS;
            cell.redrawVisuals();
            let angle = cell.angle;
            let r = cell.getRadius();
            let em = new EjectedMass(cell.x + Math.cos(angle)*r, cell.y + Math.sin(angle)*r, angle, cell.color, cell);
            ejectedMasses.push(em);
            playSynthSound('split');
        }
    });
}

function togglePause() {
    if(!gameRunning) return;
    isPaused = !isPaused;
    if(isPaused) {
        document.getElementById('pause-menu').classList.remove('hidden');
        bgMusic.pause();
    } else {
        document.getElementById('pause-menu').classList.add('hidden');
        bgMusic.play().catch(()=>{});
    }
}

function startGame() {
    document.getElementById('ui-container').classList.add('hidden');
    document.getElementById('hud-top-right').classList.remove('hidden');
    document.getElementById('hud-bottom-left').classList.remove('hidden');
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('pause-menu').classList.add('hidden');
    minimapContainer.visible = true;

    currentMapSize = BASE_MAP_SIZE;
    brShrinkTimer = 0;
    isPaused = false;
    createStars();

    if (audioCtx.state === 'suspended') audioCtx.resume();
    bgMusic.play().catch(() => {});

    if (gameMode === 'BR') {
        document.getElementById('hud-top-center').style.display = 'block';
        document.getElementById('zone-alert').style.display = 'block';
        setTimeout(() => document.getElementById('zone-alert').style.display = 'none', 3000);
    } else document.getElementById('hud-top-center').style.display = 'block';

    document.getElementById('hud-top-center').style.top = "150px";

    const nameInput = document.getElementById('nickname').value.trim() || "Joueur";
    let mySkin = SKINS[skinIndex];
    if (nameInput.toLowerCase() === "bazin") mySkin = { name: "Master BAZIN", req: 0, color: "#8e44ad", url: "bazin.png" };

    const hudImg = document.getElementById('mini-skin');
    const hudFb = document.getElementById('mini-skin-fallback');
    hudImg.style.display = 'block'; hudFb.style.display = 'none';
    hudImg.src = mySkin.url || "";
    if(!mySkin.url) { hudImg.style.display='none'; hudFb.style.display='block'; hudFb.style.backgroundColor=mySkin.color; }

    entities.forEach(e => { e.container.destroy({children:true}); });
    foods.forEach(f => f.remove());
    ejectedMasses.forEach(e => e.remove());

    entities = []; foods = []; myCells = []; ejectedMasses = [];

    let startMass = 50;
    if (gameMode === 'BR' && brWins > 0) startMass += (brWins * BONUS_PER_WIN);

    let p = new Entity(0, 0, true, nameInput, startMass, mySkin);
    entities.push(p); myCells.push(p);

    let botCount = (gameMode === 'BR') ? TOTAL_BOTS_BR : TOTAL_BOTS_FFA;
    for(let i=0; i < botCount - 1; i++) spawnBot();
    for(let i=0; i<1000; i++) foods.push(new Food());

    gameRunning = true;
}

function spawnBot() {
    let name = BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)];
    let x = (Math.random()-0.5)*currentMapSize*0.8;
    let y = (Math.random()-0.5)*currentMapSize*0.8;
    entities.push(new Entity(x, y, false, name, 30 + Math.random()*40, null));
}

function endGame(win) {
    gameRunning = false;
    document.getElementById('game-over-screen').style.display = 'block';
    minimapContainer.visible = false;
    bgMusic.pause();
    if(win) { playSynthSound('win'); } else { playSynthSound('loose'); }

    const title = document.getElementById('go-title');
    const sub = document.getElementById('go-sub');
    const bonus = document.getElementById('go-bonus');
    bonus.style.display = 'none';

    if(win) {
        title.innerText = "VICTOIRE ROYALE"; title.style.color = "#00ffcc"; sub.innerText = "Tu as conquis l'espace !";
        brWins++; localStorage.setItem(KEY_BR_WINS, brWins);
        bonus.style.display = 'block'; bonus.innerText = `+${BONUS_PER_WIN} Masse !`;
    } else {
        title.innerText = "FIN DE PARTIE"; title.style.color = "#ff0055"; sub.innerText = (gameMode === 'BR') ? "Éliminé." : "Réessaye !";
    }
    setTimeout(() => { location.reload(); }, 4000);
}

const borderGraphics = new PIXI.Graphics();
borderLayer.addChild(borderGraphics);

app.ticker.add((delta) => {
    if(!gameRunning || isPaused) return;
    const dt = delta / 60;

    let playerTotalMass = 0;
    if(myCells.length > 0) myCells.forEach(c => playerTotalMass += c.mass);

    if (gameMode === 'BR') {
        brShrinkTimer += dt;
        if (brShrinkTimer > 10 && currentMapSize > 500) currentMapSize -= 20 * dt;
    } else {
        const currentBots = entities.filter(e => !e.isPlayer).length;
        if (currentBots < TOTAL_BOTS_FFA && Math.random() < 0.05) spawnBot();
        currentMapSize = BASE_MAP_SIZE;
    }

    if(myCells.length > 0) {
        let avgX = 0, avgY = 0, totalM = 0;
        myCells.forEach(c => { avgX += c.x * c.mass; avgY += c.y * c.mass; totalM += c.mass; });
        let tX = avgX / totalM; let tY = avgY / totalM;
        let totalRadius = Math.sqrt(totalM * 100);

        // DEZOOM AGRESSIF
        let zoomBase = 0.9;
        let tZ = zoomBase / (1 + totalRadius * 0.003);

        camera.tz += (tZ - camera.tz) * 0.05; camera.z = camera.tz;
        camera.x += (tX - camera.x) * 0.1; camera.y += (tY - camera.y) * 0.1;

        if (gameMode === 'FFA' && totalM > recordMass) {
            recordMass = Math.floor(totalM); localStorage.setItem(KEY_MAX_MASS, recordMass);
        }

        // MINIMAP UPDATE
        minimapBg.clear();
        minimapBg.lineStyle(2, 0xffffff);
        minimapBg.beginFill(0x000000, 0.6);
        minimapBg.drawRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
        minimapBg.endFill();

        minimapDots.clear();
        minimapDots.beginFill(0x00ffcc);
        let mapX = (tX + BASE_MAP_SIZE/2) / BASE_MAP_SIZE * MINIMAP_SIZE;
        let mapY = (tY + BASE_MAP_SIZE/2) / BASE_MAP_SIZE * MINIMAP_SIZE;
        minimapDots.drawCircle(mapX, mapY, 4);
        minimapDots.endFill();

        if(gameMode === 'BR') {
            let zoneSize = (currentMapSize / BASE_MAP_SIZE) * MINIMAP_SIZE;
            let offset = (MINIMAP_SIZE - zoneSize) / 2;
            minimapDots.lineStyle(1, 0xff0055);
            minimapDots.drawRect(offset, offset, zoneSize, zoneSize);
        }
    }

    gameLayer.pivot.set(camera.x, camera.y);
    gameLayer.position.set(app.screen.width/2, app.screen.height/2);
    gameLayer.scale.set(camera.z);

    starsLayer.children.forEach(s => {
        let x = (s.x - camera.x * (0.05*s.zDepth) + BASE_MAP_SIZE*2) % BASE_MAP_SIZE - BASE_MAP_SIZE/2;
        let y = (s.y - camera.y * (0.05*s.zDepth) + BASE_MAP_SIZE*2) % BASE_MAP_SIZE - BASE_MAP_SIZE/2;
        s.x = x + app.screen.width/2;
        s.y = y + app.screen.height/2;
    });

    borderGraphics.clear();
    borderGraphics.lineStyle(50, (gameMode === 'BR') ? 0xff0055 : 0x00d2ff);
    borderGraphics.drawRect(-currentMapSize/2, -currentMapSize/2, currentMapSize, currentMapSize);
    if(gameMode === 'BR') {
        borderGraphics.beginFill(0xff0055, 0.1);
        borderGraphics.drawRect(-BASE_MAP_SIZE, -BASE_MAP_SIZE, BASE_MAP_SIZE*2, BASE_MAP_SIZE*2);
        borderGraphics.beginHole();
        borderGraphics.drawRect(-currentMapSize/2, -currentMapSize/2, currentMapSize, currentMapSize);
        borderGraphics.endHole();
        borderGraphics.endFill();
    }

    if(foods.length < 1000) foods.push(new Food());

    for (let i = foods.length - 1; i >= 0; i--) {
        let f = foods[i];
        if (Math.abs(f.graphics.x) > currentMapSize/2 || Math.abs(f.graphics.y) > currentMapSize/2) {
            f.remove(); foods.splice(i, 1); continue;
        }
        let eaten = false;
        for(let e of entities) {
            if(e.dead) continue;
            let dx = e.x - f.graphics.x; let dy = e.y - f.graphics.y;
            let r = e.getRadius();
            if (dx*dx + dy*dy < (r + f.radius)**2) {
                e.mass += f.val; e.triggerEatEffect();
                if(e.isPlayer) playSynthSound('eat');
                eaten = true; break;
            }
        }
        if(eaten) { f.remove(); foods.splice(i, 1); }
    }

    for (let i = ejectedMasses.length - 1; i >= 0; i--) {
        let em = ejectedMasses[i];
        em.update(dt);
        if (Math.abs(em.x) > currentMapSize/2 || Math.abs(em.y) > currentMapSize/2) {
            em.remove(); ejectedMasses.splice(i, 1); continue;
        }
        let eaten = false;
        for(let e of entities) {
            if(e.dead) continue;
            let distSq = (e.x-em.x)**2 + (e.y-em.y)**2;
            if (distSq < e.getRadius()**2) {
                if (e !== em.parent || (Date.now() - em.bornTime > 500)) {
                    e.mass += em.val; e.triggerEatEffect();
                    if(e.isPlayer) playSynthSound('eat');
                    eaten = true; break;
                }
            }
        }
        if(eaten) { em.remove(); ejectedMasses.splice(i, 1); }
    }

    entities.sort((a,b) => a.mass - b.mass);

    entities.forEach((e, i) => {
        if (Math.abs(e.x) > currentMapSize/2 || Math.abs(e.y) > currentMapSize/2) {
            e.mass -= e.mass * 0.2 * dt;
            if (e.mass < 10) e.dead = true;
        }

        e.update(dt);

        for(let j = 0; j < entities.length; j++) {
            let other = entities[j];
            if(i === j || e.dead || other.dead) continue;

            let dist = Math.hypot(e.x - other.x, e.y - other.y);

            if (e.name === other.name) {
                if (dist < e.getRadius() + other.getRadius()) {
                    if (e.canMerge && other.canMerge && e.mass >= other.mass) {
                        e.mass += other.mass; e.triggerEatEffect();
                        if(e.isPlayer) playSynthSound('eat');
                        other.dead = true;
                    } else if (!e.canMerge || !other.canMerge) {
                        // COLLISION DOUCE (Glissement)
                        let a = Math.atan2(e.y - other.y, e.x - other.x);
                        // Force de repousse un peu réduite pour qu'ils restent proches
                        let f = 120 * dt;
                        e.x += Math.cos(a)*f; e.y += Math.sin(a)*f;
                        other.x -= Math.cos(a)*f; other.y -= Math.sin(a)*f;
                    }
                }
            } else {
                let eatDist = e.getRadius() - (other.getRadius() * 0.35);
                if(dist < eatDist && e.mass > other.mass * 1.25) {
                    e.mass += other.mass; e.triggerEatEffect();
                    if(e.isPlayer) playSynthSound('eat');
                    other.dead = true;
                }
            }
        }
    });

    entities = entities.filter(e => {
        if(e.dead) { e.container.destroy({children:true}); return false; }
        return true;
    });
    myCells = myCells.filter(e => !e.dead);

    lbTimer += dt;
    if(lbTimer > 0.5) {
        let scores = {};
        entities.forEach(e => { if(!scores[e.name]) scores[e.name]=0; scores[e.name]+=e.mass; });
        let sorted = Object.keys(scores).sort((a,b) => scores[b] - scores[a]).slice(0, 5);
        document.getElementById('leaderboard').innerHTML = sorted.map((name,i) =>
            `<div style="color:${name===document.getElementById('nickname').value?"#00ffcc":"white"}; display:flex; justify-content:space-between;"><span>#${i+1} ${name}</span><span>${Math.floor(scores[name])}</span></div>`
        ).join('');

        let unique = new Set(entities.map(e => e.name)).size;
        document.getElementById('alive-count').innerText = unique;
        document.getElementById('mass-display').innerText = Math.floor(playerTotalMass);

        if (unique === 1 && myCells.length > 0 && gameMode === 'BR') endGame(true);
        if (myCells.length === 0 && gameRunning) endGame(false);
        lbTimer = 0;
    }
});

window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('keydown', e => {
    if(e.code === 'Space') splitPlayer();
    if(e.code === 'KeyW') ejectMass();
    if(e.code === 'Escape') togglePause();
});