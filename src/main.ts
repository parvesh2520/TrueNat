import './styles/main.css'
import { Viewer, POSES } from './scenes/viewer'
import { drawScreen, TOTAL_CYCLES } from './scenes/screen'
import { initExploreUI } from './components/ui'
import { initSmoothScroll, initReveal, createScrollFx, storyPosition } from './utils/scroll'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const viewer = new Viewer(canvas)
const lenis = initSmoothScroll()
const scrollFx = createScrollFx()
const sections = [...document.querySelectorAll<HTMLElement>('[data-pose]')]
const explore = document.getElementById('explore')!

initReveal()
initExploreUI(viewer)

// Chapter rail
const rail = document.querySelector('.rail')!
const labels = ['Intro', 'Idea', 'Inside', 'Chip', 'Optics', 'Exploded', 'Explore']
rail.innerHTML = labels.map((l, i) => `<li>${String(i).padStart(2, '0')} ${l}</li>`).join('')
const railItems = [...rail.children]

// Static result plot in the "Reading the result" section
const curve = document.getElementById('curve-plot') as HTMLCanvasElement
const drawCurve = () =>
  drawScreen(curve.getContext('2d')!, curve.width, curve.height, { stage: 'Run complete', temp: 60, cycle: TOTAL_CYCLES, result: 'MTB DETECTED' })
drawCurve()
document.fonts.ready.then(() => (drawCurve(), viewer.drawScreen()))

addEventListener('resize', () => viewer.resize())
viewer.resize()
requestAnimationFrame(() => canvas.classList.add('ready'))

function frame(time: number) {
  lenis?.raf(time)
  scrollFx()

  const r = explore.getBoundingClientRect()
  const vh = innerHeight
  viewer.setExplore(r.top < vh * 0.2 && r.bottom > vh * 0.8)
  const { a, b, u, index } = storyPosition(sections)
  if (!viewer.explore) viewer.setStory(POSES[a], POSES[b], u)
  railItems.forEach((li, i) => li.classList.toggle('on', i === index))
  rail.classList.toggle('hide', index === 0 || r.top < vh * 0.5)

  // The canvas is fully covered once the explore section has scrolled away.
  if (r.bottom > 0) viewer.render()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
