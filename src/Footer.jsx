const AUTHOR = 'Hernán Montané'
const IG = 'https://www.instagram.com/hernandev_/'
const WEB = 'https://montanehernan.dev/'

const icon = 'grid size-6 place-items-center rounded-full text-ink/50 transition hover:text-ink/80 focus-visible:outline-2 focus-visible:outline-amber-500'

// credito chiquito, el protagonista es el que regala
export default function Footer({ className = '' }) {
  return (
    <footer className={`pointer-events-auto flex flex-col items-center gap-0.5 rounded-2xl bg-cream/55 px-3 pt-1.5 pb-0.5 text-[11px] backdrop-blur-md ${className}`}>
      <a href={IG} target="_blank" rel="noreferrer" aria-label="@hernandev_ en Instagram" className="text-ink/55 transition hover:text-ink/80">
        @hernandev_
      </a>
      <span className="flex items-center">
        <a href={WEB} target="_blank" rel="noreferrer" aria-label={`Web de ${AUTHOR}`} className={icon}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
        </a>
        <a href={IG} target="_blank" rel="noreferrer" aria-label={`Instagram de ${AUTHOR}`} className={icon}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
          </svg>
        </a>
      </span>
    </footer>
  )
}
