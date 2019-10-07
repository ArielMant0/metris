

const gameInfo = (function() {

    const STATUS = Object.freeze({
        none: 0,
        loggedIn: 1,
        joined: 2,
        ingame: 3
    });

    return {

        status: STATUS.none,
        userid: 0,
        gameid: 0,
        lobby: null,
        field_height: 16,
        field_width: 30,
        field: [],
        username: null,
        score: 0,
        paused: false,
        stone_drop: [-1, -1, -1, -1],
        background: 0,
        spectator: false,


        login: function() {
            this.username = $('#login-name').val();
            $('#login-name').val('');
            $('#player-name').text(name);
            $('#login-modal').hide();
            $('#login-button').text("logout");
            this.status = STATUS.loggedIn;
        },

        logout: function() {
            this.username = null;
            $('#login-button').text("login");
            this.status = STATUS.none;
        },

        loggedIn : function() {
            return this.status === STATUS.loggedIn;
        },

        joined: function() {
            return this.status === STATUS.joined;
        },

        ingame: function() {
            return this.status === STATUS.ingame;
        },

        setIngame: function() {
            this.status = STATUS.ingame;
        },

        updateScore: function(value) {
            this.score = value;
            $('#scoretext').text('score: ' + this.score)
        },

        reset: function() {
            $('#player-name').css('color', 'white');
            this.lobby = '';
            this.userid = -1;
            this.field_width = 0;
            this.field_height = 0;
            this.score = 0;
            this.paused = false;
            this.background = 0;
            this.gameid = '';
            this.stone_drop = [-1, -1, -1, -1];
            this.field = [];
            this.spectator = false;
            this.status = STATUS.loggedIn;
            gameRunning = false;
            level = 1;
            players = [];
        }

    };

}());
