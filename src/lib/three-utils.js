import * as THREE from 'three'

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smooth = (x) => x * x * (3 - 2 * x)
export const easeOut3 = (x) => 1 - Math.pow(1 - x, 3)
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const lerp = (a, b, t) => a + (b - a) * t

// los petalos se pasan un toque y vuelven, como una flor de verdad
export function easeBloom(x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const c = 1.15
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

export function makeRng(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// un petalo: finito en la base, se curva hacia adentro y cae en la punta.
// el color va de la base a la punta por vertice
export function petalGeometry({ len, w, cup = 0.06, droop = 0.1, tip = 0 }, colors) {
  const g = new THREE.PlaneGeometry(1, 1, 4, 10)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const c0 = new THREE.Color(colors[0])
  const c1 = new THREE.Color(colors[1])
  const c2 = new THREE.Color(colors[2])
  const c = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i)
    const v = pos.getY(i) + 0.5
    // forma: angosto abajo, ancho a un tercio, punta aguda o redonda segun tip
    const e = 0.78 - 0.45 * tip
    let width = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.62)), e)
    width = Math.max(width, 0.14 * (1 - v))

    const x = u * w * width
    const y = v * len
    // cup curva los bordes, droop tira la punta para atras
    const z = -cup * Math.pow(2 * u, 2) * w * width + droop * v * v * len

    pos.setXYZ(i, x, y, z)

    c.copy(c0).lerp(c1, smooth(clamp01(v / 0.45)))
    c.lerp(c2, smooth(clamp01((v - 0.45) / 0.55)))
    c.multiplyScalar(1 - 0.14 * Math.exp(-u * u * 70) * v) // venita del medio
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// centro de la flor: disco abombado mirando para arriba
export function centerGeometry(dome) {
  const g = new THREE.RingGeometry(0.0001, 1, 40, 6)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, dome * (1 - (x * x + y * y)))
  }
  g.rotateX(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

// semillas en espiral (fibonacci), oscuro al centro y mas calido en el borde
export function seedTexture(c0, c1, c2) {
  const s = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const x = cv.getContext('2d')
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, c0)
  g.addColorStop(0.72, c1)
  g.addColorStop(1, c2)
  x.fillStyle = g
  x.fillRect(0, 0, s, s)

  const seeds = 1200
  for (let i = 0; i < seeds; i++) {
    const r = Math.sqrt(i / seeds) * s * 0.475
    const a = i * 2.399963
    const px = s / 2 + Math.cos(a) * r
    const py = s / 2 + Math.sin(a) * r
    const k = r / (s * 0.475)
    x.fillStyle = `rgba(20,8,0,${0.2 + 0.25 * k})`
    x.beginPath()
    x.arc(px, py, 1.1 + r * 0.02, 0, 7)
    x.fill()
    x.fillStyle = `rgba(255,205,110,${0.12 + 0.4 * k})`
    x.beginPath()
    x.arc(px - 1.1, py - 1.1, 0.5 + r * 0.01, 0, 7)
    x.fill()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// hoja de pasto, arranca en y=0 y termina en punta
export function bladeGeometry() {
  const g = new THREE.PlaneGeometry(0.075, 1, 1, 3)
  g.translate(0, 0.5, 0)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setX(i, pos.getX(i) * (1 - y * 0.92))
  }
  g.computeVertexNormals()
  return g
}

// puntito suave para el polen y las flores lejanas
export function dotTexture() {
  const s = 64
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const x = cv.getContext('2d')
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.75)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, s, s)
  const t = new THREE.CanvasTexture(cv)
  return t
}

// corteza del tronco
export function barkTexture() {
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 512
  const x = cv.getContext('2d')
  x.fillStyle = '#5b3c22'
  x.fillRect(0, 0, 256, 512)
  const rnd = makeRng(77)
  for (let i = 0; i < 160; i++) {
    const px = rnd() * 256
    const w = 1.5 + rnd() * 5
    x.strokeStyle = rnd() < 0.55 ? `rgba(30,16,6,${0.25 + rnd() * 0.4})` : `rgba(150,105,65,${0.12 + rnd() * 0.25})`
    x.lineWidth = w
    x.beginPath()
    x.moveTo(px, 0)
    for (let y = 0; y <= 512; y += 32) x.lineTo(px + Math.sin(y * 0.02 + i) * 4, y)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 1)
  return t
}

// la parte de arriba del tronco: anillos y un par de grietas
export function ringsTexture() {
  const s = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const x = cv.getContext('2d')
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, '#d9b27a')
  g.addColorStop(0.85, '#c49660')
  g.addColorStop(0.92, '#6b4527')
  g.addColorStop(1, '#3e2614')
  x.fillStyle = g
  x.fillRect(0, 0, s, s)
  const rnd = makeRng(91)
  for (let r = 8; r < s * 0.44; r += 5 + rnd() * 9) {
    x.strokeStyle = `rgba(110,68,32,${0.18 + rnd() * 0.25})`
    x.lineWidth = 1 + rnd() * 2
    x.beginPath()
    x.ellipse(s / 2 + (rnd() - 0.5) * 3, s / 2 + (rnd() - 0.5) * 3, r, r * (0.97 + rnd() * 0.05), 0, 0, 7)
    x.stroke()
  }
  x.strokeStyle = 'rgba(60,34,14,.55)'
  x.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    const a = rnd() * 7
    x.beginPath()
    x.moveTo(s / 2 + Math.cos(a) * 40, s / 2 + Math.sin(a) * 40)
    x.lineTo(s / 2 + Math.cos(a + 0.05) * 210, s / 2 + Math.sin(a + 0.05) * 210)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// sombrita de contacto
export function shadowTexture() {
  const s = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const x = cv.getContext('2d')
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(cv)
}
