var gl;

var PROGRAM_TRANSFORM = 0;
var PROGRAM_DRAW = 1;
var PROGRAM_STONE = 2;
var PROGRAM_MODEL = 3;

var programs;

var vertexPositionAttribute;
var textureCoordAttribute;
var vertexNormalAttribute;

var cubeVertexColorLocation = 1;  // set with GLSL layout qualifier
var cubeVertexPosLocation = 0;  // set with GLSL layout qualifier
var cubeVerticesBuffer;
var cubeVerticesNormalBuffer;
var cubeVerticesTextureCoordBuffer;
var cubeVerticesIndexBuffer;
var cubeVertexArray;
var cubeVertexPosBuffer;
var cubeVertexColorBuffer;

var cubeImageGreen;
var cubeImageSpace;
var cubeImageBorder;
var frameImage;
var gridImage;

var cubeGreen;
var spaceBackground;
var cubeBorder;
var frame;
var grid;

var perspectiveMatrix;
var mvMatrix;

// -- Initialize data
var NUM_INSTANCES = 1000;
var currentSourceIdx = 0;

var rotatateAll = 0.0;
var plz_rotateAll = false;

// -- Init Vertex Array
var OFFSET_LOCATION = 0;
var ROTATION_LOCATION = 1;
var POSITION_LOCATION = 2;      // this is vertex position of the instanced geometry
var COLOR_LOCATION = 3;
var NUM_LOCATIONS = 4;

var vertexArrays;
var transformFeedbacks;
var vertexBuffers;
var drawTimeLocation;
var drawLevelLocation;

var trianglePositions;

var instanceOffsets;
var instanceRotations;
var instanceColors;

var curScene = [];
var vertexArrayMaps = [];

var SOLID_STONE = 26;

var colors = [];
var players = [];
var gameInfo = {
    userid: 0,
    gameid: 0,
    lobby: '',
    field_height: 16,
    field_width: 30,
    field: [],
    username: '',
    score: 0,
    paused: false,
    stone_drop: [-1, -1, -1, -1],
    background: 0
};

var audio;
var socket;

var level = 1;
var readBinary = false;
var gameRunning = false;
var spectator = false;
var resetBuffer = false;

$(document).ready(function () {
    // WebSocket
    socket = io();
    // Main music for the game
    audio = new Audio('assets/MUSIC.mp3');

    audio.onended = function () {
      audio.currentTime = 7;
      audio.play();
    };

    reset();

    socket.on('music', function () {
        var audio2 = new Audio('assets/MUSIC2.mp3');
        audio2.play();
    });

    socket.on('showGame', function() {
        if (gameInfo.lobby)
            loadGame({ data: { gameID: gameInfo.lobby }});
    })

    socket.on('moveField', function (field) {
        if (readBinary) {
            var bufView = new Uint8Array(field);
            gameInfo.field = Array.prototype.slice.call(bufView);
        } else {
            gameInfo.field = field;
        }
    });

    socket.on('movePlayers', function (stones) {
        if (readBinary)
            var bufView = new Uint16Array(stones);
        else
            players = stones;
        if (!spectator)
            updateDropStone();
    });

    socket.on('moveScore', function (score, lvl) {
        if (readBinary) {
            var bufView = new Uint16Array(score);
            if (bufView[0] != gameInfo.score)
                updateScore(bufView[0]);
            bufView = new Uint16Array(level);
            if (bufView[0] != level)
                updateLevel(bufView[0]);
        } else {
            if (score != gameInfo.score)
                updateScore(score);
            if (lvl != level) {
                resetBuffer = true;
                updateLevel(lvl);
            }
        }
    });

    socket.on('begin', function (field) {
        if (readBinary) {
            var bufView = new Uint8Array(data);
            gameInfo.field = Array.prototype.slice.call(bufView);
        } else {
            gameInfo.field = field;
        }
        gameInfo.score = 0;
        level = 1;
        gameRunning = true;
        updateScore(gameInfo.score);
        updateLevel(level);
    });

    socket.on('resizefield', function(width, height, field, stones) {
        gameInfo.field_width = width;
        gameInfo.field_height = height;
        if (readBinary) {
            var bufView1 = new Uint8Array(field);
            gameInfo.field = Array.prototype.slice.call(bufView1);
            var bufView2 = new Uint16Array(stones);
            players = Array.prototype.slice.call(bufView2);
        } else {
            gameInfo.field = field;
            players = stones;
        }
    });

    socket.on('leftgame', function() {
        reset();
    });

    socket.on('loggedout', function() {
        reset();
        gameInfo.username = '';
    });

    socket.on('loggedin', function(name) {
        gameInfo.username = name;
    });

    socket.on('pause', function() {
        gameInfo.paused = true;
        showPauseText();
    });

    socket.on('unpause', function() {
        gameInfo.paused = false;
        hidePauseText();
    });

    socket.on('gameover', function() {
        $('#gameover-score').html('Final Score: ' + gameInfo.score);
        $('#game-over').css('display', 'block');
        reset(false);
    });

    socket.on('dataerror', function() {
        sendAjax('get', '/error', '#content');
    });

    socket.on('setspecinfo', function(lobbyname, width, height, hashes) {
        gameInfo.lobby = lobbyname;
        gameInfo.field_width = width;
        gameInfo.field_height = height;
        for (i = 0; i < hashes.length; i++) {
            computeColor(i, hashes[i]);
        }
        spectator = true;
    });

    socket.on('setgameinfo', function(data) {
        gameInfo.lobby = data.lobbyname;
        gameInfo.userid = data.id;
        gameInfo.field_width = data.width;
        gameInfo.field_height = data.height;
        gameInfo.username = data.username;
        gameInfo.gameid = data.gameid;
        gameInfo.paused = false;
        computeColor(gameInfo.userid, data.hash);
        colorUsername();
        spectator = false;
    });

    socket.on('userhash', function(id, hash) {
        computeColor(id, hash);
    });

    socket.on('sethashes', function(hashes) {
        for (i = 0; i < hashes.length; i++) {
            computeColor(i, hashes[i]);
        }
    });

    $('#get-lobbies').on('click', function () {
        audio.pause();
    });

    $('#get-scores').on('click', function () {
        audio.pause();
    });

    $('#get-controls').on('click', function () {
        audio.pause();
    });

    $(document).keydown(function (e) {
        // A, E, Q, D, S
        if (!spectator && gameRunning && (e.which == 65 || e.which == 69 || e.which == 81 || e.which == 68 || e.which == 83))
            submitmove(e.which, gameInfo.userid);
        else if (gameRunning && e.which === 27) // Escape
            closeLobby();
        else if (gameRunning && e.which === 32) // Space
            instaDrop()
        else if (gameRunning && e.which === 80) // P
            pauseLobby();
        else if (gameRunning && e.which === 82) // R
            plz_rotateAll = !plz_rotateAll;
    });
});

