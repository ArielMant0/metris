var NAME_REGEX = /[^A-Za-z0-9_\-äÄüÜöÖ\s]/;

// Enum
var Title = {
	Lobbies: ' - Lobbies',
	Highscores: ' - Highscores',
	Game: ' - Game: ',
	Controls: ' - Controls'
};

var currentSort;
var currentOrder;

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

function initControlsListeners() {
	setDocTitle(Title.Controls);
	// Check if game tab should be shown or not
	checkGameTab();
}

function initGameListeners() {
	setDocTitle(Title.Game);
	// Check if game tab should be shown or not
	checkGameTab();
	// Start the game
	startgame();
}

function initHighscoreListeners() {
	setDocTitle(Title.Highscores);

	// Check if game tab should be shown or not
	checkGameTab(Title.Lobbies);

	// Send score request for highscore list
	$('#score-sort-button').on('click', function() {
		loadHighscores({ data: { sort: parseInt($('#scores-sort').val()),
							  	 order: parseInt($('#order-sort').val()) }});
	});

	// Show the currently selected sorting parameters
	$("#scores-sort > option[value="+currentSort+"]").prop('selected', true);
	$("#order-sort > option[value="+currentOrder+"]").prop('selected', true);
}

function initLobbyListeners() {
	// Set page content height
	$('#content').innerHeight($('body').innerHeight() - $('footer').outerHeight() - $('#topnav').outerHeight());

	setDocTitle(Title.Lobbies);

	// Check if game tab should be shown or not
	checkGameTab();

	$('.watch-button').each(function() {
		$(this).on('click', function () {
			var lobbyid = $('#'+$(this).attr('id').split('.')[0]).text();
			watchAsSpectator(lobbyid);
			loadGame({ data: { gameID: lobbyid }});
		});
	});

	$('#lobby-sort-button').on('click', function() {
		loadLobbies({ data: { sort: parseInt($('#lobbies-sort').val()),
							  order: parseInt($('#order-sort').val()) }});
	});

	// Show the currently selected sorting parameters
	$("#lobbies-sort > option[value="+currentSort+"]").prop('selected', true);
	$("#order-sort > option[value="+currentOrder+"]").prop('selected', true);

	if (isLoggedIn()) {
		$('.lobby-button').each(function() {
			$(this).on('click', function () {
				joinGame($(this).attr('id').split('.')[0]);
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
			$('#' + gameInfo.gameid + '-watch').on('click', { gameID: gameInfo.gameid }, loadGame);
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

		$('#lobby-name').on('input', function() {
			var str = $(this).val();
			if (str.match(NAME_REGEX) !== null) {
				handleUserInput(true, true, 'Your game name may only contain letters, numbers, underscores and hyphens!');
				$(this).val(str.replace(NAME_REGEX, ''));
			} else {
				handleUserInput(true, false);
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
	if (!event) {
		currentSort = 0;
		currentOrder = 1;
	} else {
		currentSort = event.data.sort;
		currentOrder = event.data.order;
	}

	sendAjaxListeners('get', '/lobbies' + '?sort=' + currentSort + "&order=" + currentOrder,
					  '#content', initLobbyListeners);
}

function loadHighscores(event) {
	if (!event) {
		currentSort = 0;
		currentOrder = 0;
	} else {
		currentSort = event.data.sort;
		currentOrder = event.data.order;
	}
	console.log('highscore ' + currentOrder + ', ' + currentSort);
	sendAjaxListeners('get', '/highscores' + '?sort=' + currentSort + "&order=" + currentOrder,
					  '#content', initHighscoreListeners);
}

function loadControls(event) {
	sendAjaxListeners('get', '/controls', '#content', initControlsListeners);
}

function loadGame(event) {
	sendAjaxListeners('get', '/game/' + event.data.gameID, '#content', initGameListeners);
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
	    	loadGame({ data: { gameID: gameInfo.gameid }});
	    }
    });

    // Close dialog on clicking the 'X' button
	$('#close-login-modal').on('click', function() {
		$('#login-modal').css('display', 'none');
		$('#login-msg').css('display', 'none');
	});
	// Store username on submit
	$('#submit-login').on('click', function() {
		login($('#login-name').val());
	});
	// Only allow letters, numbers and underscores in a username
	$('#login-name').on('input', function() {
		var str = $(this).val();
		if (str.match(NAME_REGEX) !== null) {
			handleUserInput(false, true, 'Your username may only contain letters, numbers, underscores and hyphens!');
			$(this).val(str.replace(NAME_REGEX, ''));
		} else {
			handleUserInput(false, false);
		}
	});
};

function setDocTitle(content) {
	if (content === Title.Game)
		content += gameInfo.lobby;

	document.title = document.title.split('-')[0] + content;
}

function handleUserInput(createlobby, error, msg='') {
	if (createlobby) {
		$('#create-msg').text(msg);
		if (error)
			$('#create-msg').css('display', 'block');
		else
			$('#create-msg').css('display', 'none');
	} else {
		$('#login-msg').text(msg);
		if (error)
			$('#login-msg').css('display', 'block');
		else
			$('#login-msg').css('display', 'none');
	}

}

function adjustHidden(item) {
	if ($(item).prop('checked'))
		$('.on-fixed').css('visibility', 'visible');
	else
		$('.on-fixed').css('visibility', 'hidden');
}