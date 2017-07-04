var gl;

var PROGRAM_TRANSFORM = 0;
var PROGRAM_DRAW = 1;

var programs;
var shaderProgram;

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
var cubeImageRed;
var cubeImageBlue;
var cubeImageYellow;
var cubeImageSpace;

var cubeGreen;
var cubeRed;
var cubeBlue;
var cubeYellow;
var spaceBackground;

var perspectiveMatrix;
var mvMatrix;
var perspectiveMatrix;

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

var players = {};
var gameInfo = {
    userid: 0,
    lobby: '',
    field_height: 16,
    field_width: 30,
    field: [],
    username: '',
    score: 0
};

var audio;
var socket;

var level = 1;
var readBinary = false;
var gameRunning = false;

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

    socket.on('moveField', function (data) {
        if (readBinary) {
            var bufView = new Uint8Array(data);
            gameInfo.field = Array.prototype.slice.call(bufView);
        } else {
            gameInfo.field = data.field;
        }
    });

    socket.on('movePlayers', function (data) {
        if (readBinary) {
            var bufView = new Uint16Array(data);
            if (bufView[0] != gameInfo.score)
                updateScore(bufView[0]);
        } else {
            for (var key in data) {
                players[key] = data[key];
            }
        }
    });

    socket.on('moveScore', function (data) {
        if (readBinary) {
            var bufView = new Uint16Array(data);
            if (bufView[0] != gameInfo.score)
                updateScore(bufView[0]);
        } else {
            if (data.score != gameInfo.score)
                updateScore(data.score);
        }
    });

    socket.on('begin', function (data) {
        if (readBinary) {
            var bufView = new Uint8Array(data);
            gameInfo.field = Array.prototype.slice.call(bufView);
            for (i = 0; i < bufView.length; i++) {
                console.log('[' + i + '] = ' + bufView[i]);
            }
        } else {
            gameInfo.field = data.field;
        }
        gameInfo.score = 0;
        level = 1;
        gameRunning = true;
        updateScore(gameInfo.score);
    });

    socket.on('setuser', function(data) {
        gameInfo.username = data.name;
    })

    socket.on('gameover', function() {
        $('#gameover-score').html('Final Score: ' + gameInfo.score);
        $('#game-over').css('display', 'block');
        reset();
    });

    socket.on('dataerror', function() {
        sendAjax('get', '/error', '#content');
    });

    socket.on('setgameinfo', function(data) {
        gameInfo.lobby = data.lobbyname;
        gameInfo.userid = data.id;
        gameInfo.field_width = data.width;
        gameInfo.field_height = data.height;
        gameInfo.username = data.username;
        colourUsername();
    });

    $('#get-lobbies').on('click', function () {
        audio.pause();
    });

    $('#get-scores').on('click', function () {
        audio.pause();
    });

    $(document).keydown(function (e) {
        // A, E, Q, D, S
        if (gameRunning && (e.which == 65 || e.which == 69 || e.which == 81 || e.which == 68 || e.which == 83)) {
            submitmove(e.which, gameInfo.userid);
        } else if (gameRunning && e.which == 27) {
            closeLobby();
        } else if (gameRunning && e.which == 49) {
            level = 1;
            resetBuffer();
        } else if (gameRunning && e.which == 50) {
            level = 2;
            resetBuffer();
        } else if (gameRunning && e.which == 51) {
            level = 3;
            resetBuffer();
        } else if (gameRunning && e.which == 52) {
            level = 4;
            resetBuffer();
        }
    });
});

function closeLobby() {
    socket.emit('endGame', { lobbyname: gameInfo.lobby, userid: gameInfo.userid });
}

function colourUsername() {
    switch (gameInfo.userid) {
        case 0: $('#player-name').css('color', 'green'); break;
        case 1: $('#player-name').css('color', 'red'); break;
        case 2: $('#player-name').css('color', 'blue'); break;
        case 3: $('#player-name').css('color', 'yellow'); break;
        default: break;
    }
}

function updateScore(newScore) {
    if (Math.abs(newScore - gameInfo.score) === gameInfo.field_width) {
        level++;
        $('#leveltext').html('Level: ' + level);
    }
    gameInfo.score = newScore;
    $('#scoretext').html('Score: ' + gameInfo.score);
}

function createLobby(lobby, fwidth, fheight, gspeed) {
    if (gameInfo.username)
        socket.emit('createlobby', { lobbyname: lobby, username: gameInfo.username,
                                     width: fwidth, height: fheight, speed: gspeed });
}

function setPlayerName(name) {
    gameInfo.username = name;
}

function isLoggedIn() {
    return gameInfo.username !== '';
}

function isInGame() {
    return gameInfo.lobby !== '';
}