function instaDrop() {
    socket.emit('drop', gameInfo.lobby, gameInfo.userid);
}

function watchAsSpectator(lobbyname) {
    if (isInGame())
        leaveGame();

    spectator = true;
    socket.emit('spectate', lobbyname);
}

function showPauseText() {
    $('#game-pause').css('display', 'block');
}

function hidePauseText() {
    $('#game-pause').css('display', 'none');
}

function pauseLobby() {
    socket.emit('togglepause', gameInfo.lobby, gameInfo.userid);
}

function closeLobby() {
    socket.emit('endgame', gameInfo.lobby, gameInfo.userid);
}

function playerColor(x, y, z) {
    return { r: x, g: y, b: z};
}

function computeColor(index, hash) {
    colors[index] = playerColor((hash & 0xFF0000) >> 16,
                                (hash & 0x00FF00) >> 8,
                                 hash & 0x0000FF);
}

function colorUsername() {
    $('#player-name').css('color', "rgb(" + colors[gameInfo.userid].r + ","
                                          + colors[gameInfo.userid].g + ","
                                          + colors[gameInfo.userid].b + ")");
}

function updateScore(newScore) {
    gameInfo.score = newScore;
    $('#scoretext').text('Score: ' + gameInfo.score);
}

function updateLevel(newLevel) {
    level = newLevel;
    $('#leveltext').text('Level: ' + level);
}

function updateDropStone() {
    // Speichere welche Positionen gestet werden muessen
    // Dabei koennen Positionen die eine "Position" unter sich haben
    // oder -1 sind uebersprungen werden
    var tmp = [true, true, true, true]
    var found = false;
    for (i = 0; i < 4; i++) {
        for (j = 0; j < 4; j++) {
            if (players[gameInfo.userid][i] + gameInfo.field_width === players[gameInfo.userid][j] || players[gameInfo.userid][i] === -1)
                tmp[i] = false;
        }
    }

    // Gehe alle Positions des aktuellen Steins des Nutzers durch
    for (k = 0; k < 4; k++) {
        if (tmp[k] === true) {
            // Teste alle Felder darunter, wobei nur bis 0 (also zur negativen Höhe des Spielers) getestet werden muss
            var max_h = gameInfo.field_height - Math.floor(players[gameInfo.userid][k] / gameInfo.field_width)
            for (l = 0; l < max_h; l++) {
                                // Wenn am Feld unter dem aktuellen Index ein Stein liegt, setze die Vorschau auf den Index
                if (gameInfo.field[players[gameInfo.userid][k] + (l + 1) * gameInfo.field_width] > 0 || l === max_h - 1) {
                                        // Wenn schon eine Lösung vorhanden, teste ob der Wert kleiner ist
                    if (!found || players[gameInfo.userid][0] + l * gameInfo.field_width < gameInfo.stone_drop[0]) {
                        gameInfo.stone_drop = [players[gameInfo.userid][0] + l * gameInfo.field_width,
                                               players[gameInfo.userid][1] + l * gameInfo.field_width,
                                               players[gameInfo.userid][2] === -1 ? -1 : players[gameInfo.userid][2] + l * gameInfo.field_width,
                                               players[gameInfo.userid][3] === -1 ? -1 : players[gameInfo.userid][3] + l * gameInfo.field_width]
                        found = true;
                    }
                }
            }
        }
    }
}

function createLobbyFixed(lobby, bg, fwidth, fheight, maxplayers) {
    if (gameInfo.username) {
        if (spectator) {
            socket.emit('endspectate', gameInfo.lobby);
            reset();
        }
        gameInfo.background = bg;
        socket.emit('createlobbyfixed', lobby, gameInfo.username, fwidth, fheight, maxplayers);
    }
}

function createLobby(lobby, bg) {
    if (gameInfo.username) {
        if (spectator) {
            socket.emit('endspectate', gameInfo.lobby);
            reset();
        }
        gameInfo.background = bg;
        socket.emit('createlobby', lobby, gameInfo.username);
    }
}

function setPlayerName(name) {
    gameInfo.username = name;
}

function isLoggedIn() {
    return gameInfo.username.length > 0;
}

function isInGame() {
    return !spectator && gameInfo.lobby.length > 0;
}

function reset(killmusic=true) {
    $('#player-name').css('color', 'white');
    gameInfo.lobby = '';
    gameInfo.userid = -1;
    gameInfo.field_width = 0;
    gameInfo.field_height = 0;
    gameInfo.score = 0;
    gameInfo.paused = false;
    gameInfo.background = 0;
    gameInfo.stone_drop = [-1, -1, -1, -1];
    gameRunning = false;
    level = 1;
    players = [];
    spectator = false;
    gameInfo.field = [];

    if (killmusic) {
        audio.pause();
        audio.currentTime = 0;
    }
}

// Send player movement
function submitmove(key) {
    socket.emit('playermove', gameInfo.lobby, key, gameInfo.userid);
}

function joinGame(lobby) {
    if (isInGame() && lobby != gameInfo.lobby) {
        alert('You must leave your current game before joining another one!');
    } else if (!isInGame()) {
        if (spectator) {
            socket.emit('endspectate', gameInfo.lobby);
            reset();
        }
        socket.emit('join', lobby, gameInfo.username, spectator);
    }
}

function leaveGame() {
    socket.emit('leave', gameInfo.lobby, gameInfo.userid, gameInfo.username);
}

function sendLogin(name) {
    socket.emit('login', name);
}

function sendLogout() {
    socket.emit('logout', gameInfo.username, gameInfo.userid, gameInfo.lobby);
}

// Start the game in the current lobby
function startgame() {
    // Creates canvas to draw on
    start();

    // Socket senden
    if (!gameRunning) {
        audio.currentTime = 0;
        socket.emit('startgame', gameInfo.lobby, gameInfo.userid);
    } else {
        socket.emit('updategame', gameInfo.lobby);
    }

    audio.play();
}

