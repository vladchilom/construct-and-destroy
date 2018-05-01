(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

class Map {

  constructor(canvas, context) {
    this.canvas = canvas
    this.context = context
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

}

module.exports = Map

},{}],2:[function(require,module,exports){

class Player {

  constructor(id, x, y, canvas, context) {
    this.id = id
    this.x = x
    this.y = y
    this.canvas = canvas
    this.context = context
    this.radius = 80
    this.color = 'black'
  }

  draw() {
    this.context.fillStyle = this.color
    this.context.beginPath()
    this.context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
    this.context.closePath()
    this.context.stroke()
    this.context.fill()
  }

}

module.exports = Player

},{}],3:[function(require,module,exports){

class Position {

  constructor() {
    this.currentx = window.innerWidth / 2
    this.currenty = window.innerHeight / 2
    this.newx = 0
    this.newy = 0
    this.currentAttackAngle = 0
    this.newAttackAngle = 0
  }

}

module.exports = Position

},{}],4:[function(require,module,exports){

var Position = require('./Position')
var Map = require('./Map')
var Player = require('./Player')

//setInterval(drawHUDMiniMap, 1000)

$(() => {
  //showLoadingDiv()
  showWelcomeDiv()
  processNameInput()
  loadImages()
  loadSounds()
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
var minimapDrawn = false

var minimapImage
var materialImage
var meleeImage
var buildImage
var hammerImage
var pistolImage
var graveImage

var pistolSound
var punchSound
var damageObjectSound
var buildSound
var moveSound
var swapToPistolSound
var swapToBuildSound
var swapToPunchSound
var emptyMaterialsSound

var players
var trees = []
var bushes = []
var rocks = []
var armories = []
var walls = []

var graves = []
var projectiles = []

var weapon = 'melee'
var position

var map
var gameSpecs
var leaderboardData
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

  socket.on('request screen size', function() {
    resize()
  })

  socket.on('ready', function() {
    hideWelcomeDiv()
  })

  socket.on('respawn', function() {
    hideRespawnDiv()
  })

  socket.on('leaderboard info', function(leaderboardInfo) {
    leaderboardData = leaderboardInfo
  })

  socket.on('players', function(data) {
    for (id in data) {
      if (id !== 'undefined') {
        if (players[id]) {
          currentAttackState = players[id].inAttackState
          currentRandomVariable = players[id].attackStateRandomVariable
          players[id] = data[id]
          if (currentAttackState) {
            players[id].inAttackState = currentAttackState
            players[id].attackStateRandomVariable = currentRandomVariable
          } else {
            players[id].attackStateRandomVariable = 0
          }
        } else {
          players[id] = data[id]
        }
      }
    }
  })

  socket.on('map objects', function(data) {
    trees = []
    bushes = []
    rocks = []
    graves = []
    armories = []
    walls = []
    for (objectId in data) {
      if (data[objectId].type == 'tree') {
        trees.push(data[objectId])
      }
      else if (data[objectId].type == 'bush') {
        bushes.push(data[objectId])
      }
      else if (data[objectId].type == 'rock') {
        rocks.push(data[objectId])
      }
      else if (data[objectId].type == 'grave') {
        graves.push(data[objectId])
      }
      else if (data[objectId].type == 'armory') {
        armories.push(data[objectId])
      }
      else if (data[objectId].type == 'wall') {
        walls.push(data[objectId])
      }
    }
  })

  socket.on('projectiles', function(data) {
    projectiles = data
  })

  socket.on('player disconnected', function(data) {
    delete players[data]
  })
}

function loadSounds() {
  pistolSound = new Audio('../sound/pistolSound.wav')
  punchSound = new Audio('../sound/punchSound.flac')
  damageObjectSound = new Audio('../sound/damageObject.wav')
  buildSound = new Audio('../sound/buildSound.wav')
  moveSound = new Audio('../sound/moveSound.wav')
  swapToPistolSound = new Audio('../sound/swapToPistolSound.wav')
  swapToBuildSound = new Audio('../sound/swapToBuildSound.flac')
  swapToPunchSound = new Audio('../sound/swapToPunchSound.wav')
  emptyMaterialsSound = new Audio('../sound/emptyMaterials.wav')
}

function loadImages() {
  materialImage = new Image()
  materialImage.src = '../img/wood3.png'
  minimapImage = new Image()
  minimapImage.src = '../img/minimap.png'
  meleeImage = new Image()
  meleeImage.src = '../img/melee2.png'
  buildImage = new Image()
  buildImage.src = '../img/build.png'
  hammerImage = new Image()
  hammerImage.src = '../img/hammer.png'
  pistolImage = new Image()
  pistolImage.src = '../img/pistol.png'
  graveImage = new Image()
  graveImage.src = '../img/grave.png'
}

function showLoadingDiv() {
  $('#loading-div').show()
  var bar = new ProgressBar.Line('#loading-bar', { easing: 'easeInOut', strokeWidth: 0.5, duration: 2500, color: '#000000' })
  bar.animate(1)
  setTimeout(() => {
    $('#loading-div').hide()
  }, 2500)
}

function showWelcomeDiv() {
  $('#welcome-div').show()
}

function hideWelcomeDiv() {
  $('#welcome-div').hide()
}


function showRespawnDiv() {
  $('#respawn-div').show()
}

function hideRespawnDiv() {
  $('#respawn-div').hide()
}

function processNameInput() {
  $('#inputName').submit(function(event) {
      if (!socket || !socket.id) {
        return
      }
      event.preventDefault()
      if ($('#textInputName').val().length != 0) {
        socket.emit('set name', $('#textInputName').val())
      }
  });
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
  if (!socket || !socket.id || !players || !players[socket.id]) {
    return
  }
  if (!gameSpecsLoaded() || !players[socket.id].ready) {
    return
  }
  checkIfMoved()
  checkIfAttackAngleChanged()
  checkIfAttacked()
  checkIfSwappedWeapon()
}

function checkIfMoved() {
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
  if (playerPositionIsNew(xspeed, yspeed)) {
    x = players[socket.id].x + xspeed
    y = players[socket.id].y + yspeed
    moveSound.volume = 0.13
    moveSound.play()
    socket.emit('update position', socket.id, x, y)
  }
}

function playerPositionIsNew(xspeed, yspeed) {
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

function checkIfAttackAngleChanged() {
  if (position.currentAttackAngle != position.newAttackAngle) {
    socket.emit('update attack angle', socket.id, position.newAttackAngle)
  }

}

function checkIfAttacked() {
  if (map.keys && map.keys[32]) {
    attack()
  }
}

function checkIfSwappedWeapon() {
  if (!socket || !socket.id) {
    return
  }
  if (map.keys && map.keys[49]) {
    if (players[socket.id].equippedWeapon != 'pistol') {
      socket.emit('swap weapon', socket.id, 'pistol')
      swapToPistolSound.play()
    }
  }
  else if (map.keys && map.keys[50]) {
    if (players[socket.id].equippedWeapon != 'melee') {
      socket.emit('swap weapon', socket.id, 'melee')
      swapToPunchSound.play()
    }
  }
  else if (map.keys && map.keys[51]) {
    if (players[socket.id].equippedWeapon != 'build') {
      socket.emit('swap weapon', socket.id, 'build')
      swapToBuildSound.play()
    }
  }
}

function updateMap() {
  requestAnimationFrame(updateMap)
  if (!socket) {
    return
  }
  processPlayerInput()
  map.clear()
  drawBackground()
  drawCoordinateGrid()
  for (id in graves) {
    drawGrave(graves[id])
  }
  for (id in armories) {
    drawArmory(armories[id])
  }
  context.beginPath()
  for (id in players) {
    if (id !== 'undefined') {
      if (id == socket.id) {
        position.currentx = players[id].x
        position.currenty = players[id].y
        position.currentAttackAngle = players[id].attackAngle
        drawPlayer(players[id])
      } else {
        drawEnemy(players[id])
      }
    }
  }
  for (id in trees) {
    drawTree(trees[id])
  }
  for (id in bushes) {
    drawBush(bushes[id])
  }
  for (id in rocks) {
    drawRock(rocks[id])
  }
  for (id in walls) {
    drawWall(walls[id])
  }
  drawHUD()
  for (id in projectiles) {
    drawProjectile(projectiles[id])
  }
  if (socket && socket.id && players && players[socket.id] && players[socket.id].health <= 0) {
    showRespawnDiv()
  } else {
    hideRespawnDiv()
  }
}

function drawHUD() {
  if (!players[socket.id]) {
    return
  }
  drawHealthBar()
  drawHUDMaterials()
  drawHUDWeapon()
  drawHUDMiniMap()
  drawHUDLeaderboard()
}

function drawHealthBar() {
  var healthWidth = window.innerWidth / 3.5
  var healthHeight = Math.min(window.innerHeight / 20, 20)
  var healthCornerRadius = 20;
  var healthX = halfScreenWidth - healthWidth / 2
  var healthY = window.innerHeight - healthHeight - 15
  var healthRatio = players[socket.id].health / 100.0

  context.lineWidth = 5
  context.lineJoin = 'round'
  context.lineWidth = healthCornerRadius
  context.fillStyle = 'rgba(0, 0, 0, 0)'
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)'

  context.beginPath()
  context.strokeRect(healthX + (healthCornerRadius / 2), healthY + (healthCornerRadius / 2), healthWidth - healthCornerRadius,  healthHeight - healthCornerRadius)
  context.fillRect(healthX + (healthCornerRadius / 2), healthY + (healthCornerRadius / 2), healthWidth - healthCornerRadius,  healthHeight - healthCornerRadius) 
  context.closePath()

  context.lineJoin = 'round'
  context.lineWidth = healthCornerRadius
  context.fillStyle = 'rgba(0, 0, 0, 0)'
  context.strokeStyle = 'rgba(0, 0, 255, 0.8)'
  if (healthRatio <= 0.15) {
    context.strokeStyle = 'rgba(255, 0, 0, 0.8)'
  }

  context.beginPath()
  healthPercentage = (healthWidth - healthCornerRadius) * healthRatio
  context.strokeRect(healthX + (healthCornerRadius / 2), healthY + (healthCornerRadius / 2), healthPercentage,  healthHeight - healthCornerRadius)
  context.fillRect(healthX + (healthCornerRadius / 2), healthY + (healthCornerRadius / 2), healthWidth - healthCornerRadius,  healthHeight - healthCornerRadius) 
  context.closePath()

  context.lineJoin = 'miter'
  context.lineWidth = 1
}

function drawHUDMaterials() {
  var materialWidth = Math.min(window.innerWidth / 4, window.innerHeight / 4)
  materialWidth = Math.max(materialWidth, 100)
  var materialHeight = materialWidth
  var materialX = 15
  var materialY = window.innerHeight - 15 - materialHeight
  var imageSize = materialWidth / 1.3
  var imageOffset = (materialWidth - imageSize) / 1.5

  var font = (materialWidth / 5) + 'px sans-serif'
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(0, 0, 0, 0.6)'
  context.lineWidth = 2
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)'
  context.textStyle = 'white'

  context.beginPath()
  context.strokeRect(materialX, materialY, materialWidth, materialHeight)
  context.fillRect(materialX, materialY, materialWidth, materialHeight)
  context.drawImage(materialImage, materialX + imageOffset / 1.2, materialY + imageOffset, imageSize, imageSize)

  context.fillStyle = 'white'
  context.fillText(players[socket.id].materials, materialX + materialWidth / 4.5, materialY + materialWidth / 6.0)
  context.fill()

  context.closePath()
}

function drawHUDWeapon() {
  var weaponWidth = Math.min(window.innerWidth / 4, window.innerHeight / 4)
  weaponWidth = Math.max(weaponWidth, 100)
  var weaponWidth = weaponWidth
  var weaponX = window.innerWidth - 15 - weaponWidth
  var weaponY = window.innerHeight - 15 - weaponWidth
  var imageSize = weaponWidth / 1.3
  var imageOffset = (weaponWidth - imageSize) / 1.5

  var font = (weaponWidth / 5) + 'px sans-serif'
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(0, 0, 0, 0.6)'
  context.lineWidth = 2
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)'

  context.beginPath()
  context.strokeRect(weaponX, weaponY, weaponWidth, weaponWidth)
  context.fillRect(weaponX, weaponY, weaponWidth, weaponWidth)
  if (players[socket.id].equippedWeapon == 'melee') {
    context.drawImage(meleeImage, weaponX + imageOffset / 1.2, weaponY + imageOffset / 1.2, imageSize, imageSize)
  }
  else if(players[socket.id].equippedWeapon == 'build') {
    context.drawImage(buildImage, weaponX + imageOffset / 1.2, weaponY + imageOffset / 1.2, imageSize, imageSize)
  }
  else if(players[socket.id].equippedWeapon == 'pistol') {
    context.drawImage(pistolImage, weaponX + imageOffset / 1.2, weaponY + imageOffset / 1.2, imageSize, imageSize)
  }

  context.fillStyle = 'black'
  context.fill()

  context.closePath()
}

function drawHUDMiniMap() {
  if (!gameSpecs) {
    return
  }
  var minimapWidth = Math.min(window.innerWidth / 4, window.innerHeight / 4)
  minimapWidth = Math.max(minimapWidth, 100)
  var minimapHeight = minimapWidth
  var minimapX = 15
  var minimapY = 15

  var font = (minimapWidth / 5) + 'px sans-serif'
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(0, 255, 0, 0.80)'
  context.lineWidth = 2
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)'

  context.beginPath()
  context.strokeRect(minimapX, minimapY, minimapWidth, minimapHeight)
  context.fillRect(minimapX, minimapY, minimapWidth, minimapHeight)
  context.drawImage(minimapImage, minimapX, minimapY, minimapWidth, minimapHeight)
  context.closePath()

  var playerXRelative = (players[socket.id].x / gameSpecs.gameWidth) * minimapWidth + minimapX
  var playerYRelative = (players[socket.id].y / gameSpecs.gameHeight) * minimapHeight + minimapY

  context.lineWidth = 1
  context.fillStyle = 'rgba(255, 220, 178)'

  if (players[socket.id].ready) {
    context.beginPath()
    context.arc(playerXRelative, playerYRelative, 4, 0, 2 * Math.PI)
    context.closePath()
    context.stroke()
    context.fill()
    context.lineWidth = 1
  }

  // Ended up taking a screenshot of a higher rendering of the minimap
  // Doing it dynamically was somewhat annoying
  // will change later
  // if (!minimapDrawn) {
  //   for (id in gameSpecs.minimap) {
  //     var objectXRelative = (gameSpecs.minimap[id].x / gameSpecs.gameWidth) * minimapWidth + minimapX
  //     var objectYRelative = (gameSpecs.minimap[id].y / gameSpecs.gameHeight) * minimapHeight + minimapY
  //     context.beginPath()
  //     if (gameSpecs.minimap[id].type == 'tree') {
  //       context.fillStyle = 'green'
  //       context.arc(objectXRelative, objectYRelative, 8, 0, 2 * Math.PI)
  //     } else if (gameSpecs.minimap[id].type == 'bush') {
  //       context.fillStyle = 'lightgreen'
  //       context.arc(objectXRelative, objectYRelative, 4, 0, 2 * Math.PI)
  //     } else if (gameSpecs.minimap[id].type == 'rock') {
  //       context.fillStyle = 'lightgray'
  //       context.arc(objectXRelative, objectYRelative, 12, 0, 2 * Math.PI)
  //     } else if (gameSpecs.minimap[id].type == 'armory') {
  //       var miniarmory = gameSpecs.minimap[id]
  //       drawMiniArmory(miniarmory)
  //     }
  //     context.closePath()
  //     context.stroke()
  //     context.fill()
  //     context.lineWidth = 1 
  //   }
  //   minimapDrawn = true
  // }

  context.closePath()
  context.fillStyle = 'black'
  context.lineWidth = 1
}

