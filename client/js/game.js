
var Position = require('./Position')
var Map = require('./Map')
var Player = require('./Player')

$(() => {
  connectToServer()
  initializeCanvas()
  initializePlayers()
  setupClientServerCommunication()
  initializeMap()
  setupKeyListeners()
})

var socket
var canvas
var context
var players
var trees = []
var bushes = []
var rocks = []
var attackAngle
var map
var position
var gameSpecs
var halfScreenWidth
var halfScreenHeight

function connectToServer() {
  socket = io()
}

function initializeCanvas() {
  canvas = $('#canvas')[0]
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  context = canvas.getContext('2d')
}

function initializePlayers() {
  players = {}
  position = new Position()
}

function setupClientServerCommunication() {
  socket.on('setup game', function(data) {
    gameSpecs = {}
    for (key in data) {
      gameSpecs[key] = data[key]
    }
  })

  socket.on('players', function(data) {
    for (id in data) {
      if (id !== 'undefined') {
        players[id] = data[id]
      }
    }
  })

  socket.on('trees', function(data) {
    trees = data
  })

  socket.on('bushes', function(data) {
    bushes = data
  })

  socket.on('rocks', function(data) {
    rocks = data
  })

  socket.on('player disconnected', function(data) {
    delete players[data]
  })
}

function initializeMap() {
  map = new Map(canvas, context)

  resize()
  updateMap()
}

function setupKeyListeners() {
  window.addEventListener('keydown', function (e) {
    map.keys = (map.keys || [])
    map.keys[e.keyCode] = (e.type == 'keydown')
  })
  window.addEventListener('keyup', function (e) {
    map.keys[e.keyCode] = (e.type == 'keydown')  
  })
  window.addEventListener('resize', resize)
  window.addEventListener('click', attack)
  window.addEventListener('mousemove', updateAttackAngle)
}


function processPlayerInput() {
  if (!gameSpecsLoaded()) {
    return
  }
  var addObject = false
  var xspeed = 0
  var yspeed = 0

  if (map.keys && (map.keys[37] || map.keys[65])) {
    xspeed = -1 * gameSpecs.gameSpeed
  }
  if (map.keys && (map.keys[39] || map.keys[68])) {
    xspeed = 1 * gameSpecs.gameSpeed
  }
  if (map.keys && (map.keys[38] || map.keys[87])) {
    yspeed = -1 * gameSpecs.gameSpeed
  }
  if (map.keys && (map.keys[40] || map.keys[83])) {
    yspeed = 1 * gameSpecs.gameSpeed
  }

  if (map.keys && map.keys[32]) {
    socket.emit('Create Object', socket.id)
  }

  if (playerInputShouldBeSent(xspeed, yspeed)) {
    x = players[socket.id].x + xspeed
    y = players[socket.id].y + yspeed
    socket.emit('update position', { id: socket.id, x: x, y: y })

  }
  if (addObject) {
  }

}

function playerInputShouldBeSent(xspeed, yspeed) {
  if (xspeed === 0 && yspeed === 0) {
    return false
  }
  if (!players[socket.id]) {
    return false
  }
  x = players[socket.id].x + xspeed
  y = players[socket.id].y + yspeed
  if (position.newx === x && position.newy === y) {
    return false
  } else {
    position.newx = x
    position.newy = y
    return true
  }
}

function updateMap() {
  requestAnimationFrame(updateMap)
  processPlayerInput()
  map.clear()
  drawBackground()
  drawCoordinateGrid()
  writeCoordinates()
  context.beginPath()
  for (id in players) {
    if (id !== 'undefined') {
      if (id == socket.id) {
        position.currentx = players[id].x
        position.currenty = players[id].y
        drawPlayer()
      } else {
        drawEnemy(players[id])
      }
    }
  }
  trees.forEach(drawTree);
  bushes.forEach(drawBush);
  rocks.forEach(drawRock);
  context.closePath()
}

