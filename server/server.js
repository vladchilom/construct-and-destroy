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
  sockets[socket.id] = socket
  players[socket.id] = makeNewPlayer(socket)

  socket.on('set name', function(name) {
    players[socket.id].name = name
    players[socket.id].x = 450
    players[socket.id].y = 450
    players[socket.id].ready = true
    socket.emit('ready')
    console.log(name + ' connected')
  })

  socket.emit('request screen size')

  socket.on('update position', function(id, x, y) {
    if (!isLegalMovement(id, x, y)) {
      return
    }
    if (players[id].health <= 0) {
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
    if (players[id].health <= 0) {
      return
    }
    if (id && attackAngle) {
      players[id].attackAngle = attackAngle
    }
  })

  socket.on('window resized', function(id, halfScreenWidth, halfScreenHeight) {
    players[id].halfScreenWidth = halfScreenWidth
    players[id].halfScreenHeight = halfScreenHeight
  })

  socket.on('attack', function(id) {
    if (players[id].health <= 0) {
      return
    }
    if (players[id].equippedWeapon == 'melee') {
      processMeleeAttack(id)
    }
    if (players[id].equippedWeapon == 'build') {
      processBuild(id)
    }
    if (players[id].equippedWeapon == 'pistol') {
      processPistol(id)
    }
  })

  socket.on('swap weapon', function(id, weapon) {
    if (players[id].health <= 0) {
      return
    }
    var playerHasWeapon = false
    for (var i = 0; i < players[id].weapons.length; i++) {
      if (players[id].weapons[i] === weapon) {
        playerHasWeapon = true
      }
    }
    if (!playerHasWeapon) {
      return
    }
    else {
      players[id].equippedWeapon = weapon
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
    ready: false,
    name: 'dennis',
    type: 'player',
    health: 100,
    lastHealth: 100,
    materials: 0,
    kills: 0,
    deaths: 0,
    x: util.randomInRange(400, 450),
    y: util.randomInRange(400, 450),
    halfScreenWidth: config.get('gameWidth') / 2,
    halfScreenHeight: config.get('gameHeight') / 2,
    attackAngle: 0,
    equippedWeapon: 'melee',
    weapons: ['melee', 'build', 'pistol'],
    lastAttack: new Date(1),
    lastAttackWeapon: '',
    lastAttackDuration: 0,
    lastDied: new Date(1),
    lastDamaged: new Date(1)
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

var processPistol = function(id) {
  var now = new Date()
  if (now <= new Date(players[id].lastAttack.getTime() + players[id].lastAttackDuration)) {
    return
  }
  players[id].lastAttack = now
  players[id].lastAttackWeapon = 'pistol'
  players[id].lastAttackDuration = config.get('attackAnimationDuration.pistol')
  addPistolProjectile(players[id])
}

function addWall(coords, height, width) {
  var uuid = uuidv4()
  var visibleRadius = Math.max(height, width)
  map[uuid] = {
    id: uuid,
    type: 'wall',
    x: coords.x,
    y: coords.y,
    maxhealth: 120,
    currentHealth: 120,
    visibleRadius: visibleRadius,
    height: height,
    width: width,
    disabled: false,
    currentHealth: 50
  }
}

var processBuild = function(id) {
  var now = new Date()
  if (now <= new Date(players[id].lastAttack.getTime() + players[id].lastAttackDuration)) {
    return
  }
  players[id].lastAttack = now
  players[id].lastAttackWeapon = 'build'
  players[id].lastAttackDuration = config.get('attackAnimationDuration.build')

  var angle = players[id].attackAngle
  var half
  var xQuadrant = Math.floor((players[id].x) / config.gridSpacing)
  var yQuadrant = Math.floor((players[id].y) / config.gridSpacing)
  if (angle > Math.PI && angle < 2 * Math.PI) {
    var interceptChecker = (yQuadrant + 1) * config.gridSpacing
    half = false
  }
  else if (angle > 0 && angle < Math.PI) {
    var interceptChecker = (yQuadrant) * config.gridSpacing
    half = true
  }
  else {
    return
  }
  var xAxisWhichWall = (interceptChecker - getIntercept(players[id].x, players[id].y, Math.tan(-angle))) / Math.tan(-angle)
    if (players[id].materials >= 10) {
      if (((angle > (3*Math.PI)/2 && angle < 2*Math.PI) || (angle > 0 && angle < Math.PI/2)) && (xAxisWhichWall > (xQuadrant + 1) * config.gridSpacing)) {
        console.log("RightSide", xAxisWhichWall, (xQuadrant + 1) * config.gridSpacing, angle/Math.PI + "pi", getIntercept(players[id].x, players[id].y, Math.tan(angle)))
        for (var objectId in map) {
          var object = map[objectId]
          if (object.type == 'wall') {
            if (object.x == ((xQuadrant + 1) * config.gridSpacing) - 12 && object.y == (yQuadrant) * config.gridSpacing && object.width == 25 && object.height == config.gridSpacing) {
              return
            }
          }
        }
        players[id].materials = players[id].materials - 10

        addWall({x: ((xQuadrant + 1) * config.gridSpacing) - 12, y: (yQuadrant) * config.gridSpacing}, config.gridSpacing, 25)
      }
      else if ((angle > (Math.PI/2) && angle < (3*Math.PI/2)) && (xAxisWhichWall < (xQuadrant) * config.gridSpacing)) {
        for (var objectId in map) {
          var object = map[objectId]
          if (object.type == 'wall') {
            if (object.x == (xQuadrant * config.gridSpacing) - 12 && object.y == (yQuadrant) * config.gridSpacing && object.width == 25 && object.height == config.gridSpacing) {
              return
            }
          }
        }
        players[id].materials = players[id].materials - 10

        addWall({x: (xQuadrant * config.gridSpacing) - 12, y: (yQuadrant) * config.gridSpacing}, config.gridSpacing, 25)
        console.log("Left")
      }
      else if (half) {
        for (var objectId in map) {
          var object = map[objectId]
          if (object.type == 'wall') {
            if (object.x == (xQuadrant * config.gridSpacing) && object.y == ((yQuadrant) * config.gridSpacing) - 12 && object.width == config.gridSpacing && object.height == 25) {
              return
            }
          }
        }
        players[id].materials = players[id].materials - 10

        addWall({x: (xQuadrant * config.gridSpacing), y: (yQuadrant) * config.gridSpacing - 12}, 25, config.gridSpacing)
        console.log("Up")
      }
      else {
        for (var objectId in map) {
          var object = map[objectId]
          if (object.type == 'wall') {
            if (object.x == (xQuadrant * config.gridSpacing) && object.y == (yQuadrant + 1) * config.gridSpacing - 12 && object.width == config.gridSpacing && object.height == 25) {
              return
            }
          }
        }
        players[id].materials = players[id].materials - 10
        addWall({x: (xQuadrant * config.gridSpacing), y: (yQuadrant + 1) * config.gridSpacing - 12}, 25, config.gridSpacing)
        console.log("Down")
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

var addPistolProjectile = function(player) {
  var x = player.x + (config.get('playerRadius') + 12) * Math.cos(-player.attackAngle)
  var y = player.y + (config.get('playerRadius') + 12) * Math.sin(-player.attackAngle)
  var projectile = {
    id: uuidv4(),
    sentBy: player.id,
    x: x,
    y: y,
    direction: player.attackAngle,
    type: 'pistol',
    damage: config.get('attackDamage.pistol'),
    radius: config.get('attackRadius.pistol'),
    speed: config.get('attackTravelSpeed.pistol'),
    color: config.get('attackColor.pistol')
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
  for (var objectId in map) {
    map[objectId].lastDamaged = new Date(1)
  }
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
  // if (ignoreId == 'none') {
    for (var id in map) {
      var object = map[id]
      if (object.type == 'armory') {
        for (var i = 0; i < object.walls.length; i++) {
          if ((x + config.get('playerRadius') > object.walls[i].x) && (x - config.get('playerRadius') < object.walls[i].x + object.walls[i].width) && (y - config.get('playerRadius') < object.walls[i].y + object.walls[i].height && (y + config.get('playerRadius') > object.walls[i].y))) {
              return {status: true, object: object.walls[i]}
          } 
        }
      }
      else if (object.type == 'wall') {
        // we on that "can't build walls on fences fortnite" status right now
        if ((x + config.get('playerRadius') > object.x) && (x - config.get('playerRadius') < object.x + object.width) && (y - config.get('playerRadius') < object.y + object.height && (y + config.get('playerRadius') > object.y))) {
          return {status: true, object: object}
        }
      }
      if (object.id != ignoreId) {
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
    var obj = movingIntoObject.object
    var movingLeft = x < players[id].x
    var movingRight = x > players[id].x
    var movingUp = y < players[id].y
    var movingDown = y > players[id].y
  if (movingIntoObject.object.type == 'wall') {
    if (x + config.get('playerRadius') > obj.x && x - config.get('playerRadius') < obj.x && y + config.get('playerRadius') > obj.y && y - config.get('playerRadius') < obj.y + obj.height) {
      var newx = obj.x - config.get('playerRadius')
      var newy = y  
    }
    else if (x - config.get('playerRadius') < obj.x + obj.width && x + config.get('playerRadius') > obj.x + obj.width && y + config.get('playerRadius') > obj.y && y - config.get('playerRadius') < obj.y + obj.height) {
      var newx = obj.x + obj.width + config.get('playerRadius')
      var newy = y
    }
    if (y - config.get('playerRadius') < obj.y + obj.height && y - config.get('playerRadius') > obj.y + obj.height - 2*config.get('playerRadius') && (x + config.get('playerRadius') > obj.x && x - config.get('playerRadius') < obj.x + obj.width)) {
      var newx = x
      var newy = obj.y + obj.height + config.get('playerRadius')
      

    }
    else if (y + config.get('playerRadius') > obj.y && y + config.get('playerRadius') < obj.y + 2*config.get('playerRadius') && ((x + config.get('playerRadius') > obj.x && x - config.get('playerRadius') < obj.x + obj.width))) {
     
      var newx = x
      var newy = obj.y - config.get('playerRadius')
      
    }

    // if (x > obj.x && x < obj.x + obj.width && y > obj.y && y < obj.y + obj.height) {
    //   var xQuadrant = Math.floor((players[id].x) / config.gridSpacing)
    //   var yQuadrant = Math.floor((players[id].y) / config.gridSpacing)
    //   var xmod = players[id].x % config.gridSpacing
    //   var ymod = players[id].y % config.gridSpacing
    //   if (ymod < 25) {
    //     var newy = players[id].y + 30
    //   }
    //   else if (ymod > 175) {
    //     var newy = players[id].y - 30
    //   }
    //   else {
    //     var newy = y
    //   }
    //   if (xmod < 30) {
    //     var newx = players[id].x + 30
    //   }
    //   else if (xmod > 175) {
    //     var newx = players[id].x - 30
    //   }
    //   else {
    //     var newx = x
    //   }
    // }
    // else {

    // }
    // if (movingLeft) {
    //   var newx = Math.round(movingIntoObject.object.x + movingIntoObject.object.width + config.get('playerRadius'))
    //   var newy = y
    // }
    // else if (movingRight) {
    //   var newx = Math.round(movingIntoObject.object.x - config.get('playerRadius'))
    //   var newy = y

    // }

    // if (movingUp) {
    //   var newy = Math.round(movingIntoObject.object.y + movingIntoObject.object.height + config.get('playerRadius'))
    //   var newx = players[id].x

    // }
    // else if (movingDown) {
    //   var newy = Math.round(movingIntoObject.object.y - config.get('playerRadius'))
    //   var newx = players[id].x


    // }
  }
  

  else {
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

var projectileIsVisible = function(projectile, player) {
  if ((projectile.x + projectile.radius) >= (player.x - player.halfScreenWidth)) {
    if ((projectile.x - projectile.radius) <= (player.x + player.halfScreenWidth)) {
      if ((projectile.y + projectile.radius) >= (player.y - player.halfScreenHeight)) {
        if ((projectile.y - projectile.radius) <= (player.y + player.halfScreenHeight)) {
          return true
        }
      }
    }
  }
  return false
}

var projectileIsInObject = function(projectile, object) {
  if (object.type == 'wall') {    
    if ((projectile.x + projectile.radius > object.x) && (projectile.x - projectile.radius < object.x + object.width) && (projectile.y - projectile.radius < object.y + object.height && (projectile.y + projectile.radius > object.y))) {
      return true;        
    }
  }
  else {
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
  } 
  return false;
}

var projectileIsInPlayer = function(projectile, player) {
  if (!player.ready || player.health <= 0) {
    return false;
  }
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
  if ((projectile.x - projectile.radius) < 0 || (projectile.x + projectile.radius) > config.get('gameWidth')) {
    return true
  }
  if ((projectile.y - projectile.radius) < 0 || (projectile.y + projectile.radius) > config.get('gameHeight')) {
    return true
  }
  return false
}

var moveProjectile = function(projectileId) {
  var newx = projectiles[projectileId].x + projectiles[projectileId].speed * Math.cos(projectiles[projectileId].direction)
  var newy = projectiles[projectileId].y - projectiles[projectileId].speed * Math.sin(projectiles[projectileId].direction)
  projectiles[projectileId].x = newx
  projectiles[projectileId].y = newy
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
  if (map[objectId].type == 'wall') {
    damageWall(projectileId, objectId)
  }
}

var damageArmoryWall = function(projectileId, armoryObjectId, index) {
  var newHealth = map[armoryObjectId].walls[index].currentHealth - projectiles[projectileId].damage + 0.0
  if (newHealth > 0) {
   map[armoryObjectId].walls[index].currentHealth = newHealth
  }
  else {
    map[armoryObjectId].walls[index].currentHealth = newHealth
    map[armoryObjectId].walls[index].x = 0
    map[armoryObjectId].walls[index].y = 0
    map[armoryObjectId].walls[index].width = 0
    map[armoryObjectId].walls[index].height = 0
    map[armoryObjectId].walls[index].disabled = true
  }
}

var damageWall = function(projectileId, objectId) {
  var newHealth = map[objectId].currentHealth - projectiles[projectileId].damage + 0.0
  map[objectId].lastDamaged = new Date()
  if (newHealth > 0) {
    map[objectId].currentHealth = newHealth
  }
  else {
    map[objectId].currentHealth = newHealth
    map[objectId].x = 0
    map[objectId].y = 0
    map[objectId].width = 0
    map[objectId].height = 0
    map[objectId].disabled = true
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
    map[objectId].lastDamaged = new Date()
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
    map[objectId].lastDamaged = new Date()
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
    map[objectId].lastDamaged = new Date()
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
  if (players[playerId].health <= 0 ) {
    return
  }
  var newHealth = players[playerId].health - projectiles[projectileId].damage + 0.0
  if (newHealth > 0) {
    players[playerId].health = newHealth
    players[playerId].lastDamaged = new Date()
  } else {
    players[playerId].health = 0
    players[playerId].deaths += 1
    players[playerId].lastDied = new Date()
    sockets[playerId].emit('dead')
    players[projectiles[projectileId].sentBy].kills += 1
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

var respawnPlayers = function() {
  for (var id in players) {
    if (players[id].health <= 0) {
      var now = new Date()
      if (now <= new Date(players[id].lastDied.getTime() + 3000)) {
        return
      }
      players[id].health = 100
      players[id].x = util.randomInRange(400, 450)
      players[id].y = util.randomInRange(400, 450)
      players[id].lastDied = now
      sockets[id].emit('respawn')
    } else {
      if (players[id].health < players[id].lastHealth) {
        players[id].lastHealth = players[id].health
      }
    }
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

var sendLeaderboardInfo = function() {
  var topPlayers = ['none', 'none', 'none', 'none']
  var currentMax = -1
  var currentPlayer = 'none'
  for (var playerId in players) {
    if (players[playerId].ready && players[playerId].kills > currentMax) {
      currentMax = players[playerId].kills
      currentPlayer = playerId
    }
  }
  if (currentPlayer != 'none') {
    topPlayers[0] = currentPlayer
  }

  currentMax = -1
  currentPlayer = 'none'
  for (var playerId in players) {
    if (players[playerId].ready && playerId != topPlayers[0] && players[playerId].kills > currentMax) {
      currentMax = players[playerId].kills
      currentPlayer = playerId
    }
  }
  if (currentPlayer != 'none') {
    topPlayers[1] = currentPlayer
  }

  currentMax = -1
  currentPlayer = 'none'
  for (var playerId in players) {
    if (players[playerId].ready && playerId != topPlayers[0] && playerId != topPlayers[1] && players[playerId].kills > currentMax) {
      currentMax = players[playerId].kills
      currentPlayer = playerId
    }
  }
  if (currentPlayer != 'none') {
    topPlayers[2] = currentPlayer
  }

  currentMax = -1
  currentPlayer = 'none'
  for (var playerId in players) {
    if (players[playerId].ready && playerId != topPlayers[0] && playerId != topPlayers[1] && playerId != topPlayers[2] && players[playerId].kills > currentMax) {
      currentMax = players[playerId].kills
      currentPlayer = playerId
    }
  }
  if (currentPlayer != 'none') {
    topPlayers[3] = currentPlayer
  }

  var topStats = ['none', 'none', 'none', 'none']
  for (var i = 0; i < topStats.length; i++) {
    if (players[topPlayers[i]]) {
      topStats[i] = players[topPlayers[i]].name + ' (' + players[topPlayers[i]].kills + ')'
    }
  }
  io.emit('leaderboard info', topStats)
}

var sendProjectiles = function() {
  for (var playerId in players) {
    var visibleProjectiles = {}
    for (var projectileId in projectiles) {
      if (projectileIsVisible(projectiles[projectileId], players[playerId])) {
        visibleProjectiles[projectileId] = projectiles[projectileId]
      }
    }
    sockets[playerId].emit('projectiles', visibleProjectiles)
  }
}

var processProjectiles = function() {
  for (var projectileId in projectiles) {
    var projectileDeleted = false
    loop1:
    for (var objectId in map) {
      if (map[objectId].type != 'grave') {
        if (map[objectId].type == 'armory') {
          for (var i = 0; i < map[objectId].walls.length; i++) {
            if (projectileIsInObject(projectiles[projectileId], map[objectId].walls[i])) {
              damageArmoryWall(projectileId, objectId, i)
              delete projectiles[projectileId]
              projectileDeleted = true
              break loop1;
            }
          }
        }
        else if (projectileIsInObject(projectiles[projectileId], map[objectId])) {
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
    if (!projectileDeleted) {
      moveProjectile(projectileId)
    }
  }
}

http.listen(7070, function(err){
  if (err) console.error(err)
  console.log('Listening on port 7070')
})

setInterval(respawnPlayers, 1000/ 60)
setInterval(sendGameUpdates, 1000 / 60)
setInterval(sendMapInfo, 1000 / 60)
setInterval(sendProjectiles, 1000 / 60)
setInterval(processProjectiles, 1000 / 60)
setInterval(sendLeaderboardInfo, 300)
