// Same family as the site; the runtime awaits this font before the first trial.
export const FONT_FAMILY = '"Google Sans Flex", system-ui, sans-serif'
const font = (size) => `450 ${size}px ${FONT_FAMILY}`

export class Renderer {
  constructor(canvas, { backgroundColor = '#000', textColor = '#fff', fontSize = 32 } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this._fitCache = new Map()
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

  // Largest size ≤ fontSize whose widest line fits 90% of the width and whose block fits
  // 90% of the height. Measured once per text/size/viewport, then read from the cache
  // so the per-frame redraw never calls measureText.
  _fit(lines, fontSize) {
    const cacheKey = `${fontSize}|${this.width}x${this.height}|${lines.join('\n')}`
    let size = this._fitCache.get(cacheKey)
    if (size) return size
    this.ctx.font = font(fontSize)
    const widest = Math.max(...lines.map((l) => this.ctx.measureText(l).width))
    const byWidth = widest ? (fontSize * this.width * 0.9) / widest : fontSize
    const byHeight = (this.height * 0.9) / (lines.length * 1.3)
    size = Math.max(10, Math.floor(Math.min(fontSize, byWidth, byHeight)))
    if (this._fitCache.size > 200) this._fitCache.clear()
    this._fitCache.set(cacheKey, size)
    return size
  }

  drawText(text, { color = this.textColor, fontSize = this.fontSize } = {}) {
    // Multi-line text (visual search grids, IAT category reminders) is centred as a block.
    const lines = String(text).split('\n')
    const size = this._fit(lines, fontSize)
    this.ctx.fillStyle = color
    this.ctx.font = font(size)
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    const lineHeight = size * 1.3
    const top = this.height / 2 - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, i) => this.ctx.fillText(line, this.width / 2, top + i * lineHeight))
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
    this.drawText(text, { color: correct ? '#188038' : '#d93025' })
  }

  destroy() {
    window.removeEventListener('resize', this._resize)
  }
}
