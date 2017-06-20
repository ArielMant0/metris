$(document).ready(function () {
	setEventListeners();
	sendAjaxListeners('get', '/lobbies', '#content');
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

function sendAjaxListeners(method, url, elem) {
	var req = new XMLHttpRequest();
	req.addEventListener('load', function() {
		document.querySelector(elem).innerHTML = this.responseText;
		initLobbyListeners(true);
	});

	req.open(method, url);
	if (method === "get" || method === "GET")
		req.send();
	else
		req.send(body);
}

function sendAjaxLoadGame(method, url, elem) {
	var req = new XMLHttpRequest();
	req.addEventListener('load', function() {
		document.querySelector(elem).innerHTML = this.responseText;
    	startgame();
	});

	req.open(method, url);
	if (method === "get" || method === "GET")
		req.send();
	else
		req.send(body);
}

function initLobbyListeners(loggedIn) {
	if (loggedIn && false)
		$('.lobby-button').each(function() {
			$(this).on('click', joinForm);
		});
	else
		$('.lobby-button').each(function() {
			$(this).on('click', { gameID: $(this).attr('id').split('-')[0] }, loadGame);
		});
}

function loadLobbies(event) {
	if ($(this).attr('class') !== 'active') {
		sendAjaxListeners('get', '/lobbies', '#content');
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
		sendAjaxLoadGame('get', '/game/' + event.data.gameID, '#content');
	}
}

// To be called when a lobby wants to be joined by a non-identified user
function joinForm(event) {
	// present a login type form
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
    	$(this).attr('class', 'active');
    	$('#get-scores').removeAttr('class');
    	$('#get-lobbies').removeAttr('class');
    	var event = { data: { gameID: gameInfo.lobby }};
    	loadGame(event);
    });
};