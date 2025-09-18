import { promises as fs } from 'fs'
import { join, resolve } from 'path'

type Folder = 'images' | 'css' | 'js'

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'css': return 'text/css; charset=utf-8'
    case 'js': return 'application/javascript; charset=utf-8'
    case 'json': return 'application/json; charset=utf-8'
    case 'svg': return 'image/svg+xml'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'ico': return 'image/x-icon'
    case 'woff2': return 'font/woff2'
    case 'woff': return 'font/woff'
    case 'ttf': return 'font/ttf'
    default: return 'application/octet-stream'
  }
}

export async function serveTrkUiFile(folder: Folder, pathParts: string[]): Promise<Response> {
  // Restrict path traversal strictly within files/trk_ui/<folder>
  const baseDir = resolve(process.cwd(), 'files', 'trk_ui', folder)
  const targetPath = resolve(baseDir, ...pathParts)
  if (!targetPath.startsWith(baseDir)) {
    return new Response('Not found', { status: 404 })
  }
  try {
    const data = await fs.readFile(targetPath)
    const contentType = getMimeType(targetPath)
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    return new Response('Not found', { status: 404 })
  }
}

