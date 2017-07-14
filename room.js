var MAX_PLAYERS = 25;
var PLAYER_OFFSET = 4;
var MIN_WIDTH = 10;
var MIN_HEIGHT = 10;
var DEFAULT_WIDTH = 30;
var DEFAULT_HEIGHT = 20;
var SOLID_STONE = 26;

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
    this.background = 0;

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
    this.id = '';
    this.name = '';
    // Players and stones
    this.players = [];
    this.stones = [];
    this.solids = new Set();
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

    this.createRoom = function(roomName, roomID, user, bg=0) {
        if (!this.gameStarted && !this.gameOver) {
            this.name = roomName;
            this.id = roomID;
            this.background = bg;
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

    this.createRoomFixed = function(roomName, roomID, user, width, height, max, bg=0) {
        if (!this.gameStarted && !this.gameOver) {
            this.name = roomName;
            this.id = roomID;
            this.background = bg;
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
        if (this.speed - 250 > 25) {
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

    this.callGameOverCallback = function() {
        if (this.callback)
            this.callback(this.name, this.players, this.score);
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
        if (!status && this.players.length === 0)
            status = true;

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
            this.players.push(new this.player(this.players.length, user, status));
            this.stones.push(new this.stone(this.players.length));
            this.spawnStone(this.stones.length-1);

            return 2;
        }
        return 0;
    }

    this.togglePause = function(userid) {
        if (this.players[userid].isAdmin) {
            this.paused = !this.paused;
            return true;
        }
        return false;
    }

    this.getAllHashes = function() {
        list = [];
        for (i = 0; i < this.players.length; i++) {
            list.push(this.players[i].hash);
        }
        return list;
    }

    this.isAdmin = function(userid) {
        return userid >= 0 && userid < this.players.length && this.players[userid].isAdmin;
    }

    this.instaDrop = function(userid) {
        var tmp = [true, true, true, true]
        var found = false;
        for (i = 0; i < 4; i++) {
            for (j = 0; j < 4; j++) {
                if (this.stones[userid].pos[i] + this.field_width === this.stones[userid].pos[j] || this.stones[userid].pos[i] === -1)
                    tmp[i] = false;
            }
        }
        var tmpStone = [-1, -1, -1, -1];
        for (k = 0; k < 4; k++) {
            if (tmp[k] === true) {
                var max_h = this.field_height - Math.floor(this.stones[userid].pos[k] / this.field_width)
                for (l = 0; l < max_h; l++) {
                    if (this.field[this.stones[userid].pos[k] + (l + 1) * this.field_width] > 0 || l === max_h - 1) {
                        if (!found || this.stones[userid].pos[0] + l * this.field_width < tmpStone[0]) {
                            tmpStone = [this.stones[userid].pos[0] + l * this.field_width,
                                        this.stones[userid].pos[1] + l * this.field_width,
                                        this.stones[userid].pos[2] === -1 ? -1 : this.stones[userid].pos[2] + l * this.field_width,
                                        this.stones[userid].pos[3] === -1 ? -1 : this.stones[userid].pos[3] + l * this.field_width]
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
            if (userid === 0) {
                this.players.shift();
                this.stones.shift();
            } else if (userid === this.players.length - 1) {
                this.players.pop();
                this.stones.pop();
            } else {
                this.players = this.players.filter(function(item) { return item.id !== userid; });
                this.stones = this.stones.filter(function(item) { return item.color !== userid; });
            }
            // Delete/Reset game when there is no player left
            if (this.players.length === 0) {
                this.callGameOverCallback();
            } else {
                if (this.players.length === 1)
                    this.players[0].isAdmin = true;
                if (!this.fixed) {
                    this.shrinkField();
                    return 2;
                }
            }
            return 1;
        }
        return 0;
    }

    this.getLastUser = function() {
        return this.players.length - 1;
    }

    this.getUserID = function(username) {
        return this.players.findIndex(function(item, index, array) {
            return item.name === this;
        }, username);
    }

    // Increase field size and transfer old data + update all players
    this.growField = function() {
        this.paused = true;
        this.maxPlayers++;
        // Store old field size to be able to adjust players
        var oldWidth = this.field_width;
        var oldHeight = this.field_height;
        // Compute new field size
        var newWidth = oldWidth + (2 * PLAYER_OFFSET);
        var newHeight = newWidth + PLAYER_OFFSET > oldHeight ? newWidth + PLAYER_OFFSET : oldHeight;

        this.field = this.adjustField(newWidth, newHeight, oldHeight-1, oldWidth);
        this.adjustPlayers(oldWidth, oldHeight, false);

        this.paused = false;
    }

    // Increase field size and transfer old data + update all players
    this.shrinkField = function() {
        this.paused = true;
        this.maxPlayers--;
        // Store old field size to be able to adjust players
        var oldWidth = this.field_width;
        var oldHeight = this.field_height;
        // Compute new field size
        var newWidth = oldWidth - PLAYER_OFFSET > MIN_WIDTH ? oldWidth - PLAYER_OFFSET : MIN_WIDTH;
        var newHeight = oldHeight - Math.floor(PLAYER_OFFSET/2) > MIN_HEIGHT ? oldHeight - Math.floor(PLAYER_OFFSET/2) : MIN_HEIGHT;

        this.field = this.adjustField(newWidth, newHeight, newHeight-1, newWidth);
        this.adjustPlayers(oldWidth, oldHeight, true);
        this.paused = false;
    }

    // Transfer old field data to new larger/smaller field
    this.adjustField = function(width, height, limitV, limitH, shrink) {
        var newField =  new Array(width * height);
        newField.fill(0);

        // Clear list of rows holding immortal stones
        if (shrink)
            this.solids.clear();

        var stop = false;
        // Difference in height between new and old field
        var diff = shrink ? 0 : Math.abs(height - this.field_height);
        // Starting from the bottom of the old field when the new field is bigger
        // or the bottom of the new field when the new field is smaller: copy data
        for (i = limitV; i >= 0 && !stop; i--) {
            var empty = 0;
            // Check all fields of the current row
            for (j = 0; j < limitH; j++) {
                // If we are shrinking and there is an immortal stone in this row
                // add its row to the list of rows holding immortal stones
                if (shrink && this.field[(i * this.field_width) + j] === SOLID_STONE) {
                    this.solids.add(i);
                }
                // If the field is not empty or holds an immortal and we are NOT
                // shrinking, then we copy this field
                else if (this.field[(i * this.field_width) + j] > 0) {
                    newField[((i + diff) * width) + j] = this.field[(i * this.field_width) + j];
                }
                // If the field is empty increment the optimization counter
                else {
                    empty++
                    // If we find an empty row we can stop, there
                    // can be no other static stones above this row
                    if (empty == this.field_width)
                        stop = true;
                }
            }
        }
        // Set new width and height
        this.field_width = width;
        this.field_height = height;

        return newField;
    }

    // Reposition playerstones to fit the new field
    this.adjustPlayers = function(width, height, shrink) {
        // Difference between old and new field width
        var diff = Math.abs(width - this.field_width);
        for (i = 0; i < this.stones.length; i++) {
            var cancel = false;
            var setStatic = false;
            // Check all single stones
            for (j = 0; j < 4 && !cancel && this.stones[i].pos[j] != -1; j++) {
                // Compute the row this stone was in in the old field
                row = Math.floor(this.stones[i].pos[j] / width);
                if (shrink) {
                    // If we are shrinking and the stone is in the
                    // last row of our new field, mark it as static
                    if (row === this.field_height-1) {
                        setStatic = true;
                    }
                    // If the stone is further down than our new
                    // field's height is, spawn a new stone for
                    // this player and go to the next stone
                    else if (row > this.field_height-1) {
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
    this.stonefinished = function(userid) {
        var stop = false;
        // From bottom to top check all rows
        for (i = this.field_height-1; i >= 0 && !stop; i--) {
            // Count of empty fields in this row
            var empty = 0;
            // Count of filled fields in this row
            var full = 0;
            for (j = this.field_width-1; j >= 0; j--) {
                // If there is a filled field and there is no
                // immortal stone in this row
                if (this.field[i * this.field_width + j] > 0 && !this.solids.has(i)) {
                    full++;
                    // When the whole row is full
                    if (full === this.field_width) {
                        var change = false;
                        this.updateScoreLevel();
                        for (k = 0; k < i; k++) {
                            var emptyRow = 0;
                            // If there is no immortal stone is in this row, destroy it
                            if (!this.solids.has(i-k)) {
                                change = true;
                                for (l = 0; l < this.field_width; l++) {
                                    emptyRow += this.field[(i - k - 1) * this.field_width + l];
                                    this.field[(i - k) * this.field_width + l] = this.field[(i - k - 1) * this.field_width + l];
                                }
                                // If the row was empty stop checking
                                if (emptyRow === 0)
                                    k = i;
                            }
                        }
                        // If a row was deleted the row index must not change
                        // because the our current row is now one of the former above rows
                        i = change ? i + 1 : i;
                    }
                }
                // If the field is empty
                else if (this.field[i * this.field_width + j] === 0) {
                    empty++;
                    // When there are empty and filled fields in this row
                    // we can skip this row, it cannot be deleted, but there
                    // may be other above of it that can
                    if (full > 0)
                        j = -1;
                    // If we found a completely empty row we can stop checking
                    else if (empty === this.field_width)
                        stop = true;
                }
            }
        }
        // Spawn a new stone for the user with id 'userid'
        this.spawnStone(userid);
    }

    this.updateScoreLevel = function() {
        var diff = Math.abs(Math.floor(this.score / 200) - Math.floor((this.score + (this.field_width * this.multiplier)) / 200));
        if (diff > 0) {
            this.score += this.field_width * this.multiplier;
            this.level += diff;
            this.setSpeed();
            this.callSpeedCallback();
        } else {
            this.score += this.field_width * this.multiplier;
        }
    }

    this.setStaticStone = function(userid) {
        for (i = 0; i < 4 && this.stones[userid].pos[i] != -1; i++) {
            if (this.field[this.stones[userid].pos[i]] > 0)
                this.spawnSolidStone(this.stones[userid].pos[i])
            else
                this.field[this.stones[userid].pos[i]] = userid + 1;
        }
        this.stateChanged = true;
    }

    this.spawnSolidStone = function(pos) {
        this.field[pos] = SOLID_STONE;
        this.solids.add(Math.floor(pos / this.field_width));
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
        if (this.paused)
            return;

        // Turn Left (Q)
        if (key === 81) {
            switch (this.stones[userid].kind) {
                case 1: // OX
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === 0) {
                            this.stones[userid].pos[1] = this.stones[userid].pos[0];
                            this.stones[userid].pos[0]++;
                        } else {
                            this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                        }
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === (this.field_width - 1)) {
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
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] - this.field_width] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === 0) {
                            this.stones[userid].pos[1]++;
                            this.stones[userid].pos[2]++;
                        }
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - this.field_width;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] + this.field_width] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + this.field_width;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 6: // J - Inverse L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] - 1] === 0 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === 0) {
                            this.stones[userid].pos[1]++;
                            this.stones[userid].pos[0]++;
                        }
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] + this.field_width] === 0 && this.field[this.stones[userid].pos[3] - 1] === 0) {
                        if (this.stones[userid].pos[3] % this.field_width === 0) {
                            this.stones[userid].pos[3]++;
                            this.stones[userid].pos[1]++;
                        }
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[3] - 1;
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
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - this.field_width] === 0 && this.field[this.stones[userid].pos[0] - (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] - this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[2] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 1] === 0 && this.field[this.stones[userid].pos[0] - 2] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === 0) {
                            this.stones[userid].pos[0] += 2;
                            this.stones[userid].pos[2] += 2;
                        }
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] - 2;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] + this.field_width] === 0 && this.field[this.stones[userid].pos[0] + (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] + this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[2] + this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + 1] === 0 && this.field[this.stones[userid].pos[0] + 2] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === (this.field_width-1)) {
                            this.stones[userid].pos[0] -= 2;
                        } else if (this.stones[userid].pos[0] % this.field_width === (this.field_width-2)) {
                            this.stones[userid].pos[0]--;
                        }
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] + 2;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] + this.field_width;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 8: // kleines L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === 0) {
                            this.stones[userid].pos[0]++;
                            this.stones[userid].pos[2]++;
                        }
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] + this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + 1;
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
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] + 1] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === (this.field_width-1)) {
                            this.stones[userid].pos[1]--;
                            this.stones[userid].pos[0]--;
                        }
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] + this.field_width] === 0) {
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] - 1] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - 1;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 6: // J
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] + this.field_width] === 0 && this.field[this.stones[userid].pos[1] + (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] + this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] + this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0 && this.field[this.stones[userid].pos[1] - 2] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === 0) {
                            this.stones[userid].pos[0] += 2;
                            this.stones[userid].pos[1] += 2;
                        } else if (this.stones[userid].pos[1] % this.field_width === 1) {
                            this.stones[userid].pos[0]++;
                            this.stones[userid].pos[1]++;
                        }
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[3] - 1;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] - this.field_width] === 0 && this.field[this.stones[userid].pos[0] - (2 * this.field_width)] === 0) {
                        this.stones[userid].pos[0] = this.stones[userid].pos[1] - this.field_width;
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 1] === 0 && this.field[this.stones[userid].pos[1] + 2] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === (this.field_width-1)) {
                            this.stones[userid].pos[0] -= 2;
                            this.stones[userid].pos[1] -= 2;
                        } else if (this.stones[userid].pos[1] % this.field_width === (this.field_width-2)) {
                            this.stones[userid].pos[0]--;
                            this.stones[userid].pos[1]--;
                        }
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] + 2;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 7: // L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - 1] === 0 && this.field[this.stones[userid].pos[3] + this.field_width] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === 0) {
                            this.stones[userid].pos[0]++;
                        }
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] + this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[2] + this.field_width;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 1] === 0 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === 0) {
                            this.stones[userid].pos[0]++;
                            this.stones[userid].pos[1]++;
                        }
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] - this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[1] - 1;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[2] - this.field_width] === 0 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width == (this.field_width-1)) {
                            this.stones[userid].pos[0]--;
                        }
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + 1;
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] - this.field_width;
                        this.stones[userid].pos[3] = this.stones[userid].pos[2] - this.field_width;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 1] === 0 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        if (this.stones[userid].pos[1] % this.field_width === (this.field_width-1)) {
                            this.stones[userid].pos[0]--;
                            this.stones[userid].pos[1] --;
                        }
                        this.stones[userid].pos[2] = this.stones[userid].pos[1] + 1;
                        this.stones[userid].pos[3] = this.stones[userid].pos[0] + this.field_width;
                    } else {
                        break;
                    }
                    this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
                    break;
                case 8: // kleines L
                    if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === 0) {
                            this.stones[userid].pos[0]++;
                        }
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] - 1;
                    } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - this.field_width] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] - this.field_width;
                    } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] + 1] === 0) {
                        if (this.stones[userid].pos[0] % this.field_width === (this.field_width-1)) {
                            this.stones[userid].pos[0]--;
                            this.stones[userid].pos[2]--;
                        }
                        this.stones[userid].pos[1] = this.stones[userid].pos[0] + 1;
                    } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + this.field_width] === 0) {
                        this.stones[userid].pos[2] = this.stones[userid].pos[0] + this.field_width;
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
                if (this.stones[userid].pos[i] + this.field_width >= (this.field.length - this.field_width) ||
                    this.field[this.stones[userid].pos[i] + this.field_width] > 0) {
                    setzen = false;
                }
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
                    if ((this.stones[j].pos[i] < (this.field.length - this.field_width) &&
                         this.field[this.stones[j].pos[i] + this.field_width] > 0) ||
                         this.stones[j].pos[i] >= (this.field.length - this.field_width)) {
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
            for (j = 0; j < this.stones.length && !this.isGameOver(); j++) {
                var setzen = true;
                for (i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                    if (this.field[this.stones[j].pos[i] + this.field_width] > 0 ||
                        this.field[this.stones[j].pos[i]] + this.field_width >= this.field.length) {
                        setzen = false;
                    }
                }
                if (setzen) {
                    var setStatic = false;
                    for (i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
                        this.stones[j].pos[i] += this.field_width;
                    }
                }
            }
        }
    }
};