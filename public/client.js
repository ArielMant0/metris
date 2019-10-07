
$(document).ready(function () {
	tabManager.addTab(new LobbyTab());
	tabManager.addTab(new Tab("game", "/game"));
	tabManager.addTab(new Tab("controls", "/controls"));
	tabManager.addTab(new HighscoreTab());

	$('#get-lobbies').on('click', function() {
		tabManager.switchTab("lobbies");
	});

	$('#get-scores').on('click', function() {
		tabManager.switchTab("highscores");
	});

	$('#get-controls').on('click', function() {
		tabManager.switchTab("controls");
	});

	$('#get-game').on('click', function() {
		tabManager.switchTab("game");
	});

	tabManager.switchTab("lobbies");
});

