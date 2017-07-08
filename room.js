var MAX_PLAYERS = 25;
var PLAYER_OFFSET = 4;
var DEFAULT_WIDTH = 30;
var DEFAULT_HEIGHT = 20;

var dbj2 = function(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash;
}

module.exports.room = function() {

    // Field data
    this.field_height = 0;
    this.field_width = 0;
    this.field;

    // Stone constructor
    this.stone = function(userid) {
        // 1: OX  2: XOX 4: XOX  5: XX  6: X    7: OXX  8: OX  9:  OX  10: XX   O = rotation center
        // 3: XOXX           X      OX     OXX     X       X      XX        OX
        this.kind = 1;
        this.pos = [-1, -1, -1, -1];
        this.color = userid;
        this.rotation = 1;
        this.start = 0;
    };

    // Player constructor
    this.player = function(userid, name, status) {
        this.id = userid;
        this.name = name;
        this.isAdmin = status;
        this.hash = dbj2(name);
    };

    // Metadata
    this.speed = 1000;
    this.score = 0;
    this.level = 1;
    this.multiplier = 1;
    this.id = 0;
    this.name = '';
    // Players and stones
    this.players = [];
    this.stones = [];
    // Game flags
    this.gameOver = false;
    this.gameStarted = false;
    this.stateChanged = false;
    this.paused = false;
    // Callbacks
    this.callback;
    this.speedUpdate;
    // Player count stuff
    this.fixed = false;
    this.maxPlayers = 4;

    this.createRoom = function(roomName, roomID, user) {
        if (!this.gameStarted && !this.gameOver) {
            this.name = roomName;
            this.id = roomID;
            this.field_width = DEFAULT_WIDTH;
            this.field_height = DEFAULT_HEIGHT;
            this.fixed = false;
            this.reset();
            this.addUser(user, true);
            console.log("Created Lobby: \'" + roomName + "\'");
            console.log("\tsize = " + this.field_width + "x" + this.field_height);
            console.log("\tcreated by = " + user);
        }
    };

    this.createRoomFixed = function(roomName, roomID, user, width, height, max) {
        if (!this.gameStarted && !this.gameOver) {
            this.name = roomName;
            this.id = roomID;
            this.field_width = width;
            this.field_height = height;
            this.fixed = true;
            this.maxPlayers = max > 0 ? max : 4;
            this.reset();
            this.addUser(user, true);
            console.log("Created Lobby: \'" + roomName + "\'");
            console.log("\tsize = " + this.field_width + "x" + this.field_height);
            console.log("\tcreated by = " + user);
        }
    };

    this.initSpeed = function() {
        this.speed = 1000;
        this.multiplier = 1;
    }

    this.setSpeed = function() {
        if (this.speed > 250) {
            this.speed -= 250;
            this.multiplier++;
        } else {
            var newSpeed = this.speed - this.speed * (1 / 3) > 25 ? this.speed - this.speed * (1 / 3) : 25;
            if (newSpeed != this.speed)
                this.multiplier++;
            this.speed = newSpeed;
        }
    }

    this.setSpeedCallback = function(func) {
        this.speedUpdate = func;
    }

    this.callSpeedCallback = function() {
        if (this.speedUpdate)
            this.speedUpdate(this);
    }

    this.setGameOverCallback = function(func) {
        this.callback = func;
    }

    this.callGameOverCallback = function(leave=false) {
        if (this.callback)
            this.callback(this.name, this.players, this.score, leave);
    }

    this.startGame = function() {
        this.gameOver = false;
        this.gameStarted = true;
        console.log("Game \"" + this.name + "\" started");
    }

    this.initField = function() {
        this.field = new Array(this.field_height * this.field_width);
        this.field.fill(0);
    }

    this.reset = function() {
        this.level = 1;
        this.score = 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.stateChanged = false;
        this.paused = false;
        this.players = [];
        this.stones = [];
        this.initField();
        this.initSpeed();
        this.setMaxPlayers();
    }

    this.setMaxPlayers = function() {
        if (!this.fixed)
            this.maxPlayers = Math.floor((this.field_width - 1) / (PLAYER_OFFSET + 1));
    }

    this.getMaxPlayerCount = function() {
        return this.fixed ? this.maxPlayers : MAX_PLAYERS;
    }

    this.addUser = function(user, status=false) {
        if (this.players.length < this.maxPlayers) {
            console.log("Player \'" + user + "\' joined the game \'" + this.name + "\'");
            this.players.push(new this.player(this.players.length, user, status));
            this.stones.push(new this.stone(this.players.length));
            this.spawnStone(this.stones.length-1);

            return 1;
        } else if (!this.fixed) {
            // TODO resize field according to player count
            console.log("Player \'" + user + "\' joined the game \'" + this.name + "\'");
            this.growField();
            console.log('Resizing field: ' + this.field_width + 'x' + this.field_height);
            this.players.push(new this.player(this.players.length, user, status));
            this.stones.push(new this.stone(this.players.length));
            this.spawnStone(this.stones.length-1);

            return 2;
        }
        return 0;
    }

    this.getAllHashes = function() {
        list = [];
        for (i = 0; i < this.players.length; i++) {
            list.push(this.players[i].hash);
        }
        return list;
    }

    this.growField = function() {
        this.paused = true;
        this.maxPlayers++;
        var newWidth = this.field_width + (2 * PLAYER_OFFSET);
        var newHeight = newWidth * 0.5 > this.field_height ? newWidth * 0.5 : this.field_height;
        var newField = new Array(newWidth * newHeight);
        newField.fill(0);

        var stop = false;
        var diff = Math.abs(newHeight - this.field_height);
        for (i = this.field_height-1; i >= 0 && !stop; i--) {
            var empty = 0;
            for (j = 0; j < this.field_width; j++) {
                if (this.field[(i * this.field_width) + j] > 0) {
                    newField[((i + diff) * newWidth) + j] = this.field[(i * this.field_width) + j];
                } else {
                    empty++
                    if (empty == this.field_width)
                        stop = true;
                }
            }
        }

        diff = Math.abs(newWidth - this.field_width);
        for (i = 0; i < this.stones.length; i++) {
            for (j = 0; j < 4 && this.stones[i].pos[j] != -1; j++) {
                row = Math.floor(this.stones[i].pos[j] / this.field_width);
                // column = Math.floor(this.stones[i].pos[j] % this.field_width);
                // this.stones[i].pos[j] = row > 0 ? (row * newWidth) + column : column;
                this.stones[i].pos[j] += row * diff;
            }
        }

        this.field = newField.slice(0);
        this.field_width = newWidth;
        this.field_height = newHeight;
        this.paused = false;
    }

    this.isAdmin = function(userid) {
        return userid >= 0 && userid < this.players.length && this.players[userid].isAdmin;
    }

    this.setStartPosition = function(userid) {
        if ((userid + 1) % 2 === 0)
            this.stones[userid].start = -PLAYER_OFFSET * Math.floor((userid + 1) / 2);
        else
            this.stones[userid].start = PLAYER_OFFSET * Math.floor((userid + 1) / 2);
    }

    this.removeUser = function(userid) {
        if (userid >= 0 && userid < this.players.length) {
            // Log user leaving game
            console.log("Player \'" + this.players[userid].name + "\' left the game \'" + this.name + "\'");
            // Remove player and player's stone from game
            if (userid === this.players.length - 1) {
                this.players.pop();
                this.stones.pop();
            } else if (userid === 0) {
                this.players.shift();
                this.stones.shift();
            } else {
                this.players = this.players.filter(function(item) { return item.id !== userid; });
                this.stones = this.stones.filter(function(item) { return item.color !== userid; });
            }
            // Delete/Reset game when there is no player left
            if (this.players.length === 0)
                this.callGameOverCallback(true);
        }
    }

    this.getLastUser = function() {
        return this.players.length - 1;
    }

    this.getUserID = function(username) {
        if (id >= 0 && id < this.players.length) {
            for (i = 0; i < this.players.length; i++) {
                if (this.players[i].name === username)
                    return i;
            }
        }
    }

    this.stonefinished = function(userid) {
        var stop = false;
        for (i = this.field_height-1; i >= 0 && !stop; i--) {
            var empty = 0;
            var full = 0;
            for (j = this.field_width-1; j >= 0; j--) {
                // Delete full row and spawn new stone
                if (this.field[i * this.field_width + j] > 0) {
                    full++;
                    if (full === this.field_width) {
                        this.updateScoreLevel();
                        for (k = 0; k < i; k++) {
                            for (l = 0; l < this.field_width; l++) {
                                this.field[(i - k) * this.field_width + l] = this.field[(i - k - 1) * this.field_width + l];
                            }
                        }
                        i++;
                    }
                } else {
                    empty++;
                    if (full > 0)
                        j = -1;
                    else if (empty === this.field_width)
                        stop = true;
                }
            }
        }

        this.spawnStone(userid);
    }

    this.updateScoreLevel = function() {
        this.score += this.field_width * this.multiplier;
        this.level++;
        this.setSpeed();
        this.callSpeedCallback();
    }

    this.setStaticStone = function(userid) {
        for (i = 0; i < this.stones[userid].pos.length && this.stones[userid].pos[i] != -1; i++) {
            this.field[this.stones[userid].pos[i]] = userid + 1;
        }
        this.stateChanged = true;
    }

    this.spawnStone = function(userid) {
        // Roll the dice to decide which form the stone has (1-10)
        this.stones[userid].kind = Math.floor((Math.random() * 10) + 1);
        // No rotation
        this.stones[userid].rotation = 1;
        // Compute the starting position of the new stone
        this.setStartPosition(userid);
        // Create a new stone
        this.getNewStone(userid);
    }

    this.getNewStone = function(userid) {
        var at = this.stones[userid].start;

        switch (this.stones[userid].kind) {
            case 1:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, (this.field_width / 2) + at, -1, -1];
                break;
            case 2:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, (this.field_width / 2) + at, (this.field_width / 2) + 1 + at, -1];
                break;
            case 3:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, (this.field_width / 2) + at, (this.field_width / 2) + 1 + at, (this.field_width / 2) + 2 + at];
                break;
            case 4:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, this.field_width / 2 + at, this.field_width / 2 + 1 + at, this.field_width / 2 + this.field_width + at];
                break;
            case 5:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, this.field_width / 2 + at, this.field_width / 2 - 1 + this.field_width + at, this.field_width / 2 + this.field_width + at];
                break;
            case 6:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, this.field_width / 2 - 1 + this.field_width + at, this.field_width / 2 + this.field_width + at, this.field_width / 2 + 1 + this.field_width + at];
                break;
            case 7:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, this.field_width / 2 + at, this.field_width / 2 + 1 + at, this.field_width / 2 - 1 + this.field_width + at];
                break;
            case 8:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, this.field_width / 2 + at, this.field_width / 2 - 1 + this.field_width + at, -1];
                break;
            case 9:
                this.stones[userid].pos = [(this.field_width / 2) + at, (this.field_width / 2) + 1 + at, this.field_width / 2 - 1 + this.field_width + at, this.field_width / 2 + this.field_width + at];
                break;
            case 10:
                this.stones[userid].pos = [(this.field_width / 2) - 1 + at, (this.field_width / 2) + at, this.field_width / 2 + this.field_width + at, this.field_width / 2 + 1 + this.field_width + at];
                break;
        }
    }

    this.movestone = function(key, userid) {
        // Turn Left (Q)
        if (key === 81) {
            switch (this.stones[userid].kind) {
                case 1: // OX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width == 0) {
                            this.stones[userid].pos[1] = this.stones[userid].pos[0];
                            this.stones[userid].pos[0]++;
                        } else {
                            this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                        }
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width == (this.field_width - 1)) {
                            this.stones[userid].pos[1] = this.stones[userid].pos[0];
                            this.stones[userid].pos[0]--;
                        } else {
                            this.stones[userid].pos[1] = this.stones[userid].pos[0] + 1;
                        }
                    } else
                        break;
                    this.stones[userid].rotation = this.stones[userid].rotation === 4 ? 1 : this.stones[userid].rotation+1;
                    break;
                case 2: // XOX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] - this.field_width] === 0 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].rotation = 2;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === 0) {
                            this.stones[userid].pos[0] = this.stones[userid].pos[1];
                            this.stones[userid].pos[1]++;
                            this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        } else if (this.stones[userid].pos[1] % this.field_width === (this.field_width-1)) {
                            this.stones[userid].pos[2] = this.stones[userid].pos[1];
                            this.stones[userid].pos[1]--;
                            this.stones[userid].pos[0] = this.stones[userid].pos[1] - 1;
                        } else {
                            this.stones[userid].pos[0] = this.stones[userid].pos[1] - 1;
                            this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        }
                        this.stones[userid].rotation = 1;
                    } break;
                case 3: // XOXX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] + (this.field_width + 1)] === 0 && this.field[this.stones[userid].pos[2] - (this.field_width + 1)] === 0 && this.field[this.stones[userid].pos[3] - 2 * (this.field_width + 1)] === 0) {
                        this.stones[userid].pos[0] += (this.field_width + 1);
                        this.stones[userid].pos[2] -= (this.field_width + 1);
                        this.stones[userid].pos[3] -= 2 * (this.field_width + 1);
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0 &&
                               this.field[this.stones[userid].pos[1] - 2] === 0 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === 0) {
                            this.stones[userid].pos[1] += 2;
                        }
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - 2;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] + this.field_width] === 0 &&
                               this.field[this.stones[userid].pos[1] + (2 * this.field_width)] === 0 && this.field[this.stones[userid].pos[1] - this.field_width] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + (this.field_width * 2);
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] - 1] === 0 &&
                               this.field[this.stones[userid].pos[1] + 1] === 0 && this.field[this.stones[userid].pos[1] + 2] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === (this.field_width - 1)) {
                            this.stones[userid].pos[1] -= 2;
                        }
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + 2;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 4: // T XOX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - (this.field_width - 1)] === 0) {
                        this.stones[userid].pos[0] -= (this.field_width - 1);
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] + (this.field_width - 1)] === 0) {
                        this.stones[userid].pos[0] += (this.field_width - 1);
                        this.stones[userid].pos[3] -= 2 * this.field_width;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[3] + 2 * this.field_width] === 0) {
                        this.stones[userid].pos[3] += 2 * this.field_width;
                        this.stones[userid].pos[2] -= (this.field_width + 1);
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + (this.field_width + 1)] === 0) {
                        this.stones[userid].pos[2] += (this.field_width + 1);
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 6: // J
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] - 1] === 0 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === 0) {
                            this.stones[userid].pos[1]++;
                            this.stones[userid].pos[0]++;
                        }
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] + this.field_width] === 0 && this.field[this.stones[userid].pos[2] - 1] === 0) {
                        if (this.stones[userid].pos[2] % this.field_width === 0) {
                            this.stones[userid].pos[2]++;
                            this.stones[userid].pos[1]++;
                        }
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[2] - 1;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] + this.field_width] === 0 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === (this.field_width - 1)) {
                            this.stones[userid].pos[1]--;
                            this.stones[userid].pos[0]--;
                        }
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] + this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[2] + 1] === 0 && this.field[this.stones[userid].pos[1] - this.field_width] === 0) {
                        if (this.stones[userid].pos[2] % this.field_width === (this.field_width - 1)) {
                            this.stones[userid].pos[2]--;
                            this.stones[userid].pos[1]--;
                        }
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[2] + 1;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 7: // L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[3] - 2 * this.field_width] === 0 && this.field[this.stones[userid].pos[2] - 2 * (this.field_width + 1)] === 0) {
                        this.stones[userid].pos[3] -= 2 * this.field_width;
                        this.stones[userid].pos[2] -= 2 * (this.field_width + 1);
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 2] === 0 && this.field[this.stones[userid].pos[2] + 2 * (this.field_width - 1)] === 0) {
                        this.stones[userid].pos[1] -= 2;
                        this.stones[userid].pos[2] += 2 * (this.field_width - 1);
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[3] + 2 * this.field_width] === 0 && this.field[this.stones[userid].pos[2] + 2 * (this.field_width + 1)] === 0) {
                        this.stones[userid].pos[3] += 2 * this.field_width;
                        this.stones[userid].pos[2] += 2 * (this.field_width + 1);
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 2] === 0 && this.field[this.stones[userid].pos[2] - 2 * (this.field_width - 1)] === 0) {
                        this.stones[userid].pos[1] += 2;
                        this.stones[userid].pos[2] -= 2 * (this.field_width - 1);
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 8: // kleines L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[2] - 2 * this.field_width] === 0) {
                        this.stones[userid].pos[2] -= 2 * this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 2] === 0) {
                        this.stones[userid].pos[1] -= 2;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[2] + 2 * this.field_width] === 0) {
                        this.stones[userid].pos[2] += 2 * this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 2] === 0) {
                        this.stones[userid].pos[1] += 2;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 9: // S
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[2] + 2] === 0 && this.field[this.stones[userid].pos[3] - 2 * this.field_width] === 0) {
                        this.stones[userid].pos[2] += 2;
                        this.stones[userid].pos[3] -= 2 * this.field_width;
                        this.stones[userid].rotation = 2;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[2] - 2] === 0 && this.field[this.stones[userid].pos[3] + 2 * this.field_width] === 0) {
                        this.stones[userid].pos[2] -= 2;
                        this.stones[userid].pos[3] += 2 * this.field_width;
                        this.stones[userid].rotation = 1;
                    } break;
                case 10: // Z
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] + 2] === 0 && this.field[this.stones[userid].pos[1] + 2 * this.field_width] === 0) {
                        this.stones[userid].pos[0] += 2;
                        this.stones[userid].pos[1] += 2 * this.field_width;
                        this.stones[userid].rotation = 2;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 2] === 0 && this.field[this.stones[userid].pos[1] - 2 * this.field_width] === 0) {
                        this.stones[userid].pos[0] -= 2;
                        this.stones[userid].pos[1] -= 2 * this.field_width;
                        this.stones[userid].rotation = 1;
                    } break;
                default: break;
            }
        // Turn Right (E)
        } else if (key === 69) {
            switch (this.stones[userid].kind) {
                case 1: // OX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 1] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + 1;
                    } else
                        break;
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 2: // XOX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - (this.field_width - 1)] === 0 && this.field[this.stones[userid].pos[2] + (this.field_width - 1)] === 0) {
                        this.stones[userid].pos[0] -= (this.field_width - 1);
                        this.stones[userid].pos[2] += (this.field_width - 1);
                        this.stones[userid].rotation = 2;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] + (this.field_width - 1)] === 0 && this.field[this.stones[userid].pos[2] - (this.field_width - 1)] === 0) {
                        this.stones[userid].pos[0] += (this.field_width - 1);
                        this.stones[userid].pos[2] -= (this.field_width - 1);
                        this.stones[userid].rotation = 1;
                    } break;
                case 3: // XOXX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] - this.field_width] === 0 &&
                        this.field[this.stones[userid].pos[1] + this.field_width] === 0 && this.field[this.stones[userid].pos[1] + (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + (2 * this.field_width);
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0 &&
                               this.field[this.stones[userid].pos[1] - 2] === 0 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - 2;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] + this.field_width] === 0 &&
                               this.field[this.stones[userid].pos[1] - this.field_width] === 0 && this.field[this.stones[userid].pos[1] - (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - (2 * this.field_width);
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] - 1] === 0 &&
                               this.field[this.stones[userid].pos[1] + 1] === 0 && this.field[this.stones[userid].pos[1] + 2] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + 2;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 4: // T XOX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] - this.field_width] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + 1;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] + this.field_width] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] - 1] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + this.field_width;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 6: // J
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] + this.field_width] === 0 && this.field[this.stones[userid].pos[1] + (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + (2 * this.field_width);
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0 && this.field[this.stones[userid].pos[1] - 2] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - 2;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] - this.field_width] === 0 && this.field[this.stones[userid].pos[1] - (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - (2 * this.field_width);
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 1] === 0 && this.field[this.stones[userid].pos[1] + 2] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + 2;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 7: // L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[3] + this.field_width] === 0 && this.field[this.stones[userid].pos[0] - 1] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[3] + this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[3] - this.field_width] === 0 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[3] - this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + this.field_width] === 0 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] + this.field_width;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 8: // kleines L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - 1] === 0) {
                        this.stones[userid].pos[1] -= 2;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        this.stones[userid].pos[2] -= 2 * this.field_width;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        this.stones[userid].pos[1] += 2;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        this.stones[userid].pos[2] += 2 * this.field_width;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 9: // S
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[2] + 2] === 0 && this.field[this.stones[userid].pos[3] - 2 * this.field_width] === 0) {
                        this.stones[userid].pos[2] += 2;
                        this.stones[userid].pos[3] -= 2 * this.field_width;
                        this.stones[userid].rotation = 2;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[2] - 2] === 0 && this.field[this.stones[userid].pos[3] + 2 * this.field_width] === 0) {
                        this.stones[userid].pos[2] -= 2;
                        this.stones[userid].pos[3] += 2 * this.field_width;
                        this.stones[userid].rotation = 1;
                    } break;
                case 10: // Z
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] + 2] === 0 && this.field[this.stones[userid].pos[1] + 2 * this.field_width] === 0) {
                        this.stones[userid].pos[0] += 2;
                        this.stones[userid].pos[1] += 2 * this.field_width;
                        this.stones[userid].rotation = 2;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 2] === 0 && this.field[this.stones[userid].pos[1] - 2 * this.field_width] === 0) {
                        this.stones[userid].pos[0] -= 2;
                        this.stones[userid].pos[1] -= 2 * this.field_width;
                        this.stones[userid].rotation = 1;
                    } break;
                default: break;
            }
        // Move Left (A)
        } else if (key === 65) {
            var setzen = true;
            for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                if (this.stones[userid].pos[i] - 1 < 0 || this.field[this.stones[userid].pos[i] - 1] > 0 ||
                    this.stones[userid].pos[i] % this.field_width < (this.stones[userid].pos[i] - 1) % this.field_width)
                    setzen = false;
            }
            if (setzen) {
                for (i = 0; i < 4; i++) {
                    if (this.stones[userid].pos[i] >= 0)
                        this.stones[userid].pos[i]--;
                }
            }
        // Move Right (D)
        } else if (key === 68) {
            var setzen = true;
            for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                if (this.stones[userid].pos[i] + 1 > this.field.length || this.field[this.stones[userid].pos[i] + 1] > 0 ||
                    this.stones[userid].pos[i] % this.field_width > (this.stones[userid].pos[i] + 1) % this.field_width)
                    setzen = false;
            }
            if (setzen) {
                for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                    this.stones[userid].pos[i]++;
                }
            }
        // Move Down (S)
        } else if (key === 83) {
            var setzen = true;
            for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                if (this.stones[userid].pos[i] + this.field_width >= this.field.length || (
                    this.stones[userid].pos[i] + this.field_width < this.field.length &&
                    this.field[this.stones[userid].pos[i] + this.field_width] > 0))
                    setzen = false;
            }
            if (setzen) {
                for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
                    this.stones[userid].pos[i] += this.field_width;
                }
            }
        }
    }

    this.gamelogic = function() {
        if (!this.gameOver && !this.paused) {
            // Check if the player's stones reached the bottom
            for (j = 0; j < this.stones.length && !this.isGameOver(); j++) {
                for (i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                    // Check if the player's stone is in the last row or one before that and there
                    // is no free space under his stone
                    if ((this.stones[j].pos[i] < (this.field_height-1) * this.field_width &&
                         this.field[this.stones[j].pos[i] + this.field_width] > 0) ||
                         this.stones[j].pos[i] >= (this.field_height-1) * this.field_width) {
                        this.setStaticStone(j);
                        this.stonefinished(j);
                        break;
                    }
                }
            }
        }
    }

    this.isGameOver = function() {
        // Check if stones are so high the game is over
        for (i = 0; i < this.field_width; i++) {
            if (this.field[i] > 0) {
                this.gameOver = true;
                this.gameStarted = false;
                this.callGameOverCallback();
                return true;
            }
        }
        return false;
    }

    this.dropStones = function() {
        if (!this.gameOver && !this.paused) {
            for (j = 0; j < this.stones.length; j++) {
                var setzen = true;
                for (i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                    if (this.field[this.stones[j].pos[i] + this.field_width] > 0 ||
                        this.field[this.stones[j].pos[i]] + this.field_width >= this.field.length) {
                        setzen = false;
                    }
                }
                if (setzen) {
                    for (i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                        this.stones[j].pos[i] += this.field_width;
                    }
                }
            }
        }
    }
};