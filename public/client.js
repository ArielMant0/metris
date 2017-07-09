$(document).ready(function () {
	setEventListeners();
	loadLobbies();
});

function sendAjax(method, url, elem, body=undefined) {
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

function sendAjaxListeners(method, url, elem, func, body=undefined) {
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

function initHighscoreListeners() {
	$('#score-sort-button').on('click', function() {
		loadHighscores({ data: { sort: parseInt($('#scores-sort').val()),
							  	 order: parseInt($('#order-sort').val()) }});
	});
}

function initLobbyListeners() {
	$('#content').innerHeight($('body').innerHeight() - $('footer').outerHeight() - $('#topnav').outerHeight());

	$('.watch-button').each(function() {
		$(this).on('click', function () {
			var lobbyname = $('#'+$(this).attr('id').split('-')[0]).text();
			watchAsSpectator(lobbyname);
			loadGame({ data: { gameID: lobbyname }});
		});
	});

	$('#lobby-sort-button').on('click', function() {
		loadLobbies({ data: { sort: parseInt($('#lobbies-sort').val()),
							  order: parseInt($('#order-sort').val()) }});
	});

	if (isLoggedIn()) {
		$('.lobby-button').each(function() {
			$(this).on('click', function () {
				var lobbyname = $('#'+$(this).attr('id').split('-')[0]).text();
				joinGame(lobbyname);
			});
		});

		if (isInGame()) {
			$('#' + gameInfo.gameid + '-join').text('Leave');
			$('#' + gameInfo.gameid + '-join').addClass('joined');
			$('#' + gameInfo.gameid + '-join').off();
			$('#' + gameInfo.gameid + '-join').on('click', function() {
				leaveGame();
				loadLobbies();
			});

			$('#' + gameInfo.gameid + '-watch').text('Go');
			$('#' + gameInfo.gameid + '-watch').addClass('nonspec');
			$('#' + gameInfo.gameid + '-watch').off();
			$('#' + gameInfo.gameid + '-watch').on('click', { gameID: gameInfo.lobby }, loadGame);
		}

		$('#create-lobby').on('click', function() {
			lobbyForm();
		});

		$('#login-button').off();
		$('#login-button').text('Logout');
		$('#login-button').on('click', function() {
    		logout();
    	});

    	$('#fixed-size').on('change', function() {
			adjustHidden('#fixed-size');
		});

		adjustHidden('#fixed-size');

		$('#max-players').on('input', function() {
			$('#max-players-desc').text($('#max-players').val());
		});

		$('#field-width').on('input', function() {
			$('#field-width-desc').text($('#field-width').val());
		});

		$('#field-height').on('input', function() {
			$('#field-height-desc').text($('#field-height').val());
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
		if ($('#fixed-size').prop('checked') && $('#lobby-name').val().length > 0) {
			createLobbyFixed($('#lobby-name').val(),
							parseInt($('#lobby-background').val()),
							parseInt($('#field-width').val()),
							parseInt($('#field-height').val()),
							parseInt($('#max-players').val()));
			resetCreateLobby();
			$('#create-modal').css('display', 'none');
			sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
		} else if ($('#lobby-name').val().length > 0) {
			createLobby($('#lobby-name').val(), parseInt($('#lobby-background').val()));
			resetCreateLobby();
			$('#create-modal').css('display', 'none');
			sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
		} else {
			alert('You must minimally enter a lobby name');
		}
	});
}

function logout() {
	sendLogout();
	reset();
	sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);

}

function login(name) {
	if (name.length > 0) {
		sendLogin(name);
		$('#login-name').val('');
		$('#player-name').text(name);
		$('#login-modal').css('display', 'none');
		sendAjaxListeners('get', '/lobbies', '#content', initLobbyListeners);
	}
}

function resetCreateLobby() {
	$('#lobby-name').val('');
	$('#field-width').val(10);
	$('#field-height').val(10);
	$('#max-players').val(1);
}

function loadLobbies(event) {
	var sort;
	var order;
	if (!event) {
		sort = 0;
		order = 1;
	} else {
		sort = event.data.sort;
		order = event.data.order;
	}

	sendAjaxListeners('get', '/lobbies' + '?sort=' + sort + "&order=" + order,
					  '#content', initLobbyListeners);
	checkGameTab();
}

function loadHighscores(event) {
	var sort;
	var order;
	if (!event) {
		sort = 0;
		order = 0;
	} else {
		sort = event.data.sort;
		order = event.data.order;
	}

	sendAjaxListeners('get', '/highscores' + '?sort=' + sort + "&order=" + order,
					  '#content', initHighscoreListeners);
	checkGameTab();
}

function loadControls(event) {
	sendAjax('get', '/controls', '#content');
	checkGameTab();
}

function loadGame(event) {
	sendAjaxListeners('get', '/game/' + event.data.gameID, '#content', startgame);
	checkGameTab();
}

function lobbyForm(event) {
	$('#create-modal').css('display', 'block');
	$('#lobby-name').focus();
}

function checkGameTab() {
	if (isInGame() || spectator)
		$('#get-game').css('visibility', 'visible');
	else
		$('#get-game').css('visibility', 'hidden');
}

// To be called when a lobby wants to be joined by a non-identified user
function joinForm(event) {
	// Display login dialog
	$('#login-modal').css('display', 'block');
	$('#login-name').focus();
}

function setEventListeners() {

    $('#get-lobbies').on('click', function() {
    	loadLobbies();
    });

    $('#get-scores').on('click', function() {
    	loadHighscores();
    });

    $('#get-controls').on('click', function() {
    	loadControls();
    });

    $('#get-game').on('click', function() {
    	if (isInGame() || spectator) {
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

function adjustHidden(item) {
	if ($(item).prop('checked'))
		$('.on-fixed').css('visibility', 'visible');
	else
		$('.on-fixed').css('visibility', 'hidden');
}