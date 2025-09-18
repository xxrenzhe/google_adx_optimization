import { promises as fs } from 'fs'
import { resolve } from 'path'

export async function GET() {
  const filePath = resolve(process.cwd(), 'files', 'trk_ui', 'index.html')
  try {
    let html = await fs.readFile(filePath, 'utf8')
    // Rewrite relative asset paths to our served routes
    html = html.replaceAll('./css/', '/trk_ui/css/')
               .replaceAll('./js/', '/trk_ui/js/')
               .replaceAll('./images/', '/trk_ui/images/')
               .replaceAll('/images/', '/trk_ui/images/')
    // Ensure links open in parent when embedded
    html = html.replace('<head>', '<head><base href="/" target="_parent">')
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return new Response('Not found', { status: 404 })
  }
}
