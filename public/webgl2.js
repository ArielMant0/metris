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

var cubeGreen;
var spaceBackground;
var cubeBorder;
var frame;

var perspectiveMatrix;
var mvMatrix;

// -- Initialize data
var NUM_INSTANCES = 1000;
var currentSourceIdx = 0;

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

var curScene = 0;
var vertexArrayMaps;

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
    stone_drop: [-1, -1, -1, -1]
};

var audio;
var socket;

var level = 1;
var readBinary = false;
var gameRunning = false;
var spectator = false;

$(document).ready(function () {
    // WebSocket
    socket = io();
    // Main music for the game
    audio = new Audio('MUSIC.mp3');

    audio.onended = function () {
      audio.currentTime = 7;
      audio.play();
    };

    reset();

    socket.on('music', function () {
        var audio2 = new Audio('MUSIC2.mp3');
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
            if (lvl != level)
                updateLevel(lvl);
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

    socket.on('leaveroom', function() {
        socket.emit('leave', gameInfo.lobby, gameInfo.userid, gameInfo.username);
    });

    socket.on('leftgame', function() {
        reset();
    });

    socket.on('loggedout', function() {
        reset();
        gameInfo.username = '';
    })

    socket.on('loggedin', function(name) {
        gameInfo.username = name;
    })

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

    $(document).keydown(function (e) {
        // A, E, Q, D, S
        if (!spectator && gameRunning && (e.which == 65 || e.which == 69 || e.which == 81 || e.which == 68 || e.which == 83))
            submitmove(e.which, gameInfo.userid);
        else if (gameRunning && e.which == 27)
            closeLobby();
    });
});

function watchAsSpectator(lobbyname) {
    socket.emit('spectate', lobbyname);
}

function closeLobby() {
    socket.emit('endGame', { lobbyname: gameInfo.lobby, userid: gameInfo.userid });
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
    var tmp = [true, true, true, true]
    var found = false;
    for (i = 0; i < 4; i++) {
        for (j = 0; j < 4; j++) {
            if (players[gameInfo.userid][i] + gameInfo.field_width === players[gameInfo.userid][j] || players[gameInfo.userid][i] === -1)
                tmp[i] = false;
        }
    }

    for (k = 0; k < 4; k++) {
        if (tmp[k] === true) {
            var max_h = gameInfo.field_height - Math.floor(players[gameInfo.userid][k] / gameInfo.field_width)
            for (l = 0; l < max_h; l++) {
                if (gameInfo.field[players[gameInfo.userid][k] + (l + 1) * gameInfo.field_width] > 0 || l === max_h - 1) {
                    if (!found || players[gameInfo.userid][0] + l * gameInfo.field_width < gameInfo.stone_drop[0]) {
                    gameInfo.stone_drop =
                        [players[gameInfo.userid][0] + l * gameInfo.field_width,
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

function createLobbyFixed(lobby, fwidth, fheight, maxplayers) {
    if (gameInfo.username)
        socket.emit('createlobbyfixed', lobby, gameInfo.username, fwidth, fheight, maxplayers);
}

function createLobby(lobby) {
    if (gameInfo.username)
        socket.emit('createlobby', lobby, gameInfo.username);
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

function reset(killfield=true) {
    $('#player-name').css('color', 'white');
    gameInfo.lobby = '';
    gameInfo.userid = -1;
    gameInfo.field_width = 0;
    gameInfo.field_height = 0;
    gameInfo.score = 0;
    gameInfo.stone_drop = [-1, -1, -1, -1];
    gameRunning = false;
    level = 1;
    players = [];
    spectator = false;

    if (killfield) {
        audio.pause();
        audio.currentTime = 0;
        gameInfo.field = [];
    }
}

// Send player movement
function submitmove(key) {
    socket.emit('playermove', gameInfo.lobby, key, gameInfo.userid);
}

function joinGame(lobby) {
    if (isInGame() && lobby != gameInfo.lobby) {
        alert('You must leave your current game before joining another one!');
        return false;
    } else if (!isInGame()) {
        socket.emit('join', lobby, gameInfo.username);
        return true;
    }
}

function leaveGame() {
    socket.emit('leave', gameInfo.lobby, gameInfo.userid, gameInfo.username);
}

function sendLogin(name) {
    socket.emit('login', name);
}

function sendLogout() {
    socket.emit('logout', gameInfo.username, gameInfo.userid);
}

// Start the game in the current lobby
function startgame() {
    // Creates canvas to draw on
    start();

    // Socket senden
    if (!gameRunning) {
        audio.currentTime = 0;
        socket.emit('startgame', gameInfo.lobby);
    } else {
        socket.emit('updategame', gameInfo.lobby);
    }

    audio.play();
}

// Called when the canvas is created to get the ball rolling.
function start() {
    'use strict';

    initWebGL();      // Initialize the GL context

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

        initModels();

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

    // Setup program for draw shader
    var programPartDraw = createProgram(gl, getShaderSource('vs-draw'), getShaderSource('fs-draw'));

    var programStone = createProgram(gl, getShaderSource('stone-vs'), getShaderSource('stone-fs'));

    var programModel = createProgram(gl, getShaderSource('model-vs'), getShaderSource('model-fs'));

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
    cubeImageGreen.src = "assets/cubegreen.png";

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
}

function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function initModels() {

    // -- Load gltf
    var gltfUrl = "/assets/border.gltf";
    var glTFLoader = new MinimalGLTFLoader.glTFLoader();

    glTFLoader.loadGLTF(gltfUrl, function(glTF) {

        curScene = glTF.scenes[glTF.defaultScene];

        // -- Initialize vertex array
        var POSITION_LOCATION = 0; // set with GLSL layout qualifier
        var NORMAL_LOCATION = 1; // set with GLSL layout qualifier
        var TEXCOORD_LOCATION = 2;
        vertexArrayMaps = {};

        // var in loop
        var mesh;
        var primitive;
        var vertexBuffer2;
        var indicesBuffer2;
        var vertexArray2;
        var i, len;

        for (var mid in curScene.meshes) {

            mesh = curScene.meshes[mid];
            vertexArrayMaps[mid] = [];

            for (i = 0, len = mesh.primitives.length; i < len; ++i) {

                primitive = mesh.primitives[i];

                // create buffers
                vertexBuffer2 = gl.createBuffer();
                indicesBuffer2 = gl.createBuffer();

                // WebGL2: create vertexArray
                vertexArray2 = gl.createVertexArray();
                vertexArrayMaps[mid].push(vertexArray2);

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

function resetBuffer() {
    for (var i = 0; i < NUM_INSTANCES; ++i) {
        var oi = i * 2;
        var ri = i;
        var ci = i * 3;

        // beides i ODER beides 0 oder i + 0
        //instanceOffsets[oi] = Math.random() * 2.0 - 1.0;
        //instanceOffsets[oi + 1] = Math.random() * 2.0 - 1.0;

        instanceRotations[i] = i / (NUM_INSTANCES / 2.0) * 2.0 * Math.PI;


        if (level === 1) {
            if (i < NUM_INSTANCES / 2) {
                instanceOffsets[oi] = 0.0;
                instanceOffsets[oi + 1] = 0.0;
            } else {
                instanceOffsets[oi] = 0.675 * Math.cos(instanceRotations[i - NUM_INSTANCES / 2]);
                instanceOffsets[oi + 1] = 0.675 * Math.sin(instanceRotations[i - NUM_INSTANCES / 2]);
            }
        } else if (level == 2) {
            instanceOffsets[oi] = 0.0;
            instanceOffsets[oi + 1] = 0.0;
        } else if (level == 3) {
            instanceOffsets[oi] = Math.random() * Math.cos(instanceRotations[i - NUM_INSTANCES / 2]);
            instanceOffsets[oi + 1] = Math.random() * Math.sin(instanceRotations[i - NUM_INSTANCES / 2]);
        } else if (level == 4) {
            instanceRotations[i] = (3.0/2.0) * Math.PI;

            instanceOffsets[oi] = Math.random() * 2.0 - 1.0;
            instanceOffsets[oi + 1] = Math.random() * 2.0 + 0.7;
        }
    }

    for (var va = 0; va < vertexArrays.length; ++va) {
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
    // Set the viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear color buffer
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    // Establish the perspective with which we want to view the
    // scene. Our field of view is 45 degrees, with a width/height
    // ratio of 640:480, and we only want to see objects between 0.1 units
    // and 100 units away from the camera.
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
    // Background
    ///////////////////////////////////////
    gl.disable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, spaceBackground);

    translate = vec3.create();
    vec3.set(translate, 0, 0, -0.15);

    mvMatrix = mat4.create();
    mat4.translate(mvMatrix, mvMatrix, translate);

    gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_STONE], "uSampler"), 2);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.DEPTH_TEST);


    ///////////////////////////////////////
    // ParticleSystem
    ///////////////////////////////////////
    initParticleSystem2();

    // Rotate/Move triangles
    transform();

    gl.bindVertexArray(vertexArrays[currentSourceIdx]);

    // Attributes per-instance when drawing sets back to 1 when drawing instances
    gl.vertexAttribDivisor(OFFSET_LOCATION, 1);
    gl.vertexAttribDivisor(ROTATION_LOCATION, 1);

    gl.useProgram(programs[PROGRAM_DRAW]);

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Set uniforms
    var time = Date.now();
    gl.uniform1f(drawTimeLocation, time);
    gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_DRAW], "uSampler"), 2);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, NUM_INSTANCES);

    gl.disable(gl.BLEND);

    // DAS IST ALLES SO DUMM !!!
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);

    gl.bindVertexArray(null);

    ///////////////////////////////////////
    // Models
    ///////////////////////////////////////
    var a = gameInfo.field_width / screenaspect > gameInfo.field_height ? gameInfo.field_width / screenaspect + (gameInfo.field_width / screenaspect * 0.1) : gameInfo.field_height + (gameInfo.field_height * 0.1);
    var trans = (a / Math.sin(Math.PI / 8)) * Math.sin(Math.PI / 4 + Math.PI / 8);

    var uniformMVLocations = gl.getUniformLocation(programs[PROGRAM_MODEL], "uMVMatrix");
    var uniformMvNormalLocations = gl.getUniformLocation(programs[PROGRAM_MODEL], "mvNormal");
    var uniformPLocations = gl.getUniformLocation(programs[PROGRAM_MODEL], "uPMatrix");

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, frame);

    gl.useProgram(programs[PROGRAM_MODEL]);

    // -- Render preparation
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    var rotatationY = Math.PI / 2.0;

    var localMV;
    var localMVP;
    var localMVNormal;
    var modelView;
    var scale;
    var translate;

    for (h = 0; h < 4; h++) {
        localMV = mat4.create();
        localMVP = mat4.create();
        localMVNormal = mat4.create();

        translate = vec3.create();
        if (h === 0)
            vec3.set(translate, gameInfo.field_width + 1, 0, -trans);
        else if (h === 1)
            vec3.set(translate, -gameInfo.field_width - 1, 0, -trans);
        else if (h === 2)
            vec3.set(translate, 0, gameInfo.field_height + 1, -trans);
        else if (h === 3)
            vec3.set(translate, 0, -gameInfo.field_height - 1, -trans);

        scale = vec3.create();
        var scale_r;
        if (h === 0 || h === 1)
            scale_r = gameInfo.field_height / 10.0; // breite, tiefe, höhe
        else
            scale_r = gameInfo.field_width / 10.0;
        vec3.set(scale, 1.0, 1.0, scale_r);

        modelView = mat4.create();

        mat4.translate(modelView, modelView, translate);

        //mat4.rotateZ(modelView, modelView, rotatationY);
        mat4.rotateX(modelView, modelView, rotatationY);
        if (h === 2 || h === 3)
            mat4.rotateY(modelView, modelView, rotatationY);

        mat4.scale(modelView, modelView, scale);

        for (var mid in curScene.meshes) {
            mesh = curScene.meshes[mid];

            for (i = 0, len = mesh.primitives.length; i < len; ++i) {
                primitive = mesh.primitives[i];

                mat4.multiply(localMV, modelView, primitive.matrix);

                mat4.invert(localMVNormal, localMV);
                mat4.transpose(localMVNormal, localMVNormal);

                gl.bindVertexArray(vertexArrayMaps[mid][i]);

                gl.uniformMatrix4fv(uniformMVLocations, false, localMV);
                gl.uniformMatrix4fv(uniformMvNormalLocations, false, localMVNormal);
                gl.uniformMatrix4fv(uniformPLocations, false, perspectiveMatrix);
                gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_MODEL], "uSampler"), 3);

                gl.uniform1fv(gl.getUniformLocation(programs[PROGRAM_MODEL], "scale"), [scale_r]);

                gl.drawElements(primitive.mode, primitive.indices.length, primitive.indicesComponentType, 0);

                gl.bindVertexArray(null);
            }
        }
    }


    ///////////////////////////////////////
    // Tetrisfield
    ///////////////////////////////////////
    gl.useProgram(programs[PROGRAM_STONE]);

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

    var empty = 0;
    if (typeof gameInfo.field !== 'undefined') {
        for (d1 = gameInfo.field_height-1; d1 >= 0 && empty < gameInfo.field_width; d1--) {
            empty = 0;
            for (d2 = gameInfo.field_width-1; d2 >= 0; d2--) {
                if (gameInfo.field[d1 * gameInfo.field_width + d2] > 0) { //&& gameInfo.field[d1 * gameInfo.field_width + d2] < 5) {

                    empty++;

                    translate = vec3.create();
                    vec3.set(translate, d2 * 2 - gameInfo.field_width + 1, gameInfo.field_height - d1 * 2 - 1, -trans);

                    mvMatrix = mat4.create();
                    mat4.translate(mvMatrix, mvMatrix, translate);

                    // Specify the texture to map onto the faces.
                    gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_STONE], "uSampler"), 1);
                    gl.uniform3fv(gl.getUniformLocation(programs[PROGRAM_STONE], "uColor"), [colors[gameInfo.field[d1 * gameInfo.field_width + d2]-1].r,
                                                                                             colors[gameInfo.field[d1 * gameInfo.field_width + d2]-1].g,
                                                                                             colors[gameInfo.field[d1 * gameInfo.field_width + d2]-1].b]);

                    // Draw the cube.
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
                    setMatrixUniforms();

                    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
                }
            }
        }
    }

    if (typeof players !== 'undefined') {
        for (i = 0; i < players.length; i++) {
            for (d2 = 0; d2 < players[i].length; d2++) {
                if (players[i][d2] >= 0) {

                    translate = vec3.create();
                    vec3.set(translate,
                        Math.floor(players[i][d2] % gameInfo.field_width) * 2 - gameInfo.field_width + 1,
                        gameInfo.field_height - Math.floor(players[i][d2] / gameInfo.field_width) * 2 - 1,
                        -trans);

                    mvMatrix = mat4.create();
                    mat4.translate(mvMatrix, mvMatrix, translate);

                    // Specify the texture to map onto the faces.
                    gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_STONE], "uSampler"), 1);
                    gl.uniform3fv(gl.getUniformLocation(programs[PROGRAM_STONE], "uColor"), [colors[i].r, colors[i].g, colors[i].b]);

                    // Draw the cube.
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
                    setMatrixUniforms();
                    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
                }
            }
        }
    }

    ///////////////////////////////////////
    // gameInfo.stone_drop
    ///////////////////////////////////////
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    if (typeof gameInfo.stone_drop !== 'undefined') {
        for (i = 0; i < gameInfo.stone_drop.length; i++) {
            if (gameInfo.stone_drop[i] >= 0) {

                translate = vec3.create();
                vec3.set(translate,
                    Math.floor(gameInfo.stone_drop[i] % gameInfo.field_width) * 2 - gameInfo.field_width + 1,
                    gameInfo.field_height - Math.floor(gameInfo.stone_drop[i] / gameInfo.field_width) * 2 - 1,
                    -trans);

                mvMatrix = mat4.create();
                mat4.translate(mvMatrix, mvMatrix, translate);

                gl.uniform1i(gl.getUniformLocation(programs[PROGRAM_STONE], "uSampler"), 4);
                gl.uniform3fv(gl.getUniformLocation(programs[PROGRAM_STONE], "uColor"), [colors[gameInfo.userid].r,
                                                                                         colors[gameInfo.userid].g,
                                                                                         colors[gameInfo.userid].b]);

                // Draw the cube.
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);

                setMatrixUniforms();
                gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
            }
        }
    }
    gl.disable(gl.BLEND);

    requestAnimationFrame(render);
}

//
// Set Matrix
//
function setMatrixUniforms() {
    var pUniform = gl.getUniformLocation(programs[PROGRAM_STONE], "uPMatrix");
    gl.uniformMatrix4fv(pUniform, false, perspectiveMatrix);

    var mvUniform = gl.getUniformLocation(programs[PROGRAM_STONE], "uMVMatrix");
    gl.uniformMatrix4fv(mvUniform, false, mvMatrix);

    var normalMatrix = mat4.create();
    mat4.invert(normalMatrix, mvMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
    var nUniform = gl.getUniformLocation(programs[PROGRAM_STONE], "uNormalMatrix");
    gl.uniformMatrix4fv(nUniform, false, normalMatrix);
}