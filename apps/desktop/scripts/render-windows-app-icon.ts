/** Generate Windows application artwork from the Leadyn logo, excluding transparent canvas margins. */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { packIco, type IcoEntry } from './render-tray-icon.ts'

/** Windows shell bitmap sizes, including the 256-pixel Explorer representation. */
export const WINDOWS_APP_ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256] as const

/** Original logo and committed Windows application resources. */
export const WINDOWS_APP_ICON_PATHS = {
  source: fileURLToPath(new URL('../../../leadyn/logo.svg', import.meta.url)),
  png: fileURLToPath(new URL('../resources/icon-windows.png', import.meta.url)),
  ico: fileURLToPath(new URL('../resources/icon-windows.ico', import.meta.url)),
} as const

/**
 * Render the complete visible logo centered on a transparent square.
 * @param svg - Original SVG, including any transparent canvas margins.
 * @returns A 1024-pixel PNG and the Windows shell ICO bitmaps.
 */
export async function renderWindowsAppIcon(svg: Buffer): Promise<{ png: Buffer; entries: IcoEntry[] }> {
  const cropped = await sharp(svg, { density: 144 })
    .trim({ background: '#00000000', threshold: 0 })
    .png().toBuffer()
  const render = (size: number): Promise<Buffer> => sharp(cropped)
    .resize(size, size, { fit: 'contain', background: '#00000000' })
    .png().toBuffer()
  const [png, entries] = await Promise.all([
    render(1024),
    Promise.all(WINDOWS_APP_ICON_SIZES.map(async size => ({ size, png: await render(size) }))),
  ])
  return { png, entries }
}

async function main(): Promise<void> {
  const { png, entries } = await renderWindowsAppIcon(await readFile(WINDOWS_APP_ICON_PATHS.source))
  await Promise.all([
    writeFile(WINDOWS_APP_ICON_PATHS.png, png),
    writeFile(WINDOWS_APP_ICON_PATHS.ico, packIco(entries)),
  ])
  console.info(`Windows application icon: wrote ${WINDOWS_APP_ICON_PATHS.png} and ${WINDOWS_APP_ICON_PATHS.ico}`)
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) await main()
