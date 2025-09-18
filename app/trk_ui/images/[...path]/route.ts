import { serveTrkUiFile } from '@/lib/serve-static'

export async function GET(_req: Request, context: { params: { path: string[] } }) {
  const { path } = context.params
  return serveTrkUiFile('images', path)
}