function reset() {
    $('#player-name').css('color', 'white');
    gameInfo.lobby = '';
    gameInfo.userid = 0;
    gameInfo.field_width = 0;
    gameInfo.field_height = 0;
    gameInfo.score = 0;
    gameRunning = false;
    gameInfo.field = [];
    level = 1;
    players = {};
    audio.pause();
    audio.currentTime = 0;
}

// Send player movement
function submitmove(key) {
    socket.emit('playermove', { key: key, userid: gameInfo.userid, lobbyname: gameInfo.lobby });
}

function joinGame(lobby) {
    if (isInGame() && lobby != gameInfo.lobby) {
        socket.emit('leave', { lobbyname: gameInfo.lobby, userid: gameInfo.userid, username: gameInfo.username });
        reset();
        socket.emit('join', { lobbyname: lobby, username: gameInfo.username });
    } else if (!isInGame()) {
        socket.emit('join', { lobbyname: lobby, username: gameInfo.username });
    }
}

function sendLogin(name) {
    socket.emit('login', { username: name });
}

function sendLogout() {
    socket.emit('logout', { username: gameInfo.username });
}

// Start the game in the current lobby
function startgame() {
    // Creates canvas to draw on
    start();

    // Socket senden
    if (!gameRunning) {
        audio.currentTime = 0;
        socket.emit('startgame', { width: gameInfo.field_width, height: gameInfo.field_height, lobbyname: gameInfo.lobby });
    } else {
        socket.emit('updategame', { lobbyname: gameInfo.lobby });
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

        render();

        //setInterval(render, 15);

        // Initialize the shaders; this is where all the lighting for the
        // vertices and so forth is established.

        /*initShaders();

        // -- Init Program
        program2 = createProgram(gl, getShaderSource('vs'), getShaderSource('fs'));

        // Here's where we call the routine that builds all the objects
        // we'll be drawing.

        initBuffers();

        // Next, load and set up the textures we'll be using.

        initTextures();

        // Set up to draw the scene periodically.

        setInterval(drawScene, 15);*/
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

    var programTransform = gl.createProgram();
    gl.attachShader(programTransform, vshaderTransform);
    gl.deleteShader(vshaderTransform);
    gl.attachShader(programTransform, fshaderTransform);
    gl.deleteShader(fshaderTransform);

    var varyings = ['v_offset', 'v_rotation'];
    gl.transformFeedbackVaryings(programTransform, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(programTransform);

    // check
    var log = gl.getProgramInfoLog(programTransform);
    if (log) {
        console.log(log);
    }

    log = gl.getShaderInfoLog(vshaderTransform);
    if (log) {
        console.log(log);
    }

    // Setup program for draw shader
    var programDraw = createProgram(gl, getShaderSource('vs-draw'), getShaderSource('fs-draw'));

    programs = [programTransform, programDraw];




    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    // Create the shader program

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    //shaderProgram = createProgram(gl, getShaderSource("shader-vs"), getShaderSource("shader-fs"));

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program: " + gl.getProgramInfoLog(shader));
    }

    gl.useProgram(shaderProgram);

    vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(vertexPositionAttribute);

    textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(textureCoordAttribute);

    vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
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
    cubeImageGreen.src = "cubegreen.png";

    cubeRed = gl.createTexture();
    cubeImageRed = new Image();
    cubeImageRed.onload = function () { handleTextureLoaded(cubeImageRed, cubeRed); }
    cubeImageRed.src = "cubered.png";

    cubeBlue = gl.createTexture();
    cubeImageBlue = new Image();
    cubeImageBlue.onload = function () { handleTextureLoaded(cubeImageBlue, cubeBlue); }
    cubeImageBlue.src = "cubeblue.png";

    cubeYellow = gl.createTexture();
    cubeImageYellow = new Image();
    cubeImageYellow.onload = function () { handleTextureLoaded(cubeImageYellow, cubeYellow); }
    cubeImageYellow.src = "cubeyellow.png";

    spaceBackground = gl.createTexture();
    cubeImageSpace = new Image();
    cubeImageSpace.onload = function () { handleTextureLoaded(cubeImageSpace, spaceBackground); }
    cubeImageSpace.src = "The-Edge-of-Space.jpg"; //"Space-Background.png";
}

function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
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

    perspectiveMatrix = makePerspective(45, screenaspect, 0.1, 1000.0);

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    loadIdentity();

    // Now move the drawing position a bit to where we want to start
    // drawing the cube.
    gl.useProgram(shaderProgram);

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

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, spaceBackground);

    mvPushMatrix();
    mvTranslate([0.0, 0.0, -0.15]);

    gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 5);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

    mvPopMatrix();

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

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, NUM_INSTANCES);

    gl.disable(gl.BLEND);

    // DAS IST ALLES SO DUMM !!!
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);


    ///////////////////////////////////////
    // Tetris
    ///////////////////////////////////////
    perspectiveMatrix = makePerspective(45, screenaspect, 0.1, 1000.0);

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    loadIdentity();

    gl.useProgram(shaderProgram);

    var a = gameInfo.field_width / screenaspect > gameInfo.field_height ? gameInfo.field_width / screenaspect + (gameInfo.field_width / screenaspect * 0.1) : gameInfo.field_height + (gameInfo.field_height * 0.1);
    var trans = (a / Math.sin(Math.PI / 8)) * Math.sin(Math.PI / 4 + Math.PI / 8);
    mvTranslate([0.0, 0.0, -trans]);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cubeGreen);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, cubeRed);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, cubeBlue);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, cubeYellow);


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
                if (gameInfo.field[d1 * gameInfo.field_width + d2] > 0 && gameInfo.field[d1 * gameInfo.field_width + d2] < 5) {

                    empty++;
                    // Save the current matrix, then rotate before we draw.
                    mvPushMatrix();
                    mvTranslate([d2 * 2 - gameInfo.field_width + 1, gameInfo.field_height - d1 * 2 - 1, 0]);
                    //mvRotate(cubeRotation, [1, 0, 1]);

                    // Specify the texture to map onto the faces.

                    if (gameInfo.field[d1 * gameInfo.field_width + d2] === 1) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 1);
                    } else if (gameInfo.field[d1 * gameInfo.field_width + d2] === 2) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 2);
                    } else if (gameInfo.field[d1 * gameInfo.field_width + d2] === 3) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 3);
                    } else if (gameInfo.field[d1 * gameInfo.field_width + d2] === 4) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 4);
                    }

                    // Draw the cube.

                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
                    setMatrixUniforms();
                    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

                    // Restore the original matrix

                    mvPopMatrix();
                }
            }
        }
    }

    if (typeof players !== 'undefined') {
        for (var key in players) {
            for (d2 = 0; d2 < players[key].length; d2++) {
                if (players[key][d2] >= 0) {
                    // Save the current matrix, then rotate before we draw.
                    mvPushMatrix();
                    mvTranslate([Math.floor(players[key][d2] % gameInfo.field_width) * 2 - gameInfo.field_width + 1,
                        gameInfo.field_height - Math.floor(players[key][d2] / gameInfo.field_width) * 2 - 1, 0]);
                    //mvRotate(cubeRotation, [1, 0, 1]);

                    // Specify the texture to map onto the faces.
                    var id = parseInt(key);
                    if (id === 1) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 1);
                    } else if (id === 2) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 2);
                    } else if (id === 3) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 3);
                    } else if (id === 4) {
                        gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 4);
                    }

                    // Draw the cube.
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
                    setMatrixUniforms();
                    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

                    // Restore the original matrix
                    mvPopMatrix();
                }
            }
        }
    }

    requestAnimationFrame(render);
}

