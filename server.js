var express = require('express')
,   app = express()
,   server = require('http').createServer(app)
,   io = require('socket.io')(server, { 'transports': ['websocket', 'polling'] })
,   conf = require('./config.json')
,   lobby = require('./room.js')
,   sql = require('sqlite3');

var once = true;
var last = 0;
var DATABASE = 'users.db';

// Default lobbies
var def1 = 'default1';
var def2 = 'default2';

var useBinary = conf.binary;

// Map of all currently active lobbies
var roomlist = new Map();
var loops = new Map();
var scores = [];
var users = new Map();

// Webserver
// Use Port X
var port = process.env.PORT || conf.port;
server.listen(port);

// Template directory and engine
app.set('views', './views');
app.set('view engine', 'pug');

// Routing
// Deliver static files
app.use(express.static(__dirname + '/public'));

// Main Site
app.get('/', function (req, res) {
    // Render index.pug
    res.render('index');
});

// Lobbies
app.get('/lobbies', sortLobbies, function (req, res) {
    // Render lobbies.pug
    res.render('lobbies', { lobbies: req.lobbies });
});

// Highscores
app.get('/highscores', sortScores, function (req, res) {
    // Render highscores.pug
    res.render('highscores', { scores: scores });
});

// Game
app.get(/\/game\/[a-zA-z0-9]/, function (req, res) {
    // Render game.pug
    res.render('game');
});

// Controls
app.get('/controls', function (req, res) {
    // Render error.pug
    res.render('controls');
});

// Errors
app.get('/error', function (req, res) {
    // Render error.pug
    res.render('error', { msg: lastError });
});

// Database stuff
var db = new sql.Database(DATABASE);

// Create a list of all lobbies
function getLobbies() {
    list = [];
    roomlist.forEach(function(value, key, map) {
        list.push({ name: key, id: value.id,
                    currentPlayers: value.players.length,
                    maxPlayers: value.getMaxPlayerCount() });
    });
    return list;
}

function createScoreTable() {
    db.serialize(function() {
        db.run('CREATE TABLE IF NOT EXISTS highscores' +
            '(name TEXT PRIMARY KEY NOT NULL,' +
            ' score INT NOT NULL,' +
            ' date INTEGER NOT NULL,' +
            ' game TEXT NOT NULL)', [], function(error, rows) {
        if (error)
            console.log('Creating highscores table failed: ' + error);
        });
    })
}

function updateScoreTable(name, score, game) {
    var currentScore = score;
    db.get('SELECT * FROM highscores WHERE name = ?', [name], function(error, row) {
        if (!error && row)
            currentScore = row.score > currentScore ? row.score : currentScore;
    });

    db.serialize(function() {
        db.run('INSERT OR REPLACE INTO highscores (name, score, date, game) VALUES ($n, $s, $d, $g)',
            { $n: name, $s: currentScore, $d: new Date().toDateString(), $g: game }, function(error) {
            if (error)
                console.log('Setting new user score failed: ' + "[" + name + ", " + score + "]\n" + error);
        });
    });
}

function sortLobbies(req, res, next) {
    var sort = parseInt(req.query.sort);
    var order = parseInt(req.query.order) === 0 ? -1 : 1;
    req.lobbies = getLobbies();
    req.lobbies.sort(function(a, b) {
        switch(sort) {
            case 1: {
                if (order === -1)
                    return sortBy(a.name.toLowerCase(), b.name.toLowerCase());
                else
                    return sortBy(b.name.toLowerCase(), a.name.toLowerCase());
                } break;
            case 2: return sortBy(a.currentPlayers, b.currentPlayers * order); break;
            case 3: return sortBy(a.maxPlayers * order, b.maxPlayers); break;
            default: return sortBy(a.id, b.id * order);
        }
    });
    next();
}

function sortScores(req, res, next) {
    var by;
    switch (parseInt(req.query.sort)) {
        case 1: by = 'LOWER(name)'; break;
        case 2: by = 'LOWER(game)'; break;
        case 3: by = 'date'; break;
        default: by = 'score'; break;
    }
    var ord = parseInt(req.query.sort)
    if (ord === 1 || ord === 2)
        ord = Math.abs(parseInt(req.query.order)-1);
    else
        ord = Math.abs(parseInt(req.query.order));

    var ascd = ord === 1 ? ' ASC' : ' DESC';

    db.all('SELECT * FROM highscores ORDER BY ' + by + ascd, [], function(error, rows) {
        if (!error && rows.length > 0) {
            scores = rows.slice(0);
        } else if (error) {
            console.log('Getting highscores failed: ' + error);
        }
        next();
    });
}

