const MAX_PLAYERS = 25;
const PLAYER_OFFSET = 4;

const MIN_WIDTH = 10;
const MIN_HEIGHT = 10;
const DEFAULT_WIDTH = 30;
const DEFAULT_HEIGHT = 20;

const SOLID_STONE = 26;

const START_SPEED = 1000;
const MIN_SPEED = 40; // vorher 25

const ROW_SCORE = 1.25;
const BASE_SCORE = 10;

const KEYS = {
    rotateLeft: 81,
    rotateRight: 69,
    moveLeft: 65,
    moveRight: 68,
    moveDown: 83,
    drop: 0
};

function strToColor(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash;
}

class Stone {

    constructor(userid) {
        // 1: OX  2: XOX 4: XOX  5: XX  6: X    7: OXX  8: OX  9:  OX  10: XX   O = rotation center
        // 3: XOXX           X      OX     OXX     X       X      XX        OX
        this.kind = 1;
        this.pos = [-1, -1, -1, -1];
        this.color = userid;
        this.rotation = 1;
        this.start = 0;
    }

    user(id) {
        return this.color == id;
    }

    setPosition(width) {
        const at = this.start;

        switch (this.kind) {
            case 1:
                this.pos = [(width / 2) - 1 + at, (width / 2) + at, -1, -1];
                break;
            case 2:
                this.pos = [(width / 2) - 1 + at, (width / 2) + at, (width / 2) + 1 + at, -1];
                break;
            case 3:
                this.pos = [
                    (width / 2) - 1 + at, (width / 2) + at,
                    (width / 2) + 1 + at, (width / 2) + 2 + at
                ]; break;
            case 4:
                this.pos = [
                    (width / 2) - 1 + at, width / 2 + at,
                    width / 2 + 1 + at, width / 2 + width + at
                ]; break;
            case 5:
                this.pos = [
                    (width / 2) - 1 + at, width / 2 + at,
                    width / 2 - 1 + width + at, width / 2 + width + at
                ]; break;
            case 6:
                this.pos = [
                    (width / 2) - 1 + at, width / 2 - 1 + width + at,
                    width / 2 + width + at, width / 2 + 1 + width + at
                ]; break;
            case 7:
                this.pos = [
                    (width / 2) - 1 + at, width / 2 + at,
                    width / 2 + 1 + at, width / 2 - 1 + width + at
                ]; break;
            case 8:
                this.pos = [(width / 2) - 1 + at, width / 2 + at, width / 2 - 1 + width + at, -1];
                break;
            case 9:
                this.pos = [
                    (width / 2) + at, (width / 2) + 1 + at,
                    width / 2 - 1 + width + at, width / 2 + width + at
                ]; break;
            case 10:
                this.pos = [
                    (width / 2) - 1 + at, (width / 2) + at,
                    width / 2 + width + at, width / 2 + 1 + width + at
                ]; break;
        }
    }

    down(width) {
        this.pos.forEach(p => {
            if (p !== -1) p += width;
        });
    }

    left() {
        this.pos.forEach(p => {
            if (p !== -1) p--;
        });
    }

    right() {
        this.pos.forEach(p => {
            if (p !== -1) p++;
        });
    }

    static solid() {
        const stone = new Stone();
        stone.color = SOLID_STONE;
        return stone;
    }
}

class Player {

    constructor(userid, name, status) {
        this.id = userid;
        this.isAdmin = status;
        this.hash = strToColor(name);
        this.score = 0;
    }

    user(id) {
        return this.id == id;
    }

    makeAdmin() {
        this.isAdmin = true;
    }
}

const DEFAULT_SETTINGS = {
    fixed: false,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    maxPlayers: MAX_PLAYERS,
    background: 0
};

class Room {

    constructor(
        roomName,
        roomID,
        settings=DEFAULT_SETTINGS
    ) {
        // Field data
        this.fieldHeight = settings.height;
        this.fieldWidth = settings.width;
        this.background = settings.background;
        // Metadata
        this.level = 1;
        this.initSpeed();
        this.id = roomID;
        this.name = roomName;
        // Players and stones
        this.players = [];
        this.stones = [];
        this.solids = new Set();
        // Game flags
        this.gameOver = false;
        this.gameStarted = false;
        this.stateChanged = false;
        this.paused = false;
        this.state = -1;
        // Callbacks
        this.callback;
        this.speedUpdate;
        // Player count stuff
        this.fixed = settings.fixed;
        this.setMaxPlayers(settings.maxPlayers);
        if (!this.fixed) {
            this.calculateFieldSize();
        }
        this.initField();
        console.info(`Created Lobby "${this.name}"`);
        console.info(`\tdimensions = (${this.fieldWidth}, ${this.fieldHeight})`);
        console.info(`\tmax. players = ${this.maxPlayers}`);
        console.info(`\tbackground = ${this.background}`);
    }

    status() {
        const s = this.state;
        this.state = -1;
        return s;
    }

    score(userid=-1) {
        if (this.hasUser(userid)) {
            return this.players[userid].score;
        } else {
            return this.players.reduce((acc, p) => Math.max(acc,p.score), 0);
        }
    }

    initSpeed() {
        this.speed = START_SPEED;
        this.multiplier = 1;
    }

