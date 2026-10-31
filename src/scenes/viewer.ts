import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { buildDevice, CHIP_SEAT, type Device } from './device'
import { drawScreen, targetSignal, TOTAL_CYCLES, type ScreenState } from './screen'
import type { PartId } from '../data/parts'

export interface Pose {
  pos: [number, number, number]
  target: [number, number, number]
  explode: number
  xray: number
  shift: number // -1 … 1, slides the device left/right of the viewport
  lid?: number // 0 closed … 1 open
  focus?: PartId
}

export const POSES: Record<string, Pose> = {
  hero: { pos: [5.6, 3.5, 6.6], target: [0, 0.6, 0], explode: 0, xray: 0, shift: 0.9 },
  compact: { pos: [-6.5, 3.2, 7.2], target: [0, 0.6, 0], explode: 0, xray: 0, shift: 1 },
  inside: { pos: [6.0, 7.0, 5.0], target: [0, 0.5, 0], explode: 0, xray: 1, shift: -1 },
  chip: { pos: [3.6, 4.0, 3.6], target: [0.85, 1.2, 0.15], explode: 0, xray: 1, shift: 1, lid: 1, focus: 'chip' },
  optics: { pos: [5.8, 2.2, 4.4], target: [0.85, 0.9, 0.0], explode: 0, xray: 1, shift: -1, lid: 1, focus: 'optics' },
  exploded: { pos: [-9.5, 7.6, 10.5], target: [0, 1.9, 0], explode: 1, xray: 0, shift: 1 },
  explore: { pos: [7.0, 6.0, 8.0], target: [0, 1.0, 0], explode: 0, xray: 0.85, shift: 0 },
}

export interface RunState extends ScreenState {
  running: boolean
}

const RUN = { open: 1.1, insert: 2.4, close: 3.2, hot: 4.6, cycle: 0.34 }
const RUN_END = RUN.hot + TOTAL_CYCLES * RUN.cycle
const HIGHLIGHT = new THREE.Color('#a6e86f')
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt)

export class Viewer {
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  readonly scene = new THREE.Scene()
  readonly device: Device
  readonly controls: OrbitControls

  explore = false
  selected: PartId | null = null
  hovered: PartId | null = null
  explodeTarget = 0
  xrayTarget = 0
  lidTarget = 0
  /** The user's assembled/exploded and X-ray choice in explore mode; survives scrolling out and back. */
  readonly exploreView = { explode: POSES.explore.explode, xray: POSES.explore.xray }
  run: RunState = { running: false, stage: 'Ready — insert chip', temp: 25, cycle: 0, result: null }

  onSelect: (id: PartId | null) => void = () => {}
  onFrame: (anchors: Map<PartId, { x: number; y: number; visible: boolean }>) => void = () => {}
  onRun: (s: RunState) => void = () => {}

  private explode = 0
  private xray = 0
  private lidOpen = 0
  private shift = 0
  private shiftTarget = 0
  private storyFocus: PartId | null = null
  private camPos = new THREE.Vector3()
  private look = new THREE.Vector3()
  private flight: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null
  private runTime = -1
  private fanSpeed = 2
  private clock = new THREE.Clock()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private down = { x: 0, y: 0 }
  private emissive = new Map<THREE.Material, THREE.Color>()

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.55

