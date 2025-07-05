const path = require('path');
const fs = require('fs');
const readline = require('readline');

Error.stackTraceLimit = Infinity;
let enviroment = require('./lib/dotenv.js')(fs.readFileSync(path.join(__dirname, '../.env')).toString());
for (let key in enviroment) process.env[key] = enviroment[key];

const GLOBAL = require("./modules/global.js");

console.log(`[${GLOBAL.creationDate}]: Server initialized.\nRoom Info:\n Dimensions: ${room.width} x ${room.height}`);

Array.prototype.remove = function (index) {
    if (index === this.length - 1) return this.pop();
    let r = this[index];
    this[index] = this.pop();
    return r;
};

process.stdout.write(String.fromCharCode(27) + "]0;" + Config.WINDOW_NAME + String.fromCharCode(7));
util.log(room.width + " x " + room.height + " room initalized.");

const auraCollideTypes = ["miniboss", "tank", "food", "crasher"];
function collide(collision) {
    let instance = collision[0], other = collision[1];
    if (instance.noclip || other.noclip) return 0;
    instance.emit('collide', { body: instance, instance, other });
    other.emit('collide', { body: other, instance: other, other: instance });

    for (let ghost of [instance, other]) {
        if (ghost.isGhost) {
            util.error("GHOST FOUND");
            util.error(ghost.label);
            util.error("x: " + ghost.x + " y: " + ghost.y);
            util.error(ghost.collisionArray);
            util.error("health: " + ghost.health.amount);
            if (grid.checkIfInHSHG(ghost)) {
                ghost.kill();
                util.warn("Ghost removed.");
                grid.removeObject(ghost);
            }
            return 0;
        }
    }

    if ((!instance.activation.active && !other.activation.active) ||
        (instance.isArenaCloser && !instance.alpha) ||
        (other.isArenaCloser && !other.alpha)) return 0;

    switch (true) {
        case instance.type === "wall" || other.type === "wall":
            if (instance.type === "wall" && other.type === "wall") return;
            if (["aura", "satellite"].includes(instance.type) || ["aura", "satellite"].includes(other.type)) return;
            let wall = instance.type === "wall" ? instance : other;
            let entity = instance.type === "wall" ? other : instance;
            if (entity.isArenaCloser || entity.master.isArenaCloser) return;
            (wall.shape === 4 ? mazewallcollide : mooncollide)(wall, entity);
            break;

        case instance.team === other.team && (instance.settings.hitsOwnType === "pushOnlyTeam" || other.settings.hitsOwnType === "pushOnlyTeam"):
            let pusher = instance.settings.hitsOwnType === "pushOnlyTeam" ? instance : other;
            let ent = instance.settings.hitsOwnType === "pushOnlyTeam" ? other : instance;
            if (instance.settings.hitsOwnType === other.settings.hitsOwnType || ent.settings.hitsOwnType === "never") return;
            let a = 1 + 10 / (Math.max(ent.velocity.length, pusher.velocity.length) + 10);
            advancedcollide(pusher, ent, false, false, a);
            break;

        case (instance.type === "crasher" && other.type === "food" && instance.team === other.team) ||
             (other.type === "crasher" && instance.type === "food" && other.team === instance.team):
            firmcollide(instance, other);
            break;

        case instance.team !== other.team || (instance.team === other.team && (instance.healer || other.healer)):
            if (instance.type === "aura" && !auraCollideTypes.includes(other.type)) return;
            if (other.type === "aura" && !auraCollideTypes.includes(instance.type)) return;
            advancedcollide(instance, other, true, true);
            break;

        case instance.settings.hitsOwnType === "never" || other.settings.hitsOwnType === "never":
            break;

        case instance.settings.hitsOwnType === other.settings.hitsOwnType:
            switch (instance.settings.hitsOwnType) {
                case 'assembler':
                    if (instance.assemblerLevel == null) instance.assemblerLevel = 1;
                    if (other.assemblerLevel == null) other.assemblerLevel = 1;
                    const [target1, target2] = (instance.id > other.id) ? [instance, other] : [other, instance];
                    if (target2.assemblerLevel >= 10 || target1.assemblerLevel >= 10 || target1.isDead() || target2.isDead() || (target1.parent.id !== target2.parent.id && target1.parent.id && target2.parent.id)) {
                        advancedcollide(instance, other, false, false);
                        break;
                    }
                    const better = s => target1[s] > target2[s] ? target1[s] : target2[s];
                    target1.assemblerLevel = Math.min(target2.assemblerLevel + target1.assemblerLevel, 10);
                    target1.SIZE = better('SIZE') * 1.1;
                    target1.SPEED = better('SPEED') * 0.9;
                    target1.HEALTH = better('HEALTH') * 1.2;
                    target1.health.amount = target1.health.max;
                    target1.DAMAGE = better('DAMAGE') * 1.1;
                    target2.kill();
                    for (let i = 0; i < 10; ++i) {
                        const o = new Entity(target1, target1);
                        o.define('assemblerEffect');
                        o.team = target1.team;
                        o.color = target1.color;
                        o.SIZE = target1.SIZE / 3;
                        o.velocity = new Vector((Math.random() - 0.5) * 25, (Math.random() - 0.5) * 25);
                        o.refreshBodyAttributes();
                        o.life();
                    }
                case "push":
                    advancedcollide(instance, other, false, false);
                    break;
                case "hard":
                    firmcollide(instance, other);
                    break;
                case "hardWithBuffer":
                    firmcollide(instance, other, 30);
                    break;
                case "hardOnlyTanks":
                    if (instance.type === "tank" && other.type === "tank" && !instance.isDominator && !other.isDominator) firmcollide(instance, other);
                    break;
                case "hardOnlyBosses":
                    if (instance.type === other.type && instance.type === "miniboss") firmcollide(instance, other);
                    break;
                case "repel":
                    simplecollide(instance, other);
                    break;
            }
            break;
    }
}

