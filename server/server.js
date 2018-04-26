'use strict'

var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var config = require('config')
var uuidv4 = require('uuid/v4')
var util = require('./util/util.js')
var map = require('../config/map.json')
var minimap = require('../config/minimap.json')

var sockets = {}
var players = {}
var projectiles = {}
app.use(express.static(__dirname + '/../client'))

app.get('/', function(req, res) {
  res.sendFile('index.html', { root: './client/html/' })
})

io.on('connection', function(socket) {
  console.log(socket.id + ' connected')
  sockets[socket.id] = socket

  players[socket.id] = makeNewPlayer(socket)

  socket.emit('request screen size')

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

  socket.on('build', function(id) {
    if (players[id].equippedWeapon == 'melee') {
      processBuild(id);
    }
  })

  socket.on('disconnect', function() {
    delete players[socket.id]
    socket.broadcast.emit('player disconnected', socket.id)
  })

  setupGame(socket)
})

var makeNewPlayer = function(socket) {
  return {
    id: socket.id,
    name: 'Dennis',
    type: 'player',
    health: 100,
    materials: 0,
    kill: 0,
    x: 450,
    y: 450,
    halfScreenWidth: config.get('gameWidth') / 2,
    halfScreenHeight: config.get('gameHeight') / 2,
    attackAngle: 0,
    equippedWeapon: 'melee',
    lastAttack: new Date(1),
    lastAttackWeapon: '',
    lastAttackDuration: 0,
    lastBuildDuration: 0,
    lastBuild: new Date(1)

  }
}

var processMeleeAttack = function(id) {
  var now = new Date()
  if (now <= new Date(players[id].lastAttack.getTime() + players[id].lastAttackDuration)) {
    return
  }
  players[id].lastAttack = now
  players[id].lastAttackWeapon = 'melee'
  players[id].lastAttackDuration = config.get('attackAnimationDuration.melee')
  addMeleeProjectile(players[id])
}

function addWall(coords, height, width) {
  var uuid = uuidv4()
  map[uuid] = {
    id: uuid,
    type: 'wall',
    x: coords.x,
    y: coords.y,
    maxhealth: 120,
    currenthealth: 120,
    visibleRadius: 512,
    height: height,
    width: width
  }
}

var processBuild = function(id) {
  // the reason for build animation delay is to prevent macro scripting...because as the #1 game streamed on twitch this is important
  var now = new Date()
  if (now <= new Date(players[id].lastBuild.getTime() + players[id].lastBuildDuration)) {
    return
  }
  players[id].lastBuild = now
  players[id].lastAttackWeapon = 'melee' // change to wrench/whatever at later date
  players[id].lastBuildDuration = config.get('attackAnimationDuration.build')
  console.log(map)

  // get player xQuadrant and yQuadrant
  var angle = players[id].attackAngle // reduce typing
  var half
  var xQuadrant = Math.floor((players[id].x) / config.gridSpacing)
  var yQuadrant = Math.floor((players[id].y) / config.gridSpacing)
  if (angle > Math.PI && angle < 2 * Math.PI) {
    var interceptChecker = (yQuadrant + 1) * config.gridSpacing
    half = false // if on top
  }
  else if (angle > 0 && angle < Math.PI) {
    var interceptChecker = (yQuadrant) * config.gridSpacing
    half = true
  }
  else {
    // else you are you getting a perfect angle...probably not possible.
    return
  }
  // following codes not optimal
  // but just wanted to get it to work.
  var xAxisWhichWall = (interceptChecker - getIntercept(players[id].x, players[id].y, Math.tan(-angle))) / Math.tan(-angle)
  if ((angle > (3*Math.PI)/2 && angle < 2*Math.PI) || (angle > 0 && angle < Math.PI/2)) {
    if (xAxisWhichWall > (xQuadrant + 1) * config.gridSpacing) {
      console.log("RightSide", xAxisWhichWall, (xQuadrant + 1) * config.gridSpacing, angle/Math.PI + "pi", getIntercept(players[id].x, players[id].y, Math.tan(angle)))
      addWall({x: (xQuadrant + 1) * config.gridSpacing - 12, y: (yQuadrant) * config.gridSpacing}, config.gridSpacing, 25)
    }
    else {
      if (half) {
        addWall({x: (xQuadrant * config.gridSpacing), y: (yQuadrant) * config.gridSpacing - 12}, 25, config.gridSpacing)
      }
      else {
        addWall({x: (xQuadrant * config.gridSpacing), y: (yQuadrant + 1) * config.gridSpacing - 12}, 25, config.gridSpacing)
      }
    }
  }
  else {
    if (xAxisWhichWall < (xQuadrant) * config.gridSpacing) {
      addWall({x: (xQuadrant * config.gridSpacing) - 12, y: (yQuadrant) * config.gridSpacing}, config.gridSpacing, 25)
    }
    else {
      if (half) {
        addWall({x: (xQuadrant * config.gridSpacing), y: (yQuadrant) * config.gridSpacing - 12}, 25, config.gridSpacing)
      }
      else {
        addWall({x: (xQuadrant * config.gridSpacing), y: (yQuadrant + 1) * config.gridSpacing - 12}, 25, config.gridSpacing)
      }
    }

  }
}

