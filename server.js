var express = require('express')
,   app = express()
,   server = require('http').createServer(app)
,   io = require('socket.io')(server, { 'transports': ['websocket', 'polling'] })
,   conf = require('./config.json')
,   lobby = require('./room.js');

var once = true;
var last = 0;

// Default lobbies
var def1 = 'default1';
var def2 = 'default2';

var useBinary = conf.binary;

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
    res.render('highscores', { scores: getHighscores() });
});

// Game
app.get(/\/game\/[a-zA-z0-9]/, function (req, res) {
    // Render game.pug
    res.render('game');
});

// Map of all currently active lobbies
roomlist = new Map();
loops = new Map();
scores = new Map;

addDefaultScores();

function addDefaultScores() {
    scores.set('Peter', 9231);
    scores.set('Klaus', 8829);
    scores.set('Hannah', 9106);
}

// Create a list of all lobbies
function getLobbies() {
    list = [];
    roomlist.forEach(function(value, key, map) {
        list.push({name: key, id: value.id});
    })
    return list;
}

// Create a list of all highscores
function getHighscores() {
    list = [];
    scores.forEach(function(value, key, map) {
        list.push({name: key, score: value});
    });
    list.sort(function(a, b) {
        if (a.score > b.score)
            return -1;
        else if (a.score < b.score)
            return 1;

        return 0;
    });
    return list;
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
        socket.on('startgame', function (data) {
            if (roomlist.has(data.lobbyname)) {
                // Initializes the field and starts dropping stones
                game = roomlist.get(data.lobbyname);
                game.startGame();
                game.setGameOverCallback(endGame);

                // Start game loops for this game
                setLoops(game);

                // Tell all sockets in the game what the field looks like
                io.sockets.in(game.name).emit('begin', sendFieldData(game.field));
            }
        });

        // When the game tab needs current game information
        socket.on('udpdategame', function(data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                socket.emit('moveField', sendFieldData(game.field));
                socket.emit('moveScore', sendScoreData(game.score));
            }
        });

        // When a user pressed a key, move his stone
    	socket.on('playermove', function (data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                game.movestone(data.key, data.userid);

                io.sockets.in(game.name).emit('movePlayers', sendPlayerData(game.stones));
            }
    	});

        socket.on('createlobby', function(data) {
            if (!roomlist.has(data.lobbyname)) {
                socket.join(data.lobbyname, function() {
                    roomlist.set(data.lobbyname, new lobby.room());
                    game = roomlist.get(data.lobbyname);
                    game.createRoom(data.lobbyname, generateRoomID(), data.username,
                        data.width, data.height);
                    game.setSpeed(data.speed);

                    // Tell socket game info
                    socket.emit('setgameinfo', { lobbyname: game.name, id: game.getLastUser(),
                        width: game.field_width, height: game.field_height, username: data.username });
                });
            } else {
                socket.emit('dataerror', { info: 'Lobby ' + data.lobbyname + ' already exists!'})
            }
        });

        socket.on('leave', function(data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                if (game.players.length >= data.userid && game.players[data.userid].name === data.username) {
                    game.removeUser(data.userid);
                    if (game.gameStarted && !game.gameover)
                        io.sockets.in(game.name).emit('movePlayers', sendPlayerData(game.players));
                }
            }
        });

        // When a user joins a game
        socket.on('join', function(data) {
            if (roomlist.has(data.lobbyname) && !userInGame(data.lobbyname, data.username)) {
                socket.join(data.lobbyname, function() {
                    game = roomlist.get(data.lobbyname);
                    game.addUser(data.username);

                    // Tell the player its game info
                    socket.emit('setgameinfo', { lobbyname: game.name, id: game.getLastUser(),
                        width: game.field_width, height: game.field_height, username: data.username });
                    // If the game already started tell the player about it
                    if (game.gameStarted && !game.gameover)
                        socket.emit('begin', sendFieldData(game.field));
                });
            } else if (roomlist.has(data.lobbyname) && userInGame(data.lobbyname, data.username)) {
                game = roomlist.get(data.lobbyname);
                if (game.gameStarted) {
                    socket.emit('showGame');
                } else {
                    game.startGame();
                    game.setGameOverCallback(endGame);

                    // Start game loops for this game
                    setLoops(game);
                    socket.emit('begin', sendFieldData(game.field));
                }
            }
        });

        socket.on('endGame', function(data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                if (game.isAdmin(data.userid))
                    endGame(game.name, game.players, game.score);
            }
        });
    });
}

function userInGame(lobby, name) {
    return roomlist.get(lobby).players.some(function(element, index, array) {
        return element.name === name;
    });
}

function endGame(lobby, players, score) {
    if (loops.has(lobby)) {
        console.log("Gameover in lobby: " + lobby);
        clearInterval(loops.get(lobby).short);
        clearInterval(loops.get(lobby).long);
        io.sockets.in(lobby).emit('gameover', score);
        for (i = 0; i < players.length; i++) {
            scores.set(players[i].name, score);
        }
        // TODO display dialog to ask if game should be restarted
        if (lobby === def1 || lobby === def2)
            game.reset();
        else
            roomlist.delete(lobby);
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
                io.sockets.in(game.name).emit('moveScore', sendScoreData(game.score));
            }
        }, 100);

        // Store IDs so we can stop intervals once the game is over
        loops.set(game.name, { long: l, short: s });
    }
}

function sendFieldData(field) {
    var data = OptimizeField(field);
    if (useBinary)
        return sendBinaryField(data);
    else
        return { field: data };
}

function sendPlayerData(stones) {
    if (useBinary) {
        return sendBinaryPlayers(stones);
    } else {
        var json = {};
        stones.forEach(function(item, index, array) {
            json[(index+1).toString()] = item.pos;
        });
        return json;
    }
}

function sendScoreData(points) {
    if (useBinary)
        return sendBinaryScore(points);
    else
        return { score: points };
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
    var bufArr = new ArrayBuffer(2);
    var bufView = new Uint16Array(bufArr);
    bufView[0] = score;
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

function createDefaultGame(name, w, h, s) {
    // Just for Testing
    roomlist.set(name, new lobby.room());
    game = roomlist.get(name);
    game.createRoom(name, generateRoomID(), 'Admin', w, h);
    game.setSpeed(s);
    game.removeUser(game.getLastUser());
}

function joinDefaultGame(socket) {
    if (roomlist.has(def1)) {
        // Join first game
        socket.join(def1, function() {
            game = roomlist.get(def1);
            game.addUser('defaultUser');
            socket.emit('setgameinfo', { lobbyname: game.name, id: game.getLastUser(),
                width: game.field_width, height: game.field_height, username: 'defaultUser' });
            once = false;
        });
    } else if (roomlist.has(def2)) {
        // Join second game
        socket.join(def2, function() {
            game = roomlist.get(def2);
            game.addUser('defaultUser');
            socket.emit('setgameinfo', { lobbyname: game.name, id: game.getLastUser(),
                width: game.field_width, height: game.field_height, username: 'defaultUser' });
            once = false;
        });
    }
}

function noDefaultPlayer(element, index, array) {
    return element.name !== 'defaultUser';
}

console.log('Server is running on port: ' + port);

// Set all event handlers
setEventHandlers();

createDefaultGame(def1, 60, 30, 500);
createDefaultGame(def2, 30, 16, 750);
