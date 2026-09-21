import { useEffect, useRef, useState } from 'react'
import Scene from './scene/Scene.jsx'
import Footer from './Footer.jsx'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SKIP = new URLSearchParams(window.location.search).has('fast') // para probar: ?fast salta directo al final

// fade in de la musica a mano. en iOS el volumen no se puede tocar pero igual anda
function fadeIn(audio, seconds = 6) {
  const t0 = performance.now()
  const step = () => {
    const k = Math.min((performance.now() - t0) / (seconds * 1000), 1)
    audio.volume = k * 0.34
    if (k < 1) requestAnimationFrame(step)
  }
  step()
}

export default function Gift({ para, de }) {
  const startedRef = useRef(null)
  const audioRef = useRef(null)
  const [open, setOpen] = useState(SKIP)
  const [step, setStep] = useState(SKIP ? 4 : 0)
  const [muted, setMuted] = useState(false)
  if (SKIP && startedRef.current == null) startedRef.current = performance.now() / 1000 - 20

  useEffect(() => {
    document.title = `Flores amarillas para ${para}`
  }, [para])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    if (!open) return
    if (SKIP) return
    const beats = REDUCED ? [0, 0, 0, 0] : [6.2, 9.2, 10.8, 14]
    const timers = beats.map((s, i) => setTimeout(() => setStep((v) => Math.max(v, i + 1)), s * 1000))
    return () => timers.forEach(clearTimeout)
  }, [open])

  const start = () => {
    if (open) return
    startedRef.current = performance.now() / 1000 - (REDUCED ? 14 : 0)
    const audio = audioRef.current
    audio.volume = 0
    audio.play().then(() => fadeIn(audio)).catch(() => {})
    setOpen(true)
  }

  const letters = [...para].map((ch, i) => (
    <span key={i} style={{ '--i': i }}>
      {ch === ' ' ? ' ' : ch}
    </span>
  ))

  return (
    <>
      <Scene mode="gift" startedRef={startedRef} reduced={REDUCED} />
      <div className="grain" />

      <audio ref={audioRef} src="/melodia.mp3" loop preload="auto" />

      {/* portada */}
      <section
        className={`fixed inset-0 z-20 flex flex-col items-center justify-center gap-7 px-6 text-center transition-all duration-[1400ms] ${
          open ? 'pointer-events-none opacity-0 blur-md' : 'opacity-100'
        }`}
        style={{ background: 'radial-gradient(120% 90% at 50% 40%, rgba(46,26,4,.44), rgba(24,14,2,.82))', backdropFilter: 'blur(14px)' }}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-amber-100/70">21 de septiembre</p>
        <h1 className="max-w-[16ch] font-display text-[clamp(2.4rem,7vw,4.6rem)] leading-[1.05] text-[#fff6e2]">
          {para}, alguien te mandó <em className="italic">flores amarillas</em>
        </h1>
        <button
          onClick={start}
          className="group relative mt-2 grid size-28 place-items-center rounded-full border border-amber-100/40 text-[#fff6e2] transition hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
        >
          <span className="absolute inset-0 rounded-full bg-amber-200/10 blur-xl" />
          <span className="absolute inset-0 animate-breathe rounded-full border border-amber-100/30" />
          <span className="relative font-display text-xl tracking-wide">Abrir</span>
        </button>
        <p className="text-xs tracking-[0.24em] text-amber-100/55 uppercase">subí el volumen</p>
      </section>

      {/* el show */}
      <section className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-between px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[clamp(2.2rem,7vh,5rem)] text-center text-ink">
        {/* degradés para que el texto se lea arriba del cielo */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-[50vh] transition-opacity duration-[2500ms] ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(to bottom, rgba(255,248,231,.95) 0%, rgba(255,247,226,.72) 45%, rgba(255,246,220,0) 100%)' }}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[16vh] transition-opacity duration-[2500ms] ${step >= 2 ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(to top, rgba(255,248,231,.92) 0%, rgba(255,247,226,.6) 45%, rgba(255,246,220,0) 100%)' }}
        />

        <div className="relative flex flex-col items-center">
          <p className={`fade halo text-[11px] font-semibold uppercase tracking-[0.42em] text-ink/70 ${step >= 1 ? 'in' : ''}`}>Para</p>
          <h1
            className={`letters halo mt-1 font-display text-[clamp(3rem,9vw,7.5rem)] italic leading-[0.92] tracking-[-0.02em] ${step >= 1 ? 'in' : ''}`}
            aria-label={para}
          >
            {letters}
          </h1>

        </div>

        <div className="relative flex flex-col items-center">
          {/* en celu va sobre el tronco, en compu al costado. nunca arriba de las flores */}
          <div
            className={`fade mb-4 flex flex-col items-center rounded-[1.5rem] landscape:fixed landscape:bottom-[max(1.75rem,env(safe-area-inset-bottom))] landscape:left-6 landscape:mb-0 landscape:max-w-[20rem] landscape:items-start landscape:text-left border border-white/70 bg-cream/80 px-6 py-3.5 shadow-[0_20px_60px_-24px_rgba(74,44,6,.45)] backdrop-blur-xl ${
              step >= 2 ? 'in' : ''
            }`}
          >
            <p className="max-w-[30ch] font-display text-[clamp(1.1rem,2.1vw,1.55rem)] leading-snug text-ink">
              Feliz primavera. Que todo lo lindo te encuentre floreciendo.
            </p>
            <p className={`fade mt-1.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-[#7a4a0c] ${step >= 3 ? 'in' : ''}`}>
              {de ? `con cariño, ${de}` : 'con cariño'}
            </p>
          </div>
          <a
            href="/"
            className={`fade pointer-events-auto rounded-full border border-ink/15 bg-cream/75 px-6 py-3 text-sm font-medium text-ink/80 backdrop-blur-md transition hover:bg-cream hover:text-ink ${
              step >= 4 ? 'in' : ''
            }`}
          >
            Regalale flores a alguien más
          </a>
          <Footer
            className={`fade mt-3 landscape:fixed landscape:bottom-[max(1.75rem,env(safe-area-inset-bottom))] landscape:right-6 landscape:mt-0 ${step >= 4 ? 'in' : ''}`}
          />
        </div>
      </section>

      {open && (
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="fixed right-5 top-5 z-30 grid size-11 place-items-center rounded-full border border-ink/15 bg-cream/60 text-ink/70 backdrop-blur-md transition hover:bg-cream/90"
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l4 6M21 9l-4 6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8 8 0 0 1 0 12" />
            </svg>
          )}
        </button>
      )}
    </>
  )
}