function drawHUDLeaderboard() {
  var leaderboardWidth = Math.min(window.innerWidth / 4, window.innerHeight / 4)
  leaderboardWidth = Math.max(leaderboardWidth, 100)
  var leaderboardWidth = leaderboardWidth
  var leaderboardX = window.innerWidth - 15 - leaderboardWidth
  var leaderboardY = 15

  var font = (leaderboardWidth / 8) + 'px sans-serif'
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(0, 0, 0, 0.6)'
  context.lineWidth = 2
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)'

  context.beginPath()
  context.strokeRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardWidth)
  context.fillRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardWidth)
  context.fillStyle = 'white'
  context.fillText('Leaderboard', window.innerWidth - (leaderboardWidth / 2) - 15, leaderboardY + leaderboardWidth / 7.0)
  if (leaderboardData) {
    if (leaderboardData[0] != 'none') {
      context.fillText('1) ' + leaderboardData[0], window.innerWidth - (leaderboardWidth / 2) - 15, leaderboardY + leaderboardWidth / 3.0)
    }
    if (leaderboardData[1] != 'none') {
      context.fillText('2) ' + leaderboardData[1], window.innerWidth - (leaderboardWidth / 2) - 15, leaderboardY + leaderboardWidth / 2.0)
    }
    if (leaderboardData[2] != 'none') {
      context.fillText('3) ' + leaderboardData[2], window.innerWidth - (leaderboardWidth / 2) - 15, leaderboardY + leaderboardWidth / 1.5)
    }
    if (leaderboardData[3] != 'none') {
      context.fillText('4) ' + leaderboardData[3], window.innerWidth - (leaderboardWidth / 2) - 15, leaderboardY + leaderboardWidth / 1.2)
    }
  }

  context.fillStyle = 'black'
  context.fill()

  context.closePath()
}