    updateSpeed() {
        const minus = Math.floor(this.speed / 4);
        if (this.speed - minus >= MIN_SPEED) {
            this.speed -= minus;
            this.multiplier += 10;
        } else {
            const newSpeed = Math.max(MIN_SPEED, (this.speed - MIN_SPEED) / 2);
            if (newSpeed != this.speed) {
                this.multiplier += 10;
                this.speed = newSpeed;
            }
        }
    }

    setGameOverCallback(func) {
        this.callback = func;
    }

    callGameOverCallback() {
        if (this.callback) this.callback(this.name, this.players, this.score);
        this.stopGameLoop();
    }

    setGameCallback(func) {
        this.gameCallback = func;
    }

    callGameCallback() {
        if (this.gameCallback) this.gameCallback(this);
    }

    startGame() {
        this.gameOver = false;
        this.gameStarted = true;
        this.paused = false;
        console.info("Game \"" + this.name + "\" started");
        this.setGameLoop();
    }

    stopGameLoop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    setGameLoop() {
        this.interval = setInterval(() => {
            this.dropStones();
            this.callGameCallback();
        }, this.speed);
    }

    initField() {
        this.field = new Array(this.fieldHeight * this.fieldWidth);
        this.field.fill(0);
    }

    calculateFieldSize() {
        this.fieldWidth = MIN_WIDTH + (2 * PLAYER_OFFSET);
        this.fieldHeight = Math.max(MIN_HEIGHT, this.fieldWidth + PLAYER_OFFSET);
    }

    reset() {
        this.level = 1;
        this.score = 0;
        this.multiplier = 1;
        this.gameOver = false;
        this.gameStarted = false;
        this.stateChanged = false;
        this.paused = false;
        this.players = [];
        this.stones = [];
        this.solids.clear();
        this.initField();
        this.initSpeed();
    }

    setMaxPlayers(max) {
        if (!this.fixed) {
            this.maxPlayers = Math.floor((this.fieldWidth - 1) / (PLAYER_OFFSET + 1));
        } else {
            this.maxPlayers = max > 0 ? max : 4;
        }
    }

    getMaxPlayerCount() {
        return this.fixed ? this.maxPlayers : MAX_PLAYERS;
    }

    addUser(username, isAdmin=false) {
        if (!isAdmin && this.players.length === 0) {
            isAdmin = true;
        }

        if (this.players.length < this.maxPlayers) {
            console.info(`Player "${username}" joined game "${this.name}"`);
            this.players.push(new Player(this.players.length, isAdmin));
            this.stones.push(new Stone(this.players.length));
            this.spawnStone(this.stones.length-1);

            this.state = 1;
            return this.players.length-1;

        } else if (!this.fixed) {
            // TODO resize field according to player count
            console.info(`Player "${username}" joined game "${this.name}"`);
            this.growField();
            this.players.push(new Player(this.players.length, isAdmin));
            this.stones.push(new Stone(this.players.length));
            this.spawnStone(this.stones.length-1);

            this.state = 2;
            return this.players.length-1;
        }
        this.state = 0;
        return -1;
    }

    getUser(userid) {
        return this.players.find(p => p.user(userid));
    }

    hasUser(userid) {
        return userid >= 0 && userid < this.players.length;
    }

    togglePause(userid) {
        if (this.isAdmin(userid)) {
            this.paused = !this.paused;
            return true;
        }
        return false;
    }

    getAllHashes() {
        return this.players.map(p => p.hash);
    }

    isAdmin(userid) {
        return this.hasUser(userid) && this.players[userid].isAdmin;
    }

