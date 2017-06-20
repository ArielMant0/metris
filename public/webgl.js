var canvas;
var gl;

var cubeVerticesBuffer;
var cubeVerticesTextureCoordBuffer;
var cubeVerticesIndexBuffer;
var cubeVerticesIndexBuffer;
var cubeRotation = 0.0;
var lastCubeUpdateTime = 0;

var cubeImageGreen;
var cubeImageRed;
var cubeImageBlue;
var cubeImageYellow;

var cubeGreen;
var cubeRed;
var cubeBlue;
var cubeYellow;

var mvMatrix;
var shaderProgram;
var vertexPositionAttribute;
var vertexNormalAttribute;
var textureCoordAttribute;
var perspectiveMatrix;

var gameInfo = function() {
  this.userid = 0;
  this.lobby = '';
  this.field_height = 16;
  this.field_width = 30;
  this.field = [];
}

var audio;
var socket;
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

    socket.on('music', function () {
        var audio2 = new Audio('MUSIC2.mp3');
        audio2.play();
    });

    socket.on('move', function (data) {
        gameInfo.field = data.field;
    });

    socket.on('begin', function (data) {
        gameInfo.field = data.field;
        gameRunning = true;
    });

    socket.on('setgameinfo', function(data) {
        gameInfo.lobby = data.lobbyname;
        gameInfo.userid = data.id;
        gameInfo.field_width = data.width;
        gameInfo.field_height = data.height;
    });

    $(document).keydown(function (e) {
        // Enter
        // if (!gameRunning && e.which == 13)
            // startgame();
        // A, E, Q, D, S
        if (gameRunning && (e.which == 65 || e.which == 69 || e.which == 81 || e.which == 68 || e.which == 83))
            submitmove(e.which);
    });
});

// Send player movement
function submitmove(key) {
    socket.emit('playermove', { key: key, userid: gameInfo.userid, lobbyname: gameInfo.lobby });
}

// Start the game in the current lobby
function startgame() {
    // Creates canvas to draw on
    start();

    // Socket senden
    if (!gameRunning)
        socket.emit('startgame', { width: gameInfo.field_width, height: gameInfo.field_height, lobbyname: gameInfo.lobby });
    else
        socket.emit('updategame', { lobbyname: gameInfo.lobby });

    audio.play();
}

// Called when the canvas is created to get the ball rolling.
function start() {

    initWebGL();      // Initialize the GL context

    // Only continue if WebGL is available and working

    if (gl) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

        // Initialize the shaders; this is where all the lighting for the
        // vertices and so forth is established.
        initShaders();

        // Here's where we call the routine that builds all the objects
        // we'll be drawing.
        initBuffers();

        // Next, load and set up the textures we'll be using.
        initTextures();

        // Set up to draw the scene periodically.
        setInterval(drawScene, 15);
    }
}

//
// initWebGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initWebGL() {

    gl = null;

    try {
        gl = document.getElementById('glcanvas').getContext("experimental-webgl");

        window.addEventListener('resize', resizeCanvas, false);

        resizeCanvas();

        function resizeCanvas() {
            gl.canvas.width = window.innerWidth;
            gl.canvas.height = window.innerHeight * 0.85;
            drawScene();
        }
    }
    catch (e) {
    }

    // If we don't have a GL context, give up now

    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
    }
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
}

function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

//
// drawScene
//
// Draw the scene.
//
function drawScene() {
    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Establish the perspective with which we want to view the
    // scene. Our gameInfo.field of view is 45 degrees, with a width/height
    // ratio of 640:480, and we only want to see objects between 0.1 units
    // and 100 units away from the camera.

    var screenaspect = window.innerWidth / window.innerHeight;

    perspectiveMatrix = makePerspective(45, screenaspect, 0.1, 1000.0);

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.

    loadIdentity();

    // Now move the drawing position a bit to where we want to start
    // drawing the cube.

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

    for (d1 = 0; d1 < gameInfo.field_height; d1++) {
        for (d2 = 0; d2 < gameInfo.field_width; d2++) {
            if (gameInfo.field[d1 * gameInfo.field_width + d2] > 0 && gameInfo.field[d1 * gameInfo.field_width + d2] < 5) {

                // Save the current matrix, then rotate before we draw.
                mvPushMatrix();
                mvTranslate([d2 * 2 - gameInfo.field_width + 1, gameInfo.field_height - d1 * 2 - 1, 0]);
                //mvRotate(cubeRotation, [1, 0, 1]);

                // Draw the cube by binding the array buffer to the cube's vertices
                // array, setting attributes, and pushing it to GL.

                gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);
                gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

                // Set the texture coordinates attribute for the vertices.

                gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
                gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

                // Bind the normals buffer to the shader attribute.

                gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesNormalBuffer);
                gl.vertexAttribPointer(vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

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

    // Update the rotation for the next draw, if it's time to do so.
    /*
    var currentTime = (new Date).getTime();
    if (lastCubeUpdateTime) {
        var delta = currentTime - lastCubeUpdateTime;

        cubeRotation += (30 * delta) / 1000.0;
    }

    lastCubeUpdateTime = currentTime;*/
}

//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    // Create the shader program

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

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