function resize() {
  if (!socket || !socket.id) {
    return
  }
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  halfScreenWidth = window.innerWidth / 2
  halfScreenHeight = window.innerHeight / 2
  if (socket.id) {
    socket.emit('window resized', socket.id, halfScreenWidth, halfScreenHeight)
  }
}

function attack() {
  if (!socket || !socket.id || !players || !players[socket.id]) {
    return
  }
  if (!players[socket.id].ready) {
    return
  }
  if (!players[socket.id].inAttackState) {
    if (players[socket.id].equippedWeapon == 'build') {
      if (players[socket.id].materials >= 10) {
        buildSound.play()
      } else {
        emptyMaterialsSound.play()
      }
    }
    socket.emit('attack', socket.id)
  }
}

function updateAttackAngle(event) {
  if (!socket || !socket.id || !players || !players[socket.id]) {
    return
  }
  if (!players[socket.id].ready) {
    return
  }
  xdiff = (event.clientX - halfScreenWidth)
  ydiff = (halfScreenHeight - event.clientY)
  newAttackAngle = Math.atan2(ydiff, xdiff)
  if (newAttackAngle < 0) {
    newAttackAngle += 2 * Math.PI
  }
  if (position.currentAttackAngle != newAttackAngle) {
    position.newAttackAngle = newAttackAngle
  }
}