    const key = new THREE.DirectionalLight('#fff4e6', 2.4)
    key.position.set(4, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = key.shadow.camera.bottom = -5
    key.shadow.camera.right = key.shadow.camera.top = 5
    key.shadow.radius = 6
    key.shadow.bias = -0.0005
    const rim = new THREE.DirectionalLight('#9fc4ff', 1.2)
    rim.position.set(-6, 3, -5)
    this.scene.add(key, rim, new THREE.HemisphereLight('#ffffff', '#1a1a1a', 0.4))

    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.ShadowMaterial({ opacity: 0.32 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.02
    floor.receiveShadow = true
    this.scene.add(floor)

    this.device = buildDevice()
    this.scene.add(this.device.root)
    for (const rig of this.device.parts.values())
      for (const m of rig.meshes) {
        const mt = m.material as THREE.MeshStandardMaterial
        if (!m.userData.noHighlight && mt.emissive && !this.emissive.has(mt)) this.emissive.set(mt, mt.emissive.clone())
      }

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.minPolarAngle = 0.15
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05
    this.controls.enabled = false
    this.controls.addEventListener('start', () => (this.flight = null))
    canvas.style.touchAction = 'pan-y'

    this.camPos.set(...POSES.hero.pos)
    this.look.set(...POSES.hero.target)
    this.camera.position.copy(this.camPos)

    canvas.addEventListener('pointermove', (e) => this.hover(e))
    canvas.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY }))
    canvas.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 5 && this.explore) this.onSelect(this.pick(e))
    })
    this.drawScreen()
  }

  resize() {
    const w = innerWidth, h = innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Blend between two story poses; u in 0…1. */
  setStory(a: Pose, b: Pose, u: number) {
    const k = ease(u)
    const v = (p: number[], q: number[]) => new THREE.Vector3(...p).lerp(new THREE.Vector3(...q), k)
    this.camPos.copy(v(a.pos, b.pos))
    this.look.copy(v(a.target, b.target))
    this.explodeTarget = THREE.MathUtils.lerp(a.explode, b.explode, k)
    this.xrayTarget = THREE.MathUtils.lerp(a.xray, b.xray, k)
    this.shiftTarget = THREE.MathUtils.lerp(a.shift, b.shift, k)
    this.lidTarget = THREE.MathUtils.lerp(a.lid ?? 0, b.lid ?? 0, k)
    this.storyFocus = (k < 0.5 ? a.focus : b.focus) ?? null
  }

  setExplore(on: boolean) {
    if (on === this.explore) return
    this.explore = on
    this.controls.enabled = on
    this.canvas.style.pointerEvents = on ? 'auto' : 'none'
    if (on) {
      this.controls.target.copy(this.look)
      this.explodeTarget = this.exploreView.explode
      this.xrayTarget = this.exploreView.xray
      this.shiftTarget = 0
      this.lidTarget = 0
    } else {
      this.flight = null
      this.hovered = null
      this.canvas.style.cursor = ''
    }
  }

  setExploreView(v: Partial<{ explode: number; xray: number }>) {
    Object.assign(this.exploreView, v)
    if (!this.explore) return
    this.explodeTarget = this.exploreView.explode
    this.xrayTarget = this.exploreView.xray
  }

  flyTo(pos: THREE.Vector3Like, target: THREE.Vector3Like) {
    this.flight = { pos: new THREE.Vector3().copy(pos), target: new THREE.Vector3().copy(target) }
  }

  focusPart(id: PartId) {
    const rig = this.device.parts.get(id)!
    const p = rig.anchor.getWorldPosition(new THREE.Vector3())
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    this.flyTo(p.clone().addScaledVector(dir, id === 'housing' ? 9 : 5.5), p)
  }

  resetView() {
    this.flyTo(new THREE.Vector3(...POSES.explore.pos), new THREE.Vector3(...POSES.explore.target))
  }

  startRun() {
    this.runTime = 0
    this.setExploreView({ explode: 0, xray: 0.6 })
    this.flyTo(new THREE.Vector3(4.2, 3.6, 4.4), new THREE.Vector3(0.5, 1.0, 0.1))
  }

  private pick(e: PointerEvent): PartId | null {
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const skipShell = this.xray > 0.5
    const hit = this.raycaster
      .intersectObjects(this.device.pickables, false)
      .find((h) => !(skipShell && h.object.userData.part === 'housing'))
    return (hit?.object.userData.part as PartId) ?? null
  }

  private hover(e: PointerEvent) {
    if (!this.explore || e.buttons) return
    this.hovered = this.pick(e)
    this.canvas.style.cursor = this.hovered ? 'pointer' : ''
  }

  drawScreen() {
    const { canvas, ctx, tex } = this.device.screen
    drawScreen(ctx, canvas.width, canvas.height, this.run)
    tex.needsUpdate = true
  }

  private stepRun(dt: number) {
    const d = this.device
    let setpoint = 25, led = false
    if (this.runTime >= 0) {
      const t = (this.runTime += dt)
      const r = this.run
      r.running = t < RUN_END
      const open = t < RUN.insert ? ease(t / RUN.open) : 1 - ease((t - RUN.insert) / (RUN.close - RUN.insert))
      d.lid.rotation.x = -1.75 * open
      const drop = ease((t - RUN.open) / (RUN.insert - RUN.open))
      d.chip.position.y = CHIP_SEAT.y + 1.1 * (1 - drop)
      d.chip.scale.setScalar(Math.max(0.001, ease(t / 0.6)))

      if (t < RUN.open) r.stage = 'Opening lid'
      else if (t < RUN.insert) r.stage = 'Loading chip · 6 µL'
      else if (t < RUN.close) r.stage = 'Sealing chip bay'
      else if (t < RUN.hot) { r.stage = 'Hot start'; setpoint = 95 }
      else if (t < RUN_END) {
        r.cycle = (t - RUN.hot) / RUN.cycle
        const ph = r.cycle % 1
        setpoint = ph < 0.42 ? 95 : 60
        led = ph > 0.78 && ph < 0.96
        r.stage = ph < 0.42 ? 'Denaturing · 95 °C' : led ? 'Reading fluorescence' : 'Annealing / extension · 60 °C'
      } else {
        r.cycle = TOTAL_CYCLES
        r.stage = 'Run complete'
        r.result = 'MTB DETECTED'
        this.runTime = -1
      }
      r.temp += (setpoint - r.temp) * damp(t > RUN.close ? 16 : 2, dt)
      if (this.runTime < 0) r.running = false
      this.drawScreen()
      this.onRun(r)
    }
    const temp = this.run.temp
    d.heaterMat.emissiveIntensity = THREE.MathUtils.clamp((temp - 35) / 60, 0, 1) * 3
    d.ledMat.emissiveIntensity = led ? 6 : 0.2
    d.beamMat.opacity = led ? 0.5 : 0
    const glow = targetSignal(this.run.cycle)
    d.fluidMat.emissiveIntensity = this.run.cycle > 0 ? glow * (led ? 2.5 : 0.6) : 0
    const fanTarget = setpoint === 60 && temp > 63 ? 45 : this.runTime >= 0 ? 10 : 2
    this.fanSpeed += (fanTarget - this.fanSpeed) * damp(4, dt)
    d.fanBlades.rotation.z += this.fanSpeed * dt
  }

  resetRun() {
    this.runTime = -1
    Object.assign(this.run, { running: false, stage: 'Ready — insert chip', temp: 25, cycle: 0, result: null })
    this.device.chip.position.copy(CHIP_SEAT)
    this.device.chip.scale.setScalar(1)
    this.drawScreen()
    this.onRun(this.run)
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const time = this.clock.elapsedTime
    const d = this.device

    this.explode += (this.explodeTarget - this.explode) * damp(5, dt)
    this.xray += (this.xrayTarget - this.xray) * damp(5, dt)
    this.shift += (this.shiftTarget - this.shift) * damp(4, dt)

    const e = ease(this.explode)
    for (const rig of d.parts.values())
      for (const m of rig.movers) m.obj.position.copy(m.base).addScaledVector(m.offset, e)
    this.lidOpen += (this.lidTarget - this.lidOpen) * damp(4, dt)
    d.lid.rotation.x = -1.75 * ease(this.lidOpen)
    for (const m of d.shellMats) {
      m.opacity = 1 - 0.88 * this.xray
      m.depthWrite = this.xray < 0.05
    }
    d.lidMat.opacity = 1 - 0.65 * this.xray
    d.lidMat.depthWrite = this.xray < 0.05

    this.stepRun(dt)

    // Highlight: story focus, selection or hover.
    const focus = this.explore ? this.selected : this.storyFocus
    const pulse = 0.35 + 0.25 * Math.sin(time * 3)
    for (const [mt, base] of this.emissive) (mt as THREE.MeshStandardMaterial).emissive.copy(base)
    for (const [id, strength] of [[this.hovered, 0.18], [focus, pulse]] as const) {
      if (!id) continue
      for (const m of d.parts.get(id)!.meshes) {
        const base = this.emissive.get(m.material as THREE.Material)
        if (base) (m.material as THREE.MeshStandardMaterial).emissive.copy(base).lerp(HIGHLIGHT, strength)
      }
    }

    // Camera
    if (this.explore) {
      if (this.flight) {
        const k = damp(3.5, dt)
        this.camera.position.lerp(this.flight.pos, k)
        this.controls.target.lerp(this.flight.target, k)
        if (this.camera.position.distanceTo(this.flight.pos) < 0.02) this.flight = null
      }
      this.controls.update()
      this.look.copy(this.controls.target)
    } else {
      // Portrait screens: pull back so the device fits the narrow frustum.
      const pull = Math.max(1, 0.8 / this.camera.aspect)
      const desired = this.camPos.clone().sub(this.look).multiplyScalar(pull).add(this.look)
      this.camera.position.lerp(desired, damp(4, dt))
      this.camera.lookAt(this.look)
    }
    const w = innerWidth, h = innerHeight
    const narrow = w < 820
    // Wide: slide the device beside the text. Narrow: lift it above the text card.
    this.camera.setViewOffset(w, h, narrow ? 0 : -this.shift * w * 0.2, narrow && !this.explore ? h * 0.2 : 0, w, h)

    this.renderer.render(this.scene, this.camera)

    const anchors = new Map<PartId, { x: number; y: number; visible: boolean }>()
    const v = new THREE.Vector3()
    for (const [id, rig] of d.parts) {
      rig.anchor.getWorldPosition(v).project(this.camera)
      anchors.set(id, { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 })
    }
    this.onFrame(anchors)
  }
}