// Called when the canvas is created to get the ball rolling.
function start() {
    'use strict';

    // Initialize the GL context
    initWebGL();

    // Only continue if WebGL is available and working
    if (gl) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things


        // -- Init Program
        initPrograms();

        initBuffers();

        initTextures();

        initParticleSystem();

        // Lade alle Modelle
        // Es koennen beliebig viele Modelle eingeladen werden
        // der Index gibt die Location an, mit der darauf zugegriffen werden kann
        initModel("/assets/backplane.gltf", 0);
        initModel("/assets/border.gltf", 1);
        initModel("/assets/borderedge.gltf", 2);
        initModel("/assets/backplane.gltf", 3);

        render();
    }
}

function initWebGL() {
    gl = null;

    try {
        gl = document.getElementById('glcanvas').getContext("webgl2");

        //TODO
        //if (!gl) {
        //    gl = canvas.getContext("experimental-webgl");
        //}

        // Reagiere auf Skylierung des Canvas
        window.addEventListener('resize', resizeCanvas, false);

        gl.canvas.addEventListener("webglcontextlost", function (event) {
            event.preventDefault();
        }, false);

        resizeCanvas();

        function resizeCanvas() {
            gl.canvas.width = window.innerWidth;
            gl.canvas.height = window.innerHeight - $('footer').height() - $('#nav-list').height();
        }
    }
    catch (e) {
    }

    // If we don't have a GL context, give up now

    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
    }
}

function initPrograms() {

    // Setup program for transform feedback shaders
    function createShader(gl, source, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    // Erzeuge die Shader die für das Particle-Movement zuständig sind
    var vshaderTransform = createShader(gl, getShaderSource('vs-emit'), gl.VERTEX_SHADER);
    var fshaderTransform = createShader(gl, getShaderSource('fs-emit'), gl.FRAGMENT_SHADER);

    var programPartTransform = gl.createProgram();
    gl.attachShader(programPartTransform, vshaderTransform);
    gl.deleteShader(vshaderTransform);
    gl.attachShader(programPartTransform, fshaderTransform);
    gl.deleteShader(fshaderTransform);

    var varyings = ['v_offset', 'v_rotation'];
    gl.transformFeedbackVaryings(programPartTransform, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(programPartTransform);

    // check
    var log = gl.getProgramInfoLog(programPartTransform);
    if (log) {
        console.log(log);
    }

    log = gl.getShaderInfoLog(vshaderTransform);
    if (log) {
        console.log(log);
    }

    // Erzeuge das Program zum ParticleSystem zeichnen
    var programPartDraw = createProgram(gl, getShaderSource('vs-draw'), getShaderSource('fs-draw'));

    // Erzeuge das Program zum Steine zeichnen
    var programStone = createProgram(gl, getShaderSource('stone-vs'), getShaderSource('stone-fs'));

    // Erzeuge das Program zum Models zeichnen
    var programModel = createProgram(gl, getShaderSource('model-vs'), getShaderSource('model-fs'));

    // Stecke die Programme in ein Array
    programs = [programPartTransform, programPartDraw, programStone, programModel];

    gl.useProgram(programs[PROGRAM_STONE]);

    vertexPositionAttribute = gl.getAttribLocation(programs[PROGRAM_STONE], "aVertexPosition");
    gl.enableVertexAttribArray(vertexPositionAttribute);

    textureCoordAttribute = gl.getAttribLocation(programs[PROGRAM_STONE], "aTextureCoord");
    gl.enableVertexAttribArray(textureCoordAttribute);

    vertexNormalAttribute = gl.getAttribLocation(programs[PROGRAM_STONE], "aVertexNormal");
    gl.enableVertexAttribArray(vertexNormalAttribute);
}


//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just have
// one object -- a simple two-dimensional cube.
//
function initBuffers() {

    // Create a buffer for the cube's vertices.

    cubeVerticesBuffer = gl.createBuffer();

    // Select the cubeVerticesBuffer as the one to apply vertex
    // operations to from here out.

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);

    // Now create an array of vertices for the cube.

    var vertices = [
      // Front face
      -1.0, -1.0, 1.0,
      1.0, -1.0, 1.0,
      1.0, 1.0, 1.0,
      -1.0, 1.0, 1.0,

      // Back face
      -1.0, -1.0, -1.0,
      -1.0, 1.0, -1.0,
      1.0, 1.0, -1.0,
      1.0, -1.0, -1.0,

      // Top face
      -1.0, 1.0, -1.0,
      -1.0, 1.0, 1.0,
      1.0, 1.0, 1.0,
      1.0, 1.0, -1.0,

      // Bottom face
      -1.0, -1.0, -1.0,
      1.0, -1.0, -1.0,
      1.0, -1.0, 1.0,
      -1.0, -1.0, 1.0,

      // Right face
      1.0, -1.0, -1.0,
      1.0, 1.0, -1.0,
      1.0, 1.0, 1.0,
      1.0, -1.0, 1.0,

      // Left face
      -1.0, -1.0, -1.0,
      -1.0, -1.0, 1.0,
      -1.0, 1.0, 1.0,
      -1.0, 1.0, -1.0
      ];

    // Now pass the list of vertices into WebGL to build the shape. We
    // do this by creating a Float32Array from the JavaScript array,
    // then use it to fill the current vertex buffer.

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Set up the normals for the vertices, so that we can compute lighting.

    cubeVerticesNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesNormalBuffer);

    var vertexNormals = [
      // Front
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,

      // Back
      0.0, 0.0, -1.0,
      0.0, 0.0, -1.0,
      0.0, 0.0, -1.0,
      0.0, 0.0, -1.0,

      // Top
      0.0, 1.0, 0.0,
      0.0, 1.0, 0.0,
      0.0, 1.0, 0.0,
      0.0, 1.0, 0.0,

      // Bottom
      0.0, -1.0, 0.0,
      0.0, -1.0, 0.0,
      0.0, -1.0, 0.0,
      0.0, -1.0, 0.0,

      // Right
      1.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      1.0, 0.0, 0.0,

      // Left
      -1.0, 0.0, 0.0,
      -1.0, 0.0, 0.0,
      -1.0, 0.0, 0.0,
      -1.0, 0.0, 0.0
      ];

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals),
          gl.STATIC_DRAW);

    // Map the texture onto the cube's faces.

    cubeVerticesTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);

    var textureCoordinates = [
      // Front
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0,
      // Back
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0,
      // Top
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0,
      // Bottom
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0,
      // Right
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0,
      // Left
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0
      ];

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
          gl.STATIC_DRAW);

    // Build the element array buffer; this specifies the indices
    // into the vertex array for each face's vertices.

    cubeVerticesIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);

    // This array defines each face as two triangles, using the
    // indices into the vertex array to specify each triangle's
    // position.

    var cubeVertexIndices = [
      0, 1, 2, 0, 2, 3,    // front
      4, 5, 6, 4, 6, 7,    // back
      8, 9, 10, 8, 10, 11,   // top
      12, 13, 14, 12, 14, 15,   // bottom
      16, 17, 18, 16, 18, 19,   // right
      20, 21, 22, 20, 22, 23    // left
      ]

    // Now send the element array to GL

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);



    // -- Init Vertex Array
    cubeVertexArray = gl.createVertexArray();
    gl.bindVertexArray(cubeVertexArray);


    // -- Init Buffers
    var vertices = new Float32Array([
        -0.3, -0.5,
        0.3, -0.5,
        0.0, 0.5
        ]);
    cubeVertexPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(cubeVertexPosLocation);
    gl.vertexAttribPointer(cubeVertexPosLocation, 2, gl.FLOAT, false, 0, 0);


    var colors = new Float32Array([
        1.0, 0.5, 0.0,
        0.0, 0.5, 1.0
        ]);
    cubeVertexColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(cubeVertexColorLocation);
    gl.vertexAttribPointer(cubeVertexColorLocation, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(cubeVertexColorLocation, 1); // attribute used once per instance

    gl.bindVertexArray(null);
}

