var express = require('express')
,   app = express()
,   server = require('http').createServer(app)
,   io = require('socket.io')(server, { 'transports': ['websocket', 'polling'] })
,   conf = require('./config.json')
,   lobby = require('./room.js')
,   authentication = require('express-authentication');

var once = true;
var last = 0;

// Webserver
// Use Port X
var port = process.env.PORT || conf.port;
server.listen(port);

// Template directory
app.set('views', './views');
app.set('view engine', 'pug');

// Routing
// Deliver static files
app.use(express.static(__dirname + '/public'));

app.use(function myauth(req, res, next) {
    req.challenge = req.get('Authorization');
    req.authenticated = req.authentication === 'secret';

    // provide the result of the authentication; generally some kind of user
    // object on success and some kind of error as to why authentication failed
    // otherwise.
    if (req.authenticated) {
        req.authentication = { username: getUserName() };
    } else {
        req.authentication = { error: 'INVALID_API_KEY' };
    }
    next();
});

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
scores = [];

addDefaultScores();

function addDefaultScores() {
    scores.push({ username: 'Peter', score: 9231 });
    scores.push({ username: 'Klaus', score: 8829 });
    scores.push({ username: 'Hannah', score: 9106 });
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
    return scores.sort(function(a, b) {
        if (a.score > b.score)
            return -1;
        else if (a.score < b.score)
            return 1;
        else
            return 0;
    });
}

// Generate new room id
function generateRoomID() {
    return ++last;
}

// Event handlers
function setEventHandlers() {

    io.sockets.on('connection', function (socket) {

    	// DEBUG
        // if (once && false)
        //     joinDefaultGame(socket);

        // Start the game
        socket.on('startgame', function (data) {
            if (roomlist.has(data.lobbyname)) {//&& !roomlist.get(data.lobbyname).gameStarted) {
                // Initializes the field and starts dropping stones
                game = roomlist.get(data.lobbyname);
                game.startGame();
                game.setGameOverCallback(endGame);

                // Start game loops for this game
                setLoops(game);

                // Tell all sockets in the game what the field looks like
                io.sockets.in(game.name).emit('begin', sendBinaryField(game.field));
            }
        });

        // When the game tab needs current game information
        socket.on('udpdategame', function(data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                socket.emit('moveField', sendBinaryField(game.field));
                socket.emit('moveScore', sendBinaryScore(game.score));
            }
        });

        // When a user pressed a key, move his stone
    	socket.on('playermove', function (data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                game.movestone(data.key, data.userid);

                io.sockets.in(game.name).emit('moveField', sendBinaryField(game.field));
                io.sockets.in(game.name).emit('moveScore', sendBinaryScore(game.score));
            }
    	});

        socket.on('createlobby', function(data) {
            if (!roomlist.has(data.lobbyname)) {
                socket.join(data.lobbyname, function() {
                    roomlist.set(data.lobbyname, new lobby.room());
                    game = roomlist.get(data.lobbyname);
                    game.createRoom(data.lobbyname, generateRoomID(), data.username,
                        data.width, data.height);

                    // Tell socket game info
                    socket.emit('setgameinfo', { lobbyname: game.name, id: game.getLastUser(),
                        width: game.field_width, height: game.field_height, username: data.username });
                });
            }
        });

        // When a user joins a game
        socket.on('join', function(data) {
            if (roomlist.has(data.lobbyname) && userNotPresent(data.lobbyname, data.username)) {
                socket.join(data.lobbyname, function() {
                    game = roomlist.get(data.lobbyname);
                    game.addUser(data.username);

                    // Tell the player its game info
                    socket.emit('setgameinfo', { lobbyname: game.name, id: game.getLastUser(),
                        width: game.field_width, height: game.field_height, username: data.username });
                    // If the game already started tell the player about it
                    if (game.gameStarted && !game.gameover)
                        socket.emit('begin', sendBinaryField(game.field));
                });
            }
        });
    });
}

function userNotPresent(lobby, name) {
    return roomlist.get(lobby).players.every(function(element, index, array) {
        return element.name !== name;
    });
}

function endGame(lobby, score) {
    if (loops.has(lobby)) {
        console.log("Gameover in lobby: " + lobby);
        clearInterval(loops.get(lobby).short);
        clearInterval(loops.get(lobby).long);
        //clearInterval(loops.get(lobby).other);
        io.socket.in(lobby).emit('gameover');
    }
}

// Start game loops
function setLoops(game) {

    if (!loops.has(game.name)) {
        var l = setInterval(function() {
            if (!game.gameover && game.gameStarted) {
                game.dropStones();
                io.sockets.in(game.name).emit('moveField', sendBinaryField(game.field));
                io.sockets.in(game.name).emit('moveScore', sendBinaryScore(game.score));
            }
        }, game.speed);

        var s = setInterval(function () {
            if (!game.gameover && game.gameStarted) {
                game.gamelogic();
                io.sockets.in(game.name).emit('moveField', sendBinaryField(game.field));
                io.sockets.in(game.name).emit('moveScore', sendBinaryScore(game.score));
            }
        }, 100);

        // var o = setInterval(function () {
        //     if (!game.gameover && game.gameStarted)
        //         io.sockets.in(game.name).emit('move', { field: fieldAsBinary(game.field),
        //             score: scoreAsBinary(game.score) });
        // }, 10);

        // Store IDs so we can stop intervals once the game is over
        loops.set(game.name, { long: l, short: s }); // other: o
    }
}

function sendBinaryField(field) {
    // Create Array Buffer
    var bufArr = new ArrayBuffer(field.length);
    var bufView = new Uint8Array(bufArr);
    for(i = 0; i < field.length; i++) {
        bufView[i] = field[i];
    }
    return bufArr;
}

function sendBinaryScore(score) {
    var bufArr = new ArrayBuffer(2);
    var bufView = new Uint16Array(bufArr);
    bufView[0] = score;
    return bufArr;
}

function createDefaultGame() {
    // Just for Testing
    roomlist.set('default', new lobby.room());
    game = roomlist.get('default');
    game.createRoom('default', generateRoomID(), 'Admin', 60, 30);
    game.setSpeed(500);
    game.removeUser(game.getLastUser());
}

function joinDefaultGame(socket) {
    if (roomlist.has('default')) {
        // Join 'default' game
        socket.join('default', function() {
            gane = roomlist.get('default');
            game.addUser('defaultUser');
            socket.emit('setgameinfo', { lobbyname: 'default', id: game.getLastUser(),
                width: 30, height: 16, username: 'defaultUser' });
        });
        once = false;
    }
}

function noDefaultPlayer(element, index, array) {
    return element.name !== 'defaultUser';
}

console.log('Der Server läuft nun auf Port ' + port);

// Set all event handlers
setEventHandlers();

createDefaultGame();