// Generate new room id
function generateRoomID() {
    return ++last;
}

// Event handlers
function setEventHandlers() {

    io.sockets.on('connection', function (socket) {

        if (once && conf.debug)
            joinDefaultGame(socket);

        socket.on('disconnect', function(username, id) {
            if (users.has(username)) {
                if (users.get(username).length > 0 && id >= 0)
                    users.get(username).removeUser(id);
                users.delete(username);
            }
        });

        // Start the game
        socket.on('startgame', function (lobbyname, id) {
            if (roomlist.has(lobbyname)) {
                game = roomlist.get(lobbyname);

                if (game.isAdmin(id)) {
                    game.startGame();

                    // Start game loops for this game
                    deleteOldLoops(game.name);
                    setLoops(game);

                    // Tell all sockets in the game what the field looks like
                    io.sockets.in(game.name).emit('begin', sendFieldData(game.field));
                }
            }
        });

        // When the game tab needs current game information
        socket.on('udpdategame', function(lobbyname) {
            if (roomlist.has(lobbyname)) {
                game = roomlist.get(lobbyname);
                socket.emit('moveField', sendFieldData(game.field));
                socket.emit('moveScore', sendScoreData(game.score), sendLevelData(game.level));
            }
        });

        // When a user pressed a key, move his stone
    	socket.on('playermove', function (lobbyname, key, userid) {
            if (roomlist.has(lobbyname)) {
                game = roomlist.get(lobbyname);
                game.movestone(key, userid);

                io.sockets.in(game.name).emit('movePlayers', sendPlayerData(game.stones));
            }
    	});

        socket.on('createlobbyfixed', function(lobbyname, username, width, height, max) {
            if (!roomlist.has(lobbyname)) {
                socket.join(lobbyname, function() {
                    roomlist.set(lobbyname, new lobby.room());
                    game = roomlist.get(lobbyname);
                    game.createRoomFixed(lobbyname, generateRoomID(), username, width, height, max);
                    game.setGameOverCallback(endGame);
                    game.setSpeedCallback(updateSpeed);
                    users.set(username, game.name);

                    uId = game.getLastUser();
                    // Tell socket game info
                    socket.emit('setgameinfo', { lobbyname: game.name, id: uId,
                        width: game.field_width, height: game.field_height,
                        username: username, hash: game.players[uId].hash, gameid: game.id });
                });
            } else {
                setLastError(0, lobbyname);
                socket.emit('dataerror');
            }
        });

        socket.on('createlobby', function(lobbyname, username) {
            if (!roomlist.has(lobbyname)) {
                socket.join(lobbyname, function() {
                    roomlist.set(lobbyname, new lobby.room());
                    game = roomlist.get(lobbyname);
                    game.createRoom(lobbyname, generateRoomID(), username);
                    game.setGameOverCallback(endGame);
                    game.setSpeedCallback(updateSpeed);
                    users.set(username, game.name);

                    uId = game.getLastUser();
                    // Tell socket game info
                    socket.emit('setgameinfo', { lobbyname: game.name, id: uId,
                        width: game.field_width, height: game.field_height,
                        username: username, hash: game.players[uId].hash, gameid: game.id });
                });
            } else {
                setLastError(0, lobbyname);
                socket.emit('dataerror');
            }
        });

        socket.on('login', function(username) {
            if (!users.has(username)) {
                users.set(username, '');
                socket.emit('loggedin', username);
                console.log("Player \'" + username + "\' logged in");
            } else {
                setLastError(1, username);
                socket.emit('dataerror');
            }
        });

        socket.on('logout', function(username, id) {
            if (users.has(username)) {
                if (users.get(username).length > 0) {
                    game = roomlist.get(users.get(username));
                    socket.leave(game.name, function(err) {
                        if (err)
                            console.log('Client could not leave his current game!');
                    });
                    game.removeUser(id);
                    io.sockets.in(game.name).emit('sethashes', game.getAllHashes());
                }
                users.delete(username);
                socket.emit('loggedout');
                console.log("Player \'" + username + "\' logged out");
            }
        });

        socket.on('leave', function(lobby, id, user) {
            if (roomlist.has(lobby) && users.has(user)) {
                game = roomlist.get(lobby);
                if (game.players[id].name === user) {
                    socket.leave(game.name, function(err) {
                        if (err)
                            console.log('Client could not leave his current game!');
                    });
                    var result = game.removeUser(id);
                    if (result === 2) {
                        io.sockets.in(game.name).emit('resizefield', game.field_width,
                                                                     game.field_height,
                                                                     sendFieldData(game.field),
                                                                     sendPlayerData(game.stones));
                    }

                    io.sockets.in(game.name).emit('sethashes', game.getAllHashes());

                    users.set(user, '');
                    socket.emit('leftgame');
                }
            }
        });

        // When a user joins a game
        socket.on('join', function(lobbyname, username) {
            if (roomlist.has(lobbyname) && !userInGame(lobbyname, username)) {
                socket.join(lobbyname, function() {
                    game = roomlist.get(lobbyname);
                    users.set(username, lobbyname);
                    var result = game.addUser(username);
                    if (result > 0) {
                        uId = game.getLastUser();
                        // Tell the player its game info
                        socket.emit('setgameinfo', { lobbyname: game.name, id: uId,
                            width: game.field_width, height: game.field_height,
                            username: username, hash: game.players[uId].hash, gameid: game.id });

                        socket.broadcast.to(game.name).emit('userhash', uId, game.players[uId].hash);
                        socket.emit('sethashes', game.getAllHashes());

                        if (result == 2) {
                            socket.broadcast.to(game.name).emit('resizefield', game.field_width,
                                                                               game.field_height,
                                                                               sendFieldData(game.field),
                                                                               sendPlayerData(game.stones));
                        }

                        // If the game already started tell the player about it
                        if (game.gameStarted && !game.gameOver)
                            socket.emit('begin', sendFieldData(game.field));

                        socket.emit('showGame');
                    }
                });
            } else if (roomlist.has(lobbyname) && userInGame(lobbyname, username)) {
                game = roomlist.get(lobbyname);;
                if (!game.gameStarted) {
                    game.startGame();

                    // Start game loops for this game
                    setLoops(game);
                    socket.emit('begin', sendFieldData(game.field));
                } else {
                    socket.emit('showGame');
                }
            }
        });

        socket.on('togglepause', function(lobbyname, id) {
            if (roomlist.has(lobbyname)) {
                game = roomlist.get(lobbyname);
                if (game.togglePause(id)) {
                    if (game.paused) {
                        io.sockets.in(game.name).emit('pause');
                    } else {
                        io.sockets.in(game.name).emit('unpause');
                    }
                }
            }
        });

        socket.on('endgame', function(lobbyname, id) {
            if (roomlist.has(lobbyname)) {
                game = roomlist.get(lobbyname);
                if (game.isAdmin(id))
                    endGame(game.name, game.players, game.score, false);
            }
        });

        socket.on('spectate', function(lobbyname) {
            if (roomlist.has(lobbyname)) {
                socket.join(lobbyname, function() {
                    game = roomlist.get(lobbyname);
                    // Tell the player its game info
                    socket.emit('setspecinfo', game.name, game.field_width,
                                game.field_height, game.getAllHashes());
                    // If the game already started tell the player about it
                    socket.emit('begin', sendFieldData(game.field));
                });
            }
        });

        socket.on('endspectate', function(lobbyname) {
            socket.leave(lobbyname, function(err) {
                if (err)
                    console.log('Client could not leave his current game!');
            });
        });

        socket.on('drop', function(lobbyname, userid) {
            if (roomlist.has(lobbyname)) {
                game = roomlist.get(lobbyname);
                game.instaDrop(userid);

                io.sockets.in(game.name).emit('movePlayers', sendPlayerData(game.stones));
                io.sockets.in(game.name).emit('moveField', sendFieldData(game.field));
                io.sockets.in(game.name).emit('moveScore', sendScoreData(game.score), sendLevelData(game.level));
            }
        });
    });
}