//
// initTextures
//
// Initialize the textures we'll be using, then initiate a load of
// the texture images. The handleTextureLoaded() callback will finish
// the job; it gets called each time a texture finishes loading.
//
function initTextures() {
    cubeGreen = gl.createTexture();
    cubeImageGreen = new Image();
    cubeImageGreen.onload = function () { handleTextureLoaded(cubeImageGreen, cubeGreen); }
    cubeImageGreen.src = "assets/cubegray.png";

    spaceBackground = gl.createTexture();
    cubeImageSpace = new Image();
    cubeImageSpace.onload = function () { handleTextureLoaded(cubeImageSpace, spaceBackground); }
    cubeImageSpace.src = "assets/The-Edge-of-Space.jpg"; //"Space-Background.png";

    cubeBorder = gl.createTexture();
    cubeImageBorder = new Image();
    cubeImageBorder.onload = function () { handleTextureLoaded(cubeImageBorder, cubeBorder); }
    cubeImageBorder.src = "assets/greyscaleborder.png";

    frame = gl.createTexture();
    frameImage = new Image();
    frameImage.onload = function () { handleTextureLoaded(frameImage, frame); }
    frameImage.src = "assets/frame.png";

    grid = gl.createTexture();
    gridImage = new Image();
    gridImage.onload = function () { handleTextureLoaded(gridImage, grid); }
    gridImage.src = "assets/grid.png";
}

function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function initModel(gltfUrl, index) {

    // -- Load gltf
    var glTFLoader = new MinimalGLTFLoader.glTFLoader();

    glTFLoader.loadGLTF(gltfUrl, function(glTF) {

        curScene[index] = glTF.scenes[glTF.defaultScene];

        // -- Initialize vertex array
        // set with GLSL layout qualifier
        var POSITION_LOCATION = 0;
        var NORMAL_LOCATION = 1;
        var TEXCOORD_LOCATION = 2;
        vertexArrayMaps[index] = {};

        // var in loop
        var mesh;
        var primitive;
        var vertexBuffer2;
        var indicesBuffer2;
        var vertexArray2;
        var i, len;

        for (var mid in curScene[index].meshes) {

            mesh = curScene[index].meshes[mid];
            vertexArrayMaps[index][mid] = [];

            for (i = 0, len = mesh.primitives.length; i < len; ++i) {

                primitive = mesh.primitives[i];

                // create buffers
                vertexBuffer2 = gl.createBuffer();
                indicesBuffer2 = gl.createBuffer();

                // WebGL2: create vertexArray
                vertexArray2 = gl.createVertexArray();
                vertexArrayMaps[index][mid].push(vertexArray2);

                // -- Initialize buffer
                var vertices2 = primitive.vertexBuffer;
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer2);
                gl.bufferData(gl.ARRAY_BUFFER, vertices2, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                var indices2 = primitive.indices;
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer2);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices2, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

                // -- VertexAttribPointer
                var positionInfo = primitive.attributes.POSITION;
                gl.bindVertexArray(vertexArray2);
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer2);

                gl.vertexAttribPointer(
                    POSITION_LOCATION,
                    positionInfo.size,
                    positionInfo.type,
                    false,
                    positionInfo.stride,
                    positionInfo.offset
                    );
                gl.enableVertexAttribArray(POSITION_LOCATION);

                var normalInfo = primitive.attributes.NORMAL;

                gl.vertexAttribPointer(
                    NORMAL_LOCATION,
                    normalInfo.size,
                    normalInfo.type,
                    false,
                    normalInfo.stride,
                    normalInfo.offset
                    );

                gl.enableVertexAttribArray(NORMAL_LOCATION);

                var texcoordInfo = primitive.attributes.TEXCOORD_0;

                gl.vertexAttribPointer(
                    TEXCOORD_LOCATION,
                    texcoordInfo.size,
                    texcoordInfo.type,
                    false,
                    texcoordInfo.stride,
                    texcoordInfo.offset
                    );

                gl.enableVertexAttribArray(TEXCOORD_LOCATION);

                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer2);
                gl.bindVertexArray(null);
            }
        }
    });
}

