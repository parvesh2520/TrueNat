// Procedural, stylised model of a Truelab-style real-time micro-PCR analyzer and Truenat chip.
// Units are arbitrary (~1 unit ≈ 7 cm). Not to scale; built for teaching.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PartId } from '../data/parts'

export const TOP = 1.22 // top surface of the housing
export const CHIP_SEAT = new THREE.Vector3(0.85, TOP + 0.02, 0.15)

type MatOpts = THREE.MeshPhysicalMaterialParameters
const mat = (color: THREE.ColorRepresentation, o: MatOpts = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, ...o })
const rbox = (w: number, h: number, d: number, r = 0.04, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, r)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const cyl = (r: number, h: number, seg = 32) => new THREE.CylinderGeometry(r, r, h, seg)

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.castShadow = o.receiveShadow = true
  return o
}

export interface PartRig {
  id: PartId
  movers: { obj: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 }[]
  anchor: THREE.Object3D
  meshes: THREE.Mesh[]
}

export interface Device {
  root: THREE.Group
  parts: Map<PartId, PartRig>
  pickables: THREE.Mesh[]
  shellMats: THREE.MeshPhysicalMaterial[]
  lidMat: THREE.MeshPhysicalMaterial
  lid: THREE.Object3D
  chip: THREE.Object3D
  fanBlades: THREE.Object3D
  heaterMat: THREE.MeshStandardMaterial
  fluidMat: THREE.MeshStandardMaterial
  ledMat: THREE.MeshStandardMaterial
  beamMat: THREE.MeshBasicMaterial
  screen: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture }
}

