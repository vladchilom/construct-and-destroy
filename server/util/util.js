'use strict'

function randomInRange(from, to) {
  return Math.floor(Math.random() * (to - from)) + from
}

function addTree(coords) {
  var oRadius = util.randomInRange(70, 100)
  var iRadius = (oRadius + 10)
  var sides = util.randomInRange(10, 14)
  map.push({
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
  map.push({
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
  map.push({
    id: uuidv4(),
    type: 'rock',
    x: coords.x,
    y: coords.y,
    radius: radius,
    boundary: radius + 22
  })
}

module.exports = {
  randomInRange:randomInRange,
  addTree: addTree,
  addBush: addBush,
  addRock: addRock,
}