function initParticleSystem() {
    trianglePositions = new Float32Array([
        0.015, 0.0,
        -0.010, 0.010,
        -0.010, -0.010,
        ]);

    instanceOffsets = new Float32Array(NUM_INSTANCES * 2);
    instanceRotations = new Float32Array(NUM_INSTANCES * 1);
    instanceColors = new Float32Array(NUM_INSTANCES * 3);

    for (var i = 0; i < NUM_INSTANCES; ++i) {
        var oi = i * 2;
        var ri = i;
        var ci = i * 3;

        // beides i ODER beides 0 oder i + 0
        //instanceOffsets[oi] = Math.random() * 2.0 - 1.0;
        //instanceOffsets[oi + 1] = Math.random() * 2.0 - 1.0;

        instanceRotations[i] = i / (NUM_INSTANCES / 2.0) * 2.0 * Math.PI;

        if (i < NUM_INSTANCES / 2) {
            instanceOffsets[oi] = 0.0;
            instanceOffsets[oi + 1] = 0.0;
        } else {
            instanceOffsets[oi] = 0.675 * Math.cos(instanceRotations[i - NUM_INSTANCES / 2]);
            instanceOffsets[oi + 1] = 0.675 * Math.sin(instanceRotations[i - NUM_INSTANCES / 2]);
            //instanceOffsets[oi] = 0.0;
            //instanceOffsets[oi + 1] = 0.0;
        }

        /*
            Für kreis mit random bewegung

        instanceOffsets[oi] = 0;
        instanceOffsets[oi + 1] = i/10000;

        instanceRotations[i] = Math.random() * 2 * Math.PI;
        */

        instanceColors[ci] = Math.random();
        instanceColors[ci + 1] = Math.random();
        instanceColors[ci + 2] = Math.random();
    }

    drawTimeLocation = gl.getUniformLocation(programs[PROGRAM_DRAW], 'u_time');
    drawLevelLocation = gl.getUniformLocation(programs[PROGRAM_TRANSFORM], 'u_level');

    vertexArrays = [gl.createVertexArray(), gl.createVertexArray()];

    // Transform feedback objects track output buffer state
    transformFeedbacks = [gl.createTransformFeedback(), gl.createTransformFeedback()];

    vertexBuffers = new Array(vertexArrays.length);

    for (var va = 0; va < vertexArrays.length; ++va) {
        gl.bindVertexArray(vertexArrays[va]);
        vertexBuffers[va] = new Array(NUM_LOCATIONS);

        vertexBuffers[va][OFFSET_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][OFFSET_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, instanceOffsets, gl.STREAM_COPY);
        gl.vertexAttribPointer(OFFSET_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(OFFSET_LOCATION);

        vertexBuffers[va][ROTATION_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][ROTATION_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, instanceRotations, gl.STREAM_COPY);
        gl.vertexAttribPointer(ROTATION_LOCATION, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(ROTATION_LOCATION);

        vertexBuffers[va][POSITION_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][POSITION_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, trianglePositions, gl.STATIC_DRAW);
        gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(POSITION_LOCATION);

        vertexBuffers[va][COLOR_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][COLOR_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, instanceColors, gl.STATIC_DRAW);
        gl.vertexAttribPointer(COLOR_LOCATION, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(COLOR_LOCATION);
        gl.vertexAttribDivisor(COLOR_LOCATION, 1); // attribute used once per instance

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Set up output
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedbacks[va]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, vertexBuffers[va][OFFSET_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, vertexBuffers[va][ROTATION_LOCATION]);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    }
}

function resetBuffers() {
    for (var i = 0; i < NUM_INSTANCES; ++i) {
        var oi = i * 2;
        var ri = i;
        var ci = i * 3;

        // beides i ODER beides 0 oder i + 0
        //instanceOffsets[oi] = Math.random() * 2.0 - 1.0;
        //instanceOffsets[oi + 1] = Math.random() * 2.0 - 1.0;

        instanceRotations[i] = i / (NUM_INSTANCES / 2.0) * 2.0 * Math.PI;


        // ParticleSystem in two Cycles from Center
        if (level % 4 === 1) {
            if (i < NUM_INSTANCES / 2) {
                instanceOffsets[oi] = 0.0;
                instanceOffsets[oi + 1] = 0.0;
            } else {
                instanceOffsets[oi] = 0.675 * Math.cos(instanceRotations[i - NUM_INSTANCES / 2]);
                instanceOffsets[oi + 1] = 0.675 * Math.sin(instanceRotations[i - NUM_INSTANCES / 2]);
            }
        }
        // ParticleSystem in one Cycle from Center
        else if (level % 4 === 2) {
            instanceOffsets[oi] = 0.0;
            instanceOffsets[oi + 1] = 0.0;
        }
        // ParticleSystem filled area from Center
        else if (level % 4 === 3) {
            instanceOffsets[oi] = Math.random() * Math.cos(instanceRotations[i - NUM_INSTANCES / 2]);
            instanceOffsets[oi + 1] = Math.random() * Math.sin(instanceRotations[i - NUM_INSTANCES / 2]);
        }
        // ParticleSystem rain from top
        else if (level % 4 === 0) {
            instanceRotations[i] = (3.0/2.0) * Math.PI;

            instanceOffsets[oi] = Math.random() * 2.0 - 1.0;
            instanceOffsets[oi + 1] = Math.random() * 2.0 + 0.7;
        }
    }

    for (var va = 0; va < vertexArrays.length; ++va) {
        gl.bindVertexArray(vertexArrays[va]);

        vertexBuffers[va][OFFSET_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][OFFSET_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, instanceOffsets, gl.STREAM_COPY);
        gl.vertexAttribPointer(OFFSET_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(OFFSET_LOCATION);

        vertexBuffers[va][ROTATION_LOCATION] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][ROTATION_LOCATION]);
        gl.bufferData(gl.ARRAY_BUFFER, instanceRotations, gl.STREAM_COPY);
        gl.vertexAttribPointer(ROTATION_LOCATION, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(ROTATION_LOCATION);
    }
}

function initParticleSystem2() {
    //TODO
    for (var va = currentSourceIdx; va < currentSourceIdx + 1; ++va) {

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][OFFSET_LOCATION]);
        gl.vertexAttribPointer(OFFSET_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(OFFSET_LOCATION);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][ROTATION_LOCATION]);
        gl.vertexAttribPointer(ROTATION_LOCATION, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(ROTATION_LOCATION);


        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][POSITION_LOCATION]);
        gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(POSITION_LOCATION);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[va][COLOR_LOCATION]);
        gl.vertexAttribPointer(COLOR_LOCATION, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(COLOR_LOCATION);
        gl.vertexAttribDivisor(COLOR_LOCATION, 1); // attribute used once per instance

        //gl.bindVertexArray(null);
        //gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Set up output
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedbacks[va]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, vertexBuffers[va][OFFSET_LOCATION]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, vertexBuffers[va][ROTATION_LOCATION]);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    }
}

