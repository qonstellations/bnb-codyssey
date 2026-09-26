export class Renderer {
  constructor(canvas, { backgroundColor = '#000', textColor = '#fff', fontSize = 32 } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.backgroundColor = backgroundColor
    this.textColor = textColor
    this.fontSize = fontSize
    this._resize = this._resize.bind(this)
    this._resize()
    window.addEventListener('resize', this._resize)
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1
    const { clientWidth, clientHeight } = this.canvas
    this.canvas.width = clientWidth * dpr
    this.canvas.height = clientHeight * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  get width() {
    return this.canvas.clientWidth
  }

  get height() {
    return this.canvas.clientHeight
  }

  clear() {
    this.ctx.fillStyle = this.backgroundColor
    this.ctx.fillRect(0, 0, this.width, this.height)
  }

  drawText(text, { color = this.textColor, fontSize = this.fontSize } = {}) {
    this.ctx.fillStyle = color
    this.ctx.font = `${fontSize}px sans-serif`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(text, this.width / 2, this.height / 2)
  }

  drawImage(image) {
    const scale = Math.min(this.width / image.width, this.height / image.height, 1)
    const w = image.width * scale
    const h = image.height * scale
    this.ctx.drawImage(image, (this.width - w) / 2, (this.height - h) / 2, w, h)
  }

  drawFixation({ color = this.textColor, size = 24 } = {}) {
    this.drawText('+', { color, fontSize: size * 2 })
  }

  drawFeedback(text, { correct = true } = {}) {
    this.drawText(text, { color: correct ? '#4caf50' : '#f44336' })
  }

  destroy() {
    window.removeEventListener('resize', this._resize)
  }
}
