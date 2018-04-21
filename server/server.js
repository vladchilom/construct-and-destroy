'use strict'

var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var config = require('config')
var util = require('./util/util.js');

var mapInitialize = false
var players = {}
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
var trees = []
var bushes = []
var rocks = []
app.use(express.static(__dirname + '/../client'))

function addTrees() {
  var length = treePosition.length
  while (length--) {
    var oRadius = util.randomInRange(70, 100)
    var iRadius = (oRadius + 10)
    var sides = util.randomInRange(10, 14)
    trees.push({
      x: treePosition[treePosition.length - 1 - length].x,
      y: treePosition[treePosition.length - 1 - length].y,
      oRadius: oRadius,
      iRadius: iRadius,
      sides: sides
    })
  }
}

function addTree(coords) {
  var oRadius = util.randomInRange(70, 100)
  var iRadius = (oRadius + 10)
  var sides = util.randomInRange(10, 14)
  trees.push({
      x: coords.x,
      y: coords.y,
      oRadius: oRadius,
      iRadius: iRadius,
      sides: sides
    })
}

function addBushes() {
  var length = bushPosition.length
  while (length--) {
    var oRadius = 40
    var iRadius = (oRadius + 2)
    var sides = util.randomInRange(15, 20)
    bushes.push({
      x: bushPosition[bushPosition.length - 1 - length].x,
      y: bushPosition[bushPosition.length - 1 - length].y,
      oRadius: oRadius,
      iRadius: iRadius,
      sides: sides
    })
  }
}

function addBush(coords) {
  var oRadius = 40
  var iRadius = (oRadius + 2)
  var sides = util.randomInRange(15, 20)
  bushes.push({
    x: coords.x,
    y: coords.y,
    oRadius: oRadius,
    iRadius: iRadius,
    sides: sides
  })
}

function addRocks() {
  var length = rockPosition.length
  while (length--) {
    var radius = util.randomInRange(40, 80)
    rocks.push({
      x: rockPosition[rockPosition.length - 1 - length].x,
      y: rockPosition[rockPosition.length - 1 - length].y,
      radius: radius
    })
  }
  
}

function addRock(coords) {
  var radius = util.randomInRange(40, 80)
  rocks.push({
    x: coords.x,
    y: coords.y,
    radius: radius
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
    equippedWeapon: 'melee'
  }

  socket.on('update position', function(id, x, y) {
    if (!isLegalMovement(id, x, y)) {
      return
    }
    if (!isWithinArenaBounds(id, x, y)) {
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
    var randomVar = util.randomInRange(1, 4)
    for (var i = 0; i < trees.length; i++) {
      if ((trees[i].x <= players[socket.id].x + 100 && trees[i].x >= players[socket.id].x - 100) && (trees[i].y <= players[socket.id].y + 100 && trees[i].y >= players[socket.id].y - 100)) {
        return
      }
    }
    for (var i = 0; i < rocks.length; i++) {
      if ((rocks[i].x <= players[socket.id].x + 100 && rocks[i].x >= players[socket.id].x - 100) && (rocks[i].y <= players[socket.id].y + 100 && rocks[i].y >= players[socket.id].y - 100)) {
        return
      }
    }
    for (var i = 0; i < bushes.length; i++) {
      if ((bushes[i].x <= players[socket.id].x + 100 && bushes[i].x >= players[socket.id].x - 100) && (bushes[i].y <= players[socket.id].y + 100 && bushes[i].y >= players[socket.id].y - 100)) {
        return
      }
    }
    if (randomVar == 1) {
      addRock({x: players[socket.id].x, y: players[socket.id].y})
    }
    else if (randomVar == 2) {
      addTree({x: players[socket.id].x, y: players[socket.id].y})
    }
    else if (randomVar == 3) {
      addBush({x: players[socket.id].x, y: players[socket.id].y})
    }
  })

  socket.on('window resized', function(data) {
    
  })

  socket.on('attack', function(data) {
    
  })

  socket.on('disconnect', function() {
    delete players[socket.id]
    socket.broadcast.emit('player disconnected', socket.id)
  })

  setupGame(socket)
})

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
  if (Math.abs(players[id].x - x) > config.get('gameSpeed')) {
    return false
  }
  if (Math.abs(players[id].y - y) > config.get('gameSpeed')) {
    return false
  }
  return true
}
var isWithinArenaBounds = function(id, x, y) {
  var oldPos = {x: x, y: y} 
  if ((x - config.get('playerRadius')) <= 0) {
    x = config.get('playerRadius')
  }
  if ((x + config.get('playerRadius')) >= (0 + config.get('gameWidth'))) {
    x = config.get('gameWidth') - config.get('playerRadius')
  }
  if ((y - config.get('playerRadius')) <= 0) {
    y = config.get('playerRadius')
  }
  if ((y + config.get('playerRadius')) >= (0 + config.get('gameHeight'))) {
    y = config.get('gameHeight') - config.get('playerRadius')
  }
  return true
}

var sendGameUpdates = function() {
  io.emit('players', players)
}

var sendMapInfo = function() {
  // all trees will be rendered by the client.
  io.emit('trees', trees)
  io.emit('bushes', bushes)
  io.emit('rocks', rocks)
}

http.listen(7070, function(err){
  if (err) console.error(err)
  console.log('Listening on port 7070')
})

setInterval(sendGameUpdates, 1000 / 60)
setInterval(sendMapInfo, 1000 / 60)
