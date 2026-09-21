import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, DepthOfField, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { TYPES, LEAF, LEAF_COLORS, buildField, buildBouquet } from '../lib/field.js'
import {
  bladeGeometry, centerGeometry, clamp01, dotTexture, easeBloom, easeInOut,
  easeOut3, makeRng, petalGeometry, seedTexture, smooth, barkTexture, ringsTexture, shadowTexture,
} from '../lib/three-utils.js'

// reloj compartido: <Clock/> lo actualiza y el resto lo lee
const S = { t: 0, st: 0, wind: 0, px: 0, py: 0, tx: 0, ty: 0 }

const SOLO = new URLSearchParams(window.location.search).has('solo') // para probar: ?solo muestra el ramo sin el campo
const SUN = new THREE.Vector3(-0.45, 0.2, -1).normalize()
// el ramo va en un frasco arriba de un tronco, asi no queda flotando
const STAND = { x: 0, z: 5.7, top: 1.05, jar: 0.44 }
const BOUQUET = { pos: [0, STAND.top + 0.08, STAND.z], tilt: 0.12, scale: 0.74, focus: [0, STAND.top + 1.1, STAND.z + 0.1] }
// entrada del ramo: baja girando, arranca 1s despues de abrir
const riseOf = (st) => easeOut3(clamp01((st - 1) / 3.2))
const HORIZON = new THREE.Color('#f8d795')

// material de los petalos, el sheen les da ese toque aterciopelado
function petalMaterial({ roughness, sheenColor, emissive, emissiveIntensity }) {
  const base = {
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness,
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
  }
  return new THREE.MeshPhysicalMaterial({ ...base, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(sheenColor) })
}

function Clock({ mode, startedRef }) {
  useFrame(({ clock }) => {
    S.frames++
    S.t = clock.elapsedTime
    S.st = mode === 'home' ? 40 : startedRef.current == null ? 0 : performance.now() / 1000 - startedRef.current
    S.px += (S.tx - S.px) * 0.045
    S.py += (S.ty - S.py) * 0.045
    S.wind = Math.sin(S.t * 0.37) * 0.55 + Math.sin(S.t * 0.13 + 1.2) * 0.45 + S.px * 0.7
  })
  return null
}