function transform() {
    var programTransform = programs[PROGRAM_TRANSFORM];
    var destinationIdx = (currentSourceIdx + 1) % 2;

    // Toggle source and destination VBO
    var sourceVAO = vertexArrays[currentSourceIdx];

    var destinationTransformFeedback = transformFeedbacks[destinationIdx];

    gl.useProgram(programTransform);

    // Set uniforms
    var time = Date.now();
    gl.uniform1f(drawTimeLocation, time);
    gl.uniform1i(drawLevelLocation, level);

    gl.bindVertexArray(sourceVAO);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, destinationTransformFeedback);

    // NOTE: The following two lines shouldn't be necessary, but are required to work in ANGLE
    // due to a bug in its handling of transform feedback objects.
    // https://bugs.chromium.org/p/angleproject/issues/detail?id=2051
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, vertexBuffers[destinationIdx][OFFSET_LOCATION]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, vertexBuffers[destinationIdx][ROTATION_LOCATION]);

    // Attributes per-vertex when doing transform feedback needs setting to 0 when doing transform feedback
    gl.vertexAttribDivisor(OFFSET_LOCATION, 0);
    gl.vertexAttribDivisor(ROTATION_LOCATION, 0);

    // Turn off rasterization - we are not drawing
    gl.enable(gl.RASTERIZER_DISCARD);

    // Update position and rotation using transform feedback
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, NUM_INSTANCES);
    gl.endTransformFeedback();

    // Restore state
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.useProgram(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    // Ping pong the buffers
    currentSourceIdx = (currentSourceIdx + 1) % 2;
}