    instaDrop(userid) {
        if (!this.hasUser(userid)) return;

        const tmp = [true, true, true, true]
        let found = false;
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (this.stones[userid].pos[i] + this.fieldWidth === this.stones[userid].pos[j] ||
                    this.stones[userid].pos[i] === -1
                ) {
                    tmp[i] = false;
                }
            }
        }

        let tmpStone = [-1, -1, -1, -1];
        for (let k = 0; k < 4; k++) {
            if (tmp[k] === true) {
                const max_h = this.fieldHeight - Math.floor(this.stones[userid].pos[k] / this.fieldWidth)
                for (let l = 0; l < max_h; l++) {
                    if (this.field[this.stones[userid].pos[k] + (l + 1) * this.fieldWidth] > 0 || l === max_h - 1) {
                        if (!found || this.stones[userid].pos[0] + l * this.fieldWidth < tmpStone[0]) {
                            tmpStone = [this.stones[userid].pos[0] + l * this.fieldWidth,
                                        this.stones[userid].pos[1] + l * this.fieldWidth,
                                        this.stones[userid].pos[2] === -1 ? -1 : this.stones[userid].pos[2] + l * this.fieldWidth,
                                        this.stones[userid].pos[3] === -1 ? -1 : this.stones[userid].pos[3] + l * this.fieldWidth]
                            found = true;
                        }
                    }
                }
            }
        }
        this.stones[userid].pos = tmpStone;
        this.setStaticStone(userid);
        this.stonefinished(userid);
    }

    setStartPosition(userid) {
        if ((userid + 1) % 2 === 0) {
            this.stones[userid].start = -PLAYER_OFFSET * Math.floor((userid + 1) / 2);
        } else {
            this.stones[userid].start = PLAYER_OFFSET * Math.floor((userid + 1) / 2);
        }
    }

    removeUser(userid) {
        if (userid >= 0 && userid < this.players.length) {
            // Remove player and player's stone from game
            if (userid === 0) {
                this.players.shift();
                this.stones.shift();
            } else if (userid === this.players.length - 1) {
                this.players.pop();
                this.stones.pop();
            } else {
                this.players = this.players.filter(function(p) { return p.user(userid); });
                this.stones = this.stones.filter(function(s) { return s.user(userid); });
            }
            // Delete/Reset game when there is no player left
            if (this.players.length === 0) {
                this.callGameOverCallback();
            } else {
                if (this.players.length === 1) {
                    this.players[0].makeAdmin();
                }
                if (!this.fixed) {
                    this.shrinkField();
                    return this.state = 2;
                }
            }
            return this.state = 1;
        }
        this.state = 0;
    }

    getLastUser() {
        return this.players.length - 1;
    }

    // Increase field size and transfer old data + update all players
    growField() {
        if (this.fixed) return;

        const prev = this.paused;
        this.paused = true;
        this.maxPlayers++;
        // store old field size to be able to adjust players
        const oldWidth = this.fieldWidth;
        const oldHeight = this.fieldHeight;
        // compute new field size
        const newWidth = oldWidth + (2 * PLAYER_OFFSET);
        const newHeight = newWidth + PLAYER_OFFSET > oldHeight ?
            newWidth + PLAYER_OFFSET :
            oldHeight;

        this.field = this.adjustField(newWidth, newHeight, oldHeight-1, oldWidth);
        this.adjustPlayers(oldWidth, oldHeight, false);

        this.paused = prev;
    }

    // Decrease field size and transfer old data + update all players
    shrinkField() {
        if (this.fixed) return;

        const prev = this.paused;
        this.paused = true;
        this.maxPlayers--;
        // Store old field size to be able to adjust players
        const oldWidth = this.fieldWidth;
        const oldHeight = this.fieldHeight;
        // Compute new field size
        const newWidth = oldWidth - PLAYER_OFFSET > MIN_WIDTH ?
            oldWidth - PLAYER_OFFSET :
            MIN_WIDTH;
        const newHeight = oldHeight - Math.floor(PLAYER_OFFSET/2) > MIN_HEIGHT ?
            oldHeight - Math.floor(PLAYER_OFFSET/2) :
            MIN_HEIGHT;

        this.field = this.adjustField(newWidth, newHeight, newHeight-1, newWidth);
        this.adjustPlayers(oldWidth, oldHeight, true);

        this.paused = prev;
    }

    // Transfer old field data to new larger/smaller field
    adjustField(width, height, limitV, limitH, shrink) {
        const newField = new Array(width * height);
        newField.fill(0);

        // Clear list of rows holding immortal stones
        if (shrink)
            this.solids.clear();

        let stop = false;
        // Difference in height between new and old field
        let diff = shrink ? 0 : Math.abs(height - this.fieldHeight);
        // Starting from the bottom of the old field when the new field is bigger
        // or the bottom of the new field when the new field is smaller: copy data
        for (let i = limitV; i >= 0 && !stop; i--) {
            let empty = 0;
            // Check all fields of the current row
            for (let j = 0; j < limitH; j++) {
                // If we are shrinking and there is an immortal stone in this row
                // add its row to the list of rows holding immortal stones
                if (shrink && this.field[(i * this.fieldWidth) + j] === SOLID_STONE) {
                    this.solids.add(i);
                }
                // If the field is not empty or holds an immortal and we are NOT
                // shrinking, then we copy this field
                else if (this.field[(i * this.fieldWidth) + j] > 0) {
                    newField[((i + diff) * width) + j] = this.field[(i * this.fieldWidth) + j];
                } else {
                    // If the field is empty increment the optimization counter
                    empty++
                    // If we find an empty row we can stop, there
                    // can be no other static stones above this row
                    if (empty == this.fieldWidth)
                        stop = true;
                }
            }
        }
        // Set new width and height
        this.fieldWidth = width;
        this.fieldHeight = height;

        return newField;
    }

    // Reposition playerstones to fit the new field
    adjustPlayers(width, height, shrink) {
        // Difference between old and new field width
        const diff = Math.abs(width - this.fieldWidth);
        for (let i = 0; i < this.stones.length; i++) {
            let cancel = false;
            let setStatic = false;
            // Check all single stones
            for (let j = 0; j < 4 && !cancel && this.stones[i].pos[j] != -1; j++) {
                // Compute the row this stone was in in the old field
                let row = Math.floor(this.stones[i].pos[j] / width);
                if (shrink) {
                    // If we are shrinking and the stone is in the
                    // last row of our new field, mark it as static
                    if (row === this.fieldHeight-1) {
                        setStatic = true;
                    }
                    // If the stone is further down than our new
                    // field's height is, spawn a new stone for
                    // this player and go to the next stone
                    else if (row > this.fieldHeight-1) {
                        this.spawnStone(i);
                        setStatic = false;
                        cancel = true;
                    }
                    // Reposition the stone (upwards) by the width difference
                    else {
                        this.stones[i].pos[j] -= (row * diff);
                    }
                }
                // If we are not shrinking all stones can fit the field
                // and we just reposition the stone (downwards) by the width difference
                else {
                    this.stones[i].pos[j] += (row * diff);
                }
            }
            // If this stone is marked as static set it down
            if (setStatic) {
                this.setStaticStone(i);
                this.stonefinished(i);
            }
        }
    }

    // Called when stone of user width id 'userid' reached
    // the current bottom of the field
    // Checks whether any rows need to be deleted
    stonefinished(userid) {
        let stop = false;
        let numFullRows = 0;
        // from bottom to top check all rows
        for (let i = this.fieldHeight-1; i >= 0 && !stop; i--) {
            // count of empty/filled fields in this row
            let empty = 0, full = 0;

            for (let j = this.fieldWidth-1; j >= 0; j--) {
                // if there is a filled field and there is no
                // immortal stone in this row
                if (this.field[i * this.fieldWidth + j] > 0 && !this.solids.has(i)) {
                    full++;
                    // When the whole row is full
                    if (full === this.fieldWidth) {
                        numFullRows++;
                        let change = false;
                        for (let k = 0; k < i; k++) {
                            let emptyRow = 0;
                            // If there is no immortal stone is in this row, destroy it
                            if (!this.solids.has(i-k)) {
                                change = true;
                                for (let l = 0; l < this.fieldWidth; l++) {
                                    emptyRow += this.field[(i - k - 1) * this.fieldWidth + l];
                                    this.field[(i - k) * this.fieldWidth + l] = this.field[(i - k - 1) * this.fieldWidth + l];
                                }
                                // if the row was empty stop checking
                                if (emptyRow === 0) {
                                    k = i;
                                }
                            }
                        }
                        // if a row was deleted the row index must not change
                        // because the our current row is now one of the former above rows
                        i = change ? i + 1 : i;
                    }
                }
                // If the field is empty
                else if (this.field[i * this.fieldWidth + j] === 0) {
                    empty++;
                    // When there are empty and filled fields in this row
                    // we can skip this row, it cannot be deleted, but there
                    // may be other above of it that can
                    if (full > 0) {
                        j = -1;
                    }
                    // If we found a completely empty row we can stop checking
                    else if (empty === this.fieldWidth) {
                        stop = true;
                    }
                }
            }
        }
        this.updateScoreLevel(userid, numFullRows);
        // Spawn a new stone for the user with id 'userid'
        this.spawnStone(userid);
    }

    updateScoreLevel(userid, rows) {
        if (rows <= 0) return;

        const newScore = this.getUser(userid).updateScore(
            BASE_SCORE * this.multiplier + (rows-1) * ROW_SCORE
        );
        if (newScore > this.levelScore()) {
            this.level++;
            this.updateSpeed();
            this.stopGameLoop();
            this.setGameLoop();
        }
    }

    levelScore() {
        return this.level * 1000;
    }

    setStaticStone(userid) {
        for (let i = 0; i < 4 && this.stones[userid].pos[i] != -1; i++) {
            if (this.field[this.stones[userid].pos[i]] > 0) {
                this.spawnSolidStone(this.stones[userid].pos[i])
            } else {
                this.field[this.stones[userid].pos[i]] = userid + 1;
            }
        }
        this.stateChanged = true;
    }

    spawnSolidStone(pos) {
        this.field[pos] = Stone.solid();
        this.solids.add(Math.floor(pos / this.fieldWidth));
    }

    spawnStone(userid) {
        // roll the dice to decide which form the stone has (1-10)
        this.stones[userid].kind = Math.floor((Math.random() * 10) + 1);
        // no rotation
        this.stones[userid].rotation = 1;
        // compute the starting position of the new stone
        this.setStartPosition(userid);
        // create a new stone
        this.getNewStone(userid);
    }

    getNewStone(userid) {
        this.stones[userid].setPosition(this.fieldWidth);
    }

    movestone(key, userid) {
        if (this.paused) return;

        const stone = this.stones[userid];
        // Turn Left (Q)
        if (key === KEYS.rotateLeft) {
            switch (stone.kind) {
                case 1: // OX
                    if (stone.rotation === 1 && this.field[stone.pos[0] - this.fieldWidth] === 0) {
                        stone.pos[1] = stone.pos[0] - this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] - 1] === 0) {
                        if (stone.pos[0] % this.fieldWidth === 0) {
                            stone.pos[1] = stone.pos[0];
                            stone.pos[0]++;
                        } else {
                            stone.pos[1] = stone.pos[0] - 1;
                        }
                    } else if (stone.rotation === 3 && this.field[stone.pos[0] + this.fieldWidth] === 0) {
                        stone.pos[1] = stone.pos[0] + this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[0] + 1] === 0) {
                        if (stone.pos[0] % this.fieldWidth === (this.fieldWidth - 1)) {
                            stone.pos[1] = stone.pos[0];
                            stone.pos[0]--;
                        } else {
                            stone.pos[1] = stone.pos[0] + 1;
                        }
                    } else
                        break;
                    stone.rotation = stone.rotation === 4 ? 1 : stone.rotation+1;
                    break;
                case 2: // XOX
                    if (stone.rotation === 1 && this.field[stone.pos[1] - this.fieldWidth] === 0 && this.field[stone.pos[0] + this.fieldWidth] === 0) {
                        stone.pos[0] = stone.pos[1] - this.fieldWidth;
                        stone.pos[2] = stone.pos[1] + this.fieldWidth;
                        stone.rotation = 2;
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] - 1] === 0 && this.field[stone.pos[1] + 1] === 0) {
                        if (stone.pos[1] % this.fieldWidth === 0) {
                            stone.pos[0] = stone.pos[1];
                            stone.pos[1]++;
                            stone.pos[2] = stone.pos[1] + 1;
                        } else if (stone.pos[1] % this.fieldWidth === (this.fieldWidth-1)) {
                            stone.pos[2] = stone.pos[1];
                            stone.pos[1]--;
                            stone.pos[0] = stone.pos[1] - 1;
                        } else {
                            stone.pos[0] = stone.pos[1] - 1;
                            stone.pos[2] = stone.pos[1] + 1;
                        }
                        stone.rotation = 1;
                    } break;
                case 3: // XOXX
                    if (stone.rotation === 1 && this.field[stone.pos[0] + (this.fieldWidth + 1)] === 0 && this.field[stone.pos[2] - (this.fieldWidth + 1)] === 0 && this.field[stone.pos[3] - 2 * (this.fieldWidth + 1)] === 0) {
                        stone.pos[0] += (this.fieldWidth + 1);
                        stone.pos[2] -= (this.fieldWidth + 1);
                        stone.pos[3] -= 2 * (this.fieldWidth + 1);
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] - 1] === 0 &&
                               this.field[stone.pos[1] - 2] === 0 && this.field[stone.pos[1] + 1] === 0) {
                        if (stone.pos[1] % this.fieldWidth === 0) {
                            stone.pos[1] += 2;
                        }
                        stone.pos[0] = stone.pos[1] + 1;
                        stone.pos[2] = stone.pos[1] - 1;
                        stone.pos[3] = stone.pos[1] - 2;
                    } else if (stone.rotation === 3 && this.field[stone.pos[1] + this.fieldWidth] === 0 &&
                               this.field[stone.pos[1] + (2 * this.fieldWidth)] === 0 && this.field[stone.pos[1] - this.fieldWidth] === 0) {
                        stone.pos[0] = stone.pos[1] - this.fieldWidth;
                        stone.pos[2] = stone.pos[1] + this.fieldWidth;
                        stone.pos[3] = stone.pos[1] + (this.fieldWidth * 2);
                    } else if (stone.rotation === 4 && this.field[stone.pos[1] - 1] === 0 &&
                               this.field[stone.pos[1] + 1] === 0 && this.field[stone.pos[1] + 2] === 0) {
                        if (stone.pos[1] % this.fieldWidth === (this.fieldWidth - 1)) {
                            stone.pos[1] -= 2;
                        }
                        stone.pos[0] = stone.pos[1] - 1;
                        stone.pos[2] = stone.pos[1] + 1;
                        stone.pos[3] = stone.pos[1] + 2;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 4: // T XOX
                    if (stone.rotation === 1 && this.field[stone.pos[1] - this.fieldWidth] === 0) {
                        stone.pos[0] = stone.pos[1] - this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] - 1] === 0) {
                        if (stone.pos[1] % this.fieldWidth === 0) {
                            stone.pos[1]++;
                            stone.pos[2]++;
                        }
                        stone.pos[0] = stone.pos[1] - 1;
                        stone.pos[3] = stone.pos[1] - this.fieldWidth;
                    } else if (stone.rotation === 3 && this.field[stone.pos[1] + this.fieldWidth] === 0) {
                        stone.pos[2] = stone.pos[1] + this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[1] + 1] === 0) {
                        stone.pos[2] = stone.pos[1] + 1;
                        stone.pos[3] = stone.pos[1] + this.fieldWidth;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 6: // J - Inverse L
                    if (stone.rotation === 1 && this.field[stone.pos[1] - 1] === 0 && this.field[stone.pos[0] - this.fieldWidth] === 0) {
                        if (stone.pos[1] % this.fieldWidth === 0) {
                            stone.pos[1]++;
                            stone.pos[0]++;
                        }
                        stone.pos[3] = stone.pos[1] - 1;
                        stone.pos[2] = stone.pos[0] - this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] + this.fieldWidth] === 0 && this.field[stone.pos[3] - 1] === 0) {
                        if (stone.pos[3] % this.fieldWidth === 0) {
                            stone.pos[3]++;
                            stone.pos[1]++;
                        }
                        stone.pos[0] = stone.pos[1] + this.fieldWidth;
                        stone.pos[2] = stone.pos[3] - 1;
                    } else if (stone.rotation === 3 && this.field[stone.pos[0] + this.fieldWidth] === 0 && this.field[stone.pos[1] + 1] === 0) {
                        if (stone.pos[1] % this.fieldWidth === (this.fieldWidth - 1)) {
                            stone.pos[1]--;
                            stone.pos[0]--;
                        }
                        stone.pos[2] = stone.pos[1] + 1;
                        stone.pos[3] = stone.pos[0] + this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[2] + 1] === 0 && this.field[stone.pos[1] - this.fieldWidth] === 0) {
                        if (stone.pos[2] % this.fieldWidth === (this.fieldWidth - 1)) {
                            stone.pos[2]--;
                            stone.pos[1]--;
                        }
                        stone.pos[0] = stone.pos[1] - this.fieldWidth;
                        stone.pos[3] = stone.pos[2] + 1;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 7: // L
                    if (stone.rotation === 1 && this.field[stone.pos[0] - this.fieldWidth] === 0 && this.field[stone.pos[0] - (2 * this.fieldWidth)] === 0) {
                        stone.pos[2] = stone.pos[0] - this.fieldWidth;
                        stone.pos[3] = stone.pos[2] - this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] - 1] === 0 && this.field[stone.pos[0] - 2] === 0) {
                        if (stone.pos[0] % this.fieldWidth === 0) {
                            stone.pos[0] += 2;
                            stone.pos[2] += 2;
                        }
                        stone.pos[1] = stone.pos[0] - 1;
                        stone.pos[3] = stone.pos[0] - 2;
                    } else if (stone.rotation === 3 && this.field[stone.pos[0] + this.fieldWidth] === 0 && this.field[stone.pos[0] + (2 * this.fieldWidth)] === 0) {
                        stone.pos[2] = stone.pos[0] + this.fieldWidth;
                        stone.pos[3] = stone.pos[2] + this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[0] + 1] === 0 && this.field[stone.pos[0] + 2] === 0) {
                        if (stone.pos[0] % this.fieldWidth === (this.fieldWidth-1)) {
                            stone.pos[0] -= 2;
                        } else if (stone.pos[0] % this.fieldWidth === (this.fieldWidth-2)) {
                            stone.pos[0]--;
                        }
                        stone.pos[1] = stone.pos[0] + 1;
                        stone.pos[2] = stone.pos[0] + 2;
                        stone.pos[3] = stone.pos[0] + this.fieldWidth;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 8: // kleines L
                    if (stone.rotation === 1 && this.field[stone.pos[0] - this.fieldWidth] === 0) {
                        stone.pos[2] = stone.pos[0] - this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] - 1] === 0) {
                        if (stone.pos[0] % this.fieldWidth === 0) {
                            stone.pos[0]++;
                            stone.pos[2]++;
                        }
                        stone.pos[1] = stone.pos[0] - 1;
                    } else if (stone.rotation === 3 && this.field[stone.pos[0] + this.fieldWidth] === 0) {
                        stone.pos[2] = stone.pos[0] + this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[0] + 1] === 0) {
                        stone.pos[1] = stone.pos[0] + 1;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 9: // S
                    if (stone.rotation === 1 && this.field[stone.pos[2] + 2] === 0 && this.field[stone.pos[3] - 2 * this.fieldWidth] === 0) {
                        stone.pos[2] += 2;
                        stone.pos[3] -= 2 * this.fieldWidth;
                        stone.rotation = 2;
                    } else if (stone.rotation === 2 && this.field[stone.pos[2] - 2] === 0 && this.field[stone.pos[3] + 2 * this.fieldWidth] === 0) {
                        stone.pos[2] -= 2;
                        stone.pos[3] += 2 * this.fieldWidth;
                        stone.rotation = 1;
                    } break;
                case 10: // Z
                    if (stone.rotation === 1 && this.field[stone.pos[0] + 2] === 0 && this.field[stone.pos[1] + 2 * this.fieldWidth] === 0) {
                        stone.pos[0] += 2;
                        stone.pos[1] += 2 * this.fieldWidth;
                        stone.rotation = 2;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] - 2] === 0 && this.field[stone.pos[1] - 2 * this.fieldWidth] === 0) {
                        stone.pos[0] -= 2;
                        stone.pos[1] -= 2 * this.fieldWidth;
                        stone.rotation = 1;
                    } break;
                default: break;
            }
        // Turn Right (E)
        } else if (key === KEYS.rotateRight) {
            switch (stone.kind) {
                case 1: // OX
                    if (stone.rotation === 1 && this.field[stone.pos[0] + this.fieldWidth] === 0) {
                        stone.pos[1] = stone.pos[0] + this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] - 1] === 0) {
                        stone.pos[1] = stone.pos[0] - 1;
                    } else if (stone.rotation === 3 && this.field[stone.pos[0] - this.fieldWidth] === 0) {
                        stone.pos[1] = stone.pos[0] - this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[0] + 1] === 0) {
                        stone.pos[1] = stone.pos[0] + 1;
                    } else
                        break;
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 2: // XOX
                    if (stone.rotation === 1 && this.field[stone.pos[0] - (this.fieldWidth - 1)] === 0 && this.field[stone.pos[2] + (this.fieldWidth - 1)] === 0) {
                        stone.pos[0] -= (this.fieldWidth - 1);
                        stone.pos[2] += (this.fieldWidth - 1);
                        stone.rotation = 2;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] + (this.fieldWidth - 1)] === 0 && this.field[stone.pos[2] - (this.fieldWidth - 1)] === 0) {
                        stone.pos[0] += (this.fieldWidth - 1);
                        stone.pos[2] -= (this.fieldWidth - 1);
                        stone.rotation = 1;
                    } break;
                case 3: // XOXX
                    if (stone.rotation === 1 && this.field[stone.pos[1] - this.fieldWidth] === 0 &&
                        this.field[stone.pos[1] + this.fieldWidth] === 0 && this.field[stone.pos[1] + (2 * this.fieldWidth)] === 0) {
                        stone.pos[0] = stone.pos[1] - this.fieldWidth;
                        stone.pos[2] = stone.pos[1] + this.fieldWidth;
                        stone.pos[3] = stone.pos[1] + (2 * this.fieldWidth);
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] - 1] === 0 &&
                               this.field[stone.pos[1] - 2] === 0 && this.field[stone.pos[1] + 1] === 0) {
                        stone.pos[0] = stone.pos[1] + 1;
                        stone.pos[2] = stone.pos[1] - 1;
                        stone.pos[3] = stone.pos[1] - 2;
                    } else if (stone.rotation === 3 && this.field[stone.pos[1] + this.fieldWidth] === 0 &&
                               this.field[stone.pos[1] - this.fieldWidth] === 0 && this.field[stone.pos[1] - (2 * this.fieldWidth)] === 0) {
                        stone.pos[0] = stone.pos[1] + this.fieldWidth;
                        stone.pos[2] = stone.pos[1] - this.fieldWidth;
                        stone.pos[3] = stone.pos[1] - (2 * this.fieldWidth);
                    } else if (stone.rotation === 4 && this.field[stone.pos[1] - 1] === 0 &&
                               this.field[stone.pos[1] + 1] === 0 && this.field[stone.pos[1] + 2] === 0) {
                        stone.pos[0] = stone.pos[1] - 1;
                        stone.pos[2] = stone.pos[1] + 1;
                        stone.pos[3] = stone.pos[1] + 2;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 4: // T XOX
                    if (stone.rotation === 1 && this.field[stone.pos[1] - this.fieldWidth] === 0) {
                        stone.pos[3] = stone.pos[1] - this.fieldWidth;
                        stone.pos[2] = stone.pos[1] + this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] + 1] === 0) {
                        if (stone.pos[1] % this.fieldWidth === (this.fieldWidth-1)) {
                            stone.pos[1]--;
                            stone.pos[0]--;
                        }
                        stone.pos[3] = stone.pos[1] - this.fieldWidth;
                        stone.pos[2] = stone.pos[1] + 1;
                    } else if (stone.rotation === 3 && this.field[stone.pos[1] + this.fieldWidth] === 0) {
                        stone.pos[3] = stone.pos[1] + this.fieldWidth;
                        stone.pos[0] = stone.pos[1] - this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[1] - 1] === 0) {
                        stone.pos[0] = stone.pos[1] - 1;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 6: // J
                    if (stone.rotation === 1 && this.field[stone.pos[1] + this.fieldWidth] === 0 && this.field[stone.pos[1] + (2 * this.fieldWidth)] === 0) {
                        stone.pos[0] = stone.pos[1] + this.fieldWidth;
                        stone.pos[3] = stone.pos[0] + this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] - 1] === 0 && this.field[stone.pos[1] - 2] === 0) {
                        if (stone.pos[1] % this.fieldWidth === 0) {
                            stone.pos[0] += 2;
                            stone.pos[1] += 2;
                        } else if (stone.pos[1] % this.fieldWidth === 1) {
                            stone.pos[0]++;
                            stone.pos[1]++;
                        }
                        stone.pos[3] = stone.pos[1] - 1;
                        stone.pos[2] = stone.pos[3] - 1;
                    } else if (stone.rotation === 3 && this.field[stone.pos[1] - this.fieldWidth] === 0 && this.field[stone.pos[0] - (2 * this.fieldWidth)] === 0) {
                        stone.pos[0] = stone.pos[1] - this.fieldWidth;
                        stone.pos[2] = stone.pos[0] - this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[1] + 1] === 0 && this.field[stone.pos[1] + 2] === 0) {
                        if (stone.pos[1] % this.fieldWidth === (this.fieldWidth-1)) {
                            stone.pos[0] -= 2;
                            stone.pos[1] -= 2;
                        } else if (stone.pos[1] % this.fieldWidth === (this.fieldWidth-2)) {
                            stone.pos[0]--;
                            stone.pos[1]--;
                        }
                        stone.pos[2] = stone.pos[1] + 1;
                        stone.pos[3] = stone.pos[1] + 2;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 7: // L
                    if (stone.rotation === 1 && this.field[stone.pos[0] - 1] === 0 && this.field[stone.pos[3] + this.fieldWidth] === 0) {
                        if (stone.pos[0] % this.fieldWidth === 0) {
                            stone.pos[0]++;
                        }
                        stone.pos[1] = stone.pos[0] - 1;
                        stone.pos[2] = stone.pos[0] + this.fieldWidth;
                        stone.pos[3] = stone.pos[2] + this.fieldWidth;
                    } else if (stone.rotation === 2 && this.field[stone.pos[1] - 1] === 0 && this.field[stone.pos[0] - this.fieldWidth] === 0) {
                        if (stone.pos[1] % this.fieldWidth === 0) {
                            stone.pos[0]++;
                            stone.pos[1]++;
                        }
                        stone.pos[2] = stone.pos[0] - this.fieldWidth;
                        stone.pos[3] = stone.pos[1] - 1;
                    } else if (stone.rotation === 3 && this.field[stone.pos[2] - this.fieldWidth] === 0 && this.field[stone.pos[0] + 1] === 0) {
                        if (stone.pos[0] % this.fieldWidth == (this.fieldWidth-1)) {
                            stone.pos[0]--;
                        }
                        stone.pos[1] = stone.pos[0] + 1;
                        stone.pos[2] = stone.pos[0] - this.fieldWidth;
                        stone.pos[3] = stone.pos[2] - this.fieldWidth;
                    } else if (stone.rotation === 4 && this.field[stone.pos[1] + 1] === 0 && this.field[stone.pos[0] + this.fieldWidth] === 0) {
                        if (stone.pos[1] % this.fieldWidth === (this.fieldWidth-1)) {
                            stone.pos[0]--;
                            stone.pos[1] --;
                        }
                        stone.pos[2] = stone.pos[1] + 1;
                        stone.pos[3] = stone.pos[0] + this.fieldWidth;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 8: // kleines L
                    if (stone.rotation === 1 && this.field[stone.pos[0] - 1] === 0) {
                        if (stone.pos[0] % this.fieldWidth === 0) {
                            stone.pos[0]++;
                        }
                        stone.pos[1] = stone.pos[0] - 1;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] - this.fieldWidth] === 0) {
                        stone.pos[2] = stone.pos[0] - this.fieldWidth;
                    } else if (stone.rotation === 3 && this.field[stone.pos[0] + 1] === 0) {
                        if (stone.pos[0] % this.fieldWidth === (this.fieldWidth-1)) {
                            stone.pos[0]--;
                            stone.pos[2]--;
                        }
                        stone.pos[1] = stone.pos[0] + 1;
                    } else if (stone.rotation === 4 && this.field[stone.pos[0] + this.fieldWidth] === 0) {
                        stone.pos[2] = stone.pos[0] + this.fieldWidth;
                    } else {
                        break;
                    }
                    stone.rotation === 4 ? stone.rotation = 1 : stone.rotation++;
                    break;
                case 9: // S
                    if (stone.rotation === 1 && this.field[stone.pos[2] + 2] === 0 && this.field[stone.pos[3] - 2 * this.fieldWidth] === 0) {
                        stone.pos[2] += 2;
                        stone.pos[3] -= 2 * this.fieldWidth;
                        stone.rotation = 2;
                    } else if (stone.rotation === 2 && this.field[stone.pos[2] - 2] === 0 && this.field[stone.pos[3] + 2 * this.fieldWidth] === 0) {
                        stone.pos[2] -= 2;
                        stone.pos[3] += 2 * this.fieldWidth;
                        stone.rotation = 1;
                    } break;
                case 10: // Z
                    if (stone.rotation === 1 && this.field[stone.pos[0] + 2] === 0 && this.field[stone.pos[1] + 2 * this.fieldWidth] === 0) {
                        stone.pos[0] += 2;
                        stone.pos[1] += 2 * this.fieldWidth;
                        stone.rotation = 2;
                    } else if (stone.rotation === 2 && this.field[stone.pos[0] - 2] === 0 && this.field[stone.pos[1] - 2 * this.fieldWidth] === 0) {
                        stone.pos[0] -= 2;
                        stone.pos[1] -= 2 * this.fieldWidth;
                        stone.rotation = 1;
                    } break;
                default: break;
            }
        // Move Left (A)
        } else if (key === KEYS.moveLeft) {
            let setzen = true;
            for (let i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                if (this.stones[userid].pos[i] - 1 < 0 ||
                    this.field[this.stones[userid].pos[i] - 1] > 0 ||
                    this.stones[userid].pos[i] % this.fieldWidth < (this.stones[userid].pos[i] - 1) % this.fieldWidth)
                    setzen = false;
            }
            if (setzen) {
                this.stones[userid].left();
            }

        // Move Right (D)
        } else if (key === KEYS.moveRight) {
            let setzen = true;
            for (let i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                if (this.stones[userid].pos[i] + 1 > this.field.length ||
                    this.field[this.stones[userid].pos[i] + 1] > 0 ||
                    this.stones[userid].pos[i] % this.fieldWidth > (this.stones[userid].pos[i] + 1) % this.fieldWidth)
                    setzen = false;
            }
            if (setzen) {
                this.stones[userid].right();
            }
        // Move Down (S)
        } else if (key === KEYS.moveDown) {
            let setzen = true;
            for (let i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                if (this.stones[userid].pos[i] + this.fieldWidth >= (this.field.length - this.fieldWidth) ||
                    this.field[this.stones[userid].pos[i] + this.fieldWidth] > 0) {
                    setzen = false;
                }
            }
            if (setzen) {
                this.stones[userid].down(this.fieldWidth);
            }
        }
    }

    gamelogic() {
        if (!this.gameOver && !this.paused) {
            // check if the player's stones reached the bottom
            for (let j = 0; j < this.stones.length && !this.isGameOver(); j++) {
                for (let i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                    // check if the player's stone is in the last row or one before that and there
                    // is no free space under his stone
                    if ((this.stones[j].pos[i] < (this.field.length - this.fieldWidth) &&
                         this.field[this.stones[j].pos[i] + this.fieldWidth] > 0) ||
                         this.stones[j].pos[i] >= (this.field.length - this.fieldWidth)) {
                        this.setStaticStone(j);
                        this.stonefinished(j);
                        break;
                    }
                }
            }
        }
    }

    isGameOver() {
        // Check if stones are so high the game is over
        for (let i = 0; i < this.fieldWidth; i++) {
            if (this.field[i] > 0) {
                this.gameOver = true;
                this.gameStarted = false;
                this.paused = false;
                this.callGameOverCallback();
                return true;
            }
        }
        return false;
    }

    dropStones() {
        if (!this.gameOver && !this.paused) {
            for (let j = 0; j < this.stones.length && !this.isGameOver(); j++) {
                let setzen = true;
                for (let i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                    if (this.field[this.stones[j].pos[i] + this.fieldWidth] > 0 ||
                        this.field[this.stones[j].pos[i]] + this.fieldWidth >= this.field.length) {
                        setzen = false;
                    }
                }
                if (setzen) {
                    for (let i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                        this.stones[j].pos[i] += this.fieldWidth;
                    }
                }
            }
        }
    }
};

module.exports = Room;
