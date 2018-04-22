'use strict'

var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var config = require('config')
var uuidv4 = require('uuid/v4');
var util = require('./util/util.js');

var mapInitialize = false
var players = {}
var mapObjects = []
var treePosition = [{x: 250, y: 400}, 
                    {x: 500, y: 600},
                    {x: 100, y: 200},
                    {x: 400, y: 180},
                    {x: 600, y: 900},
                    {x: 1300, y: 300},
                    {x: 950, y: 320}, 
                    {x: 1400, y: 3600}, 
                    {x: 1650, y: 1000}, 
                    {x: 3500, y: 2500}]
var bushPosition = [{x: 350, y: 1500}, 
                    {x: 350, y: 4000}, 
                    {x: 600, y: 3500}, 
                    {x: 4000, y: 1500}, 
                    {x: 3000, y: 1000}, 
                    {x: 4000, y: 700}, 
                    {x: 1500, y: 2250}, 
                    {x: 3500, y: 730}, 
                    {x: 530, y: 3600}]
var rockPosition = [{x: 700, y: 400}, 
                    {x: 2500, y: 455}, 
                    {x: 1500, y: 360}, 
                    {x: 600, y: 1650}, 
                    {x: 600, y: 3200}, 
                    {x: 2500, y: 1600}, 
                    {x: 2000, y: 2000}]
app.use(express.static(__dirname + '/../client'))

function addTree(coords) {
  var oRadius = util.randomInRange(70, 100)
  var iRadius = (oRadius + 10)
  var sides = util.randomInRange(10, 14)
  mapObjects.push({
    id: uuidv4(),
    type: 'tree',
    x: coords.x,
    y: coords.y,
    oRadius: oRadius,
    iRadius: iRadius,
    sides: sides,
    boundary: iRadius / 3 + 21
  })
}

function addBush(coords) {
  var oRadius = 40
  var iRadius = (oRadius + 2)
  var sides = util.randomInRange(15, 20)
  mapObjects.push({
    id: uuidv4(),
    type: 'bush',
    x: coords.x,
    y: coords.y,
    oRadius: oRadius,
    iRadius: iRadius,
    sides: sides,
    boundary: iRadius + 22
  })
}

function addRock(coords) {
  var radius = util.randomInRange(120, 150)
  mapObjects.push({
    id: uuidv4(),
    type: 'rock',
    x: coords.x,
    y: coords.y,
    radius: radius,
    boundary: radius + 22
  })
}

function initializeMap() {
  var i
  for (i = 0; i < treePosition.length; i++) {
    addTree(treePosition[i])
  }
  for (i = 0; i < bushPosition.length; i++) {
    addBush(bushPosition[i])
  }
  for (i = 0; i < rockPosition.length; i++) {
    addRock(rockPosition[i])
  } 
}

if (!mapInitialize) {
  initializeMap()
}

app.get('/', function(req, res) {
  res.sendFile('index.html', { root: './client/html/' })
})

