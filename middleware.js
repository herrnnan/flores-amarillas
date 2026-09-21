// los links de regalo (?para=...) tienen su propia preview en whatsapp:
// el nombre va en el titulo. esto corre en vercel antes de servir la pagina
export const config = { matcher: '/' }

const clean = (v) => (v || '').replace(/\s+/g, ' ').trim().slice(0, 40)
const escape = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`)
  return html.replace(re, `$1${value}$2`)
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const para = clean(url.searchParams.get('para'))
  if (!para) return // el menu usa la preview de siempre

  const de = clean(url.searchParams.get('de'))
  const title = escape(`🌼 ${para}, te mandaron flores amarillas`)
  const description = escape(
    de ? `${de} te mandó un ramo. Abrí el link y subí el volumen 🎶` : 'Abrí el link y subí el volumen: hay un ramo floreciendo para vos.',
  )

  const page = await fetch(new URL('/index.html', url))
  let html = await page.text()
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(`Flores amarillas para ${para}`)}</title>`)
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'property', 'og:description', description)
  html = setMeta(html, 'name', 'twitter:description', description)
  html = setMeta(html, 'property', 'og:url', escape(url.href))

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' },
  })
}
