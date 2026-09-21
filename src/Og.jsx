import { useRef } from 'react'
import Scene from './scene/Scene.jsx'

// ?og=1 muestra la escena terminada con el titulo. la uso para sacar la imagen de preview (public/og.jpg, 1200x630)
export default function Og() {
  const startedRef = useRef(performance.now() / 1000 - 20)
  return (
    <>
      <Scene mode="gift" startedRef={startedRef} reduced camera={{ fov: 40, pos: [0, 2.6, 9.9], look: [0, 2.05, 5.7] }} />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[48vh]"
        style={{ background: 'linear-gradient(to bottom, rgba(255,248,231,.95), rgba(255,247,226,.7) 50%, rgba(255,246,220,0))' }}
      />
      <div className="fixed inset-x-0 top-[6vh] flex flex-col items-center text-center text-ink">
        <p className="halo text-[15px] font-semibold uppercase tracking-[0.42em] text-ink/70">21 de septiembre</p>
        <h1 className="halo mt-1 font-display text-[84px] italic leading-[0.95]">Flores amarillas</h1>
      </div>
    </>
  )
}