var addMeleeProjectile = function(player) {
  var x = player.x + (config.get('playerRadius') + 12) * Math.cos(-player.attackAngle)
  var y = player.y + (config.get('playerRadius') + 12) * Math.sin(-player.attackAngle)
  var projectile = {
    id: uuidv4(),
    sentBy: player.id,
    x: x,
    y: y,
    direction: player.attackAngle,
    type: 'melee',
    damage: config.get('attackDamage.melee'),
    radius: config.get('attackRadius.melee'),
    speed: config.get('attackTravelSpeed.melee'),
    color: config.get('attackColor.melee')
  }
  projectiles[projectile.id] = projectile
}

var setupGame = function(socket) {
  var specs = {
    gameSpeed: config.get('gameSpeed'),
    gameWidth: config.get('gameWidth'),
    gameHeight: config.get('gameHeight'),
    gridSpacing: config.get('gridSpacing'),
    playerRadius: config.get('playerRadius'),
    minimap: minimap
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
    for (var id in map) {
      var object = map[id]
      if (object.id != ignoreId) {
        var distance = Math.sqrt((object.x - x) * (object.x - x) + (object.y - y) * (object.y - y))
        if (distance <= object.boundary) {
          return { status: true, object: object }
        }
      }
    }
  } else {
    for (var id in map) {
      var object = map[id]
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

var projectileIsInObject = function(projectile, object) {
  var boundary = object.boundary
  if (projectile.type == 'melee') {
    boundary = boundary - config.get('playerRadius')
  }
  var centerDiff = Math.sqrt((projectile.x - object.x) * (projectile.x - object.x) + (projectile.y - object.y) * (projectile.y - object.y))
  if (centerDiff >= Math.abs(boundary - projectile.radius)) {
    if (centerDiff <= (boundary + projectile.radius)) {
      return true;
    }
  }
  return false;
}

var projectileIsInPlayer = function(projectile, player) {
  var centerDiff = Math.sqrt((projectile.x - player.x) * (projectile.x - player.x) + (projectile.y - player.y) * (projectile.y - player.y))
  if (centerDiff <= (config.get('playerRadius') + projectile.radius)) {
    return true;
  }
  return false;
}

var projectileExpired = function(projectile) {
  if (projectile.speed == 0) {
    return true
  }
  return false
}

var damageObject = function(projectileId, objectId) {
  if (map[objectId].type == 'tree') {
    damageTree(projectileId, objectId)
  }
  if (map[objectId].type == 'rock') {
    damageRock(projectileId, objectId)
  }
  if (map[objectId].type == 'bush') {
    damageBush(projectileId, objectId)
  }
}

var damageTree = function(projectileId, objectId) {
  var newHealth = map[objectId].currentHealth - projectiles[projectileId].damage + 0.0
  if (projectiles[projectileId].type == 'melee') {
    players[projectiles[projectileId].sentBy].materials += util.randomInRange(9, 14)
  }
  if (newHealth > 0) {
    var sizeFactor = 1.0
    if (newHealth >= 50) {
      sizeFactor = 0.9
    } else if (newHealth >= 40) {
      sizeFactor = 0.83
    } else if (newHealth >= 30) {
      sizeFactor = 0.76
    } else if (newHealth >= 20) {
      sizeFactor = 0.70
    } else if (newHealth >= 10) {
      sizeFactor = 0.65
    } else {
      sizeFactor = 0.63
    }
    var newBoundary = map[objectId].maxBoundary * sizeFactor
    var newIRadius = Math.max((newBoundary - 22) * 3 + 5, 5)
    var newORadius = newIRadius - 10
    map[objectId].currentHealth = newHealth
    map[objectId].boundary = newBoundary
    map[objectId].iRadius = newIRadius
    map[objectId].oRadius = newORadius
  } else {
    var grave = {
      id: uuidv4(),
      type: 'grave',
      x: map[objectId].x,
      y: map[objectId].y,
      radius: map[objectId].iRadius / 2,
      boundary: 0
    }
    map[grave.id] = grave
    map[objectId].currentHealth = newHealth
    map[objectId].boundary = 0
    map[objectId].iRadius = 0
    map[objectId].oRadius = 0
  }
}

var damageRock = function(projectileId, objectId) {
  var newHealth = map[objectId].currentHealth - projectiles[projectileId].damage + 0.0
  if (projectiles[projectileId].type == 'melee') {
    players[projectiles[projectileId].sentBy].materials += util.randomInRange(5, 9)
  }
  if (newHealth > 0) {
    var sizeFactor = 1.0
    if (newHealth >= 80) {
      sizeFactor = 0.9
    } else if (newHealth >= 70) {
      sizeFactor = 0.83
    } else if (newHealth >= 60) {
      sizeFactor = 0.76
    } else if (newHealth >= 50) {
      sizeFactor = 0.70
    } else if (newHealth >= 40) {
      sizeFactor = 0.65
    } else if (newHealth >= 30) {
      sizeFactor = 0.61
    } else if (newHealth >= 20) {
      sizeFactor = 0.57
    } else if (newHealth >= 10) {
      sizeFactor = 0.53
    } else {
      sizeFactor = 0.50
    }
    var newBoundary = map[objectId].maxBoundary * sizeFactor
    var newRadius = newBoundary - 22
    map[objectId].currentHealth = newHealth
    map[objectId].boundary = newBoundary
    map[objectId].radius = newRadius
  } else {
    var grave = {
      id: uuidv4(),
      type: 'grave',
      x: map[objectId].x,
      y: map[objectId].y,
      radius: map[objectId].radius / 2,
      boundary: 0
    }
    map[grave.id] = grave
    map[objectId].currentHealth = newHealth
    map[objectId].boundary = 0
    map[objectId].radius = 0
  }
}

var damageBush = function(projectileId, objectId) {
  var newHealth = map[objectId].currentHealth - projectiles[projectileId].damage + 0.0
  if (projectiles[projectileId].type == 'melee') {
    players[projectiles[projectileId].sentBy].materials += util.randomInRange(8, 11)
  }
  if (newHealth > 0) {
    var sizeFactor = 1.0
    if (newHealth >= 20) {
      sizeFactor = 0.9
    } else if (newHealth >= 10) {
      sizeFactor = 0.84
    } else {
      sizeFactor = 0.79
    }
    var newBoundary = map[objectId].maxBoundary * sizeFactor
    var newIRadius = newBoundary - 22
    var newORadius = newIRadius - 2
    map[objectId].currentHealth = newHealth
    map[objectId].boundary = newBoundary
    map[objectId].iRadius = newIRadius
    map[objectId].oRadius = newORadius
  } else {
    var grave = {
      id: uuidv4(),
      type: 'grave',
      x: map[objectId].x,
      y: map[objectId].y,
      radius: map[objectId].iRadius / 2,
      boundary: 0
    }
    map[grave.id] = grave
    map[objectId].currentHealth = newHealth
    map[objectId].boundary = 0
    map[objectId].iRadius = 0
    map[objectId].oRadius = 0
  }
}

var damagePlayer = function(projectileId, playerId) {
  var newHealth = players[playerId].health - projectiles[projectileId].damage + 0.0
  if (newHealth > 0) {
    players[playerId].health = newHealth
  } else {
    console.log("DEAD")
  }
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
  for (var playerId in players) {
    var visibleObjects = {}
    for (var objectId in map) {
      if (objectIsVisible(map[objectId], players[playerId])) {
        visibleObjects[objectId] = map[objectId]
      }
    }
    sockets[playerId].emit('map objects', visibleObjects)
  }
}

var sendProjectiles = function() {
  io.emit('projectiles', projectiles)
}

var processProjectiles = function() {
  for (var projectileId in projectiles) {
    var projectileDeleted = false
    for (var objectId in map) {
      if (map[objectId].type != 'grave') {
        if (projectileIsInObject(projectiles[projectileId], map[objectId])) {
          damageObject(projectileId, objectId)
          delete projectiles[projectileId]
          projectileDeleted = true
          break
        }
      }
    }
    if (!projectileDeleted) {
      for (var playerId in players) {
        if (playerId != projectiles[projectileId].sentBy) {
          if (projectileIsInPlayer(projectiles[projectileId], players[playerId])) {
            console.log(projectiles[projectileId], players[playerId])
            damagePlayer(projectileId, playerId)
            delete projectiles[projectileId]
            projectileDeleted = true
            break
          }
        }
      }
    }
    if (!projectileDeleted && projectileExpired(projectiles[projectileId])) {
      delete projectiles[projectileId]
      break
    }
  }
}

http.listen(7070, function(err){
  if (err) console.error(err)
  console.log('Listening on port 7070')
})

setInterval(sendGameUpdates, 1000 / 60)
setInterval(sendMapInfo, 1000 / 60)
setInterval(sendProjectiles, 1000 / 60)
setInterval(processProjectiles, 1000 / 60)
