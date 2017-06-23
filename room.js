var MAX_PLAYER_COUNT = 4;
var PLAYER_OFFSET = 4;

module.exports.room = function() {

	this.field_height = 0;
	this.field_width = 0;
	this.field;

	this.stone = function(userid) {
		// 1: OX  2: XOX 4: XOX  5: XX  6: X    7: OXX  8: OX  9:  OX  10: XX   O = rotation center
		// 3: XOXX           X      OX     OXX     X       X      XX        OX
		this.kind = 1;
		this.pos = [-1, -1, -1, -1];
		this.color = userid;
		this.rotation = 1;
		this.start = 0;
	};

	this.player = function(userid, player) {
		this.id = userid;
		this.name = player;
	};

	this.score = 0;
	this.multiplier = 1;
	this.id = 0;
	this.name = '';
	this.players = [];
	this.stones = [];
	this.gameover = false;
	this.gameStarted = false;
	this.callback;

	this.createRoom = function(roomName, roomID, user) {
	    // Implement your game room (server side) logic here
	    if (!this.gameStarted && !this.gameover) {
	    	console.log("Created Lobby: \'" + roomName + "\'");
	    	this.name = roomName;
	    	this.addUser(user);
	    }
	};

	this.setGameOverCallback = function(func) {
		this.callback = func;
	}

	this.callGameOverCallback = function() {
		if (this.callback)
			this.callback(this.name, this.score);
	}

	this.getField = function() {
		return this.field;
	};

	this.getWidth = function() {
		return this.field_width;
	};

	this.getHeight = function() {
		return this.field_height;
	};

	this.getGameover = function() {
		return this.gameover;
	};

	this.getGameStarted = function() {
		return this.gameStarted;
	}

	this.startGame = function(width, height) {
		this.gameover = false;
		this.gameStarted = true;
		this.initField(width, height);
		for(var i = 0; i < this.stones.length; i++) {
			this.stonefinished(i);
		}
	}

	this.initField = function(width, height) {
		this.field_width = width;
	    this.field_height = height;
		this.field = new Array(this.field_height * this.field_width);
		this.field.fill(0);
	}

	this.addUser = function(user) {
		if (this.players.length < MAX_PLAYER_COUNT) {
			console.log("Player \'" + user + "\' joined the game \'" + this.name + "\'");
			this.players.push(new this.player(this.players.length, user));
			this.stones.push(new this.stone(this.players.length));
			this.getNewStartPosition(this.stones.length-1);
		}
	}

	this.getNewStartPosition = function(userid) {
		if ((userid + 1) % 2 === 0)
			this.stones[userid].start = (this.stones.length / 2) * -PLAYER_OFFSET;
		else
			this.stones[userid].start = (this.stones.length / 2) * PLAYER_OFFSET;
	}

	this.removeUser = function(userid) {
		if (userid >= 0 && userid < this.players.length) {
			console.log("Player \'" + this.players[userid].name + "\' left the game \'" + this.name + "\'");
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
		for (i = 0; i < this.field_height; i++) {
			for (j = 0; j < this.field_width; j++) {
				if (j === this.field_width - 1 && this.field[i * this.field_width + j] != 0) {
	                // Delete row and spawn new stones
	                this.score += this.field_width * this.multiplier;
	                for (k = 0; k < i; k++) {
	                	for (l = 0; l < this.field_width; l++) {
	                		this.field[(i - k) * this.field_width + l] = this.field[((i - k) - 1) * this.field_width + l];
	                	}
	                }
	            } else if (this.field[i * this.field_width + j] == 0) {
	            	j = this.field_width;
	            }
	        }
	    }

	    // Roll the dice which form the stone has
	    this.stones[userid].kind = Math.floor((Math.random() * 10) + 1);  // Random zahl zwischen 1 & 10
	    // No rotation
	    this.stones[userid].rotation = 1;
	    // Compute the starting position of the new stone
	    this.setStartPosition(userid);
	}

	this.setStartPosition = function(userid) {
		var at = this.stones[userid].start;

		switch (this.stones[userid].kind) {
	    	case 1:
	    		this.stones[userid].pos = [(this.field_width / 2) - 1 + at, (this.field_width / 2) + at, -1, -1];
		    	for (i = 0; i < 2; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 2:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 + at, this.field_width / 2 + 1 + at, -1]
		    	for (i = 0; i < 3; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 3:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 + at, this.field_width / 2 + 1 + at, this.field_width / 2 + 2 + at]
		    	for (i = 0; i < 4; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 4:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 + at, this.field_width / 2 + 1 + at, this.field_width / 2 + this.field_width + at]
		    	for (i = 0; i < 4; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 5:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 + at, this.field_width / 2 - 1 + this.field_width + at, this.field_width / 2 + this.field_width + at]
		    	for (i = 0; i < 4; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 6:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 - 1 + this.field_width + at, this.field_width / 2 + this.field_width + at, this.field_width / 2 + 1 + this.field_width + at]
		    	for (i = 0; i < 4; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 7:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 + at, this.field_width / 2 + 1 + at, this.field_width / 2 - 1 + this.field_width + at]
		    	for (i = 0; i < 4; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 8:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 + at, this.field_width / 2 - 1 + this.field_width + at, -1]
		    	for (i = 0; i < 3; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 9:
		    	this.stones[userid].pos = [this.field_width / 2 + at, this.field_width / 2 + 1 + at, this.field_width / 2 - 1 + this.field_width + at, this.field_width / 2 + this.field_width + at]
		    	for (i = 0; i < 4; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
	    	case 10:
		    	this.stones[userid].pos = [this.field_width / 2 - 1 + at, this.field_width / 2 + at, this.field_width / 2 + this.field_width + at, this.field_width / 2 + 1 + this.field_width + at]
		    	for (i = 0; i < 4; i++) {
		    		this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	} break;
		}
	}

	this.movestone = function(key, userid=0) {
	    // Turn left
	    if (key === 81) {
	    	switch (this.stones[userid].kind) {
	    		case 1:
		    		if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[1] - (this.field_width + 1)] === 0) {
		    			this.field[this.stones[userid].pos[1]] = 0;
		    			this.stones[userid].pos[1] -= (this.field_width + 1);
		    			this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		    		} else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] + (this.field_width - 1)] === 0) {
		    			this.field[this.stones[userid].pos[1]] = 0;
		    			this.stones[userid].pos[1] += (this.field_width - 1);
		    			this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		    		} else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[1] + (this.field_width + 1)] === 0) {
		    			this.field[this.stones[userid].pos[1]] = 0;
		    			this.stones[userid].pos[1] += (this.field_width + 1);
		    			this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		    		} else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] - (this.field_width - 1)] === 0) {
		    			this.field[this.stones[userid].pos[1]] = 0;
		    			this.stones[userid].pos[1] -= (this.field_width - 1);
		    			this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		    		} else
		    			break;
		    		this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
		    		break;
	        	case 2: // XOX
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - 9] === 0 && this.field[this.stones[userid].pos[2] + (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] -= (this.field_width - 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += (this.field_width - 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.stones[userid].rotation = 2;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] + (this.field_width - 1)] === 0 && this.field[this.stones[userid].pos[2] - (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] += (this.field_width - 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= (this.field_width - 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.stones[userid].rotation = 1;
		            } break;
	        	case 3: // XOXX
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] + (this.field_width + 1)] === 0 && this.field[this.stones[userid].pos[2] - (this.field_width + 1)] === 0 && this.field[this.stones[userid].pos[3] - 2 * (this.field_width + 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] += (this.field_width + 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= (this.field_width + 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] -= 2 * (this.field_width + 1);
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - (this.field_width - 1)] === 0 && this.field[this.stones[userid].pos[2] + (this.field_width - 1)] === 0 && this.field[this.stones[userid].pos[3] + 2 * (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] -= (this.field_width - 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += (this.field_width - 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] += 2 * (this.field_width - 1);
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[0] - (this.field_width + 1)] === 0 &&
		            	this.field[this.stones[userid].pos[2] + (this.field_width + 1)] === 0 && this.field[this.stones[userid].pos[3] + 2 * (this.field_width + 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] -= (this.field_width + 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += (this.field_width + 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] += 2 * (this.field_width + 1);
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] + (this.field_width - 1)] === 0 &&
		            	this.field[this.stones[userid].pos[2] - (this.field_width - 1)] === 0 && this.field[this.stones[userid].pos[3] - 2 * (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] += (this.field_width - 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= (this.field_width - 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] -= 2 * (this.field_width - 1);
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else
		            	break;

		            this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
		            break;
	        	case 4: // T XOX
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] - (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] -= (this.field_width - 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] + (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] += (this.field_width - 1);
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] -= 2 * this.field_width;
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[3] + 2 * this.field_width] === 0) {
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] += 2 * this.field_width;
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= (this.field_width + 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + (this.field_width + 1)] === 0) {
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += (this.field_width + 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else
		            	break;

		            this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
		            break;
	        	case 5:
	                // Keine rotation weil viereck
	                break;
	            case 6: // J
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[2] - (2 * this.field_width + 1)] === 0 && this.field[this.stones[userid].pos[3] - 3] === 0) {
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= (2 * this.field_width + 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] -= 3;
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] + 2 * this.field_width] === 0 && this.field[this.stones[userid].pos[2] + 2 * (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] += 2 * this.field_width;
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += 2 * (this.field_width - 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[2] + 3] === 0 && this.field[this.stones[userid].pos[3] + (2 * this.field_width + 1)] === 0) {
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += 3;
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] += (2 * this.field_width + 1)
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[0] - 2 * this.field_width] === 0 && this.field[this.stones[userid].pos[3] - 2 * (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] -= 2 * this.field_width;
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] -= 2 * (this.field_width - 1);
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            } else
		            	break;

		            this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
		            break;
	        	case 7: // L
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[3] - 2 * this.field_width] === 0 && this.field[this.stones[userid].pos[2] - 2 * (this.field_width + 1)] === 0) {
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] -= 2 * this.field_width;
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= 2 * (this.field_width + 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 2] === 0 && this.field[this.stones[userid].pos[2] + 2 * (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[1]] = 0;
		            	this.stones[userid].pos[1] -= 2;
		            	this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += 2 * (this.field_width - 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[3] + 2 * this.field_width] === 0 && this.field[this.stones[userid].pos[2] + 2 * (this.field_width + 1)] === 0) {
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] += 2 * this.field_width;
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += 2 * (this.field_width + 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 2] === 0 && this.field[this.stones[userid].pos[2] - 2 * (this.field_width - 1)] === 0) {
		            	this.field[this.stones[userid].pos[1]] = 0;
		            	this.stones[userid].pos[1] += 2;
		            	this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= 2 * (this.field_width - 1);
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else
		            	break;

		            this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
		            break;
	        	case 8: // kleines L
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[2] - 2 * this.field_width] === 0) {
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= 2 * this.field_width;
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[1] - 2] === 0) {
		            	this.field[this.stones[userid].pos[1]] = 0;
		            	this.stones[userid].pos[1] -= 2;
		            	this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 3 && this.field[this.stones[userid].pos[2] + 2 * this.field_width] === 0) {
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += 2 * this.field_width;
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            } else if (this.stones[userid].rotation === 4 && this.field[this.stones[userid].pos[1] + 2] === 0) {
		            	this.field[this.stones[userid].pos[1]] = 0;
		            	this.stones[userid].pos[1] += 2;
		            	this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		            } else
		            	break;

		            this.stones[userid].rotation === 4 ? this.stones[userid].rotation = 1 : this.stones[userid].rotation++;
		            break;
		        case 9: // S
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[2] + 2] === 0 && this.field[this.stones[userid].pos[3] - 2 * this.field_width] === 0) {
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] += 2;
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] -= 2 * this.field_width;
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            	this.stones[userid].rotation = 2;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[2] - 2] === 0 && this.field[this.stones[userid].pos[3] + 2 * this.field_width] === 0) {
		            	this.field[this.stones[userid].pos[2]] = 0;
		            	this.stones[userid].pos[2] -= 2;
		            	this.field[this.stones[userid].pos[2]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[3]] = 0;
		            	this.stones[userid].pos[3] += 2 * this.field_width;
		            	this.field[this.stones[userid].pos[3]] = this.stones[userid].color;
		            	this.stones[userid].rotation = 1;
		            } break;
		        case 10: // Z
		            if (this.stones[userid].rotation === 1 && this.field[this.stones[userid].pos[0] + 2] === 0 && this.field[this.stones[userid].pos[1] + 2 * this.field_width] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] += 2;
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[1]] = 0;
		            	this.stones[userid].pos[1] += 2 * this.field_width;
		            	this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		            	this.stones[userid].rotation = 2;
		            } else if (this.stones[userid].rotation === 2 && this.field[this.stones[userid].pos[0] - 2] === 0 && this.field[this.stones[userid].pos[1] - 2 * this.field_width] === 0) {
		            	this.field[this.stones[userid].pos[0]] = 0;
		            	this.stones[userid].pos[0] -= 2;
		            	this.field[this.stones[userid].pos[0]] = this.stones[userid].color;
		            	this.field[this.stones[userid].pos[1]] = 0;
		            	this.stones[userid].pos[1] -= 2 * this.field_width;
		            	this.field[this.stones[userid].pos[1]] = this.stones[userid].color;
		            	this.stones[userid].rotation = 1;
		            } break;
	        }
	    } else if (key === 69) {
	        //this.field[stonepos]--;
	    } else if (key === 65) {
	    	var setzen = true;
	    	for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
	    		if (!(this.field[this.stones[userid].pos[i] - 1] === 0 ||
	    			this.stones[userid].pos[(i + 1) % 4] === this.stones[userid].pos[i] - 1 ||
	    			this.stones[userid].pos[(i + 2) % 4] === this.stones[userid].pos[i] - 1 ||
	    			this.stones[userid].pos[(i + 3) % 4] === this.stones[userid].pos[i] - 1)||
	    			this.stones[userid].pos[i] % this.field_width < (this.stones[userid].pos[i] - 1) % this.field_width) {
	    				setzen = false;
	    		}
	    	}
		    if (setzen) {
		    	for (i = 0; i < 4; i++) {
		    		if (this.stones[userid].pos[i] >= 0) {
		    			this.field[this.stones[userid].pos[i]] = 0;
		    			this.stones[userid].pos[i]--;
		    		}
		    	}
		    	for (i = 0; i < 4; i++) {
		    		if (this.stones[userid].pos[i] >= 0)
		    			this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	}
		    }
		} else if (key === 68) {
		    var setzen = true;
		    for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
		    	if (!(this.field[this.stones[userid].pos[i] + 1] === 0 ||
		    		this.stones[userid].pos[(i + 1) % 4] === this.stones[userid].pos[i] + 1 ||
		    		this.stones[userid].pos[(i + 2) % 4] === this.stones[userid].pos[i] + 1 ||
		    		this.stones[userid].pos[(i + 3) % 4] === this.stones[userid].pos[i] + 1)||
		    		this.stones[userid].pos[i] % this.field_width > (this.stones[userid].pos[i] + 1) % this.field_width) {
		    		setzen = false;
		    	}
		    }
		    if (setzen) {
		    	for (i = 0; i < 4; i++) {
		    		if (this.stones[userid].pos[i] >= 0) {
		    			this.field[this.stones[userid].pos[i]] = 0;
		    			this.stones[userid].pos[i]++;
		    		}
		    	}
		    	for (i = 0; i < 4; i++) {
		    		if (this.stones[userid].pos[i] >= 0) {
		    			this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    		}
		    	}
		    }
		} else if (key === 83) {
		    var setzen = true;
		    for (i = 0; i < 4 && this.stones[userid].pos[i] !== -1; i++) {
		    	if (!(this.field[this.stones[userid].pos[i] + this.field_width] === 0 ||
		    		this.stones[userid].pos[(i + 1) % 4] === this.stones[userid].pos[i] + this.field_width ||
		    		this.stones[userid].pos[(i + 2) % 4] === this.stones[userid].pos[i] + this.field_width ||
		    		this.stones[userid].pos[(i + 3) % 4] === this.stones[userid].pos[i] + this.field_width)) {
		    		setzen = false;
		    	}
		    }
		    if (setzen) {
		    	for (i = 0; i < 4; i++) {
		    		if (this.stones[userid].pos[i] >= 0) {
		    			this.field[this.stones[userid].pos[i]] = 0;
		    			this.stones[userid].pos[i] += this.field_width;
		    		}
		    	}
		    	for (i = 0; i < 4; i++) {
		    		if (this.stones[userid].pos[i] >= 0)
		    			this.field[this.stones[userid].pos[i]] = this.stones[userid].color;
		    	}
		    }
		}
	}

	this.gamelogic = function() {
		// Check if stones are so high the game is over
		for (j = 0; j < this.stones.length; j++) {
			for (i = 0; i < this.field_width; i++) {
				if (this.field[i] !== 0 && i !== this.stones[j].pos[0] && i !== this.stones[j].pos[1] && i !== this.stones[j].pos[2] && i !== this.stones[j].pos[3]) {
					this.gameover = true;
					this.gameStarted = false;
					this.callGameOverCallback();
				}
			}
		}

		// Check if the player's stones reached the bottom
		for (j = 0; j < this.stones.length; j++) {
			for (i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
				if ((this.stones[j].pos[i] < (this.field_height - 1) * this.field_width && this.field[this.stones[j].pos[i] + this.field_width] > 0 &&
					this.stones[j].pos[(i + 1) % 4] !== this.stones[j].pos[i] + this.field_width &&
					this.stones[j].pos[(i + 2) % 4] !== this.stones[j].pos[i] + this.field_width &&
					this.stones[j].pos[(i + 3) % 4] !== this.stones[j].pos[i] + this.field_width) || this.stones[j].pos[i] >= (this.field_height - 1) * this.field_width) {
					this.stonefinished(j);
					break;
				}
			}
		}
	}

	this.dropStones = function() {
		if (!this.gameover) {
			for (j = 0; j < this.stones.length; j++) {
				var setzen = true;
				for (i = 0; i < 4 && this.stones[j].pos[i] !== -1; i++) {
					if (!(this.field[this.stones[j].pos[i] + this.field_width] === 0 ||
						this.stones[j].pos[(i + 1) % 4] === this.stones[j].pos[i] + this.field_width ||
						this.stones[j].pos[(i + 2) % 4] === this.stones[j].pos[i] + this.field_width ||
						this.stones[j].pos[(i + 3) % 4] === this.stones[j].pos[i] + this.field_width)) {
						setzen = false;
					}
				}
				if (setzen) {
					for (i = 0; i < 4; i++) {
						if (this.stones[j].pos[i] >= 0) {
							this.field[this.stones[j].pos[i]] = 0;
							this.stones[j].pos[i] += this.field_width;
						}
					}
					for (i = 0; i < 4; i++) {
						if (this.stones[j].pos[i] >= 0) {
							this.field[this.stones[j].pos[i]] = this.stones[j].color;
						}
					}
				}
			}
		} else {
			// Do sth when the game is over (return to menu/lobby screen)
		}
	}
};