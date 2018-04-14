
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
