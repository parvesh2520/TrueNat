import { PARTS, partById, type PartId } from '../data/parts'
import type { Viewer, RunState } from '../scenes/viewer'
import { drawScreen } from '../scenes/screen'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const num = (i: number) => String(i + 1).padStart(2, '0')

/** Wires the explore section: parts index, 3D markers, info panel, toolbar and run HUD. */
export function initExploreUI(viewer: Viewer) {
  const list = $('parts-list')
  const pinsEl = $('pins')
  const info = $('info')

  const listButtons = new Map<PartId, HTMLButtonElement>()
  const pins = new Map<PartId, HTMLButtonElement>()

  PARTS.forEach((p, i) => {
    const li = document.createElement('li')
    const b = document.createElement('button')
    b.innerHTML = `<span>${num(i)}</span>${p.name}`
    b.onclick = () => select(p.id, true)
    li.append(b)
    list.append(li)
    listButtons.set(p.id, b)

    const pin = document.createElement('button')
    pin.className = 'pin'
    pin.setAttribute('aria-label', p.name)
    pin.innerHTML = `<i>${num(i)}</i><b>${p.name}</b>`
    pin.onclick = () => select(p.id, true)
    pinsEl.append(pin)
    pins.set(p.id, pin)
  })

  function select(id: PartId | null, focus = false) {
    viewer.selected = id
    for (const [k, b] of listButtons) b.classList.toggle('on', k === id)
    for (const [k, b] of pins) b.classList.toggle('on', k === id)
    info.hidden = !id
    if (!id) return
    const p = partById(id)
    const i = PARTS.indexOf(p)
    $('info-index').textContent = `${num(i)} / ${num(PARTS.length - 1)}`
    $('info-kicker').textContent = p.kicker
    $('info-name').textContent = p.name
    $('info-summary').textContent = p.summary
    $('info-how').innerHTML = p.how.map((s) => `<li>${s}</li>`).join('')
    $('info-facts').innerHTML = p.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')
    if (focus) viewer.focusPart(id)
  }

  const step = (d: number) => {
    const i = viewer.selected ? PARTS.findIndex((p) => p.id === viewer.selected) : -1
    select(PARTS[(i + d + PARTS.length) % PARTS.length].id, true)
  }
  $('info-prev').onclick = () => step(-1)
  $('info-next').onclick = () => step(1)
  $('info-close').onclick = () => select(null)
  addEventListener('keydown', (e) => {
    if (!viewer.explore) return
    if (e.key === 'Escape') select(null)
    if (e.key === 'ArrowRight') step(1)
    if (e.key === 'ArrowLeft') step(-1)
  })
  viewer.onSelect = (id) => select(id, false)

  viewer.onFrame = (anchors) => {
    pinsEl.classList.toggle('off', !viewer.explore)
    if (!viewer.explore) return
    for (const [id, a] of anchors) {
      const pin = pins.get(id)!
      pin.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`
      pin.style.opacity = a.visible ? '' : '0'
    }
  }

  // Toolbar
  const seg = [...document.querySelectorAll<HTMLButtonElement>('[data-explode]')]
  const xray = $<HTMLInputElement>('xray')
  const setExplode = (v: number) => {
    viewer.setExploreView({ explode: v })
    seg.forEach((b) => b.classList.toggle('on', Number(b.dataset.explode) === v))
  }
  seg.forEach((b) => (b.onclick = () => setExplode(Number(b.dataset.explode))))
  xray.onchange = () => viewer.setExploreView({ xray: xray.checked ? 0.85 : 0 })
  $('reset').onclick = () => {
    select(null)
    setExplode(0)
    xray.checked = true
    viewer.setExploreView({ xray: 0.85 })
    viewer.resetRun()
    viewer.resetView()
    hud.hidden = true
  }

  // Run simulation + HUD
  const run = $<HTMLButtonElement>('run')
  const hud = $('hud')
  const plot = $<HTMLCanvasElement>('hud-plot')
  const plotCtx = plot.getContext('2d')!
  run.onclick = () => {
    viewer.resetRun()
    setExplode(0)
    xray.checked = true
    select(null)
    hud.hidden = false
    viewer.startRun()
  }
  viewer.onRun = (s: RunState) => {
    run.disabled = s.running
    seg.forEach((b) => (b.disabled = s.running))
    run.lastChild!.textContent = s.running ? 'Running…' : s.result ? 'Run again' : 'Run a test'
    $('hud-stage').textContent = s.result ? s.result : s.stage
    const t = $('hud-temp')
    t.textContent = `${s.temp.toFixed(1)} °C`
    t.classList.toggle('hot', s.temp > 70)
    $('hud-cycle').textContent = `Cycle ${Math.min(40, Math.floor(s.cycle))} / 40`
    drawScreen(plotCtx, plot.width, plot.height, s, true)
  }
}
