import * as THREE from 'three'
import { makeRng } from './three-utils.js'

export const TYPES = {
  sun: {
    stem: [1.9, 3.0],
    radius: 0.04,
    size: [0.85, 1.25],
    tilt: [0.85, 1.2],
    leaves: 2,
    leafSize: [0.75, 1.05],
    colors: ['#a8420a', '#ffae0e', '#ffd542'],
    center: { r: 0.3, dome: 0.28, tex: 'sun' },
    calyx: 0.3,
    layers: [
      { n: 17, len: 0.62, w: 0.19, cup: 0.05, droop: 0.12, tip: 0.1, r0: 0.27, y: 0, open: 1.4, closed: 0.06, delay: 0, yaw0: 0 },
      { n: 17, len: 0.52, w: 0.2, cup: 0.09, droop: 0.04, tip: 0.15, r0: 0.22, y: -0.012, open: 1.16, closed: 0.03, delay: 0.12, yaw0: 0.5 },
    ],
  },
  daisy: {
    stem: [0.75, 1.5],
    radius: 0.016,
    size: [0.8, 1.1],
    tilt: [0.35, 0.85],
    leaves: 1,
    leafSize: [0.45, 0.65],
    colors: ['#e07b06', '#ffd21c', '#fff08a'],
    center: { r: 0.115, dome: 0.6, tex: 'daisy' },
    calyx: 0.12,
    layers: [
      { n: 14, len: 0.44, w: 0.14, cup: 0.04, droop: 0.08, tip: 0.85, r0: 0.1, y: 0, open: 1.46, closed: 0.05, delay: 0, yaw0: 0 },
    ],
  },
  tulip: {
    stem: [0.85, 1.5],
    radius: 0.022,
    size: [0.85, 1.05],
    tilt: [0, 0.22],
    leaves: 1,
    leafSize: [0.5, 0.75],
    colors: ['#d97e05', '#ffc40c', '#ffe25e'],
    center: null,
    calyx: 0.09,
    layers: [
      { n: 3, len: 0.52, w: 0.36, cup: 0.3, droop: -0.06, tip: 0.5, r0: 0.04, y: 0, open: 0.34, closed: 0.03, delay: 0, yaw0: 0 },
      { n: 3, len: 0.48, w: 0.33, cup: 0.32, droop: -0.1, tip: 0.5, r0: 0.03, y: -0.006, open: 0.2, closed: 0.02, delay: 0.15, yaw0: 0.5 },
    ],
  },
}

export const LEAF = { len: 0.55, w: 0.17, cup: 0.12, droop: 0.22, tip: 0.1 }
export const LEAF_COLORS = ['#2c5211', '#5c8f22', '#8bb23d']