function drawPlayer() {
  if (!gameSpecsLoaded()) {
    return
  }
  x = halfScreenWidth
  y = halfScreenHeight
  context.lineWidth = 5
  context.fillStyle = 'red'
  context.beginPath()
  context.arc(x, y, gameSpecs.playerRadius, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()
  context.lineWidth = 1
}

function drawEnemy(player) {
  xdiff = players[socket.id].x - player.x
  ydiff = players[socket.id].y - player.y
  x = halfScreenWidth - xdiff
  y = halfScreenHeight - ydiff
  context.fillStyle = 'black'
  context.beginPath()
  context.arc(x, y, 20, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()
}

function drawRock(rock) {
  xdiff = players[socket.id].x - rock.x
  ydiff = players[socket.id].y - rock.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  context.fillStyle = "lightgray"
  context.strokeStyle = "black"
  context.beginPath();
  context.arc(newX, newY, 50, 0 , 2*Math.PI)
  context.closePath()
  context.stroke();
  context.fill();
}

function drawBush(bush) {
  xdiff = players[socket.id].x - bush.x
  ydiff = players[socket.id].y - bush.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  drawStar(newX, newY, bush.oRadius, bush.iRadius, bush.sides, "darkgreen", "darkgreen")
  drawStar(newX, newY, (bush.oRadius * 3)/4, (bush.iRadius * 3) / 4, bush.sides, "green", "green")
  drawStar(newX, newY, bush.oRadius/2, bush.iRadius/2, bush.sides, "lightgreen", "lightgreen")

}

function drawStar(cx, cy, oRadius, iRadius, sides, strokeStyle, fillStyle) {
  var rot=Math.PI/2*3;
  var x=cx;
  var y=cy;
  var step = Math.PI/sides;

  context.beginPath();
  context.moveTo(cx,cy-oRadius)
  for(i=0; i<sides; i++){
    x=cx+Math.cos(rot)*oRadius;
    y=cy+Math.sin(rot)*oRadius;
    context.lineTo(x,y)
    rot+=step

    x=cx+Math.cos(rot)*iRadius;
    y=cy+Math.sin(rot)*iRadius;
    context.lineTo(x,y)
    rot+=step
  }
  context.lineTo(cx,cy-oRadius);
  context.closePath();
  context.lineWidth=5;
  context.strokeStyle = strokeStyle;
  context.stroke();
  context.fillStyle = fillStyle;
  context.fill();
    
}

function drawTree(tree) {
  xdiff = players[socket.id].x - tree.x
  ydiff = players[socket.id].y - tree.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  drawStar(newX, newY, tree.oRadius, tree.iRadius, tree.sides, 'green', 'rgba(0,80,0,.9)')
  drawStar(newX, newY, (tree.oRadius/3), (tree.iRadius/3), tree.sides, 'rgb(73, 51, 0)', 'rgb(84, 51, 0)')

}


function drawBackground() {
  context.beginPath()
  context.fillStyle = "rgb(153, 255, 102)"
  context.fillRect(0,0,canvas.width,canvas.height)
  context.fill()
}

function writeCoordinates() {
  context.beginPath()
  context.fillStyle = "white"
  context.fillRect(canvas.width - 250, 0, canvas.width, 30)
  context.fillStyle = "black"

  context.fillText("x: " + position.currentx + ", y: " + position.currenty + " angle: " + attackAngle, canvas.width - 240, 15)
  context.fill()
}


function drawCoordinateGrid() {
  if (!gameSpecsLoaded()) {
    return
  }

  context.lineWidth = 1
  context.strokeStyle = 'black'
  context.globalAlpha = 0.15

  xoffset = (position.currentx - halfScreenWidth) % gameSpecs.gridSpacing
  for (var x = -xoffset; x <= window.innerWidth; x += gameSpecs.gridSpacing) {
    context.moveTo(x, 0)
    context.lineTo(x, window.innerHeight)
  }

  yoffset = (position.currenty - halfScreenHeight) % gameSpecs.gridSpacing
  for (var y = -yoffset; y < window.innerHeight; y += gameSpecs.gridSpacing) {
    context.moveTo(0, y)
    context.lineTo(window.innerWidth, y)
  }

  context.stroke()
  context.globalAlpha = 1

  context.lineWidth = 5
  context.strokeStyle = 'black'
  context.globalAlpha = 0.3
  context.beginPath()

  if (halfScreenWidth > position.currentx) {
    x = halfScreenWidth - position.currentx
    topy = 0
    bottomy = 0
    if (halfScreenHeight > position.currenty) {
      topy = halfScreenHeight - position.currenty
    } else {
      topy = 0
    }
    if ((halfScreenHeight + position.currenty) > gameSpecs.gameHeight) {
      bottomy = halfScreenHeight + gameSpecs.gameHeight - position.currenty
    } else {
      bottomy = window.innerHeight
    }
    topy -= 2
    bottomy += 2
    context.moveTo(x, topy)
    context.lineTo(x, bottomy)
  }

  if ((halfScreenWidth + position.currentx) > gameSpecs.gameWidth) {
    x = halfScreenWidth + gameSpecs.gameWidth - position.currentx
    topy = 0
    bottomy = 0
    if (halfScreenHeight > position.currenty) {
      topy = halfScreenHeight - position.currenty
    } else {
      topy = 0
    }
    if ((halfScreenHeight + position.currenty) > gameSpecs.gameHeight) {
      bottomy = halfScreenHeight + gameSpecs.gameHeight - position.currenty
    } else {
      bottomy = window.innerHeight
    }
    topy -= 2
    bottomy += 2
    context.moveTo(x, topy)
    context.lineTo(x, bottomy)
  }

  if (halfScreenHeight > position.currenty) {
    y = halfScreenHeight - position.currenty
    leftx = 0
    rightx = 0
    if (halfScreenWidth > position.currentx) {
      leftx = halfScreenWidth - position.currentx
    } else {
      leftx = 0
    }
    if ((halfScreenWidth + position.currentx) > gameSpecs.gameWidth) {
      rightx = halfScreenWidth + gameSpecs.gameWidth - position.currentx
    } else {
      rightx = window.innerWidth
    }
    leftx -= 2
    rightx += 2
    context.moveTo(leftx, y)
    context.lineTo(rightx, y)
  }

  if ((halfScreenHeight + position.currenty) > gameSpecs.gameHeight) {
    y = halfScreenHeight + gameSpecs.gameHeight - position.currenty
    leftx = 0
    rightx = 0
    if (halfScreenWidth > position.currentx) {
      leftx = halfScreenWidth - position.currentx
    } else {
      leftx = 0
    }
    if ((halfScreenWidth + position.currentx) > gameSpecs.gameWidth) {
      rightx = halfScreenWidth + gameSpecs.gameWidth - position.currentx
    } else {
      rightx = window.innerWidth
    }
    leftx -= 2
    rightx += 2
    context.moveTo(leftx, y)
    context.lineTo(rightx, y)
  }

  context.stroke()
  context.lineWidth = 1
  context.globalAlpha = 1
}

function resize() {
  if (!socket) {
    return
  }
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  halfScreenWidth = window.innerWidth / 2
  halfScreenHeight = window.innerHeight / 2
  socket.emit('window resized', { width: window.innerWidth, height: window.innerHeight });
}

function attack(event) {
  if (!socket) {
    return
  }
  socket.emit('attack', { angle: attackAngle })
}

function updateAttackAngle(event) {
  xdiff = (event.clientX - halfScreenWidth)
  ydiff = (halfScreenHeight - event.clientY)
  radians = Math.atan2(ydiff, xdiff)
  if (radians < 0) {
    radians += 2 * Math.PI
  }
  attackAngle = radians * (180 / Math.PI)
}

function gameSpecsLoaded() {
  if (gameSpecs) {
    return true
  }
  return false
}
