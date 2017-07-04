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
        list.push({name: key, id: value.id});
    })
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
        db.all('SELECT * FROM highscores', [], function(error, rows) {
            if (!error && rows.length > 0)
                sortScores(rows);
            else if (error)
                console.log('Getting highscores failed: ' + error);
        });
    });
}

function sortScores(list) {
    list.sort(function(a, b) {
        if (a.score > b.score)
            return -1;
        else if (a.score < b.score)
            return 1;

        return 0;
    });
    scores = list.slice(0);
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
                setLastError(0, data.lobbyname);
                socket.emit('dataerror');
            }
        });

        socket.on('login', function(data) {
            if (!users.has(data.username)) {
                users.set(data.username, '');
                socket.emit('setuser', { name: data.username });
                console.log("Player \'" + data.username + "\' logged in");
            } else {
                setLastError(1, data.username);
                socket.emit('dataerror');
            }
        });

        socket.on('logout', function(data) {
            if (users.has(data.username)) {
                users.delete(data.username);
                socket.emit('setuser', { name: '' });
                console.log("Player \'" + data.username + "\' logged out");
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

function endGame(lobby, players, score) {
    if (loops.has(lobby)) {
        console.log("Gameover in lobby: " + lobby);
        clearInterval(loops.get(lobby).short);
        clearInterval(loops.get(lobby).long);
        io.sockets.in(lobby).emit('gameover', score);

        // Update scores if greater than 0
        if (score > 0) {
            for (i = 0; i < players.length; i++) {
                updateScoreTable(players[i].name, score, lobby);
            }
            updateHighscores();
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

// Init database
createScoreTable();
updateHighscores();

// Set all event handlers
setEventHandlers();

createDefaultGame(def1, 60, 30, 500);
createDefaultGame(def2, 30, 16, 750);
