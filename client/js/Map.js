
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