//
// getShader
//
// Loads a shader program by scouring the current document,
// looking for a script with the specified ID.
//
function getShader(gl, id) {
    var shaderScript = document.getElementById(id);

    // Didn't find an element with the specified ID; abort.

    if (!shaderScript) {
        return null;
    }

    // Walk through the source element's children, building the
    // shader source string.

    var theSource = "";
    var currentChild = shaderScript.firstChild;

    while (currentChild) {
        if (currentChild.nodeType == 3) {
            theSource += currentChild.textContent;
        }

        currentChild = currentChild.nextSibling;
    }

    // Now figure out what type of shader script we have,
    // based on its MIME type.

    var shader;

    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;  // Unknown shader type
    }

    // Send the source to the shader object

    gl.shaderSource(shader, theSource);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

//
// Matrix utility functions
//

function loadIdentity() {
    mvMatrix = Matrix.I(4);
}

function multMatrix(m) {
    mvMatrix = mvMatrix.x(m);
}

function mvTranslate(v) {
    multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}

function setMatrixUniforms() {
    var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

    var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));

    var normalMatrix = mvMatrix.inverse();
    normalMatrix = normalMatrix.transpose();
    var nUniform = gl.getUniformLocation(shaderProgram, "uNormalMatrix");
    gl.uniformMatrix4fv(nUniform, false, new Float32Array(normalMatrix.flatten()));
}

var mvMatrixStack = [];

function mvPushMatrix(m) {
    if (m) {
        mvMatrixStack.push(m.dup());
        mvMatrix = m.dup();
    } else {
        mvMatrixStack.push(mvMatrix.dup());
    }
}

function mvPopMatrix() {
    if (!mvMatrixStack.length) {
        throw ("Can't pop from an empty matrix stack.");
    }
    mvMatrix = mvMatrixStack.pop();
    return mvMatrix;
}

function mvRotate(angle, v) {
    var inRadians = angle * Math.PI / 180.0;
    var m = Matrix.Rotation(inRadians, $V([v[0], v[1], v[2]])).ensure4x4();
    multMatrix(m);
}