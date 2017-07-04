$(document).ready(function () {
	setEventListeners();
	sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
});

function sendAjax(method, url, elem) {
	var req = new XMLHttpRequest();
	req.addEventListener('load', function() {
		document.querySelector(elem).innerHTML = this.responseText;
	});

	req.open(method, url);
	if (method === "GET" || method === "get")
		req.send();
	else
		req.send(body);
}

function sendAjaxListeners(method, url, elem, func) {
	var req = new XMLHttpRequest();
	req.addEventListener('load', function() {
		document.querySelector(elem).innerHTML = this.responseText;
		func();
	});

	req.open(method, url);
	if (method === "get" || method === "GET")
		req.send();
	else
		req.send(body);
}

function initLobbyListeners() {
	$('#content').innerHeight($('body').innerHeight() - $('footer').outerHeight() - $('#topnav').outerHeight());

	if (isLoggedIn()) {
		$('.lobby-button').each(function() {
			$(this).on('click', function () {
				var lobbyname = $(this).attr('id').split('-')[0];
				joinGame(lobbyname);
				loadGame({ data: { gameID: lobbyname }});
			});
		});

		if (isInGame()) {
			$('#'+gameInfo.lobby + '-button').text('Start');
			$('#'+gameInfo.lobby + '-button').addClass('joined');
		}

		$('#create-lobby').on('click', function() {
			lobbyForm();
		});

		$('#login-button').off();
		$('#login-button').text('Logout');
		$('#login-button').on('click', function() {
    		logout();
    	});
	}
	else {
		$('.lobby-button').each(function() {
			$(this).on('click', joinForm);
			$(this).removeClass('joined');
		});

		$('#create-lobby').on('click', joinForm);

		$('#login-button').text('Login');
		$('#player-name').text('');
		$('#login-button').off();
		$('#login-button').on('click', joinForm);
	}

	$('#close-create-modal').on('click', function() {
		$('#create-modal').css('display', 'none');
	});

	$('#submit-lobby').on('click', function() {
		createLobby($('#lobby-name').val(), parseInt($('#field-width').val()),
					parseInt($('#field-height').val()), parseInt($('#game-speed').val()));
		$('#create-modal').css('display', 'none');
		sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
	});
}

function logout() {
	reset();
	sendLogout();
	sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);

}

function login(name) {
	if (name.length > 0) {
		sendLogin(name);
		$('#player-name').text(name);
		$('#login-modal').css('display', 'none');
		sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
	}
}

function loadLobbies(event) {
	if ($(this).attr('class') !== 'active') {
		sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
	}
}

function loadHighscores(event) {
	if ($(this).attr('class') !== 'active') {
		sendAjax('get', '/highscores', '#content');
	}
}

// To be called when an identified user joins a game
function loadGame(event) {
	if ($(this).attr('class') !== 'active') {
		sendAjaxListeners('get', '/game/' + event.data.gameID, '#content', startgame);
	}
}

function lobbyForm(event) {
	$('#create-modal').css('display', 'block');
	$('#lobby-name').focus();
}

// To be called when a lobby wants to be joined by a non-identified user
function joinForm(event) {
	// Display login dialog
	$('#login-modal').css('display', 'block');
	$('#login-name').focus();
}

function setEventListeners() {

    $('#get-lobbies').on('click', function() {
	    $(this).addClass('active');
    	$('#get-scores').removeClass('class');
    	$('#get-game').removeClass('class');
    	loadLobbies();
    });

    $('#get-scores').on('click', function() {
	    $(this).addClass('active');
    	$('#get-lobbies').removeClass('class');
    	$('#get-game').removeClass('class');
    	loadHighscores();
    });

    $('#get-game').on('click', function() {
    	if (isLoggedIn() && isInGame()) {
	    	$(this).addClass('active');
	    	$('#get-scores').removeClass('class');
	    	$('#get-lobbies').removeClass('class');
	    	loadGame({ data: { gameID: gameInfo.lobby }});
	    } else {
	    	alert("You need to be logged in and inside a lobby to play!");
	    }
    });

    // Close dialog on clicking the 'X' button
	$('#close-login-modal').on('click', function() {
		$('#login-modal').css('display', 'none');
	});
	// Store username on submit
	$('#submit-login').on('click', function() {
		login($('#login-name').val());
	});
};