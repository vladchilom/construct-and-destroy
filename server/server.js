'use strict'

var express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var config = require('config')
var util = require('./util/util.js');

var mapInitialize = false
var players = {}
var treePosition = [{x: 50, y: 80}, {x: 280, y: 720}, {x: 330, y: 200}, {x: 700, y: 500}]
var bushPosition = [{x: 70, y: 300}, {x: 70, y: 800}, {x: 120, y: 670}, {x: 800, y: 300}, {x: 650, y: 200}, {x: 800, y: 140}, {x: 300, y: 450}, {x: 700, y: 730}, {x: 530, y: 790}]
var rockPosition = [{x: 140, y: 80}, {x: 500, y: 85}, {x: 300, y: 62}, {x: 120, y: 350}, {x: 120, y: 640}, {x: 500, y: 320}, {x: 400, y: 400}]
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

function addBush() {
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

function addRock() {
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

function initializeMap() {
    addTrees()
    addBush()
    addRock()
}

if (!mapInitialize) {
  initializeMap()
}

app.get('/', function(req, res) {
  res.sendFile('index.html', { root: './client/html/' })
})

io.on('connection', function(socket) {
  console.log(socket.id + ' connected')

  players[socket.id] = { id: socket.id, x: 450, y: 450 }

  socket.on('update position', function(position) {
    if (!isLegalMovement(position)) {
      return
    }
    if (!isWithinArenaBounds(position)) {
      return
    }
    players[position.id] = position
  })

  socket.on('window resized', function(data) {
    //console.log(data)
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

var isLegalMovement = function(position) {
  if (Math.abs(players[position.id].x - position.x) > config.get('gameSpeed')) {
    return false
  }
  if (Math.abs(players[position.id].y - position.y) > config.get('gameSpeed')) {
    return false
  }
  return true
}
var isWithinArenaBounds = function(position) {
  var oldPos = {x: position.x, y: position.y} 
  if ((position.x - config.get('playerRadius')) <= 0) {
    position.x = config.get('playerRadius')
  }
  if ((position.x + config.get('playerRadius')) >= (0 + config.get('gameWidth'))) {
    position.x = config.get('gameWidth') - config.get('playerRadius')
  }
  if ((position.y - config.get('playerRadius')) <= 0) {
    position.y = config.get('playerRadius')
  }
  if ((position.y + config.get('playerRadius')) >= (0 + config.get('gameHeight'))) {
    position.y = config.get('gameHeight') - config.get('playerRadius')
  }
  return true
}

var sendGameUpdates = function() {
  io.emit('players', players)
}

var sendMapInfo = function() {
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