let ticks = 0;
const gameloop = () => {
    logs.loops.tally();
    logs.master.startTracking();
    logs.activation.startTracking();
    logs.activation.endTracking();
    logs.collide.startTracking();
    if (entities.length > 1) {
        grid.update();
        let pairs = grid.queryForCollisionPairs();
        for (let i = 0; i < pairs.length; i++) collide(pairs[i]);
    }
    logs.collide.endTracking();
    logs.entities.startTracking();
    for (let my of entities) {
        if (my.contemplationOfMortality()) my.destroy();
        else {
            if (my.activation.active || my.isPlayer) {
                if (my.bond == null) {
                    logs.physics.startTracking();
                    my.physics();
                    logs.physics.endTracking();
                }
                logs.entities.tally();
                logs.life.startTracking();
                my.life();
                logs.life.endTracking();
                my.friction();
                my.confinementToTheseEarthlyShackles();
                logs.selfie.startTracking();
                my.takeSelfie();
                logs.selfie.endTracking();
            }
            my.collisionArray = [];
            my.activation.update();
            my.updateAABB(my.activation.active);
        }
        my.collisionArray = [];
        my.emit('tick', { body: my });
    }
    logs.entities.endTracking();
    logs.master.endTracking();
    purgeEntities();
    room.lastCycle = performance.now();
    ticks++;
    if (ticks & 1) for (let i = 0; i < sockets.players.length; i++) {
        sockets.players[i].socket.view.gazeUpon();
        sockets.players[i].socket.lastUptime = Infinity;
    }
};

setTimeout(closeArena, 24 * 60 * 60 * 1000);

global.naturallySpawnedBosses = [];
global.bots = [];
let bossTimer = 0;
let regenerateHealthAndShield = () => {
    for (let i = 0; i < entities.length; i++) {
        let e = entities[i];
        if (e.shield.max) e.shield.regenerate();
        if (e.health.max) e.health.regenerate(e.shield.max && e.shield.amount === e.shield.max);
    }
};

