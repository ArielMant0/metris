const express = require('express')
,   app = express()
,   server = require('http').createServer(app)
,   io = require('socket.io')(server, { 'transports': ['websocket', 'polling'] })
,   conf = require('./config.json')
,   GameManager = require('./game-manager')
,   sql = require('sqlite3')
,   util = require("./util");

const gameManager = new GameManager();

const DATABASE = conf.db;

// Webserver
// Use Port X
const port = process.env.PORT || conf.port;
server.listen(port);

// Template directory and engine
app.set('views', './views');
app.set('view engine', 'pug');

// Routing
// Deliver static files
app.use(express.static(__dirname + '/public'));

// Main Site
app.get('/', function (_req, res) {
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
    res.render('highscores', { scores: req.scores });
});

// Game
app.get(/\/game\/[a-zA-z0-9]/, function (req, res) {
    // Render game.pug
    const pathsplit = req.path.split('/');
    if (pathsplit.length > 2 && gameManager.hasRoom(pathsplit[2])) {
        res.render('game');
    }
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
const db = new sql.Database(DATABASE);

// Create a list of all lobbies
function getLobbies() {
    const list = [];
    gameManager.forRoom(room => {
        list.push({
            name: room.name,
            id: room.id,
            currentPlayers: room.players.length,
            maxPlayers: room.getMaxPlayerCount()
        });
    });
    return list;
}

function createScoreTable() {
    db.serialize(function() {
        db.run('CREATE TABLE IF NOT EXISTS highscores' +
            '(name TEXT PRIMARY KEY NOT NULL,' +
            ' score INT NOT NULL,' +
            ' game TEXT NOT NULL,' +
            ' date DATETIME DEFAULT CURRENT_TIMESTAMP)', [], function(error, rows) {
        if (error)
            console.log('Creating highscores table failed: ' + error);
        });
    })
}

function updateScoreTable(name, score, lobbyname) {
    let currentScore = score;

    db.serialize(function() {
        db.get('SELECT * FROM highscores WHERE name = ? AND score > ?', [name, score], function(error, row) {
            if (!error && row)
                currentScore = row.score;

            db.run('INSERT OR REPLACE INTO highscores (name, score, game) VALUES ($n, $s, $g)',
                    { $n: name, $s: currentScore, $g: lobbyname }, function(error) {
                if (error)
                    console.log('Setting new user score failed: ' + "[" + name + ", " + score + "]\n" + error);
            });
        });
    });
}

function sortLobbies(req, _res, next) {
    const sort = Number.parseInt(req.query.sort);
    const order = Number.parseInt(req.query.order) === 0 ? -1 : 1;
    req.lobbies = getLobbies();
    req.lobbies.sort(function(a, b) {
        switch(sort) {
            case 1: {
                if (order === -1)
                    return util.sortBy(a.name.toLowerCase(), b.name.toLowerCase());
                else
                    return util.sortBy(b.name.toLowerCase(), a.name.toLowerCase());
                } break;
            case 2: return util.sortBy(a.currentPlayers, b.currentPlayers * order); break;
            case 3: return util.sortBy(a.maxPlayers * order, b.maxPlayers); break;
            default: return util.sortBy(a.id, b.id * order);
        }
    });
    next();
}

function sortScores(req, _res, next) {
    let by;
    switch (parseInt(req.query.sort)) {
        case 1: by = 'LOWER(name)'; break;
        case 2: by = 'LOWER(game)'; break;
        case 3: by = 'DATETIME(date)'; break;
        default: by = 'score'; break;
    }
    let ord = parseInt(req.query.sort)
    if (ord === 1 || ord === 2)
        ord = Math.abs(parseInt(req.query.order)-1);
    else
        ord = Math.abs(parseInt(req.query.order));

    const ascd = ord === 1 ? ' ASC' : ' DESC';

    db.all('SELECT * FROM highscores ORDER BY ' + by + ascd, [], function(error, rows) {
        if (!error && rows.length > 0) {
            req.scores = rows.slice(0);
        } else if (error) {
            console.log('Getting highscores failed: ' + error);
        }
        next();
    });
}

// Event handlers
function setEventHandlers() {

    io.sockets.on('connection', function (socket) {

        socket.on('disconnect', function(username) {
            const game = gameManager.deleteUser(username);
            if (game !== null) {
                io.sockets.in(game.id).emit('sethashes', game.getAllHashes());
            }
        });

        // when the game tab needs current game information
        socket.on('updategame', function(lobbyid, userid) {
            const game = gameManager.getRoom(lobbyid, true);
            if (game !== null) {
                socket.emit('moveField', util.sendFieldData(game.field));
                socket.emit(
                    'moveScore',
                    util.sendScoreData(game.score(userid)),
                    util.sendLevelData(game.level)
                );
            }
        });

        // when a user pressed a key, move his stone
    	socket.on('playermove', function (username, key) {
            const game = gameManager.applyMove(username, key);
            if (game !== null) {
                io.sockets.in(game.id).emit('movePlayers', util.sendPlayerData(game.stones));
            }
    	});

        socket.on('createlobbyfixed', function(lobbyname, username, w, h, max, bg) {
            const s = {
                width: w,
                height: h,
                maxPlayers: max,
                background: bg,
                fixed: true
            };

            if (gameManager.createRoom(lobbyname, username, s, endGame, gameLoop)) {
                const game = gameManager.getRoom(lobbyname);
                socket.join(roomID, function() {
                    // tell socket game info
                    socket.emit('setgameinfo', gameManager.info(game, username));
                });
            } else {
                setLastError(0, lobbyname);
                socket.emit('dataerror');
            }
        });

        socket.on('createlobby', function(lobbyname, username, bg) {
            const s = {
                background: bg,
                fixed: false
            };

            if (gameManager.createRoom(lobbyname, username, s, endGame, gameLoop)) {
                const game = gameManager.getRoom(lobbyname);
                socket.join(roomID, function() {
                    // tell socket game info
                    socket.emit('setgameinfo', gameManager.info(game, username));
                });
            } else {
                setLastError(0, lobbyname);
                socket.emit('dataerror');
            }
        });

        socket.on('login', function(username) {
            if (gameManager.setUser(username)) {
                console.info(`Player "${username}" logged in`);
                socket.emit('loggedin', username);
            } else {
                setLastError(1, username);
                socket.emit('dataerror');
            }
        });

        socket.on('logout', function(username) {
            if (gameManager.hasUser(username)) {
                const game = gameManager.deleteUser(username);
                io.sockets.in(game.id).emit('sethashes', game.getAllHashes());
                socket.emit('loggedout');
                console.info(`Player "${username}" logged out`);
            }
        });

        socket.on('leave', function(username) {
            const game = gameManager.leaveRoom(username);
            if (game !== null) {
                const status = game.status();
                if (status === 2) {
                    io.sockets.in(game.id).emit('resizefield',
                        game.fieldWidth,
                        game.fieldHeight,
                        util.sendFieldData(game.field),
                        util.sendPlayerData(game.stones)
                    );
                }

                io.sockets.in(game.id).emit('sethashes', game.getAllHashes());
                socket.emit('leftgame');
            }
        });

        // When a user joins a game
        socket.on('join', function(lobbyid, username) {
            const game = gameManager.joinRoom(username, lobbyid);
            if (game !== null) {
                socket.join(lobbyid, function() {
                    const status = game.status();
                    if (status > 0) {
                        const player = game.getLastUser();
                        // tell the player its game info
                        socket.emit('setgameinfo', gameManager.info(game, username));

                        socket.broadcast.to(game.id).emit('userhash', player.id, player.hash);
                        socket.emit('sethashes', game.getAllHashes());

                        if (status == 2) {
                            socket.broadcast.to(game.id).emit('resizefield',
                                game.fieldWidth,
                                game.fieldHeight,
                                util.sendFieldData(game.field),
                                util.sendPlayerData(game.stones)
                            );
                        }
                    }
                });
            }
        });

        socket.on('togglepause', function(lobbyid, username) {
            if (gameManager.pause(lobbyid, username)) {
                io.sockets.in(game.id).emit(game.paused ? 'pause' : 'unpause');
            }
        });

        socket.on('startgame', function(username) {
            const game = gameManager.startGame(username);
            if (game !== null) {
                socket.emit('begin', util.sendFieldData(game.field));
            }
        });

        socket.on('endgame', function(lobbyid, username) {
            if (gameManager.endGame(lobbyid, username)) {
                endGame(game.id, game.name, game.players, game.score());
            }
        });

        socket.on('spectate', function(lobbyid) {
            const game = gameManager.getRoom(lobbyid);
            if (game !== null) {
                socket.join(lobbyid, function() {
                    // Tell the player its game info
                    socket.emit(
                        'setspecinfo',
                        game.name,
                        game.id,
                        game.fieldWidth,
                        game.fieldHeight,
                        game.getAllHashes()
                    );
                    // send field data
                    socket.emit('begin', sendFieldData(game.field));
                });
            }
        });

        socket.on('endspectate', function(lobbyid) {
            if (gameManager.hasRoom(lobbyid)) {
                socket.leave(lobbyid, function(err) {
                    if (err) console.error('Spectator could not leave his current game!');
                });
            }
        });

        socket.on('drop', function(lobbyid, userid) {
            const game = gameManager.getRoom(lobbyid);
            if (game !== null && game.hasUser(userid)) {
                game.instaDrop(userid);

                io.sockets.in(game.id).emit('movePlayers', util.sendPlayerData(game.stones));
                io.sockets.in(game.id).emit('moveField', util.sendFieldData(game.field));
                io.sockets.in(game.id).emit(
                    'moveScore',
                    util.sendScoreData(game.score(userid)),
                    util.sendLevelData(game.level)
                );
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

function endGame(lobbyid, lobby, players, winner) {
    io.sockets.in(lobbyid).emit('gameover', winner);

    // update scores if greater than 0
    players.forEach(p => {
        if (p.score > 0) updateScoreTable(p.name, p.score, lobby.name);
    })
}

function gameLoop(game) {
    io.sockets.in(game.id).emit('movePlayers', util.sendPlayerData(game.stones));
};

console.info('Server is running on port: ' + port);

// init database
createScoreTable();

// set all event handlers
setEventHandlers();

// default lobbies
const DEFAULT_LOBBIES = [
    {
        name: "default1",
        settings: {
            fixed: true,
            width: 60,
            height: 30,
            maxPlayers: 10,
            background: 0
        }
    },
    {
        name: "default2",
        settings: {
            fixed: true,
            width: 30,
            height: 20,
            maxPlayers: 5,
            background: 0
        }
    }
];

DEFAULT_LOBBIES.forEach(lobby => {
    gameManager.createEmptyRoom(lobby.name, lobby.settings, endGame, gameLoop);
});