function pcbTexture() {
  const c = document.createElement('canvas')
  c.width = 1024; c.height = 742
  const g = c.getContext('2d')!
  g.fillStyle = '#0d3324'
  g.fillRect(0, 0, c.width, c.height)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.lineCap = 'round'
  for (let i = 0; i < 140; i++) {
    g.strokeStyle = rnd() > 0.85 ? 'rgba(214,176,92,0.55)' : 'rgba(90,170,120,0.35)'
    g.lineWidth = 2 + rnd() * 3
    let x = rnd() * c.width, y = rnd() * c.height
    g.beginPath(); g.moveTo(x, y)
    for (let s = 0; s < 4; s++) {
      if (s % 2) x += (rnd() - 0.5) * 300
      else y += (rnd() - 0.5) * 300
      g.lineTo(x, y)
    }
    g.stroke()
    g.fillStyle = 'rgba(214,176,92,0.7)'
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function logoTexture() {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(40,42,46,0.85)'
  g.font = '600 34px Geist, sans-serif'
  g.textBaseline = 'middle'
  g.fillText('truelab', 6, 32)
  g.font = '22px "Geist Mono", monospace'
  g.fillStyle = 'rgba(40,42,46,0.5)'
  g.fillText('UNO · micro PCR', 160, 34)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildDevice(): Device {
  const root = new THREE.Group()
  const parts = new Map<PartId, PartRig>()

  const register = (id: PartId, obj: THREE.Object3D, offset: [number, number, number], anchor?: [number, number, number]) => {
    let rig = parts.get(id)
    if (!rig) {
      const a = new THREE.Object3D()
      a.position.set(...(anchor ?? [0, 0, 0]))
      obj.add(a)
      rig = { id, movers: [], anchor: a, meshes: [] }
      parts.set(id, rig)
    }
    // Each part gets its own copies of shared materials so highlighting stays local.
    const copies = new Map<THREE.Material, THREE.Material>()
    rig.movers.push({ obj, base: obj.position.clone(), offset: new THREE.Vector3(...offset) })
    obj.traverse((m) => {
      if (m instanceof THREE.Mesh && !m.userData.part) {
        m.userData.part = id
        rig!.meshes.push(m)
        const src = m.material as THREE.Material
        if (!src.userData.unique) {
          if (!copies.has(src)) copies.set(src, src.clone())
          m.material = copies.get(src)!
        }
      }
    })
  }

  const graphite = mat('#2a2d32', { roughness: 0.6 })
  const gold = mat('#d6b05c', { metalness: 1, roughness: 0.28 })
  const steel = mat('#b9bec6', { metalness: 1, roughness: 0.32 })
  const black = mat('#141518', { roughness: 0.5 })

  // ── Enclosure: base + removable cover (cover carries display and lid) ──
  const base = new THREE.Group()
  base.add(mesh(rbox(3.2, 0.3, 2.4, 0.1), mat('#3a3d43', { roughness: 0.7 }), 0, 0.15, 0))
  for (const [x, z] of [[-1.35, -0.95], [1.35, -0.95], [-1.35, 0.95], [1.35, 0.95]])
    base.add(mesh(cyl(0.12, 0.04), black, x, 0.0, z))
  root.add(base)

  const cover = new THREE.Group()
  root.add(cover)
  const shellMat = mat('#ebe8e2', { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, transparent: true })
  const recessMat = mat('#1b1d21', { roughness: 0.8, transparent: true })
  const logoMat = new THREE.MeshPhysicalMaterial({ map: logoTexture(), transparent: true, roughness: 0.5 })
  for (const m of [shellMat, recessMat, logoMat]) m.userData.unique = true
  cover.add(mesh(rbox(3.2, 0.92, 2.4, 0.14, 6), shellMat, 0, 0.76, 0))
  const recess = mesh(new THREE.PlaneGeometry(1.02, 1.32), recessMat, CHIP_SEAT.x, TOP + 0.002, 0.17)
  recess.rotation.x = -Math.PI / 2
  cover.add(recess)
  const logo = mesh(new THREE.PlaneGeometry(1.6, 0.2), logoMat, -0.62, 0.62, 1.201)
  logo.castShadow = false
  cover.add(logo)
  const statusLed = mesh(box(0.22, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: '#a6e86f', emissive: '#a6e86f', emissiveIntensity: 2 }), 1.2, 0.62, 1.205)
  statusLed.userData.noHighlight = true
  cover.add(statusLed)
  register('housing', cover, [0, 2.9, 0], [-1.6, 0.8, 0.6])
  register('housing', base, [0, -0.45, 0])

  // ── Touchscreen ──
  const display = new THREE.Group()
  display.position.set(-0.62, TOP + 0.24, 0.3)
  display.rotation.x = 0.38
  display.add(mesh(rbox(1.86, 0.07, 1.16, 0.035), mat('#111316', { roughness: 0.3, clearcoat: 1 }), 0, 0, 0))
  display.add(mesh(box(1.7, 0.3, 0.5), graphite, 0, -0.17, -0.3))
  const canvas = document.createElement('canvas')
  canvas.width = 688; canvas.height = 400
  const screenTex = new THREE.CanvasTexture(canvas)
  screenTex.colorSpace = THREE.SRGBColorSpace
  const screen = mesh(
    new THREE.PlaneGeometry(1.72, 1.0),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
    0, 0.037, 0,
  )
  screen.rotation.x = -Math.PI / 2
  screen.userData.noHighlight = true
  display.add(screen)
  cover.add(display)
  register('display', display, [0, 0.5, 0.45], [0, 0.05, 0])

  // ── Lid (hinged at the back of the chip bay) ──
  const lid = new THREE.Group()
  lid.position.set(CHIP_SEAT.x, TOP + 0.04, -0.5)
  const lidMat = mat('#2b2e33', { roughness: 0.35, clearcoat: 0.6, transparent: true })
  lidMat.userData.unique = true
  lid.add(mesh(rbox(1.04, 0.07, 1.34, 0.03), lidMat, 0, 0.035, 0.67))
  lid.add(mesh(box(0.5, 0.01, 0.06), mat('#55595f'), 0, 0.072, 1.22))
  for (const x of [-0.42, 0.42]) {
    const h = mesh(cyl(0.035, 0.14), steel, x, 0.03, 0.0)
    h.rotation.z = Math.PI / 2
    lid.add(h)
  }
  cover.add(lid)
  register('lid', lid, [0, 0.35, 0], [0, 0.1, 1.25])

  // ── Truenat chip ──
  const chip = new THREE.Group()
  chip.position.copy(CHIP_SEAT)
  chip.add(mesh(rbox(0.46, 0.03, 0.95, 0.012), mat('#f3f1ea', { roughness: 0.75 }), 0, 0, 0))
  chip.add(mesh(box(0.462, 0.034, 0.14), mat('#c4483a', { roughness: 0.5 }), 0, 0, -0.39))
  chip.add(mesh(cyl(0.095, 0.02), mat('#d9e4ea', { transmission: 0.9, roughness: 0.05, thickness: 0.05, transparent: true, opacity: 0.6 }), 0, 0.02, -0.15))
  const fluidMat = new THREE.MeshStandardMaterial({ color: '#cfe8d2', emissive: '#7dff6a', emissiveIntensity: 0, roughness: 0.2 })
  fluidMat.userData.unique = true
  const fluid = mesh(cyl(0.07, 0.012), fluidMat, 0, 0.022, -0.15)
  fluid.userData.noHighlight = true
  chip.add(fluid)
  const heaterMat = new THREE.MeshStandardMaterial({ color: '#8a5a2a', emissive: '#ff7a2a', emissiveIntensity: 0, metalness: 0.6, roughness: 0.3 })
  heaterMat.userData.unique = true
  const heater = mesh(new THREE.TorusGeometry(0.125, 0.008, 8, 48), heaterMat, 0, 0.017, -0.15)
  heater.rotation.x = Math.PI / 2
  heater.userData.noHighlight = true
  chip.add(heater)
  chip.add(mesh(cyl(0.035, 0.02), black, 0, 0.018, 0.12))
  chip.add(mesh(box(0.012, 0.004, 0.17), mat('#9aa3a8'), 0, 0.017, -0.015))
  for (let i = 0; i < 4; i++) chip.add(mesh(box(0.06, 0.006, 0.09), gold, -0.12 + i * 0.08, 0.016, 0.38))
  root.add(chip)
  register('chip', chip, [0, 1.2, 0], [0, 0.04, -0.15])

  // ── Contact block / cradle with pogo pins ──
  const contacts = new THREE.Group()
  contacts.position.set(CHIP_SEAT.x, TOP - 0.08, CHIP_SEAT.z)
  contacts.add(mesh(rbox(0.7, 0.12, 1.1, 0.02), mat('#33373d', { metalness: 0.3, roughness: 0.45 }), 0, 0, 0))
  contacts.add(mesh(cyl(0.1, 0.125), black, 0, 0.002, -0.15))
  for (let i = 0; i < 4; i++) contacts.add(mesh(cyl(0.013, 0.1, 12), gold, -0.12 + i * 0.08, 0.06, 0.38))
  root.add(contacts)
  register('contacts', contacts, [0, 0.9, 0], [0.35, 0, 0.3])

  // ── Optical module under the reaction chamber ──
  const optics = new THREE.Group()
  optics.position.set(CHIP_SEAT.x, 0.72, CHIP_SEAT.z - 0.15)
  optics.add(mesh(rbox(0.6, 0.34, 0.5, 0.03), mat('#2b3442', { metalness: 0.65, roughness: 0.35 }), 0, 0, 0))
  optics.add(mesh(cyl(0.075, 0.08), mat('#cfe3ff', { transmission: 1, roughness: 0, thickness: 0.1 }), 0, 0.2, 0))
  const ledMat = new THREE.MeshStandardMaterial({ color: '#3a6dff', emissive: '#3f7bff', emissiveIntensity: 0.2 })
  ledMat.userData.unique = true
  const led = mesh(cyl(0.04, 0.08), ledMat, -0.33, 0.05, 0)
  led.rotation.z = Math.PI / 2
  led.userData.noHighlight = true
  optics.add(led)
  optics.add(mesh(box(0.06, 0.16, 0.16), black, 0.33, 0.05, 0))
  optics.add(mesh(box(0.07, 0.08, 0.08), mat('#3b3f26', { metalness: 0.4, roughness: 0.2 }), 0.335, 0.05, 0))
  const beamMat = new THREE.MeshBasicMaterial({ color: '#5b8cff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  beamMat.userData.unique = true
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.3, 24, 1, true), beamMat)
  beam.position.y = 0.36
  beam.userData.noHighlight = true
  beam.userData.noPick = true
  optics.add(beam)
  root.add(optics)
  register('optics', optics, [0.8, 0.35, 0.2], [0, 0.2, 0.25])

  // ── Fan + heat sink ──
  const fan = new THREE.Group()
  fan.position.set(CHIP_SEAT.x, 0, -0.8)
  const frame = mat('#26282c', { roughness: 0.6 })
  for (const [x, y, w, h] of [[0, 1.05, 0.66, 0.05], [0, 0.42, 0.66, 0.05], [-0.31, 0.735, 0.05, 0.66], [0.31, 0.735, 0.05, 0.66]])
    fan.add(mesh(box(w, h, 0.1), frame, x, y, -0.2))
  const blades = new THREE.Group()
  blades.position.set(0, 0.735, -0.2)
  blades.add(mesh(cyl(0.08, 0.08), frame, 0, 0, 0).rotateX(Math.PI / 2))
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group()
    pivot.rotation.z = (i / 7) * Math.PI * 2
    const b = mesh(box(0.24, 0.07, 0.008), mat('#33363b', { roughness: 0.5 }), 0.16, 0, 0)
    b.rotation.x = 0.5
    pivot.add(b)
    blades.add(pivot)
  }
  fan.add(blades)
  const alu = mat('#c3c7cc', { metalness: 0.9, roughness: 0.35 })
  fan.add(mesh(box(0.62, 0.04, 0.38), alu, 0, 0.52, 0.18))
  for (let i = 0; i < 10; i++) fan.add(mesh(box(0.022, 0.4, 0.36), alu, -0.28 + i * 0.062, 0.74, 0.18))
  root.add(fan)
  register('fan', fan, [0.4, 0.2, -0.9], [0, 1.0, -0.2])

  // ── Main controller board ──
  const pcb = new THREE.Group()
  pcb.position.set(0, 0.32, 0)
  pcb.add(mesh(box(2.9, 0.035, 2.1), new THREE.MeshPhysicalMaterial({ map: pcbTexture(), roughness: 0.45, clearcoat: 0.5 }), 0, 0, 0))
  pcb.add(mesh(box(0.34, 0.04, 0.34), black, -0.15, 0.035, 0.35))
  pcb.add(mesh(box(0.22, 0.03, 0.14), black, 0.25, 0.03, 0.7))
  pcb.add(mesh(box(0.22, 0.03, 0.14), black, 0.25, 0.03, 0.48))
  pcb.add(mesh(box(0.7, 0.06, 0.08), mat('#e8e2d0'), -0.2, 0.045, 0.85))
  for (let i = 0; i < 6; i++) pcb.add(mesh(cyl(0.035, 0.1, 16), mat('#1f2a44', { metalness: 0.4, roughness: 0.4 }), 0.2 + (i % 3) * 0.1, 0.07, 0.15 + Math.floor(i / 3) * 0.1))
  root.add(pcb)
  register('pcb', pcb, [0, -0.25, 0.25], [-0.15, 0.08, 0.35])

  // ── Battery ──
  const battery = new THREE.Group()
  battery.position.set(-0.8, 0.53, -0.55)
  battery.add(mesh(rbox(1.25, 0.34, 0.68, 0.05), mat('#22344d', { roughness: 0.4, clearcoat: 0.6 }), 0, 0, 0))
  battery.add(mesh(box(0.5, 0.346, 0.686), mat('#e9e5dc', { roughness: 0.6 }), 0.2, 0, 0))
  battery.add(mesh(box(0.08, 0.06, 0.12), steel, -0.66, 0.08, 0.15))
  battery.add(mesh(box(0.08, 0.06, 0.12), steel, -0.66, 0.08, -0.15))
  root.add(battery)
  register('battery', battery, [-0.9, 0.55, -0.2], [0, 0.18, 0])

  // ── Connectivity module ──
  const comms = new THREE.Group()
  comms.position.set(-1.0, 0.42, 0.62)
  comms.add(mesh(box(0.5, 0.025, 0.32), mat('#1d2a44'), 0, 0, 0))
  comms.add(mesh(box(0.28, 0.045, 0.2), steel, 0.05, 0.03, 0))
  comms.add(mesh(box(0.025, 0.55, 0.025), gold, -0.34, 0.28, 0))
  root.add(comms)
  register('comms', comms, [-0.75, 0.6, 0.65], [-0.34, 0.5, 0])

  // ── Rear ports ──
  const ports = new THREE.Group()
  ports.position.set(-0.4, 0.6, -1.21)
  const jack = mesh(cyl(0.06, 0.08), black, -0.5, 0, 0)
  jack.rotation.x = Math.PI / 2
  ports.add(jack)
  ports.add(mesh(cyl(0.025, 0.09), steel, -0.5, 0, 0).rotateX(Math.PI / 2))
  ports.add(mesh(box(0.17, 0.07, 0.08), steel, -0.2, 0, 0))
  ports.add(mesh(box(0.17, 0.07, 0.08), steel, 0.05, 0, 0))
  const btn = mesh(cyl(0.07, 0.06), mat('#1b1d21'), 0.4, 0, 0)
  btn.rotation.x = Math.PI / 2
  ports.add(btn)
  root.add(ports)
  register('ports', ports, [0, 0, -0.7], [0, 0.08, -0.05])

  const pickables: THREE.Mesh[] = []
  for (const rig of parts.values()) for (const m of rig.meshes) if (!m.userData.noPick) pickables.push(m)

  return {
    root, parts, pickables,
    shellMats: [shellMat, recessMat, logoMat],
    lidMat,
    lid, chip, fanBlades: blades, heaterMat, fluidMat, ledMat, beamMat,
    screen: { canvas, ctx: canvas.getContext('2d')!, tex: screenTex },
  }
}