const maintainloop = () => {
    if (!naturallySpawnedBosses.length && bossTimer++ > Config.BOSS_SPAWN_COOLDOWN) {
        bossTimer = -Config.BOSS_SPAWN_DURATION;
        let selection = Config.BOSS_TYPES[ran.chooseChance(...Config.BOSS_TYPES.map(x => x.chance))];
        let amount = ran.chooseChance(...selection.amount) + 1;
        if (selection.message) sockets.broadcast(selection.message);
        sockets.broadcast(amount > 1 ? "Visitors are coming." : "A visitor is coming.");
        setSyncedTimeout(() => {
            let names = ran.chooseBossName(selection.nameType, amount);
            for (let i = 0; i < amount; i++) {
                let spot, attempts = 30, name = names[i];
                do { spot = getSpawnableArea(TEAM_ENEMIES); } while (attempts-- && dirtyCheck(spot, 500));
                let boss = new Entity(spot);
                boss.define(selection.bosses.sort(() => 0.5 - Math.random())[i % selection.bosses.length]);
                boss.team = TEAM_ENEMIES;
                if (name) boss.name = name;
                naturallySpawnedBosses.push(boss);
                boss.on('dead', () => util.remove(naturallySpawnedBosses, naturallySpawnedBosses.indexOf(boss)));
            }
            sockets.broadcast(`${util.listify(names)} ${names.length == 1 ? 'has' : 'have'} arrived!`);
        }, Config.BOSS_SPAWN_DURATION * 30);
    }

    for (let i = 0; i < bots.length; i++) {
        let o = bots[i];
        if (o.skill.level < Config.LEVEL_CAP) o.skill.score += Config.BOT_XP;
        o.skill.maintain();
        o.skillUp([ "atk", "hlt", "spd", "str", "pen", "dam", "rld", "mob", "rgn", "shi" ][ran.chooseChance(...Config.BOT_SKILL_UPGRADE_CHANCES)]);
        if (o.leftoverUpgrades && o.upgrade(ran.irandomRange(0, o.upgrades.length))) o.leftoverUpgrades--;
    }

    if (!global.arenaClosed && bots.length < Config.BOTS) {
        let botName = Config.BOT_NAME_PREFIX + ran.chooseBotName();
        let team = Config.MODE === "tdm" ? getWeakestTeam() : undefined;
        let limit = 20, loc;
        do { loc = getSpawnableArea(team); } while (limit-- && dirtyCheck(loc, 50));
        let o = new Entity(loc);
        o.define(Config.SPAWN_CLASS);
        o.define({ CONTROLLERS: ["nearestDifferentMaster"] });
        o.refreshBodyAttributes();
        o.skill.score = Config.BOT_START_XP;
        o.isBot = true;
        o.name = botName;
        o.invuln = true;
        o.nameColor = "#ffffff";
        o.leftoverUpgrades = ran.chooseChance(...Config.BOT_CLASS_UPGRADE_CHANCES);
        let color = Config.RANDOM_COLORS ? Math.floor(Math.random() * 20) : team ? getTeamColor(team) : "darkGrey";
        o.color.base = color;
        if (team) o.team = team;
        bots.push(o);
        setTimeout(() => {
            let index = o.index;
            o.define('bot');
            o.index = index;
            o.refreshBodyAttributes();
            o.invuln = false;
        }, 3000 + Math.floor(Math.random() * 7000));
        o.on('dead', () => util.remove(bots, bots.indexOf(o)));
    }
};

if (Config.REPL_WINDOW) {
    util.log('Starting REPL Terminal.');
    require('repl').start({ useGlobal: true });
}

let counter = 0;
setInterval(() => regenerateHealthAndShield(), room.regenerateTick);
setInterval(() => {
    gameloop();
    gamemodeLoop();
    roomLoop();
    if (counter++ / Config.runSpeed > 30) {
        chatLoop();
        maintainloop();
        speedcheckloop();
        counter = 0;
    }
    syncedDelaysLoop();
}, room.cycleSpeed);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', input => {
    input = input.trim();
    if (!input.length) return;
    try {
        const result = eval(input);
        if (result instanceof Promise) {
            result.then(res => console.log('>', res)).catch(err => console.error(err));
        } else {
            console.log('>', result);
        }
    } catch (err) {
        console.error('[ERROR]', err);
    }
});
