
var Position = require('./Position')
var Map = require('./Map')
var Player = require('./Player')

$(() => {
  //showLoadingDiv()
  loadImages()
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
var materialImage
var meleeImage

var players
var trees = []
var bushes = []
var rocks = []
var graves = []
var projectiles = []

var weapon = 'melee'
var position

var map
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

  socket.on('request screen size', function() {
    resize()
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
    }
  })

  socket.on('projectiles', function(data) {
    projectiles = data
  })

  socket.on('player disconnected', function(data) {
    delete players[data]
  })
}

function loadImages() {
  materialImage = new Image()
  materialImage.src = '../img/wood2.png'
  meleeImage = new Image()
  meleeImage.src = '../img/melee.png'
}

function showLoadingDiv() {
  $('#loading-div').show()
  var bar = new ProgressBar.Line('#loading-bar', { easing: 'easeInOut', strokeWidth: 0.5, duration: 2500, color: '#000000' })
  bar.animate(1)
  setTimeout(() => {
    $('#loading-div').hide()
  }, 2500)
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
  checkIfMoved()
  checkIfAttackAngleChanged()
  checkIfAttacked()
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

function updateMap() {
  requestAnimationFrame(updateMap)
  if (!socket) {
    return
  }
  processPlayerInput()
  map.clear()
  drawBackground()
  drawCoordinateGrid()
  writeCoordinates()
  for (id in graves) {
    drawGrave(graves[id])
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
  drawHUD()
  for (id in projectiles) {
    drawProjectile(projectiles[id])
  }
}

function writeCoordinates() {
  context.beginPath()
  context.fillStyle = 'white'
  context.fillRect(canvas.width - 250, 0, canvas.width, 30)
  context.fillStyle = 'black'

  context.fillText('x: ' + position.currentx + ', y: ' + position.currenty + ' angle: ' + position.currentAttackAngle, canvas.width - 240, 15)
  context.fill()
  context.closePath()
}

function drawHUD() {
  if (!players[socket.id]) {
    return
  }
  drawHealthBar()
  drawHUDMaterials()
  drawHUDWeapon()
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

  context.lineWidth = 5
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
  context.font = 
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(0, 0, 0, 0.10'

  context.beginPath()
  context.fillRect(materialX, materialY, materialWidth, materialHeight)
  context.drawImage(materialImage, materialX + imageOffset / 1.2, materialY + imageOffset, imageSize, imageSize)

  context.fillStyle = 'black'
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
  context.font = 
  context.font = font
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(0, 0, 0, 0.10'

  context.beginPath()
  context.fillRect(weaponX, weaponY, weaponWidth, weaponWidth)
  console.log(weaponX, weaponY, weaponWidth)
  context.drawImage(meleeImage, weaponX + imageOffset / 1.2, weaponY + imageOffset / 1.2, imageSize, imageSize)

  context.fillStyle = 'black'
  context.fill()

  context.closePath()
}

function resize() {
  if (!socket) {
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
  if (!socket) {
    return
  }
  if (!players[socket.id].inAttackState) {
    socket.emit('attack', socket.id)
  }
}

function updateAttackAngle(event) {
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
  if (isInAttackState(player)) {
    animateAttack(player, x, y)
  } else {
    drawWeapon(player, x, y)
  }
  context.lineWidth = 1
}

function drawEnemy(player) {
  xdiff = players[socket.id].x - player.x
  ydiff = players[socket.id].y - player.y
  x = halfScreenWidth - xdiff
  y = halfScreenHeight - ydiff
  context.lineWidth = 5
  context.fillStyle = 'black'
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

function drawWeapon(player, x, y) {
  if (player.equippedWeapon == 'melee') {
    drawMeleeWeapon(player, x, y)
  }
}

function drawMeleeWeapon(player, x, y) {
  radius = gameSpecs.playerRadius + 5
  leftx = x + radius * Math.cos(player.attackAngle + 0.6)
  lefty = y - radius * Math.sin(player.attackAngle + 0.6)
  rightx = x + radius * Math.cos(player.attackAngle - 0.6)
  righty = y - radius * Math.sin(player.attackAngle - 0.6)
  context.lineWidth = 5
  context.fillStyle = 'red'

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

function animateAttack(player, x, y) {
  if (player.lastAttackWeapon == 'melee') {
    animateMeleeAttack(player, x, y)
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
  context.fillStyle = 'red'

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
}

function drawBush(bush) {
  xdiff = players[socket.id].x - bush.x
  ydiff = players[socket.id].y - bush.y
  newX = halfScreenWidth - xdiff
  newY = halfScreenHeight - ydiff
  drawStar(newX, newY, bush.oRadius, bush.iRadius, bush.sides, 'darkgreen', 'darkgreen')
  drawStar(newX, newY, (bush.oRadius * 3)/4, (bush.iRadius * 3) / 4, bush.sides, 'green', 'green')
  drawStar(newX, newY, bush.oRadius/2, bush.iRadius/2, bush.sides, 'lightgreen', 'lightgreen')

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
    
}

function drawTree(tree) {
  if (tree.currentHealth > 0) {
    xdiff = players[socket.id].x - tree.x
    ydiff = players[socket.id].y - tree.y
    newX = halfScreenWidth - xdiff
    newY = halfScreenHeight - ydiff
    drawStar(newX, newY, tree.oRadius, tree.iRadius, tree.sides, 'green', 'rgba(0,80,0,.9)')
    drawStar(newX, newY, (tree.oRadius/3), (tree.iRadius/3), tree.sides, 'rgb(73, 51, 0)', 'rgb(84, 51, 0)')
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
  context.fillStyle = 'rgb(0, 0, 255, 0.1)'
  context.strokeStyle = 'rgb(0, 0, 255, 0.1)'
  context.lineWidth=5
  context.beginPath()
  context.arc(newX, newY, projectile.radius, 0 , 2*Math.PI)
  context.closePath()
  context.stroke()
  context.fill()
  context.lineWidth = 1
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
