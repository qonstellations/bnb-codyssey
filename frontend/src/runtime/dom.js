// Tiny DOM builder — no React in this bundle (PLAN.md: keep the participant runtime small).
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') el.textContent = value
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value)
    else if (key === 'class') el.className = value
    else el.setAttribute(key, value)
  }
  for (const child of [].concat(children)) {
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return el
}

export function renderScreen(root, node) {
  root.replaceChildren(node)
  // Focus the primary button so Enter/Space continues without reaching for the mouse.
  node.querySelector?.('.rt-btn')?.focus({ preventScroll: true })
}

export const keyLabel = (k) => (k === ' ' ? 'Space' : k === 'click' ? 'Tap' : k.toUpperCase())

// Every response key the experiment uses, in first-seen order.
export function experimentKeys(experiment) {
  const keys = new Set()
  for (const b of experiment.blocks) for (const t of b.trials) for (const k of t.validKeys) keys.add(k.toLowerCase())
  return [...keys]
}