function Sky() {
  const ref = useRef()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { sun: { value: SUN } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec3 vDir; uniform vec3 sun;
          void main(){
            float h = normalize(vDir).y;
            vec3 low  = vec3(0.98, 0.78, 0.50);
            vec3 warm = vec3(1.00, 0.87, 0.62);
            vec3 top  = vec3(0.36, 0.58, 0.92);
            vec3 col = mix(warm, top, smoothstep(0.0, 0.7, h));
            col = mix(col, low, smoothstep(0.08, -0.25, h));
            float d = max(dot(normalize(vDir), sun), 0.0);
            col += vec3(1.0, 0.84, 0.52) * pow(d, 7.0) * 0.42;
            col += vec3(1.0, 0.95, 0.82) * pow(d, 260.0) * 3.0;
            gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame(({ camera }) => ref.current.position.copy(camera.position))
  return (
    <mesh ref={ref} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[100, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

function Grass({ count, reach }) {
  const ref = useRef()
  const geo = useMemo(bladeGeometry, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
          time: { value: 0 },
          wind: { value: 0 },
          fogColor: { value: HORIZON },
          fogNear: { value: 18 },
          fogFar: { value: 68 },
        },
        vertexShader: /* glsl */ `
          uniform float time; uniform float wind;
          varying float vY; varying float vDepth; varying float vSeed;
          void main(){
            vY = position.y;
            vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
            float ph = wp.x * 0.4 + wp.z * 0.3;
            float sway = sin(time * 1.25 + ph) * 0.1 + sin(time * 2.6 + ph * 2.2) * 0.035 + wind * 0.05;
            float k = vY * vY;
            wp.x += sway * k; wp.z += sway * 0.45 * k;
            vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
            vec4 mv = viewMatrix * wp;
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
          varying float vY; varying float vDepth; varying float vSeed;
          void main(){
            vec3 base = vec3(0.020, 0.055, 0.008);
            vec3 tip = mix(vec3(0.16, 0.34, 0.03), vec3(0.42, 0.46, 0.07), vSeed);
            vec3 c = mix(base, tip, vY * vY * 0.8 + vY * 0.2);
            c = mix(c, fogColor, smoothstep(fogNear, fogFar, vDepth));
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )

  useLayoutEffect(() => {
    const rnd = makeRng(4242)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      // que llegue hasta los pies de la camara y a los costados en pantallas anchas
      const z = 10 - Math.pow(rnd(), 1.4) * 33
      const x = (rnd() * 2 - 1) * (2.4 + (11 - z) * reach)
      e.set((rnd() - 0.5) * 0.35, rnd() * Math.PI, (rnd() - 0.5) * 0.35)
      q.setFromEuler(e)
      p.set(x, 0, z)
      const h = 0.3 + rnd() * 0.55
      s.set(0.8 + rnd() * 0.6, h, 1)
      ref.current.setMatrixAt(i, m.compose(p, q, s))
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [count, reach])

  useFrame(() => {
    mat.uniforms.time.value = S.t
    mat.uniforms.wind.value = S.wind
  })

  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />
}

function FarBlossoms({ count }) {
  const geo = useMemo(() => {
    const rnd = makeRng(99)
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * 26
      pos[i * 3 + 1] = 0.25 + rnd() * 0.7
      pos[i * 3 + 2] = -12 - rnd() * 16
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])
  const map = useMemo(dotTexture, [])
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={map} color="#ffcc33" size={0.22} sizeAttenuation transparent depthWrite={false} opacity={0.9} fog />
    </points>
  )
}

function Pollen({ count }) {
  const geo = useMemo(() => {
    const rnd = makeRng(777)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * 11
      pos[i * 3 + 1] = 0.2 + rnd() * 5.2
      pos[i * 3 + 2] = 4 - rnd() * 16
      seed[i] = rnd()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, alpha: { value: 0 }, px: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float seed; uniform float time; uniform float px;
          varying float vTw;
          void main(){
            vec3 p = position;
            p.x += sin(time * 0.28 + seed * 31.0) * 0.7;
            p.y += sin(time * 0.19 + seed * 17.0) * 0.5 + sin(time * 0.6 + seed * 8.0) * 0.08;
            p.z += cos(time * 0.24 + seed * 23.0) * 0.6;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (3.0 + seed * 9.0) * px * (8.0 / max(-mv.z, 0.6));
            vTw = 0.45 + 0.55 * (0.5 + 0.5 * sin(time * 1.6 + seed * 40.0));
          }`,
        fragmentShader: /* glsl */ `
          uniform float alpha; varying float vTw;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d); a *= a;
            gl_FragColor = vec4(vec3(2.2, 1.7, 0.85) * a * vTw * alpha, a * vTw * alpha);
          }`,
      }),
    [],
  )

  useFrame(({ gl }) => {
    mat.uniforms.time.value = S.t
    mat.uniforms.px.value = gl.getPixelRatio()
    mat.uniforms.alpha.value = clamp01((S.st - 2.5) / 5) * 0.9
  })

  return <points geometry={geo} material={mat} frustumCulled={false} />
}

// rayos de sol: planos que miran a camara y salen del sol. baratos y quedan lindos
function Rays({ n = 6 }) {
  const group = useRef()
  const shared = useMemo(() => ({ time: { value: 0 }, alpha: { value: 0 } }), [])
  const planes = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1)
    geo.translate(0, -0.5, 0)
    return [0.28, 0.44, 0.58, 0.72, 0.9, 1.05].slice(0, n).map((angle, i) => ({
      angle,
      width: 3.5 + ((i * 37) % 5),
      mat: new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { ...shared, seed: { value: i * 1.7 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv; uniform float time; uniform float alpha; uniform float seed;
          void main(){
            float across = exp(-pow((vUv.x - 0.5) * 3.0, 2.0) * 2.2);
            float along = pow(vUv.y, 1.7) * smoothstep(0.0, 0.22, vUv.y);
            float flick = 0.7 + 0.3 * sin(time * 0.33 + seed * 2.1);
            gl_FragColor = vec4(vec3(1.0, 0.85, 0.55) * across * along * flick * alpha, 0.0);
          }`,
      }),
      geo,
    }))
  }, [shared, n])

  useFrame(({ camera }) => {
    shared.time.value = S.t
    shared.alpha.value = clamp01((S.st - 1) / 6) * 0.16
    group.current.position.copy(camera.position).addScaledVector(SUN, 42)
    group.current.lookAt(camera.position)
  })

  return (
    <group ref={group} renderOrder={20}>
      {planes.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.mat} rotation-z={p.angle} scale={[p.width, 80, 1]} frustumCulled={false} />
      ))}
    </group>
  )
}

function Stand() {
  const kit = useMemo(() => {
    const bark = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 })
    const rings = new THREE.MeshStandardMaterial({ map: ringsTexture(), roughness: 0.85 })
    const shadow = shadowTexture()
    return {
      stumpGeo: new THREE.CylinderGeometry(0.56, 0.68, STAND.top, 32, 3),
      stumpMats: [bark, rings, bark],
      glassGeo: new THREE.CylinderGeometry(0.37, 0.32, STAND.jar, 40, 1, true),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#eef7f0',
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      waterGeo: new THREE.CylinderGeometry(0.345, 0.315, STAND.jar * 0.55, 32),
      water: new THREE.MeshStandardMaterial({ color: '#cfe6c8', transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false }),
      rimGeo: new THREE.TorusGeometry(0.37, 0.013, 8, 48),
      shadowMat: new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, color: '#000', opacity: 0.42 }),
      shadowTop: new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, color: '#000', opacity: 0.5 }),
    }
  }, [])

  return (
    <group position={[STAND.x, 0, STAND.z]}>
      <mesh geometry={kit.stumpGeo} material={kit.stumpMats} position-y={STAND.top / 2} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} material={kit.shadowMat}>
        <planeGeometry args={[2.4, 2.4]} />
      </mesh>
      <group position-y={STAND.top}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.004} material={kit.shadowTop}>
          <planeGeometry args={[1.1, 1.1]} />
        </mesh>
        <mesh geometry={kit.waterGeo} material={kit.water} position-y={(STAND.jar * 0.55) / 2} renderOrder={2} />
        <mesh geometry={kit.glassGeo} material={kit.glass} position-y={STAND.jar / 2} renderOrder={3} />
        <mesh geometry={kit.rimGeo} material={kit.glass} position-y={STAND.jar} rotation-x={Math.PI / 2} renderOrder={3} />
      </group>
    </group>
  )
}

// luz calida atras del ramo para despegarlo del fondo
function Halo() {
  const ref = useRef()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { alpha: { value: 0 }, time: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv; uniform float alpha; uniform float time;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float glow = exp(-d * d * 3.0);
            float breathe = 0.9 + 0.1 * sin(time * 1.2);
            gl_FragColor = vec4(vec3(1.0, 0.8, 0.42) * glow * alpha * breathe, 1.0);
          }`,
      }),
    [],
  )
  useFrame(({ camera }) => {
    mat.uniforms.time.value = S.t
    mat.uniforms.alpha.value = riseOf(S.st) * 0.5
    ref.current.lookAt(camera.position)
  })
  return (
    <mesh ref={ref} position={[BOUQUET.focus[0], BOUQUET.focus[1] - 0.1, BOUQUET.focus[2] - 1.4]} material={mat} renderOrder={5}>
      <planeGeometry args={[5, 5]} />
    </mesh>
  )
}

// destello dorado cuando el ramo termina de abrirse
function Burst({ count }) {
  const geo = useMemo(() => {
    const rnd = makeRng(2109)
    const dir = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const v = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      v.set(rnd() * 2 - 1, rnd() * 1.4 - 0.3, rnd() * 2 - 1).normalize()
      dir.set([v.x, v.y, v.z], i * 3)
      seed[i] = rnd()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(dir, 3))
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { age: { value: -1 }, px: { value: 1 }, origin: { value: new THREE.Vector3(...BOUQUET.focus) } },
        vertexShader: /* glsl */ `
          attribute float seed; uniform float age; uniform float px; uniform vec3 origin;
          varying float vA;
          void main(){
            float a = max(age, 0.0);
            float reach = (1.0 - exp(-a * (1.6 + seed * 1.4))) * (1.2 + seed * 1.4);
            vec3 p = origin + position * reach + vec3(0.0, -a * a * 0.04, 0.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (4.0 + seed * 8.0) * px * (6.0 / max(-mv.z, 0.5));
            vA = step(0.0, age) * smoothstep(0.0, 0.15, a) * (1.0 - smoothstep(0.8, 3.0 + seed, a));
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float k = smoothstep(0.5, 0.0, d); k *= k;
            gl_FragColor = vec4(vec3(2.4, 1.8, 0.8) * k * vA, 1.0);
          }`,
      }),
    [],
  )

  useFrame(({ gl }) => {
    mat.uniforms.age.value = S.st - 4.3
    mat.uniforms.px.value = gl.getPixelRatio()
  })

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />
}

function FallingPetals({ count }) {
  const ref = useRef()
  const geo = useMemo(() => petalGeometry({ len: 0.22, w: 0.13, cup: 0.05, droop: 0.04, tip: 0.8 }, TYPES.sun.colors), [])
  const mat = useMemo(
    () =>
      petalMaterial({ roughness: 0.5, sheenColor: '#fff3b8', emissive: '#402600', emissiveIntensity: 0.5 }),
    [],
  )
  const data = useMemo(() => {
    const rnd = makeRng(1357)
    return Array.from({ length: count }, () => {
      const dir = rnd() * Math.PI * 2
      return {
        x0: (rnd() * 2 - 1) * 9,
        z0: 7.5 - rnd() * 16,
        speed: 0.5 + rnd() * 0.55,
        omega: (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 1.4),
        slip: 0.25 + rnd() * 0.6,
        phase: rnd() * Math.PI * 2,
        dirX: Math.cos(dir),
        dirZ: Math.sin(dir),
        yaw: rnd() * Math.PI * 2,
        rollRate: 0.4 + rnd() * 1.2,
        size: 0.75 + rnd() * 1.05,
        seed: rnd(),
      }
    })
  }, [count])

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  )

  useFrame(() => {
    const { m, q, e, v, s } = tmp
    const H = 9
    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      const y = 7.5 - ((S.t * d.speed + d.seed * H) % H)
      const ang = d.phase + d.omega * S.t
      const side = -(d.slip / d.omega) * Math.cos(ang) // se va mas de costado cuando el petalo queda de canto
      const drift = Math.sin(S.t * 0.18 + d.seed * 6) * 0.9 + S.wind * 0.25
      v.set(d.x0 + d.dirX * side + drift, y, d.z0 + d.dirZ * side)
      e.set(ang, d.yaw + S.t * d.rollRate * 0.25, Math.sin(S.t * d.rollRate + d.phase) * 0.7, 'YXZ')
      q.setFromEuler(e)
      const alive = clamp01((S.st - 4.5 - d.seed * 3.5) / 1.5)
      const fade = smooth(clamp01(y / 0.7)) * (1 - smooth(clamp01((y - 6.2) / 1.2)))
      s.setScalar(d.size * alive * fade)
      ref.current.setMatrixAt(i, m.compose(v, q, s))
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />
}

// cono de papel kraft con pliegues, atado con un moño
function wrapGeometry() {
  const g = new THREE.CylinderGeometry(0.84, 0.13, 1.25, 48, 6, true)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const theta = Math.atan2(v.z, v.x)
    const r = Math.hypot(v.x, v.z)
    const y = (v.y + 0.625) / 1.25
    const fold = 1 + Math.cos(theta * 9) * 0.07 * y + Math.cos(theta * 4 + 1.3) * 0.05 * y
    const lift = Math.cos(theta * 9) * 0.05 * y * y
    p.setXYZ(i, Math.cos(theta) * r * fold, v.y + lift, Math.sin(theta) * r * fold)
  }
  g.computeVertexNormals()
  g.translate(0, 0.625, 0)
  return g
}

function Wrap() {
  const ref = useRef()
  const kit = useMemo(
    () => ({
      paper: wrapGeometry(),
      paperMat: new THREE.MeshStandardMaterial({ color: '#f9e4bb', roughness: 0.92, side: THREE.DoubleSide, emissive: new THREE.Color('#3a2a10'), emissiveIntensity: 0.55 }),
      ribbon: new THREE.TorusGeometry(0.34, 0.046, 10, 40),
      ribbonMat: new THREE.MeshStandardMaterial({ color: '#e3a417', roughness: 0.35, metalness: 0.15 }),
      tail: petalGeometry({ len: 0.6, w: 0.12, cup: 0.07, droop: 0.14, tip: 0.6 }, ['#c98305', '#f0b21a', '#ffd75c']),
    }),
    [],
  )

  useFrame(() => {
    const e = easeOut3(clamp01((S.st - 1.4) / 2.2))
    ref.current.scale.set(0.4 + 0.6 * e, Math.max(e, 0.001), 0.4 + 0.6 * e)
  })

  return (
    <group ref={ref}>
      <mesh geometry={kit.paper} material={kit.paperMat} position-y={0.02} />
      <mesh geometry={kit.ribbon} material={kit.ribbonMat} position-y={0.4} rotation-x={Math.PI / 2} />
      <mesh geometry={kit.tail} material={kit.ribbonMat} position={[0.18, 0.38, 0.34]} rotation={[2.75, 0.5, 0.25]} />
      <mesh geometry={kit.tail} material={kit.ribbonMat} position={[-0.15, 0.38, 0.36]} rotation={[2.62, -0.6, -0.2]} />
    </group>
  )
}

function Flowers({ flowers, bouquet, bouquetRef }) {
  const roots = useRef([])
  const heads = useRef([])
  const stems = useRef([])
  const meshes = useRef({})

  const all = useMemo(() => [...flowers, ...bouquet], [flowers, bouquet])

  const kit = useMemo(() => {
    const petalMat = petalMaterial({ roughness: 0.52, sheenColor: '#fff2b0', emissive: '#3a2200', emissiveIntensity: 0.45 })
    const leafMat = petalMat.clone()
    leafMat.emissiveIntensity = 0.08
    leafMat.sheen = 0.3

    const layers = {}
    for (const [name, T] of Object.entries(TYPES)) {
      T.layers.forEach((L, li) => {
        layers[`${name}:${li}`] = { key: `${name}:${li}`, geo: petalGeometry(L, T.colors), def: L, count: 0 }
      })
    }

    const rnd = makeRng(8181)
    const counts = { sun: 0, daisy: 0, calyx: 0, leaf: 0 }
    const color = new THREE.Color()

    const records = all.map((f) => {
      const T = TYPES[f.type]
      const petals = []
      T.layers.forEach((L, li) => {
        const bucket = layers[`${f.type}:${li}`]
        for (let k = 0; k < L.n; k++) {
          petals.push({
            key: bucket.key,
            idx: bucket.count++,
            yaw: ((k + (L.yaw0 || 0)) / L.n) * Math.PI * 2 + (rnd() - 0.5) * 0.12,
            roll: (rnd() - 0.5) * 0.22,
            sc: 0.88 + rnd() * 0.24,
            r0: L.r0,
            y: L.y,
            open: L.open + (rnd() - 0.5) * 0.16,
            closed: L.closed,
            delay: L.delay + rnd() * 0.14,
            ph: rnd() * Math.PI * 2,
            color: color.setRGB(1, 0.9 + rnd() * 0.14, 0.78 + rnd() * 0.3).clone(),
          })
        }
      })
      const center = T.center ? { tex: T.center.tex, r: T.center.r, idx: counts[T.center.tex]++ } : null
      const calyx = { r: T.calyx, idx: counts.calyx++ }
      const leaves = f.leaves.map((l) => ({ ...l, idx: counts.leaf++ }))
      return { petals, center, calyx, leaves }
    })

    return {
      petalMat,
      leafMat,
      layers,
      records,
      counts,
      leafGeo: petalGeometry(LEAF, LEAF_COLORS),
      calyxGeo: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      calyxMat: new THREE.MeshStandardMaterial({ color: '#4e7a1e', roughness: 0.8 }),
      stemMat: new THREE.MeshStandardMaterial({ color: '#568c20', roughness: 0.75 }),
      centerGeos: { sun: centerGeometry(TYPES.sun.center.dome), daisy: centerGeometry(TYPES.daisy.center.dome) },
      centerMats: {
        sun: new THREE.MeshStandardMaterial({ map: seedTexture('#2a1604', '#54300a', '#9a5510'), roughness: 0.85 }),
        daisy: new THREE.MeshStandardMaterial({ map: seedTexture('#b35a06', '#e08a10', '#f7b52a'), roughness: 0.85 }),
      },
    }
  }, [all])

  useLayoutEffect(() => {
    for (const rec of kit.records) {
      for (const p of rec.petals) meshes.current[p.key]?.setColorAt(p.idx, p.color)
    }
    for (const L of Object.values(kit.layers)) {
      const mesh = meshes.current[L.key]
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [kit])

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(), id: new THREE.Quaternion(), frame: 0 }),
    [],
  )

  useFrame(() => {
    const { m, q, e, v, s, id } = tmp
    const { st, t, wind } = S

    // el ramo entra y despues queda respirando
    const bq = bouquetRef.current
    if (bq) {
      const rise = riseOf(st)
      const settle = Math.sin(clamp01((st - 3.6) / 0.9) * Math.PI) * 0.025 // rebotecito al apoyarse
      bq.position.y = BOUQUET.pos[1] + 1.5 * (1 - rise) - settle
      bq.rotation.set(
        BOUQUET.tilt * rise + Math.sin(t * 0.5) * 0.018,
        -1.6 * (1 - rise) + Math.sin(t * 0.33) * 0.07,
        Math.sin(t * 0.42) * 0.022,
      )
      bq.scale.setScalar(BOUQUET.scale * (0.8 + 0.2 * rise))
      bq.updateMatrixWorld(true)
    }

    tmp.frame++
    for (let i = 0; i < all.length; i++) {
      const f = all[i]
      // las del campo ya abiertas estan desenfocadas y casi quietas, las actualizo cada 2 frames
      if (!f.bouquet && st > f.grow + f.bloomLag + 3.5 && (i + tmp.frame) % 2) continue
      const rec = kit.records[i]
      const root = roots.current[i]
      const head = heads.current[i]
      const stem = stems.current[i]
      if (!root || !head || !stem) continue

      const g = easeOut3(clamp01((st - f.grow) / 2.4))
      const b = clamp01((st - f.grow - f.bloomLag) / 2.8)
      const hb = smooth(b)

      const sway = f.swayAmp * (Math.sin(t * 0.9 + f.phase) + (f.bouquet ? 0.2 : wind * 0.55))
      if (f.bouquet) root.rotation.set(f.lean + Math.sin(t * 0.72 + f.phase) * f.swayAmp * 0.5, f.yaw, f.roll + sway)
      else root.rotation.set(Math.sin(t * 0.72 + f.phase * 1.7) * f.swayAmp * 0.6, f.yaw, sway)
      stem.scale.setScalar(Math.max(g, 1e-4))
      head.position.set(f.tip.x * g, f.tip.y * g, f.tip.z * g)
      // los tallos se abren pero las caras siguen mirando a camara
      const face = f.bouquet ? f.tilt - f.lean * 0.78 : f.tilt
      head.rotation.set(
        face * (0.3 + 0.7 * hb) + Math.sin(t * 1.05 + f.phase) * 0.025,
        f.spin,
        Math.sin(t * 0.8 + f.phase * 1.3) * 0.035,
      )
      head.scale.setScalar(f.size * g * (0.4 + 0.6 * hb))
      root.updateMatrixWorld(true)
      const H = head.matrixWorld

      for (const p of rec.petals) {
        const o = easeBloom(clamp01((b - p.delay) / 0.72))
        const th = p.closed + (p.open - p.closed) * o + Math.sin(t * 1.25 + p.ph) * 0.018 * o
        e.set(th, p.yaw, p.roll, 'YXZ')
        q.setFromEuler(e)
        v.set(Math.sin(p.yaw) * p.r0, p.y, Math.cos(p.yaw) * p.r0)
        s.setScalar(p.sc)
        meshes.current[p.key]?.setMatrixAt(p.idx, m.compose(v, q, s).premultiply(H))
      }

      if (rec.center) {
        const r = rec.center.r * (0.45 + 0.55 * hb)
        v.set(0, 0, 0)
        s.set(r, r, r)
        meshes.current[`center:${rec.center.tex}`]?.setMatrixAt(rec.center.idx, m.compose(v, id, s).premultiply(H))
      }

      const cr = rec.calyx.r
      v.set(0, -0.015, 0)
      s.set(cr * 1.05, cr * 0.95, cr * 1.05)
      meshes.current.calyx?.setMatrixAt(rec.calyx.idx, m.compose(v, id, s).premultiply(H))

      for (const l of rec.leaves) {
        v.copy(l.pos).multiplyScalar(g)
        e.set(l.pitch, l.yaw, 0, 'YXZ')
        q.setFromEuler(e)
        s.setScalar(l.size * g)
        meshes.current.leaf?.setMatrixAt(l.idx, m.compose(v, q, s).premultiply(root.matrixWorld))
      }
    }

    for (const mesh of Object.values(meshes.current)) if (mesh) mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {flowers.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]} rotation={[0, f.yaw, 0]} ref={(el) => { roots.current[i] = el }}>
          <mesh ref={(el) => { stems.current[i] = el }} geometry={f.stemGeo} material={kit.stemMat} frustumCulled={false} />
          <object3D ref={(el) => { heads.current[i] = el }} />
        </group>
      ))}

      <group ref={bouquetRef} position={BOUQUET.pos}>
        <Wrap />
        {bouquet.map((f, i) => {
          const idx = flowers.length + i
          return (
            <group
              key={`b${i}`}
              position={[f.x, f.y, f.z]}
              ref={(el) => {
                roots.current[idx] = el
                if (el) el.rotation.order = 'YXZ'
              }}
            >
              <mesh ref={(el) => { stems.current[idx] = el }} geometry={f.stemGeo} material={kit.stemMat} frustumCulled={false} />
              <object3D ref={(el) => { heads.current[idx] = el }} />
            </group>
          )
        })}
      </group>

      {Object.values(kit.layers).map((L) => (
        <instancedMesh
          key={L.key}
          ref={(el) => { meshes.current[L.key] = el }}
          args={[L.geo, kit.petalMat, Math.max(L.count, 1)]}
          frustumCulled={false}
        />
      ))}

      {['sun', 'daisy'].map((k) =>
        kit.counts[k] ? (
          <instancedMesh
            key={k}
            ref={(el) => { meshes.current[`center:${k}`] = el }}
            args={[kit.centerGeos[k], kit.centerMats[k], kit.counts[k]]}
            frustumCulled={false}
          />
        ) : null,
      )}

      <instancedMesh
        ref={(el) => { meshes.current.calyx = el }}
        args={[kit.calyxGeo, kit.calyxMat, Math.max(kit.counts.calyx, 1)]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={(el) => { meshes.current.leaf = el }}
        args={[kit.leafGeo, kit.leafMat, Math.max(kit.counts.leaf, 1)]}
        frustumCulled={false}
      />
    </group>
  )
}

