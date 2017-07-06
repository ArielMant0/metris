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

	$('.watch-button').each(function() {
		$(this).on('click', function () {
			var lobbyname = $(this).attr('id').split('-')[0];
			watchAsSpectator(lobbyname);
			loadGame({ data: { gameID: lobbyname }});
		});
	});

	if (isLoggedIn()) {
		$('.lobby-button').each(function() {
			$(this).on('click', function () {
				var lobbyname = $(this).attr('id').split('-')[0];
				joinGame(lobbyname);
				loadGame({ data: { gameID: lobbyname }});
			});
		});

		if (isInGame()) {
			$('#'+gameInfo.lobby + '-join').text('Leave');
			$('#'+gameInfo.lobby + '-join').addClass('joined');
			$('#'+gameInfo.lobby + '-join').off();
			$('#'+gameInfo.lobby + '-join').on('click', function() {
				leaveGame();
				loadLobbies();
			});

			$('#'+gameInfo.lobby + '-watch').text('Go');
			$('#'+gameInfo.lobby + '-watch').addClass('nonspec');
			$('#'+gameInfo.lobby + '-watch').off();
			$('#'+gameInfo.lobby + '-watch').on('click', { gameID: gameInfo.lobby }, loadGame);

		}

		$('#create-lobby').on('click', function() {
			lobbyForm();
		});

		$('#login-button').off();
		$('#login-button').text('Logout');
		$('#login-button').on('click', function() {
    		logout();
    		loadLobbies();
    	});
	} else {
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
		createLobby($('#lobby-name').val(), parseInt($('#field-width').val()), parseInt($('#field-height').val()));
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
	sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
}

function loadHighscores(event) {
	sendAjax('get', '/highscores', '#content');
}

function loadControls(event) {
	sendAjax('get', '/controls', '#content');
}

function loadGame(event) {
	sendAjaxListeners('get', '/game/' + event.data.gameID, '#content', startgame);
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
    	$('#get-controls').removeClass('class');
    	loadLobbies();
    });

    $('#get-scores').on('click', function() {
	    $(this).addClass('active');
    	$('#get-lobbies').removeClass('class');
    	$('#get-game').removeClass('class');
    	$('#get-controls').removeClass('class');
    	loadHighscores();
    });

    $('#get-controls').on('click', function() {
	    $(this).addClass('active');
    	$('#get-lobbies').removeClass('class');
    	$('#get-game').removeClass('class');
    	$('#get-scores').removeClass('class');
    	loadControls();
    });

    $('#get-game').on('click', function() {
    	if (isLoggedIn() && isInGame()) {
	    	$(this).addClass('active');
	    	$('#get-scores').removeClass('class');
	    	$('#get-lobbies').removeClass('class');
	    	$('#get-controls').removeClass('class');
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