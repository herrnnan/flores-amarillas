import { useRef, useState } from 'react'
import Scene from './scene/Scene.jsx'
import Footer from './Footer.jsx'

export default function Home() {
  const startedRef = useRef(null)
  const [para, setPara] = useState('')
  const [de, setDe] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const create = (ev) => {
    ev.preventDefault()
    const name = para.replace(/\s+/g, ' ').trim().slice(0, 40)
    if (!name) return
    const url = new URL(window.location.pathname, window.location.href)
    url.searchParams.set('para', name)
    const from = de.replace(/\s+/g, ' ').trim().slice(0, 40)
    if (from) url.searchParams.set('de', from)
    setLink(url.href)
    setCopied(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      window.prompt('Copiá el link:', link)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const share = () => {
    const text = `${para.trim()}, te mandé flores amarillas 🌼`
    if (navigator.share) navigator.share({ title: 'Flores amarillas', text, url: link }).catch(() => {})
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, '_blank', 'noopener')
  }

  const field =
    'h-13 w-full rounded-2xl border border-ink/10 bg-white/70 px-4 text-[15px] text-ink placeholder:text-ink/35 outline-none transition focus:border-amber-500/60 focus:bg-white focus:ring-4 focus:ring-amber-300/30'

  return (
    <>
      <div className="home-canvas">
        <Scene mode="home" startedRef={startedRef} reduced={false} />
      </div>
      <div className="grain" />

      <main className="fixed inset-0 z-10 flex flex-col items-center gap-6 overflow-y-auto px-5 py-10 [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
        <div className="w-full max-w-[27rem] rounded-[2rem] border border-white/60 bg-cream/72 p-7 shadow-[0_30px_80px_-30px_rgba(74,44,6,.55)] backdrop-blur-xl sm:p-9">
          <p className="text-[11px] font-medium uppercase tracking-[0.36em] text-ink/50">21 de septiembre</p>
          <h1 className="mt-3 font-display text-[clamp(2.1rem,7vw,2.9rem)] leading-[1.02] text-ink">
            Regalá flores <em className="italic">amarillas</em>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/65">
            Escribí su nombre, creá el link y mandáselo. Cuando lo abra, un ramo florece para esa persona, con música.
          </p>

          <form onSubmit={create} className="mt-7 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/55">Para</span>
              <input
                value={para}
                onChange={(e) => setPara(e.target.value)}
                maxLength={40}
                required
                autoComplete="off"
                placeholder="Su nombre"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/55">
                De parte de <span className="font-normal normal-case tracking-normal text-ink/35">(opcional)</span>
              </span>
              <input
                value={de}
                onChange={(e) => setDe(e.target.value)}
                maxLength={40}
                autoComplete="off"
                placeholder="Tu nombre"
                className={field}
              />
            </label>
            <button
              type="submit"
              className="mt-1 h-13 rounded-2xl bg-ink text-[15px] font-semibold text-cream transition hover:-translate-y-0.5 hover:bg-[#3d2608] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:translate-y-0"
            >
              Crear el link
            </button>
          </form>

          {link && (
            <div className="fade in mt-6 border-t border-ink/10 pt-6">
              <p className="text-[13px] text-ink/60">Listo. Mandale esto a {para.trim()}:</p>
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="mt-3 h-12 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-[13px] text-ink/70 outline-none"
              />
              <div className="mt-3 flex gap-2">
                <button onClick={copy} className="h-11 flex-1 rounded-xl bg-amber-400 text-sm font-semibold text-ink transition hover:bg-amber-300">
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
                <button onClick={share} className="h-11 flex-1 rounded-xl border border-ink/15 text-sm font-semibold text-ink/75 transition hover:bg-white/70">
                  Compartir
                </button>
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-11 place-items-center rounded-xl border border-ink/15 px-4 text-sm font-semibold text-ink/75 transition hover:bg-white/70"
                >
                  Ver
                </a>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </main>
    </>
  )
}
