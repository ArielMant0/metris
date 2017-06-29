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
	if (isLoggedIn()) {
		$('.lobby-button').each(function() {
			$(this).on('click', function () {
				var lobbyname = $(this).attr('id').split('-')[0];
				joinGame(lobbyname);
				loadGame({ data: { gameID: lobbyname }});
			});
		});
		$('#create-lobby').on('click', function() {
			createLobbyForm();
		});
	}
	else {
		$('.lobby-button').each(function() {
			$(this).on('click', joinForm);
		});
		$('#create-lobby').on('click', joinForm);
	}

	$('#close-create-modal').on('click', function() {
		$('#create-modal').css('display', 'none');
	});

	$('#submit-lobby').on('click', function() {
		createLobby($('#lobby-name').val(), $('#field-width').val(), $('#field-height').val());
		loadGame({ data: { gameID: $('#lobby-name').val() }});
	});
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

function createLobbyForm(event) {
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
    	$(this).attr('class', 'active');
    	$('#get-scores').removeAttr('class');
    	$('#get-game').removeAttr('class');
    	loadLobbies();
    });

    $('#get-scores').on('click', function() {
    	$(this).attr('class', 'active');
    	$('#get-lobbies').removeAttr('class');
    	$('#get-game').removeAttr('class');
    	loadHighscores();
    });

    $('#get-game').on('click', function() {
    	if (isLoggedIn() && isInGame()) {
	    	$(this).attr('class', 'active');
	    	$('#get-scores').removeAttr('class');
	    	$('#get-lobbies').removeAttr('class');
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
		if ($('#login-name').val()) {
			setPlayerName($('#login-name').val());
			$('#player-name').html($('#login-name').val());
			$('#login-modal').css('display', 'none');
			sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
		}
		else {
			alert("You need to enter a name to play with!");
		}
	});
};