function render() {
    // Erhöhe die Rotation wenn gewollt
    if (plz_rotateAll)
        rotatateAll +=0.004;

    // Set the viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear color buffer
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    // Establish the perspective with which we want to view the
    // scene. Our field of view is 45 degrees, with a dynamic width/height
    // ratio, and we only want to see objects between 0.1 units
    // and 1000 units away from the camera.
    var screenaspect = window.innerWidth / window.innerHeight;

    perspectiveMatrix = mat4.create();
    mat4.perspective(perspectiveMatrix, Math.PI / 4.0, screenaspect, 0.1, 1000.0);

    // Now move the drawing position a bit to where we want to start
    // drawing the cube.
    gl.useProgram(programs[PROGRAM_STONE]);

    // Draw the cube by binding the array buffer to the cube's vertices
    // array, setting attributes, and pushing it to GL.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);
    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPositionAttribute);
    gl.vertexAttribDivisor(vertexPositionAttribute, 0);

    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
    gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(textureCoordAttribute);
    gl.vertexAttribDivisor(textureCoordAttribute, 0);

    // Bind the normals buffer to the shader attribute.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesNormalBuffer);
    gl.vertexAttribPointer(vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexNormalAttribute);
    gl.vertexAttribDivisor(vertexNormalAttribute, 0);


    ///////////////////////////////////////
    // Models
    ///////////////////////////////////////
    // Berechne die Entfernung der Objekte zur Kamera
    var a = gameInfo.field_width / screenaspect > gameInfo.field_height ? gameInfo.field_width / screenaspect + (gameInfo.field_width / screenaspect * 0.1) : gameInfo.field_height + (gameInfo.field_height * 0.1);
    var trans = (a / Math.sin(Math.PI / 8)) * Math.sin(Math.PI / 4 + Math.PI / 8);

    // Entscheide ob alles rotiert wird
    if (plz_rotateAll)
        trans *= (1 + Math.abs(Math.sin(rotatateAll)));

    // Speiche die Uniform locations um später darin etwas an den Shader zu übergeben
    var uniformMVLocations = gl.getUniformLocation(programs[PROGRAM_MODEL], "uMVMatrix");
    var uniformMvNormalLocations = gl.getUniformLocation(programs[PROGRAM_MODEL], "mvNormal");
    var uniformPLocations = gl.getUniformLocation(programs[PROGRAM_MODEL], "uPMatrix");
    var uniformLightLocations = gl.getUniformLocation(programs[PROGRAM_MODEL], "uLight");

    // Aktiviere Texturen
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, spaceBackground);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, frame);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, grid);

    // Nutze das Model Zeichen Program
    gl.useProgram(programs[PROGRAM_MODEL]);

    // -- Render preparation
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Konstante Rotation um die Objekte an die richtige Stelle zu bekommen
    var rotatationY = Math.PI / 2.0;

    var localMV;
    var localMVNormal;
    var modelView;
    var scale;
    var translate;
    var mesh;
    var scale_b = 1.0;
    var scale_h = 1.0;
    var max = curScene.length;

    // Gehe alle Modells durch
    for (g = 0; g < max; g++) {
        // Wenn das Spiel zuende ist, rendere nur den Hintergrund
        if (gameInfo.field_width === 0 && gameInfo.field_height === 0)
            max = 0;

        // Wenn kein Brett-Hintergrund gerendert werden soll
        if (g === 3 && gameInfo.background == 0)
            continue;

        var count = 4;
        if (g === 0) {
            count = 1;
            gl.disable(gl.DEPTH_TEST);
        }
        // Starte Blending da der Brett-Hintergrund durchsichtig sein soll
        else if (g === 3 && gameInfo.background === 1) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            gl.disable(gl.DEPTH_TEST);
        }

        for (h = 0; h < count && typeof curScene[g] !== 'undefined'; h++) {

            // Erzeuge die Matrizen
            localMV = mat4.create();
            localMVNormal = mat4.create();

            // Setze die Matrizen abhängig vom Objekt-Type
            // Background
            translate = vec3.create();
            scale = vec3.create();
            if (g === 0) {
                var tmp = screenaspect > 2.1 ? -8 + screenaspect/1.3 : -10;

                vec3.set(translate, 0, -3, tmp);

                vec3.set(scale, 10, 9, 1.0);
                scale_b = 1.0;
            }
            // Field-Border
            else if (g === 1) {
                if (h === 0)
                    vec3.set(translate, gameInfo.field_width + 1, 0, -trans);
                else if (h === 1)
                    vec3.set(translate, -gameInfo.field_width - 1, 0, -trans);
                else if (h === 2)
                    vec3.set(translate, 0, gameInfo.field_height + 1, -trans);
                else if (h === 3)
                    vec3.set(translate, 0, -gameInfo.field_height - 1, -trans);

                if (h === 0 || h === 1)
                    scale_b = gameInfo.field_height / 10.0; // breite, tiefe, höhe
                else
                    scale_b = gameInfo.field_width / 10.0;
                vec3.set(scale, 1.0, 1.0, scale_b);
            }
            // Field-Edges
            else if (g === 2) {
                if (h === 0)
                    vec3.set(translate, gameInfo.field_width + 1, -gameInfo.field_height - 1, -trans);
                else if (h === 1)
                    vec3.set(translate, gameInfo.field_width + 1, gameInfo.field_height + 1, -trans);
                else if (h === 2)
                    vec3.set(translate, -gameInfo.field_width - 1, gameInfo.field_height + 1, -trans);
                else if (h === 3)
                    vec3.set(translate, -gameInfo.field_width - 1, -gameInfo.field_height - 1, -trans);

                vec3.set(scale, 1.0, 1.0, 1.0);
                scale_b = 1.0;
            }
            // Field-Background
            else {
                vec3.set(translate, 0, 0, -trans-1.2);

                vec3.set(scale, gameInfo.field_width, gameInfo.field_height, 1.0);
                if (gameInfo.background === 1) {
                    scale_b = gameInfo.field_height;
                    scale_h = gameInfo.field_width;
                } else {
                    scale_b = gameInfo.field_height / 10.0;
                    scale_h = gameInfo.field_width / 10.0;
                }
            }

            modelView = mat4.create();

            // Rotiere alle Objekte mit rotateAll
            if (g > 0)
                mat4.rotateZ(modelView, modelView, rotatateAll);

            mat4.translate(modelView, modelView, translate);

            //mat4.rotateZ(modelView, modelView, rotatationY);
            if (g === 1) {
                mat4.rotateX(modelView, modelView, rotatationY);
                if (h === 2 || h === 3)
                    mat4.rotateY(modelView, modelView, rotatationY);
            } else if (g === 2) {
                mat4.rotateX(modelView, modelView, rotatationY);
                mat4.rotateY(modelView, modelView, rotatationY * h);
            }

            // Erzeuge eine Skalier Matrix
            mat4.scale(modelView, modelView, scale);

            for (var mid in curScene[g].meshes) {
                mesh = curScene[g].meshes[mid];

                for (i = 0, len = mesh.primitives.length; i < len; ++i) {
                    primitive = mesh.primitives[i];

                    // Verrechne die Matizen
                    mat4.multiply(localMV, modelView, primitive.matrix);

                    mat4.invert(localMVNormal, localMV);
                    mat4.transpose(localMVNormal, localMVNormal);

                    gl.bindVertexArray(vertexArrayMaps[g][mid][i]);

                    // Setze die Matrizen
                    gl.uniformMatrix4fv(uniformMVLocations, false, localMV);
                    gl.uniformMatrix4fv(uniformMvNormalLocations, false, localMVNormal);
                    gl.uniformMatrix4fv(uniformPLocations, false, perspectiveMatrix);

                    // Entscheide welche Light-Position uebergeben werden soll
                    if (g === 0)
                        gl.uniform4fv(uniformLightLocations, [0.0, 0.0, 1.0, 0.4]);
                    else if (g === 1 || g === 2)
                        gl.uniform4fv(uniformLightLocations, [0.0, 0.0, -trans*2.0 + 10, 3.0]);
                    else if (g === 3)
                        gl.uniform4fv(uniformLightLocations, [0.0, 0.0, -10.0, 1.0]);

                    // Entscheide welche Textur uebergeben werden soll
                    if (g === 0)
                        gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_MODEL], "uSampler"), 2);
                    else if (g === 3) {
                        if (gameInfo.background === 1)
                            gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_MODEL], "uSampler"), 5);
                        else if (gameInfo.background === 2)
                            gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_MODEL], "uSampler"), 3);
                    }
                    else
                        gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_MODEL], "uSampler"), 3);

                    // Schicke dem Shader wie sehr die Textur-Koordinaten skaliert werden sollen
                    gl.uniform2fv(gl.getUniformLocation(programs[PROGRAM_MODEL], "scale"), [scale_h, scale_b]);

                    // Zeichne
                    gl.drawElements(primitive.mode, primitive.indices.length, primitive.indicesComponentType, 0);

                    // Reset
                    gl.bindVertexArray(null);
                }
            }
        }
        // Disable Einstellungen
        if (g === 0)
            gl.enable(gl.DEPTH_TEST);
        else if (g === 3 && gameInfo.background === 1) {
            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
        }
    }


    ///////////////////////////////////////
    // Tetrisfield
    ///////////////////////////////////////
    // Wähle Program
    gl.useProgram(programs[PROGRAM_STONE]);

    // Aktiviere Texturen
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cubeGreen);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, cubeBorder);

    // Draw the cube by binding the array buffer to the cube's vertices
    // array, setting attributes, and pushing it to GL.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);
    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPositionAttribute);
    gl.vertexAttribDivisor(vertexPositionAttribute, 0);

    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
    gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(textureCoordAttribute);
    gl.vertexAttribDivisor(textureCoordAttribute, 0);

    // Bind the normals buffer to the shader attribute.
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesNormalBuffer);
    gl.vertexAttribPointer(vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexNormalAttribute);
    gl.vertexAttribDivisor(vertexNormalAttribute, 0);

    // Optimierungsvariable, wenn im field eine ganze Reihe frei war, brich ab, da darueber nichts sein kann
    var empty = 0;
    // Wenn das Feld undefiniert ist versuche nicht zu rendern
    if (typeof gameInfo.field !== 'undefined') {
        // Gehe das ganze feld von unten nach oben durch
        for (d1 = gameInfo.field_height-1; d1 >= 0 && empty < gameInfo.field_width; d1--) {
            empty = 0;
            // Gehe die unterste Zeile von rechte nach links durch
            for (d2 = gameInfo.field_width-1; d2 >= 0; d2--) {
                // Wenn an der Stelle im Feld ein Eintrag (>0) dann rendere den Stein
                if (gameInfo.field[d1 * gameInfo.field_width + d2] > 0) {

                    // Verschiebe den Stein sodass er von der Kamera gesehen wird.
                    translate = vec3.create();
                    vec3.set(translate, d2 * 2 - gameInfo.field_width + 1, gameInfo.field_height - d1 * 2 - 1, -trans);

                    // Rotiere mit rotateAll
                    mvMatrix = mat4.create();
                    mat4.rotateZ(mvMatrix, mvMatrix, rotatateAll);
                    mat4.translate(mvMatrix, mvMatrix, translate);

                    // Wähle die Greyscale Textur aus
                    gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_STONE], "uSampler"), 1);

                    // Definiere die Color, die der Stein haben soll.
                    // Ist es ein Immortal-Stone wird er schwarz gerendert.
                    // Sonst nutze die uebergebene Spielerfarbe.
                    var useColor;
                    if (gameInfo.field[d1 * gameInfo.field_width + d2] === SOLID_STONE) {
                        useColor = [0, 0, 0];
                    } else {
                        useColor = [colors[gameInfo.field[d1 * gameInfo.field_width + d2]-1].r,
                                    colors[gameInfo.field[d1 * gameInfo.field_width + d2]-1].g,
                                    colors[gameInfo.field[d1 * gameInfo.field_width + d2]-1].b];
                    }
                    gl.uniform3fv(gl.getUniformLocation(programs[PROGRAM_STONE], "uColor"), useColor);

                    // Draw the cube.
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
                    // Setze die Matrizen fuer den Shader
                    setMatrixUniforms();
                    // Zeichne
                    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
                } else {
                    empty++;
                }
            }
        }
    }

    // Wenn players undefined ueberspringe rendern
    if (typeof players !== 'undefined') {
        // Gehe alle Player durch
        for (i = 0; i < players.length; i++) {
            // Gehe jede Position des aktuellen Players durch
            for (d2 = 0; d2 < players[i].length; d2++) {
                // Wenn die Position nicht -1 rendere
                if (players[i][d2] >= 0) {

                    // Verschiebe den Stein sodass er sichtbar ist
                    translate = vec3.create();
                    vec3.set(translate,
                        Math.floor(players[i][d2] % gameInfo.field_width) * 2 - gameInfo.field_width + 1,
                        gameInfo.field_height - Math.floor(players[i][d2] / gameInfo.field_width) * 2 - 1,
                        -trans);

                    // Rotiere mithilfe von rotateAll
                    mvMatrix = mat4.create();
                    mat4.rotateZ(mvMatrix, mvMatrix, rotatateAll);
                    mat4.translate(mvMatrix, mvMatrix, translate);

                    // Gebe dem Shader die Textur und welche Farbe der Stein haben soll
                    gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_STONE], "uSampler"), 1);
                    gl.uniform3fv(gl.getUniformLocation(programs[PROGRAM_STONE], "uColor"), [colors[i].r, colors[i].g, colors[i].b]);

                    // Draw the cube.
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
                    // Setze die Matrizen fuer den Shader
                    setMatrixUniforms();
                    // Zeichne
                    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
                }
            }
        }
    }

    ///////////////////////////////////////
    // gameInfo.stone_drop
    ///////////////////////////////////////
    // Aktiviere Blending, da der Stein durchsichtig sein soll
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Wenn stone_drop undefined ueberspringe rendern
    if (typeof gameInfo.stone_drop !== 'undefined' && !spectator) {
        // Gehe alle Positionen von stone_drop durch
        for (i = 0; i < gameInfo.stone_drop.length; i++) {
            // Wenn die Position nicht -1 rendere
            if (gameInfo.stone_drop[i] >= 0) {

                // Verschiebe den Stein sodass er sichtbar ist
                translate = vec3.create();
                vec3.set(translate,
                    Math.floor(gameInfo.stone_drop[i] % gameInfo.field_width) * 2 - gameInfo.field_width + 1,
                    gameInfo.field_height - Math.floor(gameInfo.stone_drop[i] / gameInfo.field_width) * 2 - 1,
                    -trans);

                // Rotiere mithilfe von rotateAll
                mvMatrix = mat4.create();
                mat4.rotateZ(mvMatrix, mvMatrix, rotatateAll);
                mat4.translate(mvMatrix, mvMatrix, translate);

                // Gebe dem Shader die Textur und welche Farbe der Stein haben soll
                gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_STONE], "uSampler"), 4);
                gl.uniform3fv(gl.getUniformLocation(programs[PROGRAM_STONE], "uColor"), [colors[gameInfo.userid].r,
                                                                                         colors[gameInfo.userid].g,
                                                                                         colors[gameInfo.userid].b]);

                // Draw the cube.
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
                // Setze die Matrizen fuer den Shader
                setMatrixUniforms();
                // Zeichne
                gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
            }
        }
    }
    //gl.disable(gl.BLEND);


    ///////////////////////////////////////
    // ParticleSystem
    ///////////////////////////////////////
    // Wenn sich das Level geändert hat, setze das PartikelSystem auf die neue Startposition
    if (resetBuffer) {
        resetBuffers();
        resetBuffer = false;
    }

    initParticleSystem2();

    // Rotate/Move triangles
    transform();

    gl.bindVertexArray(vertexArrays[currentSourceIdx]);

    // Attributes per-instance when drawing sets back to 1 when drawing instances
    gl.vertexAttribDivisor(OFFSET_LOCATION, 1);
    gl.vertexAttribDivisor(ROTATION_LOCATION, 1);

    // Nutze das Zeichenprogram
    gl.useProgram(programs[PROGRAM_DRAW]);

    // Enable blending
    // gl.enable(gl.BLEND);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Set uniforms
    var time = Date.now();
    gl.uniform1f(drawTimeLocation, time);
    gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_DRAW], "uSampler"), 2);

    // Zeichne die Partikel mit Instancing
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, NUM_INSTANCES);

    gl.disable(gl.BLEND);

    // DAS IST ALLES SO DUMM !!!
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);

    gl.bindVertexArray(null);


    // Wiederhole die Render funktion
    requestAnimationFrame(render);
}

//
// Set Matrix
//
function setMatrixUniforms() {
    // Setze die Projektion Matrix
    var pUniform = gl.getUniformLocation(programs[PROGRAM_STONE], "uPMatrix");
    gl.uniformMatrix4fv(pUniform, false, perspectiveMatrix);

    // Setze die View Matrix
    var mvUniform = gl.getUniformLocation(programs[PROGRAM_STONE], "uMVMatrix");
    gl.uniformMatrix4fv(mvUniform, false, mvMatrix);

    // Setze die Normal Matrix
    var normalMatrix = mat4.create();
    mat4.invert(normalMatrix, mvMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
    var nUniform = gl.getUniformLocation(programs[PROGRAM_STONE], "uNormalMatrix");
    gl.uniformMatrix4fv(nUniform, false, normalMatrix);
}