function CameraRig({ cam, mode, reduced }) {
  const path = useMemo(
    () => ({
      from: { pos: new THREE.Vector3(0, 0.4, 7.4), look: new THREE.Vector3(0, 1.1, 3.2) },
      to: { pos: new THREE.Vector3(...cam.pos), look: new THREE.Vector3(...cam.look) },
      look: new THREE.Vector3(),
    }),
    [cam],
  )

  useFrame(({ camera }) => {
    const k = mode === 'home' || reduced ? 1 : easeInOut(clamp01(S.st / 11))
    camera.position.lerpVectors(path.from.pos, path.to.pos, k)
    path.look.lerpVectors(path.from.look, path.to.look, k)
    // sin paneo automatico, si no termina descentrado
    camera.position.x += S.px * 0.7 * k
    camera.position.z += Math.sin(S.t * 0.08) * 0.15 * k
    camera.position.y += S.py * 0.3 * k
    camera.lookAt(path.look)
  })
  return null
}

// mismo look en todos lados. en celu solo bajo cosas del fondo que igual estan desenfocadas
const PROFILES = {
  desktop: { flowers: 95, grass: 34000, petals: 180, pollen: 480, blossoms: 1500, burst: 180, rays: 6 },
  phone: { flowers: 60, grass: 20000, petals: 120, pollen: 300, blossoms: 1000, burst: 140, rays: 6 },
}