io.on('connection', function(socket) {
  console.log(socket.id + ' connected')

  players[socket.id] = {
    id: socket.id,
    x: 450,
    y: 450,
    attackAngle: 0,
    equippedWeapon: 'melee',
    lastAttack: new Date(1),
    lastAttackWeapon: '',
    lastAttackDuration: 0
  }

  socket.on('update position', function(id, x, y) {
    if (!isLegalMovement(id, x, y)) {
      return
    }
    x = isWithinArenaBoundsX(id, x)
    y = isWithinArenaBoundsY(id, y)
    var movingIntoObject = isMovingIntoObject(id, x, y, 'none')
    if (movingIntoObject.status) {
      var pushedPosition = pushObjectOut(id, x, y, movingIntoObject)
      if (pushedPosition) {
        players[id].x = pushedPosition.x
        players[id].y = pushedPosition.y
      }
      return
    }
    players[id].x = x
    players[id].y = y
  })

  socket.on('update attack angle', function(id, attackAngle) {
    if (id && attackAngle) {
      players[id].attackAngle = attackAngle
    }
  })

  socket.on('Create Object', function() {
    // var randomVar = util.randomInRange(1, 4)
    // for (var i = 0; i < mapObjects.trees.length; i++) {
    //   if ((trees[i].x <= players[socket.id].x + 100 && trees[i].x >= players[socket.id].x - 100) && (trees[i].y <= players[socket.id].y + 100 && trees[i].y >= players[socket.id].y - 100)) {
    //     return
    //   }
    // }
    // for (var i = 0; i < mapObjects.rocks.length; i++) {
    //   if ((rocks[i].x <= players[socket.id].x + 100 && rocks[i].x >= players[socket.id].x - 100) && (rocks[i].y <= players[socket.id].y + 100 && rocks[i].y >= players[socket.id].y - 100)) {
    //     return
    //   }
    // }
    // for (var i = 0; i < mapObjects.bushes.length; i++) {
    //   if ((bushes[i].x <= players[socket.id].x + 100 && bushes[i].x >= players[socket.id].x - 100) && (bushes[i].y <= players[socket.id].y + 100 && bushes[i].y >= players[socket.id].y - 100)) {
    //     return
    //   }
    // }
    // if (randomVar == 1) {
    //   addRock({x: players[socket.id].x, y: players[socket.id].y})
    // }
    // else if (randomVar == 2) {
    //   addTree({x: players[socket.id].x, y: players[socket.id].y})
    // }
    // else if (randomVar == 3) {
    //   addBush({x: players[socket.id].x, y: players[socket.id].y})
    // }
  })

  socket.on('window resized', function(data) {
    
  })

  socket.on('attack', function(id) {
    if (players[id].equippedWeapon == 'melee') {
      processMeleeAttack(id)
    }
  })

  socket.on('disconnect', function() {
    delete players[socket.id]
    socket.broadcast.emit('player disconnected', socket.id)
  })

  setupGame(socket)
})

var processMeleeAttack = function(id) {
  var now = new Date()
  if (now <= (players[id].lastAttack + players[id].lastAttackDuration)) {
    return
  }
  players[id].lastAttack = now
  players[id].lastAttackWeapon = 'melee'
  players[id].lastAttackDuration = config.get('attackAnimationDuration.melee')
}

var setupGame = function(socket) {
  var specs = {
    gameSpeed: config.get('gameSpeed'),
    gameWidth: config.get('gameWidth'),
    gameHeight: config.get('gameHeight'),
    gridSpacing: config.get('gridSpacing'),
    playerRadius: config.get('playerRadius')
  }
  socket.emit('setup game', specs)
}

var isLegalMovement = function(id, x, y) {
  if (Math.abs(players[id].x - x) > config.get('gameSpeed') + 1) {
    return false
  }
  if (Math.abs(players[id].y - y) > config.get('gameSpeed') + 1) {
    return false
  }
  return true
}

var isMovingIntoObject = function(id, x, y, ignoreId) {
  if (ignoreId != 'none') {
    for (var i = 0; i < mapObjects.length; i++) {
      var object = mapObjects[i]
      if (object.id != ignoreId) {
        var distance = Math.sqrt((object.x - x) * (object.x - x) + (object.y - y) * (object.y - y))
        if (distance <= object.boundary) {
          return { status: true, object: object }
        }
      }
    }
  } else {
    for (var i = 0; i < mapObjects.length; i++) {
      var object = mapObjects[i]
      var distance = Math.sqrt((object.x - x) * (object.x - x) + (object.y - y) * (object.y - y))
      if (distance <= object.boundary) {
        return { status: true, object: object }
      }
    }
  }
  return { status: false, object: undefined }
}

var getSlope = function(x1, y1, x2, y2) {
  if (x1 == x2) {
    x1 = x1 - 1
  }
  return ((y2 - y1) / (x2 - x1))
}