function sortBy(a, b) {
    if (a < b)
        return -1;
    else if (a > b)
        return 1;
    else
        return 0;
}

function setLastError(num, arg) {
    switch(num) {
        case 0: lastError = 'Lobby ' + arg + ' already exists'; break;
        case 1: lastError = 'User ' + arg + ' is already logged in'; break;
        case 2: lastError = 'Lalala'; break;
        default: lastError = 'Error Occured';
    }
}

function userInGame(lobby, name) {
    return roomlist.get(lobby).players.some(function(element, index, array) {
        return element.name === name;
    });
}

function checkDelete(lobby) {
    if (lobby !== def1 && lobby !== def2 && roomlist.get(lobby).players.length === 0)
        roomlist.delete(lobby);
}

function endGame(lobby, players, score) {
    if (loops.has(lobby)) {
        clearInterval(loops.get(lobby).short);
        clearInterval(loops.get(lobby).long);
    }

    io.sockets.in(lobby).emit('gameover', score);

    // Update scores if greater than 0
    if (score > 0) {
        for (i = 0; i < players.length; i++) {
            updateScoreTable(players[i].name, score, lobby);
        }
    }

    // TODO display dialog to ask if game should be restarted
    if (lobby === def1 || lobby === def2)
        game.reset();
    else
        roomlist.delete(lobby);

    for (i = 0; i < players.length; i++) {
        users.set(players[i].name, '');
    }
}

