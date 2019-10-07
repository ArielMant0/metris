const NAME_REGEX = /[^A-Za-z0-9_\-äÄüÜöÖ\s]/;

class Tab {

    constructor(id, route) {
        this.id = id;
        this.route = route;
        this.active = false;
        // create new html element for this tab
        $("body").append(`<div class="tab" data-id="${this.id}"></div>`);
        this.hide();
        // render content
        this.pingServer();
    }

    async pingServer(params='') {
        $.get(this.route+params, function(data) {
            this.render(data);
            this.registerEventListener();
        });
    }

    get self() {
        return $(`.tab[data-id=${this.id}]`);
    }

    render(data) {
        this.self.html(data);
    }

    show() {
        this.self.show();
        document.title = `Metris - ${this.id}`;
    }

    hide() {
        this.self.hide();
    }

    setActive(val) {
        this.active = val;
        this.active ? this.show() : this.hide();
    }

    load(data="", reload=false) {
        if (data || reload) {
            this.pingServer(this.route+data).then(() => {
                this.load();
            });
        } else {
            this.setActive(true);
        }
    }

    unload() {
        this.setActive(false);
    }

    registerEventListener() {}
}

class LobbyTab extends Tab {

    constructor() {
        super("lobbies", "/lobbies");
        this.sort = 0;
        this.order = 1;
    }

    registerEventListener() {
        // submit login/logout
        $('#submit-login').click(function() {
            gameInfo.login();
        });
        $('#login-button').click(function() {
            if (gameInfo.loggedIn()) {
                this.joinForm();
            } else {
                gameInfo.logout();
            }
        });
        // eval login name
        $('#login-name').on('input', function() {
            let str = $(this).val();
            $(this).val(str.replace(NAME_REGEX, ''));
            alert('Your username may only contain letters, numbers, underscores and hyphens!');
        });
        // close login dialog on clicking the 'X' button
        $('#close-login-modal').on('click', function() {
            $('#login-modal').hide();
            $('#login-msg').hide();
        });

        // spectator
        $('.watch-button').each(function() {
            $(this).on('click', function () {
                Connection.spectate($(this).data('id'));
            });
        });
        // joining a game
        $('.lobby-button').each(function() {
            if (!gameInfo.loggedIn()) {
                this.joinForm();
            } else {
                Connection.join($(this).data('id'));
            }
        });

        $('#lobby-sort-button').on('click', function() {
            this.sort = Number.parseInt($('#lobbies-sort').val());
            this.order = Number.parseInt($('#order-sort').val());
            this.pingServer(`?sort=${this.sort}&order=${this.order}`);
        });
        // Show the currently selected sorting parameters
        $("#lobbies-sort > option[value="+this.sort+"]").prop('selected', true);
        $("#order-sort > option[value="+this.order+"]").prop('selected', true);

        // create a lobby
        $('#create-lobby').on('click', function(event) {
            if (isLoggedIn()) {
                this.lobbyForm();
            } else {
                this.joinForm();
            }
        });

        $('#submit-lobby').on('click', function() {
            if ($('#fixed-size').prop('checked') && $('#lobby-name').val().length > 0) {
                Connecttion.createLobbyFixed(
                    $('#lobby-name').val(),
                    Number.parseInt($('#lobby-background').val()),
                    Number.parseInt($('#field-width').val()),
                    Number.parseInt($('#field-height').val()),
                    Number.parseInt($('#max-players').val())
                );
                this.resetCreateLobby();
            } else if ($('#lobby-name').val().length > 0) {
                Connecttion.createLobby(
                    $('#lobby-name').val(),
                    Number.parseInt($('#lobby-background').val())
                );
                this.resetCreateLobby();
            } else {
                alert('You must at least enter a lobby name');
            }
        });

        $('#max-players').on('input', function() {
            $('#max-players-desc').text($('#max-players').val());
        });

        $('#field-width').on('input', function() {
            $('#field-width-desc').text($('#field-width').val());
        });

        $('#field-height').on('input', function() {
            $('#field-height-desc').text($('#field-height').val());
        });

        $('#close-create-modal').on('click', function() {
            $('#create-modal').hide();
        });

        $('#lobby-name').on('input', function() {
            let str = $(this).val();
            if (str.match(NAME_REGEX) !== null) {
                $(this).val(str.replace(NAME_REGEX, ''));
                alert('Your username may only contain letters, numbers, underscores and hyphens!');
            }
        });
    }

    joinForm() {
        $('#login-modal').show();
	    $('#login-name').focus();
    }

    lobbyForm() {
        $('#create-modal').show();
	    $('#lobby-name').focus();
    }

    resetCreateLobby() {
        $('#lobby-name').val('');
        $('#field-width').val(10);
        $('#field-height').val(10);
        $('#max-players').val(1);
        $('#create-modal').hide();
    }
}

class HighscoreTab {

    constructor() {
        super("highscores", "/scores");
        this.sort = 0;
        this.order = 1;
    }

    registerEventListener() {
        // Send score request for highscore list
        $('#score-sort-button').on('click', function() {
            this.sort = Number.parseInt($('#scores-sort').val());
            this.order = Number.parseInt($('#order-sort').val());
            this.pingServer(`?sort=${this.sort}&order=${this.order}`);
        });

        // Show the currently selected sorting parameters
        $("#scores-sort > option[value="+this.sort+"]").prop('selected', true);
        $("#order-sort > option[value="+this.order+"]").prop('selected', true);
    }
}
