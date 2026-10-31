// Analyzer UI drawn into a 2D canvas: used as the 3D screen texture and the HUD.

export const TOTAL_CYCLES = 40
export const TARGET_CT = 24
export const THRESHOLD = 0.2

const sigmoid = (c: number, ct: number, k: number, amp: number) => 0.04 + amp / (1 + Math.exp(-(c - ct) / k))
export const targetSignal = (c: number) => sigmoid(c, TARGET_CT + 2.4, 1.5, 0.95)
export const controlSignal = (c: number) => sigmoid(c, 29, 1.7, 0.5)

export interface ScreenState {
  stage: string
  temp: number
  cycle: number
  result: string | null
}

const C = {
  bg: '#0d1012',
  grid: 'rgba(255,255,255,0.06)',
  text: '#e9e5dc',
  dim: 'rgba(233,229,220,0.5)',
  target: '#9fe870',
  control: '#7cc7ff',
  heat: '#ff9a4d',
}

export function drawScreen(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState, compact = false) {
  const u = h / 300
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, w, h)

  const pad = 22 * u
  const top = compact ? 12 * u : 64 * u
  if (!compact) {
    ctx.fillStyle = C.dim
    ctx.font = `${13 * u}px "Geist Mono", monospace`
    ctx.fillText('TRUELAB · MTB', pad, 30 * u)
    ctx.textAlign = 'right'
    ctx.fillText(s.cycle > 0 ? `CYCLE ${Math.min(TOTAL_CYCLES, Math.floor(s.cycle))}/${TOTAL_CYCLES}` : 'READY', w - pad, 30 * u)
    ctx.textAlign = 'left'
    ctx.fillStyle = C.text
    ctx.font = `500 ${19 * u}px "Geist", sans-serif`
    ctx.fillText(s.stage, pad, 54 * u)
    ctx.textAlign = 'right'
    ctx.fillStyle = s.temp > 70 ? C.heat : C.control
    ctx.fillText(`${s.temp.toFixed(1)} °C`, w - pad, 54 * u)
    ctx.textAlign = 'left'
  }

  // Plot area; the full view leaves room for axis labels.
  const x0 = pad + (compact ? 0 : 46 * u), x1 = w - pad, y0 = top + 8 * u, y1 = h - (compact ? 12 : 46) * u
  ctx.strokeStyle = C.grid
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = y0 + ((y1 - y0) * i) / 4
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
  }
  const px = (c: number) => x0 + ((x1 - x0) * c) / TOTAL_CYCLES
  const py = (v: number) => y1 - (y1 - y0) * v

  if (!compact) {
    ctx.strokeStyle = 'rgba(233,229,220,0.35)'
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke()
    ctx.fillStyle = C.dim
    ctx.font = `${11 * u}px "Geist Mono", monospace`
    ctx.textAlign = 'center'
    for (let c = 0; c <= TOTAL_CYCLES; c += 10) {
      ctx.beginPath(); ctx.moveTo(px(c), y1); ctx.lineTo(px(c), y1 + 4 * u); ctx.stroke()
      ctx.fillText(String(c), px(c), y1 + 17 * u)
    }
    ctx.fillStyle = C.text
    ctx.fillText('PCR cycle number →', (x0 + x1) / 2, y1 + 36 * u)
    ctx.textAlign = 'right'
    ctx.fillStyle = C.dim
    ctx.fillText('high', x0 - 6 * u, y0 + 9 * u)
    ctx.fillText('low', x0 - 6 * u, y1)
    ctx.save()
    ctx.translate(pad + 2 * u, (y0 + y1) / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = C.text
    ctx.fillText('Fluorescence (DNA amount) →', 0, 0)
    ctx.restore()
    ctx.textAlign = 'left'
  }

  ctx.setLineDash([4 * u, 4 * u])
  ctx.strokeStyle = 'rgba(233,229,220,0.25)'
  ctx.beginPath(); ctx.moveTo(x0, py(THRESHOLD)); ctx.lineTo(x1, py(THRESHOLD)); ctx.stroke()
  ctx.setLineDash([])
  if (!compact) {
    ctx.fillStyle = C.dim
    ctx.font = `${10 * u}px "Geist Mono", monospace`
    ctx.textAlign = 'right'
    ctx.fillText('THRESHOLD', x1, py(THRESHOLD) - 6 * u)
    ctx.textAlign = 'left'
  }

  const end = Math.min(TOTAL_CYCLES, s.cycle)
  const plot = (fn: (c: number) => number, color: string) => {
    if (end <= 0) return
    ctx.strokeStyle = color
    ctx.lineWidth = 2.4 * u
    ctx.beginPath()
    for (let c = 0; c <= end; c += 0.25) {
      const x = px(c), y = py(fn(c))
      c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  plot(controlSignal, C.control)
  plot(targetSignal, C.target)

  if (!compact && end >= TARGET_CT) {
    // Ct: the cycle where the target curve crosses the threshold.
    const cx = px(TARGET_CT), cy = py(THRESHOLD)
    ctx.setLineDash([2 * u, 3 * u])
    ctx.strokeStyle = C.target
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, y1); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = C.target
    ctx.beginPath(); ctx.arc(cx, cy, 4 * u, 0, Math.PI * 2); ctx.fill()
    ctx.font = `500 ${11 * u}px "Geist Mono", monospace`
    ctx.textAlign = 'right'
    ctx.fillText(`Ct = ${TARGET_CT}`, cx - 8 * u, cy - 8 * u)
    ctx.textAlign = 'left'
  }

  if (!compact) {
    // Legend
    ctx.font = `${11 * u}px "Geist", sans-serif`
    const items: [string, string][] = [['Target (TB DNA)', C.target], ['Internal control', C.control]]
    // Sits in the empty early-cycle area, below the result badge.
    let ly = y0 + 84 * u
    for (const [label, color] of items) {
      const lx = x0 + 12 * u
      ctx.fillStyle = color
      ctx.fillRect(lx, ly - 4 * u, 14 * u, 2.4 * u)
      ctx.fillStyle = C.text
      ctx.fillText(label, lx + 20 * u, ly)
      ly += 17 * u
    }
  }

  if (s.result && !compact) {
    ctx.fillStyle = 'rgba(13,16,18,0.82)'
    ctx.fillRect(x0, y0 + 6 * u, 236 * u, 52 * u)
    ctx.fillStyle = C.target
    ctx.font = `600 ${18 * u}px "Geist", sans-serif`
    ctx.fillText(s.result, x0 + 12 * u, y0 + 30 * u)
    ctx.fillStyle = C.dim
    ctx.font = `${12 * u}px "Geist Mono", monospace`
    ctx.fillText(`Ct ${TARGET_CT.toFixed(1)} · control valid`, x0 + 12 * u, y0 + 48 * u)
  }
}