var getIntercept = function(x, y, slope) {
  if (slope == 1000.0) {
    return x
  }
  return y - slope * x
}

var pushObjectOut = function(id, x, y, movingIntoObject) {
  var movingLeft = x < players[id].x
  var movingRight = x > players[id].x
  var movingUp = y < players[id].y
  var movingDown = y > players[id].y

  if (movingUp && movingLeft) {
    if (angle > (Math.PI / 4)) {
      movingUp = false
    }
    else {
      movingLeft = false
    }
  }
  else if (movingUp && movingRight) {
    if (angle > (3 * Math.PI / 4)) {
      movingLeft = false
    }
    else {
      movingUp = false
    }
  }
  else if (movingDown && movingLeft) {
    if (angle > (-1 * Math.PI / 4)) {
      movingLeft = false
    }
    else {
      movingDown = false
    }
  }
  else if (movingDown && movingRight) {
    if (angle > (-3 * Math.PI / 4)) {
      movingDown = false
    }
    else {
      movingRight = false
    }
  }

  var angle = Math.atan2(players[id].y - movingIntoObject.object.y, players[id].x - movingIntoObject.object.x)
  var slope = getSlope(players[id].x, players[id].y, x, y)
  var intercept = getIntercept(players[id].x, players[id].y, slope)
  var tangentDiff = Math.abs(((movingIntoObject.object.y - intercept) / slope) - movingIntoObject.object.x)
  if (movingLeft || movingRight) {
    var tangentDiff = Math.abs((slope * movingIntoObject.object.x + intercept) - movingIntoObject.object.y)
  }
  tangentDiff = tangentDiff / movingIntoObject.object.boundary
  var angleIntensity = tangentDiff + 0.13
  var angleSpeed = 0.1 / (movingIntoObject.object.boundary / 45.0) * angleIntensity

  if (movingUp) {
    if (players[id].x < movingIntoObject.object.x) {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle + angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle + angleSpeed))
    }
    else {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle - angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle - angleSpeed))
    }
  }
  else if (movingDown) {
    if (players[id].x < movingIntoObject.object.x) {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle - angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle - angleSpeed))
    }
    else {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle + angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle + angleSpeed))
    }
  }
  else if (movingLeft) {
    if (players[id].y < movingIntoObject.object.y) {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle - angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle - angleSpeed))
    }
    else {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle + angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle + angleSpeed))
    }
  }
  else if (movingRight) {
    if (players[id].y < movingIntoObject.object.y) {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle + angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle + angleSpeed))
    }
    else {
      var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.boundary * Math.cos(angle - angleSpeed))
      var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.boundary * Math.sin(angle - angleSpeed))
    }
  }
  var movingIntoObject = isMovingIntoObject(id, newx, newy, movingIntoObject.object.id)
  if (!movingIntoObject.status) {
    return { x: newx, y: newy }
  }
}

var isWithinArenaBoundsX = function(id, x) {
  if ((x - config.get('playerRadius')) <= 0) {
    return config.get('playerRadius')
  }
  if ((x + config.get('playerRadius')) >= (0 + config.get('gameWidth'))) {
    return (config.get('gameWidth') - config.get('playerRadius'))
  }
  return x
}

var isWithinArenaBoundsY = function(id, y) {
  if ((y - config.get('playerRadius')) <= 0) {
    return config.get('playerRadius')
  }
  if ((y + config.get('playerRadius')) >= (0 + config.get('gameHeight'))) {
    return (config.get('gameHeight') - config.get('playerRadius'))
  }
  return y
}

var sendGameUpdates = function() {
  io.emit('players', players)
}

var sendMapInfo = function() {
  io.emit('map objects', mapObjects)
}

http.listen(7070, function(err){
  if (err) console.error(err)
  console.log('Listening on port 7070')
})

setInterval(sendGameUpdates, 1000 / 60)
setInterval(sendMapInfo, 1000 / 60)