function gameSpecsLoaded() {
  if (gameSpecs) {
    return true
  }
  return false
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max)) + 1
}


// Draw Functions

function drawPlayer(player) {
  if (!gameSpecsLoaded() ) {
    return
  }
  if (!socket || !socket.id || !players || !players[socket.id] || !players[socket.id].ready) {
    return
  }
  if (player.health <= 0) {
    x = halfScreenWidth
    y = halfScreenHeight
    drawDeath(player, x, y)
  } else {
    x = halfScreenWidth
    y = halfScreenHeight
    context.lineWidth = 5
    context.fillStyle = 'rgba(255, 220, 178)'
    if (player.health < player.lastHealth) {
      context.strokeStyle = 'red'
    } else {
      context.strokeStyle = 'black'
    }
    context.beginPath()
    context.arc(x, y, gameSpecs.playerRadius, 0, 2 * Math.PI)
    context.closePath()
    context.stroke()
    context.fill()
    context.lineWidth = 1
    if (isInAttackState(player)) {
      animateAttack(player, x, y)
    }
    else {
      drawWeapon(player, x, y)
    }
    context.lineWidth = 1
    context.strokeStyle = 'black'
  }
}

function drawEnemy(player) {
  if (!player.ready) {
    return
  }
  if (player.health <= 0) {
    drawDeath(player, x, y)
  } else {
    xdiff = players[socket.id].x - player.x
    ydiff = players[socket.id].y - player.y
    x = halfScreenWidth - xdiff
    y = halfScreenHeight - ydiff
    context.lineWidth = 5
    context.fillStyle = 'rgba(255, 220, 178)'
    if (player.health < player.lastHealth || new Date(new Date(player.lastDamaged).getTime() + 100) >= new Date()) {
      context.strokeStyle = 'red'
    } else {
      context.strokeStyle = 'black'
    }
    context.beginPath()
    context.arc(x, y, gameSpecs.playerRadius, 0, 2 * Math.PI)
    context.closePath()
    context.stroke()
    context.fill()
    context.lineWidth = 1
    if (isInAttackState(player)) {
      animateAttack(player, x, y)
    } else {
      drawWeapon(player, x, y)
    }
    context.strokeStyle = 'black'
  }
}

