class Connection {

    constructor() {
        this.socket = io();
        this.audio = new Audio('assets/MUSIC.mp3');

        audio.onended = function () {
            audio.currentTime = 7;
            audio.play();
        };
    }

    addSocketEvents() {
        this.socket.on('music', function () {
            new Audio('assets/MUSIC2.mp3').play();
        });

        this.socket.on('moveField', function (field) {
            gameInfo.field = field;
        });

        this.socket.on('movePlayers', function (stones) {
            players = stones;
            if (!gameInfo.spectator) {
                updateDropStone();
            }
        });

        this.socket.on('moveScore', function (score, lvl) {
            gameInfo.updateScore(score);
            if (lvl != level) {
                resetBuffer = true;
                updateLevel(lvl);
            }
        });

        this.socket.on('begin', function (field) {
            gameInfo.field = field;
            level = 1;
            gameInfo.setIngame();
            gameInfo.updateScore(0);
            updateLevel(level);
            console.debug("game started");
            tabManager.switchTabData("game", gameInfo.gameid);
        });

        this.socket.on('resizefield', function(width, height, field, stones) {
            gameInfo.field_width = width;
            gameInfo.field_height = height;
            gameInfo.field = field;
            players = stones;
        });

        this.socket.on('leftgame', function() {
            gameInfo.reset();
        });

        this.socket.on('loggedout', function() {
            gameInfo.reset();
            gameInfo.logout();
        });

        this.socket.on('loggedin', function(name) {
            console.debug("logged in as ", name);
            gameInfo.username = name;
            gameInfo.mode = "none";
            $('#login-button').text("logout");
        });

        this.socket.on('pause', function() {
            gameInfo.paused = true;
            showPauseText();
        });

        this.socket.on('unpause', function() {
            gameInfo.paused = false;
            hidePauseText();
        });

        this.socket.on('gameover', function(winner) {
            if (winner.name) {
                $('#gameover-score').text(`${winner.name} won with a score of ${winner.score}`);
            } else {
                $('#gameover-score').text(`Final Score: ${winner.score}`);
            }
            $('#game-over').show();
            reset(false);
        });

        this.socket.on('dataerror', function() {
            sendAjax('get', '/error', '#content');
        });

        this.socket.on('setspecinfo', function(lobbyname, lobbyid, width, height, hashes) {
            gameInfo.lobby = lobbyname;
            gameInfo.gameid = lobbyid;
            gameInfo.field_width = width;
            gameInfo.field_height = height;
            hashes.forEach((hash,i) => computeColor(i, hash));
            spectator = true;
        });

        this.socket.on('setgameinfo', function(data) {
            gameInfo.lobby = data.lobbyname;
            gameInfo.userid = data.id;
            gameInfo.field_width = data.width;
            gameInfo.field_height = data.height;
            gameInfo.username = data.username;
            gameInfo.gameid = data.gameid;
            gameInfo.background = data.background;
            gameInfo.paused = data.paused;
            computeColor(gameInfo.userid, data.hash);
            colorUsername();
            spectator = false;
            gameInfo.mode = "joined";
            console.log("joined lobby ", data.lobbyname);
        });

        this.socket.on('userhash', function(id, hash) {
            computeColor(id, hash);
        });

        this.socket.on('sethashes', function(hashes) {
            hashes.forEach((hash,i) => computeColor(i, hash));
        });
    }
}
