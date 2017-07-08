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
app.get('/lobbies', function (req, res) {
    // Render lobbies.pug
    res.render('lobbies', { lobbies: getLobbies() });
});

// Highscores
app.get('/highscores', function (req, res) {
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
            ' date TEXT NOT NULL,' +
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
            { $n: name, $s: currentScore, $d: new Date().toUTCString(), $g: game }, function(error) {
            if (error)
                console.log('Setting new user score failed: ' + "[" + name + ", " + score + "]\n" + error);
        });
    });
}

// Create a list of all highscores
function updateHighscores() {
    db.serialize(function() {
        db.all('SELECT * FROM highscores ORDER BY score DESC', [], function(error, rows) {
            if (!error && rows.length > 0)
                scores = rows.slice(0);
            else if (error)
                console.log('Getting highscores failed: ' + error);
        });
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

        // Start the game
        socket.on('startgame', function (lobbyname) {
            if (roomlist.has(lobbyname)) {
                // Initializes the field and starts dropping stones
                game = roomlist.get(lobbyname);
                game.startGame();

                // Start game loops for this game
                deleteOldLoops(game.name);
                setLoops(game);

                // Tell all sockets in the game what the field looks like
                io.sockets.in(game.name).emit('begin', sendFieldData(game.field));
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
                if (users.get(username) != '') {
                    game = roomlist.get(users.get(username));
                    socket.leave(game.name, function(err) {
                        if (err)
                            console.log('Client could not leave his current game!');
                    });
                    game.removeUser(id);
                }
                users.delete(username);
                socket.emit('loggedout');
                console.log("Player \'" + username + "\' logged out");
            }
        });

        socket.on('leavejoin', function(data) {
            if (roomlist.has(data.oldlobby) && roomlist.has(data.newlobby)) {
                oldgame = roomlist.get(data.oldlobby);
                newgame = roomlist.get(data.newlobby);

                socket.leave(oldgame.name);
                oldgame.removeUser(data.userid);

                if (newgame.addUser(data.username)) {
                    socket.join(newgame.name, function() {
                        users.set(data.username, newgame.name);
                        uId = newgame.getLastUser();
                        // Tell the player its game info
                        socket.emit('setgameinfo', { lobbyname: newgame.name, id: uId,
                                width: newgame.field_width, height: newgame.field_height,
                                username: data.username, hash: newgame.players[uId].hash });

                        socket.broadcast.to(newgame.name).emit('userhashes', uId, newgame.players[uId].hash);
                        socket.emit('sethashes', newgame.getAllHashes());

                        // If the game already started tell the player about it
                        if (newgame.gameStarted && !newgame.gameOver)
                            socket.emit('begin', sendFieldData(newgame.field));

                        socket.emit('showGame');
                    });
                } else {
                    users.set(data.username, '');
                    socket.emit('leftgame');
                }
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
                    game.removeUser(id);
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
                                                game.field_height, sendFieldData(game.field), sendPlayerData(game.stones));
                        }

                        // If the game already started tell the player about it
                        if (game.gameStarted && !game.gameOver)
                            socket.emit('begin', sendFieldData(game.field));
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

        socket.on('endGame', function(data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                if (game.isAdmin(data.userid))
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
    });
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

function endGame(lobby, players, score, leave=false) {
    if (loops.has(lobby)) {
        clearInterval(loops.get(lobby).short);
        clearInterval(loops.get(lobby).long);
    }

    if (!leave) {
        io.sockets.in(lobby).emit('gameover', score);

        // Update scores if greater than 0
        if (score > 0) {
            for (i = 0; i < players.length; i++) {
                updateScoreTable(players[i].name, score, lobby);
            }
            updateHighscores();
        }
    }

    // TODO display dialog to ask if game should be restarted
    if (lobby === def1 || lobby === def2)
        game.reset();
    else
        roomlist.delete(lobby);
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
    //var field = OptimizeField(data);
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

function OptimizeField(field) {
    // TODO implement
    return field;
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
updateHighscores();

// Set all event handlers
setEventHandlers();

createDefaultGame(def1, 60, 30, 10);
createDefaultGame(def2, 30, 20, 5);
