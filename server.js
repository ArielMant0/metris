var express = require('express')
,   app = express()
,   server = require('http').createServer(app)
,   io = require('socket.io')(server) //, {'transports': ['websocket']})
,   conf = require('./config.json')
,   lobby = require('./room.js')

var once = true;
var last = 0;

// Webserver
// Use Port X
var port = process.env.PORT || conf.port
app.listen(port, function() {
    console.log('Der Server laeuft nun auf Port' + port);
});

// Template directory
app.set('views', './views');
app.set('view engine', 'pug');

// Routing
// Deliver static files
app.use(express.static(__dirname + '/public'));

// Main Site
app.get('/', function (req, res) {
    // Render game.html | TODO replace true
    res.render('index', { inGame: true });
});

// Lobbies
app.get('/lobbies', function (req, res) {
    // Render game.html | TODO replace true
    res.render('lobbies', { inGame: true, lobbies: getLobbies() });
});

// Highscores
app.get('/highscores', function (req, res) {
    // Render game.html | TODO replace true
    res.render('highscores', { inGame: true, scores: getHighscores() });
});

// Game
app.get(/\/game\/[a-zA-z0-9]/, function (req, res) {
    // Render game.html | TODO replace true
    res.render('game', { inGame: true });
});

// Map of all currently active lobbies
roomlist = new Map();

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
    return [{name: "Peter", score: 9231}, {name: "Hannah", score: 9106}, {name: "Klaus", score: 8829}];
}

// Generate new room id
function generateRoomID() {
    return ++last;
}

// Event handlers
function setEventHandlers() {

    io.sockets.on('connection', function (socket) {

    	// DEBUG
        if (once)
            joinDefaultGame(socket);

        // Start the game
        socket.on('startgame', function (data) {
            if (roomlist.has(data.lobbyname)) {
                // Initializes the field and starts dropping stones
                game = roomlist.get(data.lobbyname);
                game.startGame(data.width, data.height);

                // Start game loops for this game
                setLoops(game);

                // Tell all sockets in the game what the field looks like
                io.sockets.in(game.name).emit('begin', { field: game.field});
            }
        });

    	// Wenn ein Benutzer einen Text senden
    	socket.on('chat', function (data) {
    		// so wird dieser Text an alle anderen Benutzer gesendet
    		io.sockets.emit('chat', { zeit: new Date(), name: data.name || 'Anonym', text: data.text });
    	});

        // When the game tab needs current game information
        socket.on('udpdategame', function(data) {
            if (roomlist.has(data.lobbyname))
                socket.emit('move', { field: roomlist.get(data.lobbyname).field });
        });

        // When a user pressed a key, move his stone
    	socket.on('playermove', function (data) {
            if (roomlist.has(data.lobbyname)) {
                game = roomlist.get(data.lobbyname);
                game.movestone(data.key, data.userid);
                io.sockets.in(game.name).emit('move', { field: game.field });
            }
    	});

        // When a user joins a game
        socket.on('join', function(data) {
            socket.join(data.lobbyname, function() {
                if (roomlist.has(data.lobbyname)) {
                    roomlist.get(data.lobbyname).addUser(data.username);
                } else {
                    roomlist.set(data.lobbyname, new lobby.room());
                    roomlist.get(data.lobbyname).createRoom(data.lobbyname, data.username);
                }
                game = roomlist.get(data.lobbyname);

                socket.emit('setgameinfo', {lobbyname: game.name, id: game.getLastUser(),
                    width: game.field_width, height: game.field_height});
                console.log("Server Join -> name: " + data.lobbyname + ", id: " + roomlist.get(data.lobbyname).getLastUser());
            });
        });
    });
}

// Start game loops
function setLoops(game) {

    setInterval(function() {
        if (!game.gameover && game.gameStarted)
            game.dropStones();
        io.sockets.in(game.name).emit('move', { field: game.field });
    }, 1000);

    setInterval(function () {
        if (!game.gameover && game.gameStarted)
            game.gamelogic();
        io.sockets.in(game.name).emit('move', { field: game.field });
    }, 100);
}

function createDefaultGame() {
    // Just for Testing
    roomlist.set('default', new lobby.room());
    game = roomlist.get('default');
    game.createRoom('default', generateRoomID(), 'Admin');
    game.removeUser(game.getLastUser());
}

function joinDefaultGame(socket) {
    if (roomlist.has('default')) {
        // Join 'default' game
        socket.join('default', function() {
            gane = roomlist.get('default');
            game.addUser('defaultUser');
            socket.emit('setgameinfo', { lobbyname: 'default', id: game.getLastUser(), width: 30, height: 16});
        });
        once = false;
    }
}

function noDefaultPlayer(element, index, array) {
    return element.name !== 'defaultUser';
}

// Set all event handlers
setEventHandlers();

createDefaultGame();