function updateSpeed(game) {
    if (loops.has(game.name)) {
        clearInterval(loops.get(game.name).short);
        clearInterval(loops.get(game.name).long);
        loops.delete(game.name);

        setLoops(game);
    }
}

function deleteOldLoops(name) {
    if (loops.has(name)) {
        clearInterval(loops.get(name).short);
        clearInterval(loops.get(name).long);
        loops.delete(name);
    }
}

// Start game loops
function setLoops(game) {
    if (!loops.has(game.name)) {
        var l = setInterval(function() {
            game.dropStones();
            io.sockets.in(game.name).emit('movePlayers', sendPlayerData(game.stones));
        }, game.speed);

        var s = setInterval(function () {
            game.stateChanged = false;
            game.gamelogic();
            if (game.stateChanged) {
                io.sockets.in(game.name).emit('moveField', sendFieldData(game.field));
                io.sockets.in(game.name).emit('moveScore', sendScoreData(game.score), sendLevelData(game.level));
            }
       }, 50);
    }

    // Store IDs so we can stop intervals once the game is over
    loops.set(game.name, { long: l, short: s });
}

function sendFieldData(field) {
    if (useBinary)
        return sendBinaryField(field);
    else
        return field;
}

function sendPlayerData(stones) {
    if (useBinary) {
        return sendBinaryPlayers(stones);
    } else {
        var list = [stones.length];
        stones.forEach(function(item, index, array) {
            list[index] = item.pos;
        });
        return list;
    }
}

function sendScoreData(score) {
    if (useBinary)
        return sendBinaryScore(score);
    else
        return score;
}

function sendLevelData(level) {
    if (useBinary)
        return sendBinaryScore(level);
    else
        return level;
}

function sendBinaryField(field) {
    var bufArr = new ArrayBuffer(field.length);
    var bufView = new Uint8Array(bufArr);
    for(i = 0; i < field.length; i++) {
        bufView[i] = field[i];
    }
    return bufArr;
}

function sendBinaryPlayers(players) {
    var bufArr = new ArrayBuffer(players.length);
    var bufView = new Uint8Array(bufArr);
    for(i = 0; i < players.length; i++) {
        bufView[i] = players[i].pos;
    }
    return bufArr;
}

function sendBinaryScore(score) {
    var bufArr = new ArrayBuffer(2);
    var bufView = new Uint16Array(bufArr);
    bufView[0] = score;
    return bufArr;
}

function createDefaultGame(name, w, h, m) {
    // Just for Testing
    roomlist.set(name, new lobby.room());
    game = roomlist.get(name);
    game.createRoomFixed(name, generateRoomID(), 'Admin', w, h, m);
    game.setGameOverCallback(endGame);
    game.setSpeedCallback(updateSpeed);
    game.removeUser(game.getLastUser());
}

function joinDefaultGame(socket) {
    if (roomlist.has(def1)) {
        // Join first game
        socket.join(def1, function() {
            game = roomlist.get(def1);
            game.addUser('defaultUser');
            uId = game.getLastUser();
            socket.emit('setgameinfo', { lobbyname: game.name, id: uId,
                width: game.field_width, height: game.field_height, username: 'defaultUser',
                hash: game.players[uId].hash });
            once = false;
        });
    } else if (roomlist.has(def2)) {
        // Join second game
        socket.join(def2, function() {
            game = roomlist.get(def2);
            game.addUser('defaultUser');
            uId = game.getLastUser();
            socket.emit('setgameinfo', { lobbyname: game.name, id: uId,
                width: game.field_width, height: game.field_height, username: 'defaultUser',
                hash: game.players[uId].hash });
            once = false;
        });
    }
}

function noDefaultPlayer(element, index, array) {
    return element.name !== 'defaultUser';
}

console.log('Server is running on port: ' + port);

// Init database
createScoreTable();

// Set all event handlers
setEventHandlers();

createDefaultGame(def1, 60, 30, 10);
createDefaultGame(def2, 30, 20, 5);