// con frameloop demand dibuja una sola vez, le pido un par de frames mas por las dudas
function Settle() {
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => {
    const ids = [120, 700].map((ms) => setTimeout(invalidate, ms))
    return () => ids.forEach(clearTimeout)
  }, [invalidate])
  return null
}

export default function Scene({ mode, startedRef, reduced, camera: cameraOverride }) {
  const setup = useMemo(() => {
    const portrait = window.innerWidth < window.innerHeight
    const phone = new URLSearchParams(window.location.search).has('small') || window.innerWidth < 820 || window.matchMedia('(pointer: coarse)').matches
    const cam =
      cameraOverride ??
      (portrait
        ? { fov: 58, pos: [0, 2.45, 12.2], look: [0, 1.95, 5.7] }
        : { fov: 42, pos: [0, 2.45, 11.0], look: [0, 2.15, 5.7] })
    const aspect = window.innerWidth / window.innerHeight
    return {
      portrait,
      phone,
      P: PROFILES[phone ? 'phone' : 'desktop'],
      cam,
      // cuanto se abre el pasto a los costados para llenar la pantalla (asumo horizontal por si giran el celu)
      grassReach: Math.tan(((cam.fov / 2) * Math.PI) / 180) * Math.max(aspect, 1) * 1.1,
    }
  }, [])
  const { P } = setup

  // si el celu no da, bajo de 2x a 1.5x y listo, los efectos quedan
  const [eased, setEased] = useState(false)
  const maxDpr = mode === 'home' ? 1 : eased ? 1.5 : 2
  // en el menu la escena es solo fondo: en celu la dibujo una vez y no 60 por segundo
  const still = mode === 'home' && setup.phone

  const flowers = useMemo(
    () => buildField({ count: P.flowers, portrait: setup.portrait, camPos: setup.cam.pos }),
    [setup, P],
  )
  const bouquet = useMemo(buildBouquet, [])
  const bouquetRef = useRef(null)

  useEffect(() => {
    // el parallax sigue al mouse nomas, con el dedo quedaba descentrado
    const onMove = (ev) => {
      if (ev.pointerType !== 'mouse') return
      S.tx = (ev.clientX / window.innerWidth) * 2 - 1
      S.ty = (ev.clientY / window.innerHeight) * 2 - 1
    }
    const recenter = () => {
      S.tx = 0
      S.ty = 0
    }
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', recenter)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', recenter)
    }
  }, [])

  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh' }}
      frameloop={still ? 'demand' : 'always'}
      dpr={[1, maxDpr]}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      camera={{ fov: setup.cam.fov, position: setup.cam.pos, near: 0.05, far: 220 }}
    >
      {!still && <PerformanceMonitor bounds={() => [24, 60]} flipflops={1} onDecline={() => setEased(true)} />}
      {still && <Settle />}

      <Clock mode={mode} startedRef={startedRef} />
      <fog attach="fog" args={[HORIZON, 18, 68]} />
      <Sky />

      <hemisphereLight args={['#ffeaba', '#2e4a10', 0.75]} />
      <directionalLight position={[5, 7, 8]} intensity={2.9} color="#fff0c8" />
      <directionalLight position={[-7, 5, -9]} intensity={2.4} color="#ffc76a" />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <circleGeometry args={[70, 48]} />
        <meshStandardMaterial color="#4a6a1e" roughness={1} />
      </mesh>

      {!SOLO && <Grass count={P.grass} reach={setup.grassReach} />}
      {!SOLO && <FarBlossoms count={P.blossoms} />}
      <Flowers flowers={SOLO ? [] : flowers} bouquet={bouquet} bouquetRef={bouquetRef} />
      <FallingPetals count={P.petals} />
      <Pollen count={P.pollen} />
      <Rays n={P.rays} />
      <Stand />
      <Halo />
      <Burst count={P.burst} />
      <CameraRig cam={setup.cam} mode={mode} reduced={reduced} />

      <EffectComposer multisampling={4} disableNormalPass frameBufferType={THREE.HalfFloatType}>
        <DepthOfField target={BOUQUET.focus} worldFocusRange={1.6} bokehScale={5} />
        <Bloom intensity={0.7} luminanceThreshold={0.78} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.28} darkness={0.42} />
      </EffectComposer>
    </Canvas>
  )
}