function isInAttackState(player) {
  var now = new Date()
  var attackTime = new Date(player.lastAttack)
  var animationWindow = new Date(attackTime.getTime() + player.lastAttackDuration)
  if (now <= animationWindow) {
    player.inAttackState = true
    if (!player.attackStateRandomVariable) {
      player.attackStateRandomVariable = getRandomInt(2)
    }
    return true
  } else {
    player.inAttackState = false
    return false
  }
}

function drawWall(wall) {
  if (wall.disabled == false) {
    xdiff = players[socket.id].x - wall.x
    ydiff = players[socket.id].y - wall.y
    newX = halfScreenWidth - xdiff
    newY = halfScreenHeight - ydiff
    opacity = wall.currentHealth / 50.0
    context.fillStyle = 'rgb(128, 128, 128, ' + opacity + ')'
    context.strokeStyle = 'black'
    context.lineWidth = 7
    context.beginPath();
    context.rect(newX, newY, wall.width, wall.height)
    context.closePath()
    context.stroke()
    context.fill()
    if (new Date(new Date(wall.lastDamaged).getTime() + 100) >= new Date()) {
      damageObjectSound.play()
    }
  }
}

function animateBuild(player, x, y) {
  var now = new Date()
  var attackTime = new Date(player.lastAttack)
  var frame = (now - attackTime) / 10
  hammerWidth = 30
  hammerHeight = 30
  if (frame > 17) {
    frame = 30 - frame
  }
  radius = gameSpecs.playerRadius + 5
  largeRadius = gameSpecs.playerRadius + 5 + frame
  angleDifference = frame * 0.035

  leftx = x + radius * Math.cos(player.attackAngle + 0.6)
  lefty = y - radius * Math.sin(player.attackAngle + 0.6)
  rightx = x + largeRadius * Math.cos(player.attackAngle - 0.6 + angleDifference)
  righty = y - largeRadius * Math.sin(player.attackAngle - 0.6 + angleDifference)

  hammerx = x + largeRadius * Math.cos(player.attackAngle + 0.5)
  hammery = y - largeRadius * Math.sin(player.attackAngle + 0.5)

  context.lineWidth = 5
  context.fillStyle = 'rgba(255, 220, 178)'

  context.beginPath()
  context.arc(leftx, lefty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.beginPath()
  context.arc(rightx, righty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.translate(hammerx, hammery)
  context.rotate(-player.attackAngle)
  context.translate(-hammerx, -hammery)
  context.drawImage(hammerImage, hammerx, hammery, hammerWidth, hammerHeight)
  context.setTransform(1, 0, 0, 1, 0, 0)

  context.lineWidth = 1
}

function animatePistol(player, x, y) {
  drawPistol(player, x, y)
  radius = gameSpecs.playerRadius + 5

  flairX = x + (radius + 22) * Math.cos(-player.attackAngle)
  flairY = y + (radius + 22) * Math.sin(-player.attackAngle)
  drawStar(flairX, flairY, 3, 5, 15, 'rgba(255, 255, 0)', 'rgba(255, 255, 0)')

  context.lineWidth = 1
}

function drawWeapon(player, x, y) {
  if (player.equippedWeapon == 'melee') {
    drawMeleeWeapon(player, x, y)
  }
  if (player.equippedWeapon == 'build') {
    drawBuildWeapon(player, x, y)
  }
  if (player.equippedWeapon == 'pistol') {
    drawPistol(player, x, y)
  }
}

function drawMeleeWeapon(player, x, y) {
  radius = gameSpecs.playerRadius + 5
  leftx = x + radius * Math.cos(player.attackAngle + 0.6)
  lefty = y - radius * Math.sin(player.attackAngle + 0.6)
  rightx = x + radius * Math.cos(player.attackAngle - 0.6)
  righty = y - radius * Math.sin(player.attackAngle - 0.6)
  context.lineWidth = 5
  context.fillStyle = 'rgba(255, 220, 178)'

  context.beginPath()
  context.arc(leftx, lefty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.beginPath()
  context.arc(rightx, righty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.lineWidth = 1
}

function drawBuildWeapon(player, x, y) {
  radius = gameSpecs.playerRadius + 5
  leftx = x + radius * Math.cos(player.attackAngle + 0.6)
  lefty = y - radius * Math.sin(player.attackAngle + 0.6)
  rightx = x + radius * Math.cos(player.attackAngle - 0.6)
  righty = y - radius * Math.sin(player.attackAngle - 0.6)
  hammerx = x + radius * Math.cos(player.attackAngle + 0.5)
  hammery = y - radius * Math.sin(player.attackAngle + 0.5)
  hammerWidth = 30
  hammerHeight = 30
  context.lineWidth = 5
  context.fillStyle = 'rgba(255, 220, 178)'

  context.beginPath()
  context.arc(leftx, lefty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.beginPath()
  context.arc(rightx, righty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.translate(hammerx, hammery)
  context.rotate(-player.attackAngle)
  context.translate(-hammerx, -hammery)
  context.drawImage(hammerImage, hammerx, hammery, hammerWidth, hammerHeight)
  context.setTransform(1, 0, 0, 1, 0, 0)

  context.lineWidth = 1
}

function drawPistol(player, x, y) {
  radius = gameSpecs.playerRadius + 5
  context.lineWidth = 5
  context.fillStyle = 'rgba(255, 220, 178)'


  pistolX = x + (radius + 0) * Math.cos(-player.attackAngle)
  pistolY = y + (radius + 0) * Math.sin(-player.attackAngle)
  context.beginPath()
  context.arc(pistolX, pistolY, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.fillStyle = 'black'

  pistolX = x + (radius + 8) * Math.cos(-player.attackAngle)
  pistolY = y + (radius + 8) * Math.sin(-player.attackAngle)
  context.beginPath()
  context.arc(pistolX, pistolY, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  pistolX = x + (radius + 10) * Math.cos(-player.attackAngle)
  pistolY = y + (radius + 10) * Math.sin(-player.attackAngle)
  context.beginPath()
  context.arc(pistolX, pistolY, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  pistolX = x + (radius + 12) * Math.cos(-player.attackAngle)
  pistolY = y + (radius + 12) * Math.sin(-player.attackAngle)
  context.beginPath()
  context.arc(pistolX, pistolY, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  pistolX = x + (radius + 14) * Math.cos(-player.attackAngle)
  pistolY = y + (radius + 14) * Math.sin(-player.attackAngle)
  context.beginPath()
  context.arc(pistolX, pistolY, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  pistolX = x + (radius + 16) * Math.cos(-player.attackAngle)
  pistolY = y + (radius + 16) * Math.sin(-player.attackAngle)
  context.beginPath()
  context.arc(pistolX, pistolY, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.lineWidth = 1
}

function drawDeath(player, x, y) {
  xdiff = players[socket.id].x - player.x
  ydiff = players[socket.id].y - player.y
  x = halfScreenWidth - xdiff
  y = halfScreenHeight - ydiff
  context.lineWidth = 5
  context.fillStyle = 'black'
  context.beginPath()
  context.arc(x, y, gameSpecs.playerRadius, 0, 2 * Math.PI)
  context.stroke()
  context.fill()
  context.drawImage(graveImage, x - 25, y - 27, 50, 50)
  context.closePath()
  context.lineWidth = 1  
}

function animateAttack(player, x, y) {
  if (player.lastAttackWeapon == 'melee') {
    punchSound.play()
    animateMeleeAttack(player, x, y)
  }
  if (player.lastAttackWeapon == 'build') {
    animateBuild(player, x, y)
  }
  if (player.lastAttackWeapon == 'pistol') {
    pistolSound.play()
    animatePistol(player, x, y)
  }
}

function animateMeleeAttack(player, x, y) {
  var now = new Date()
  var attackTime = new Date(player.lastAttack)
  var frame = (now - attackTime) / 10
  if (frame > 17) {
    frame = 30 - frame
  }
  radius = gameSpecs.playerRadius + 5
  largeRadius = gameSpecs.playerRadius + 5 + frame
  angleDifference = frame * 0.035

  if (player.attackStateRandomVariable == 1) {
    leftx = x + largeRadius * Math.cos(player.attackAngle + 0.6 - angleDifference)
    lefty = y - largeRadius * Math.sin(player.attackAngle + 0.6 - angleDifference)
    rightx = x + radius * Math.cos(player.attackAngle - 0.6)
    righty = y - radius * Math.sin(player.attackAngle - 0.6)
  }
  else {
    leftx = x + radius * Math.cos(player.attackAngle + 0.6)
    lefty = y - radius * Math.sin(player.attackAngle + 0.6)
    rightx = x + largeRadius * Math.cos(player.attackAngle - 0.6 + angleDifference)
    righty = y - largeRadius * Math.sin(player.attackAngle - 0.6 + angleDifference)
  }

  context.lineWidth = 5
  context.fillStyle = 'rgba(255, 220, 178)'

  context.beginPath()
  context.arc(leftx, lefty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.beginPath()
  context.arc(rightx, righty, 6, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()

  context.lineWidth = 1
}

function drawRock(rock) {
  xdiff = players[socket.id].x - rock.x
  ydiff = players[socket.id].y - rock.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  context.fillStyle = 'lightgray'
  context.strokeStyle = 'black'
  context.lineWidth=5
  context.beginPath()
  context.arc(newX, newY, rock.radius, 0 , 2*Math.PI)
  context.closePath()
  context.stroke()
  context.fill()
  context.lineWidth = 1
  if (new Date(new Date(rock.lastDamaged).getTime() + 100) >= new Date()) {
    damageObjectSound.play()
  }
}

function drawBush(bush) {
  xdiff = players[socket.id].x - bush.x
  ydiff = players[socket.id].y - bush.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  drawStar(newX, newY, bush.oRadius, bush.iRadius, bush.sides, 'darkgreen', 'darkgreen')
  drawStar(newX, newY, (bush.oRadius * 3)/4, (bush.iRadius * 3) / 4, bush.sides, 'green', 'green')
  drawStar(newX, newY, bush.oRadius/2, bush.iRadius/2, bush.sides, 'lightgreen', 'lightgreen')
  if (new Date(new Date(bush.lastDamaged).getTime() + 100) >= new Date()) {
    damageObjectSound.play()
  }
}

function drawMiniArmory(armory) {
  newX = armory.x
  newY = armory.y
  context.fillStyle = 'rgb(206, 119, 51)'
  context.beginPath()
  context.fillRect(newX, newY, armory.width, armory.height)
  context.closePath()
  drawMiniArmoryWallLines(armory)
  for(var i = 0; i < armory.walls.length; i++) {
    drawMiniArmoryWall(armory.walls[i])
  }
}

function drawArmory(armory) {
  xdiff = players[socket.id].x - armory.x
  ydiff = players[socket.id].y - armory.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  context.fillStyle = 'rgb(206, 119, 51)'
  context.beginPath()
  context.fillRect(newX, newY, armory.width, armory.height)
  context.closePath()
  drawTiles(armory)
  drawArmoryWallLines(armory)
  for(var i = 0; i < armory.walls.length; i++) {
    if (armory.walls[i].disabled == false) {
      drawArmoryWall(armory.walls[i])
    }
  }
}

function drawMiniArmoryWall(wall) {
  newX = wall.x
  newY = wall.y
  context.fillStyle = 'rgb(128, 128, 128)'
  context.beginPath();
  context.rect(newX, newY, wall.width, wall.height)
  context.closePath()
  context.fill()
}

function drawArmoryWall(wall) {
  xdiff = players[socket.id].x - wall.x
  ydiff = players[socket.id].y - wall.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  context.fillStyle = 'rgb(128, 128, 128)'
  context.beginPath();
  context.rect(newX, newY, wall.width, wall.height)
  context.closePath()
  context.fill()
}

function drawTiles(armory) {
  xdiff = players[socket.id].x - armory.x
  ydiff = players[socket.id].y - armory.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  var moduloLine = 0
  for (var i = 5; i < armory.height; i += 75) {
    context.beginPath()
    context.lineWidth = 0.5
    context.moveTo(newX, newY + i)
    context.lineTo(newX + armory.width, newY + i)
    context.stroke()

    for (var j = 0; j < armory.width - 100; j += 100) {
      context.beginPath()
      context.strokeStyle = '#723E1C'
      context.lineWidth = 0.5
      context.moveTo(newX + j + ((moduloLine % 4) * 40), newY + i)
      if (i + 75 > armory.height) {
        context.lineTo(newX + j + ((moduloLine % 4) * 40), newY + armory.height)

      }
      else {
        context.lineTo(newX + j + ((moduloLine % 4) * 40), newY + i + 75)
      }
      context.stroke()
    }
    moduloLine = (moduloLine + 1) % 4
  }
}

function drawMiniArmoryWallLines(armory) { 
  newX = armory.x
  newY = armory.y
  context.strokeStyle = '#000'

  if (armory.orientation == 'horizontal') {
    context.beginPath()
    context.lineWidth = 10
    context.moveTo(newX, newY)
    context.lineTo(newX + armory.width, newY)
    context.lineTo(newX + armory.width, newY + (armory.height / 3))
    context.lineTo(newX + armory.width - armory.thickness, newY + (armory.height / 3))
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.thickness)
    context.lineTo(newX + armory.thickness, newY + armory.thickness)
    context.lineTo(newX + armory.thickness, newY + (armory.height / 3))
    context.lineTo(newX, newY + (armory.height / 3))
    context.lineTo(newX, newY - 3)
    context.stroke()
    context.beginPath()
    context.moveTo(newX + armory.width, newY + armory.height)
    context.lineTo(newX, newY + armory.height)
    context.lineTo(newX, newY + (2 * armory.height / 3))
    context.lineTo(newX + armory.thickness, newY + (2 * armory.height / 3))
    context.lineTo(newX + armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + (2 * armory.height / 3))
    context.lineTo(newX + armory.width, newY + (2 * armory.height / 3))
    context.closePath()
    context.stroke()
  }
  else if (armory.orientation == 'vertical'){
    context.beginPath()
    context.lineWidth = 7
    context.moveTo(newX, newY)
    context.lineTo(newX + (armory.width / 3), newY)
    context.lineTo(newX + (armory.width / 3), newY + armory.thickness)
    context.lineTo(newX + (armory.thickness), newY + armory.thickness)
    context.lineTo(newX + armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + (armory.width / 3), newY + armory.height - armory.thickness)
    context.lineTo(newX + (armory.width / 3), newY + armory.height)
    context.lineTo(newX, newY + armory.height)
    context.closePath()
    context.stroke()
    context.beginPath()
    context.moveTo(newX + armory.width, newY)
    context.lineTo(newX + (2 * armory.width / 3), newY)
    context.lineTo(newX + (2 * armory.width / 3), newY + armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + (2 * armory.width / 3), newY + armory.height - armory.thickness)
    context.lineTo(newX + (2 * armory.width / 3), newY + armory.height)
    context.lineTo(newX + armory.width, newY + armory.height)
    context.closePath()
    context.stroke()
  }
}

function drawArmoryWallLines(armory) { 
  xdiff = players[socket.id].x - armory.x
  ydiff = players[socket.id].y - armory.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  context.strokeStyle = '#000'

  if (armory.orientation == 'horizontal') {
    context.beginPath()
    context.lineWidth = 10
    context.moveTo(newX, newY)
    context.lineTo(newX + armory.width, newY)
    context.lineTo(newX + armory.width, newY + (armory.height / 3))
    context.lineTo(newX + armory.width - armory.thickness, newY + (armory.height / 3))
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.thickness)
    context.lineTo(newX + armory.thickness, newY + armory.thickness)
    context.lineTo(newX + armory.thickness, newY + (armory.height / 3))
    context.lineTo(newX, newY + (armory.height / 3))
    context.lineTo(newX, newY - 3)
    context.stroke()
    context.beginPath()
    context.moveTo(newX + armory.width, newY + armory.height)
    context.lineTo(newX, newY + armory.height)
    context.lineTo(newX, newY + (2 * armory.height / 3))
    context.lineTo(newX + armory.thickness, newY + (2 * armory.height / 3))
    context.lineTo(newX + armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + (2 * armory.height / 3))
    context.lineTo(newX + armory.width, newY + (2 * armory.height / 3))
    context.closePath()
    context.stroke()
  }
  else if (armory.orientation == 'vertical'){
    context.beginPath()
    context.lineWidth = 7
    context.moveTo(newX, newY)
    context.lineTo(newX + (armory.width / 3), newY)
    context.lineTo(newX + (armory.width / 3), newY + armory.thickness)
    context.lineTo(newX + (armory.thickness), newY + armory.thickness)
    context.lineTo(newX + armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + (armory.width / 3), newY + armory.height - armory.thickness)
    context.lineTo(newX + (armory.width / 3), newY + armory.height)
    context.lineTo(newX, newY + armory.height)
    context.closePath()
    context.stroke()
    context.beginPath()
    context.moveTo(newX + armory.width, newY)
    context.lineTo(newX + (2 * armory.width / 3), newY)
    context.lineTo(newX + (2 * armory.width / 3), newY + armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.thickness)
    context.lineTo(newX + armory.width - armory.thickness, newY + armory.height - armory.thickness)
    context.lineTo(newX + (2 * armory.width / 3), newY + armory.height - armory.thickness)
    context.lineTo(newX + (2 * armory.width / 3), newY + armory.height)
    context.lineTo(newX + armory.width, newY + armory.height)
    context.closePath()
    context.stroke()
  }
}

function drawStar(cx, cy, oRadius, iRadius, sides, strokeStyle, fillStyle) {
  var rot=Math.PI/2*3
  var x=cx
  var y=cy
  var step = Math.PI/sides

  context.beginPath()
  context.moveTo(cx,cy-oRadius)
  for(i=0; i<sides; i++){
    x=cx+Math.cos(rot)*oRadius
    y=cy+Math.sin(rot)*oRadius
    context.lineTo(x,y)
    rot+=step

    x=cx+Math.cos(rot)*iRadius
    y=cy+Math.sin(rot)*iRadius
    context.lineTo(x,y)
    rot+=step
  }
  context.lineTo(cx,cy-oRadius)
  context.closePath()
  context.lineWidth=5
  context.strokeStyle = strokeStyle
  context.stroke()
  context.fillStyle = fillStyle
  context.fill()
  context.strokeStyle = 'black'
  context.fillStyle = 'black'
    
}

function drawTree(tree) {
  if (tree.currentHealth > 0) {
    xdiff = players[socket.id].x - tree.x
    ydiff = players[socket.id].y - tree.y
    newX = halfScreenWidth - xdiff
    newY = halfScreenHeight - ydiff
    drawStar(newX, newY, tree.oRadius, tree.iRadius, tree.sides, 'green', 'rgba(0,80,0,.9)')
    drawStar(newX, newY, (tree.oRadius/3), (tree.iRadius/3), tree.sides, 'rgb(73, 51, 0)', 'rgb(84, 51, 0)')
    if (new Date(new Date(tree.lastDamaged).getTime() + 100) >= new Date()) {
      damageObjectSound.play()
    }
  }
}

function drawGrave(grave) {
  xdiff = players[socket.id].x - grave.x
  ydiff = players[socket.id].y - grave.y
  x = halfScreenWidth - xdiff
  y = halfScreenHeight - ydiff
  context.lineWidth = 1
  context.fillStyle = 'rgba(107, 106, 107, 0.4)'
  context.strokeStyle = 'rgba(107, 106, 107, 0.4)'
  context.beginPath()
  context.arc(x, y, grave.radius, 0, 2 * Math.PI)
  context.closePath()
  context.stroke()
  context.fill()
  context.lineWidth = 1
  context.strokeStyle = 'black'
}

function drawProjectile(projectile) {
  xdiff = players[socket.id].x - projectile.x
  ydiff = players[socket.id].y - projectile.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  if (projectile.type == 'pistol') {
    context.fillStyle = projectile.color
    context.strokeStyle = projectile.color
    context.lineWidth=5
    context.beginPath()
    context.arc(newX, newY, projectile.radius, 0 , 2*Math.PI)
    context.closePath()
    context.stroke()
    context.fill()
    context.lineWidth = 1
  }
}


function drawBackground() {
  context.beginPath()
  context.fillStyle = 'rgb(153, 255, 102)'
  context.fillRect(0,0,canvas.width,canvas.height)
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

},{"./Map":1,"./Player":2,"./Position":3}]},{},[4]);