// arma el campo: un girasol grande al medio y el resto repartido, mas abierto hacia el fondo.
// la seed es fija asi todos ven el mismo campo
export function buildField({ count, portrait, camPos }) {
  const rnd = makeRng(20250921)
  const rr = (a, b) => a + (b - a) * rnd()
  const spread = portrait ? 0.42 : 0.6
  const near = portrait ? 1.7 : 2.6

  // el ramo va adelante, el campo queda atras
  const spots = [{ x: 0.35, z: -4.5, type: 'sun', hero: true }]
  let guard = 0
  while (spots.length < count && guard++ < count * 60) {
    const z = -3.5 - Math.pow(rnd(), 1.35) * 14
    const halfWidth = near + (1 - z) * spread
    const x = rr(-halfWidth, halfWidth)
    if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 0.36)) continue
    const depth = (z + 17.5) / 14 // 0 = fondo, 1 = adelante
    const p = rnd()
    const type =
      depth < 0.45 ? (p < 0.62 ? 'sun' : p < 0.82 ? 'tulip' : 'daisy')
      : depth < 0.75 ? (p < 0.3 ? 'sun' : p < 0.62 ? 'tulip' : 'daisy')
      : (p < 0.12 ? 'sun' : p < 0.5 ? 'tulip' : 'daisy')
    spots.push({ x, z, type })
  }

  const flowers = spots.map((s, i) => {
    const T = TYPES[s.type]
    const h = s.hero ? 2.05 : s.frame ? rr(T.stem[1] * 0.95, T.stem[1] * 1.25) : rr(T.stem[0], T.stem[1])
    const bx = rr(-0.22, 0.22)
    const bz = rr(0.02, 0.22)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(bx * 0.2, h * 0.35, bz * 0.15),
      new THREE.Vector3(bx * 0.7, h * 0.76, bz * 0.6),
      new THREE.Vector3(bx, h, bz),
    ])
    const stemGeo = new THREE.TubeGeometry(curve, 10, T.radius, 5, false)
    const dist = Math.hypot(s.x - 0.35, s.z + 4.5)

    const leaves = []
    for (let l = 0; l < T.leaves; l++) {
      const at = rr(0.22, 0.55)
      leaves.push({
        pos: curve.getPoint(at),
        yaw: rr(0, Math.PI * 2),
        pitch: rr(0.85, 1.25),
        size: rr(T.leafSize[0], T.leafSize[1]),
      })
    }

    // que miren mas o menos a camara, pero no todas iguales
    const yaw = Math.atan2(camPos[0] - s.x, camPos[2] - s.z) + rr(-0.3, 0.3)

    return {
      type: s.type,
      hero: !!s.hero,
      frame: !!s.frame,
      x: s.x,
      z: s.z,
      yaw,
      spin: rr(0, Math.PI * 2),
      tilt: rr(T.tilt[0], T.tilt[1]),
      size: s.hero ? 1.32 : s.frame ? rr(1.05, 1.35) : rr(T.size[0], T.size[1]),
      phase: rr(0, Math.PI * 2),
      swayAmp: rr(0.014, 0.032) * (0.6 + h * 0.3),
      tip: curve.getPoint(1),
      stemGeo,
      leaves,
      grow: s.hero ? 0.5 : s.frame ? 0.25 + rr(0, 0.4) : 0.7 + dist * 0.17 + rr(0, 0.9),
      bloomLag: s.hero ? 1.5 : s.frame ? rr(1.3, 1.7) : rr(1.6, 2.2),
    }
  })

  return flowers
}

// el ramo: los tallos van juntos adentro del papel y se abren recien arriba del borde,
// asi no atraviesan el envoltorio. cada tallo se arma sobre +Z y despues se rota con el yaw
export const BOUQUET_RIM = 1.2

export function buildBouquet() {
  const rnd = makeRng(31415)
  const rr = (a, b) => a + (b - a) * rnd()
  const N = 21
  const V = (x, y, z) => new THREE.Vector3(x, y, z)

  return Array.from({ length: N }, (_, i) => {
    const ring = i === 0 ? 0 : i < 7 ? 1 : 2
    const theta = i * 2.399963 + rr(-0.18, 0.18)
    const type = ring === 0 ? 'sun' : ring === 1 ? (i % 2 ? 'sun' : 'daisy') : i % 3 === 0 ? 'tulip' : i % 3 === 1 ? 'daisy' : 'sun'
    const T = TYPES[type]

    const R = ring === 0 ? 0 : ring === 1 ? rr(0.34, 0.48) : rr(0.72, 0.92)
    const h = ring === 0 ? rr(2.25, 2.35) : ring === 1 ? rr(2.0, 2.15) : rr(1.62, 1.82)
    const rGrip = ring * 0.035
    const rRim = R * 0.55
    const curve = new THREE.CatmullRomCurve3([
      V(0, 0, rGrip),
      V(0, BOUQUET_RIM * 0.5, (rGrip + rRim) / 2),
      V(0, BOUQUET_RIM, rRim),
      V(0, (BOUQUET_RIM + h) / 2, R * 0.85),
      V(0, h, R),
    ])

    const size = type === 'sun' ? (ring === 0 ? rr(0.72, 0.8) : rr(0.5, 0.6)) : type === 'daisy' ? rr(0.52, 0.66) : rr(0.6, 0.74)

    return {
      type,
      bouquet: true,
      ring,
      x: 0,
      y: 0,
      z: 0,
      yaw: theta,
      lean: 0,
      roll: 0,
      spin: rr(0, Math.PI * 2),
      // las de afuera se inclinan mas, queda redondito
      tilt: ring === 0 ? rr(0, 0.06) : ring === 1 ? rr(0.22, 0.34) : rr(0.5, 0.68),
      size,
      phase: rr(0, Math.PI * 2),
      swayAmp: rr(0.006, 0.014),
      tip: curve.getPoint(1),
      stemGeo: new THREE.TubeGeometry(curve, 14, T.radius * 0.8, 5, false),
      leaves: [],
      // primero el centro y despues las de afuera
      grow: 1.9 + ring * 0.45 + rr(0, 0.35),
      bloomLag: rr(0.9, 1.3),
    }
  })
}
