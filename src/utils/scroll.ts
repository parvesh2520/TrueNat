import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

export function initSmoothScroll() {
  return reducedMotion ? null : new Lenis({ lerp: 0.09, anchors: true })
}

/** Fade-up reveal for blocks marked `.reveal`. */
export function initReveal() {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
    { threshold: 0.25 },
  )
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Per-frame scroll effects that don't involve the 3D scene. */
export function createScrollFx() {
  const parallax = [...document.querySelectorAll<HTMLElement>('[data-speed]')]
  const workflow = document.getElementById('workflow')!
  const track = document.getElementById('track')!
  const bar = document.getElementById('track-bar')!
  const photos = [...track.querySelectorAll<HTMLImageElement>('.card-media img')]
  const travel = () => Math.max(0, track.scrollWidth - innerWidth)

  // Section is exactly as tall as the sideways travel needs, so no dead scroll after the last card.
  const fit = () => (workflow.style.height = `${innerHeight + travel()}px`)
  fit()
  addEventListener('resize', fit)
  document.fonts.ready.then(fit)

  return () => {
    const vh = innerHeight
    if (!reducedMotion)
      for (const el of parallax) {
        const r = el.parentElement!.getBoundingClientRect()
        if (r.bottom < -vh || r.top > 2 * vh) continue
        const d = r.top + r.height / 2 - vh / 2
        el.style.transform = `translate3d(0, ${(d * Number(el.dataset.speed)).toFixed(1)}px, 0)`
      }

    const w = workflow.getBoundingClientRect()
    const p = clamp01(-w.top / Math.max(1, w.height - vh))
    const max = travel()
    track.style.transform = `translate3d(${(-p * max).toFixed(1)}px, 0, 0)`
    bar.style.transform = `scaleX(${p})`

    // Photos drift against the track inside their frames.
    if (!reducedMotion && w.top < vh && w.bottom > 0)
      for (const img of photos) {
        const r = img.parentElement!.getBoundingClientRect()
        const d = (r.left + r.width / 2 - innerWidth / 2) / innerWidth
        img.style.transform = `translate3d(${(-d * 0.12 * r.width).toFixed(1)}px, 0, 0)`
      }
  }
}

/**
 * Locates the viewport centre between consecutive `[data-pose]` sections.
 * Returns the two pose names and a 0…1 blend that holds on each pose before moving on.
 */
export function storyPosition(sections: HTMLElement[]) {
  const mid = innerHeight / 2
  const centers = sections.map((s) => {
    const r = s.getBoundingClientRect()
    return r.top + r.height / 2
  })
  let i = 0
  while (i < centers.length - 2 && centers[i + 1] <= mid) i++
  const u = clamp01((mid - centers[i]) / (centers[i + 1] - centers[i]))
  return { a: sections[i].dataset.pose!, b: sections[i + 1].dataset.pose!, u: clamp01((u - 0.15) / 0.7), index: u > 0.5 ? i + 1 : i }
}
