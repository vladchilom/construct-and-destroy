'use strict'

var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var config = require('config')
var uuidv4 = require('uuid/v4')
var util = require('./util/util.js')
var map = require('../config/map.json').map

var sockets = {}
var players = {}
app.use(express.static(__dirname + '/../client'))

app.get('/', function(req, res) {
  res.sendFile('index.html', { root: './client/html/' })
})

io.on('connection', function(socket) {
  console.log(socket.id + ' connected')
  sockets[socket.id] = socket

  socket.emit('request screen size')

  players[socket.id] = {
    id: socket.id,
    x: 450,
    y: 450,
    halfScreenWidth: config.get('gameWidth') / 2,
    halfScreenHeight: config.get('gameHeight') / 2,
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

  socket.on('window resized', function(id, halfScreenWidth, halfScreenHeight) {
    players[id].halfScreenWidth = halfScreenWidth
    players[id].halfScreenHeight = halfScreenHeight
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
    for (var i = 0; i < map.length; i++) {
      var object = map[i]
      if (object.id != ignoreId) {
        var distance = Math.sqrt((object.x - x) * (object.x - x) + (object.y - y) * (object.y - y))
        if (distance <= object.boundary) {
          return { status: true, object: object }
        }
      }
    }
  } else {
    for (var i = 0; i < map.length; i++) {
      var object = map[i]
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
    if (isWithinArenaBounds(id, newx, newy)) {
      return { x: newx, y: newy }
    }
  }
}

var isWithinArenaBounds = function(id, x, y) {
  if ((x - config.get('playerRadius')) <= 0) {
    return false
  }
  if ((x + config.get('playerRadius')) >= (0 + config.get('gameWidth'))) {
    return false
  }
  if ((y - config.get('playerRadius')) <= 0) {
    return false
  }
  if ((y + config.get('playerRadius')) >= (0 + config.get('gameHeight'))) {
    return false
  }
  return true
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

var objectIsVisible = function(object, player) {
  if (!object.visibleRadius) {
    object.visibleRadius = config.get('playerRadius')
  }
  if ((object.x + object.visibleRadius) >= (player.x - player.halfScreenWidth)) {
    if ((object.x - object.visibleRadius) <= (player.x + player.halfScreenWidth)) {
      if ((object.y + object.visibleRadius) >= (player.y - player.halfScreenHeight)) {
        if ((object.y - object.visibleRadius) <= (player.y + player.halfScreenHeight)) {
          return true
        }
      }
    }
  }
  return false
}

var sendGameUpdates = function() {
  for (var me in players) {
    var visiblePlayers = {}
    for (var id in players) {
      if (me == id) {
        visiblePlayers[me] = players[me]
      } else {
        if (objectIsVisible(players[id], players[me])) {
          visiblePlayers[id] = players[id]
        }
      }
    }
    sockets[me].emit('players', visiblePlayers)
  }
}

var sendMapInfo = function() {
  for (var id in players) {
    var visibleObjects = map.filter(function(object) {
      return objectIsVisible(object, players[id])
    })
    sockets[id].emit('map objects', visibleObjects)
  }
}

http.listen(7070, function(err){
  if (err) console.error(err)
  console.log('Listening on port 7070')
})

setInterval(sendGameUpdates, 1000 / 60)
setInterval(sendMapInfo, 1000 / 60)
