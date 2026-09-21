import Home from './Home.jsx'
import Gift from './Gift.jsx'
import Og from './Og.jsx'

const params = new URLSearchParams(window.location.search)
const clean = (v) => (v || '').replace(/\s+/g, ' ').trim().slice(0, 40)

export default function App() {
  if (params.has('og')) return <Og />
  const para = clean(params.get('para'))
  const de = clean(params.get('de'))
  return para ? <Gift para={para} de={de} /> : <Home />
}
