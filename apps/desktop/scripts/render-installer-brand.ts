/**
 * Render the Windows installer brand lockup and the uninstaller sidebar from the Leadyn mark.
 *
 * The installer draws the lockup as one bitmap above the install button, and the progress overlay
 * reuses the same file, so both surfaces follow the logo. NSIS reads 24-bit BMP copies that
 * `prepare-windows-installer.ps1` converts from these PNGs; that conversion only clears the
 * transparent margins to the theme background, so the artwork itself stays transparent.
 *
 * The committed files under `installer/assets/` are the output: rerun
 * `pnpm run render:installer-brand` in `apps/desktop` after changing the logo or the wordmark.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Installer brand canvas in 96-DPI logical pixels. */
export const INSTALLER_BRAND_SIZE = { width: 600, height: 196 } as const

/** Sidebar bitmap NSIS shows on the uninstaller welcome and finish pages. */
export const UNINSTALLER_SIDEBAR_SIZE = { width: 164, height: 314 } as const

/** Logical placement of the mark on the brand canvas. */
export const INSTALLER_BRAND_MARK = { size: 120, x: 240, y: 16 } as const

/**
 * Ink of the wordmark per installer theme.
 *
 * `theme.nsh` paints the background of each variant in `InstallerResolveTheme` and pairs it with
 * these two text colours, so the wordmark keeps the contrast of the original artwork.
 */
export const INSTALLER_BRAND_INK = { light: '#0f1115', dark: '#ffffff' } as const

/** Installer theme whose artwork a file carries. */
export type InstallerBrandTheme = keyof typeof INSTALLER_BRAND_INK

/** Vector sources and committed outputs of the installer artwork. */
export const INSTALLER_BRAND_PATHS = {
  source: fileURLToPath(new URL('../../../leadyn/logo.svg', import.meta.url)),
  wordmark: fileURLToPath(new URL('../installer/assets/leadyn-dsh-wordmark.svg', import.meta.url)),
  light: fileURLToPath(new URL('../installer/assets/brand.png', import.meta.url)),
  light2x: fileURLToPath(new URL('../installer/assets/brand-2x.png', import.meta.url)),
  dark: fileURLToPath(new URL('../installer/assets/brand-dark.png', import.meta.url)),
  dark2x: fileURLToPath(new URL('../installer/assets/brand-dark-2x.png', import.meta.url)),
  sidebar: fileURLToPath(new URL('../installer/assets/uninstaller-sidebar.png', import.meta.url)),
} as const

/** One rendered installer file. */
export interface InstallerBrandArtwork {
  readonly light: Buffer
  readonly light2x: Buffer
  readonly dark: Buffer
  readonly dark2x: Buffer
  readonly sidebar: Buffer
}

/** Supersampling factor for the flat sidebar bitmap, which NSIS shows at its exact pixel size. */
const SIDEBAR_SUPERSAMPLE = 4

/** Sidebar card that frames the mark; NSIS places the bitmap without scaling it. */
const SIDEBAR_CARD = { x: 20, y: 88, size: 124, radius: 6 } as const

/** Edge of the mark drawn inside the sidebar card. */
const SIDEBAR_MARK_SIZE = 94

/**
 * Drop the XML prolog and comments so a document can be nested inside a composed canvas.
 * @param document - Complete SVG file contents.
 * @returns the markup starting at the root element.
 */
function inlineSvg(document: string): string {
  const start = document.indexOf('<svg')
  if (start < 0) throw new Error('installer brand: artwork is not an SVG document')
  return document.slice(start).replace(/<!--[\s\S]*?-->/gu, '')
}

/**
 * Rasterize the logo's visible content into a square PNG, then return it as a data URI.
 * @param logo - Leadyn logo SVG, including the transparent canvas margins the icon renderers trim.
 * @param pixels - Edge of the emitted bitmap.
 * @returns data URI of a square PNG holding the complete mark.
 */
async function markDataUri(logo: Buffer, pixels: number): Promise<string> {
  const png = await sharp(logo, { density: 144 })
    .trim({ background: '#00000000', threshold: 0 })
    .resize(pixels, pixels, { fit: 'contain', background: '#00000000' })
    .png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

/**
 * Compose the lockup on the installer canvas.
 * @param mark - Data URI of the square mark.
 * @param wordmark - LeadynDSH wordmark document.
 * @param theme - Installer theme selecting the wordmark ink.
 * @param scale - Output multiplier over {@link INSTALLER_BRAND_SIZE}.
 * @returns complete canvas SVG at the requested pixel size.
 */
function brandSvg(mark: string, wordmark: string, theme: InstallerBrandTheme, scale: number): string {
  const { width, height } = INSTALLER_BRAND_SIZE
  // The canvas viewBox stays in logical pixels, so the mark keeps its placement at every scale; only
  // the pixel size attributes and the embedded bitmap's resolution grow.
  const edge = INSTALLER_BRAND_MARK.size
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">`
    + `<image x="${INSTALLER_BRAND_MARK.x}" y="${INSTALLER_BRAND_MARK.y}" width="${edge}" height="${edge}" href="${mark}"/>`
    + `<g color="${INSTALLER_BRAND_INK[theme]}">${inlineSvg(wordmark).replace('<svg ', '<svg x="0" y="0" ')}</g>`
    + '</svg>'
}

/**
 * Compose the uninstaller sidebar: the NSIS panel background with the mark on a light card.
 * @param mark - Data URI of the square mark.
 * @returns complete canvas SVG in supersampled pixels.
 */
function sidebarSvg(mark: string): string {
  const { width, height } = UNINSTALLER_SIDEBAR_SIZE
  const { x, y, size, radius } = SIDEBAR_CARD
  const markOffset = (size - SIDEBAR_MARK_SIZE) / 2
  const scale = SIDEBAR_SUPERSAMPLE
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">`
    + '<defs><linearGradient id="card" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#fafafb"/><stop offset="1" stop-color="#f2f4f7"/></linearGradient></defs>'
    + `<rect width="${width}" height="${height}" fill="#f3f4f6"/>`
    + `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#card)" stroke="#e8eaee"/>`
    + `<image x="${x + markOffset}" y="${y + markOffset}" width="${SIDEBAR_MARK_SIZE}" height="${SIDEBAR_MARK_SIZE}" href="${mark}"/>`
    + '</svg>'
}

/**
 * Render every installer brand file.
 * @param logo - Leadyn logo SVG.
 * @param wordmark - LeadynDSH wordmark SVG.
 * @returns PNG bytes for each committed asset.
 */
export async function renderInstallerBrand(logo: Buffer, wordmark: Buffer): Promise<InstallerBrandArtwork> {
  const [mark, mark2x, markSidebar] = await Promise.all([
    markDataUri(logo, INSTALLER_BRAND_MARK.size),
    markDataUri(logo, INSTALLER_BRAND_MARK.size * 2),
    markDataUri(logo, SIDEBAR_MARK_SIZE * SIDEBAR_SUPERSAMPLE),
  ])
  const document = wordmark.toString('utf8')
  const [light, light2x, dark, dark2x] = await Promise.all([
    sharp(Buffer.from(brandSvg(mark, document, 'light', 1))).png().toBuffer(),
    sharp(Buffer.from(brandSvg(mark2x, document, 'light', 2))).png().toBuffer(),
    sharp(Buffer.from(brandSvg(mark, document, 'dark', 1))).png().toBuffer(),
    sharp(Buffer.from(brandSvg(mark2x, document, 'dark', 2))).png().toBuffer(),
  ])
  const sidebar = await sharp(Buffer.from(sidebarSvg(markSidebar)))
    .resize(UNINSTALLER_SIDEBAR_SIZE.width, UNINSTALLER_SIDEBAR_SIZE.height, { fit: 'fill' })
    .png().toBuffer()
  return { light, light2x, dark, dark2x, sidebar }
}

async function main(): Promise<void> {
  const artwork = await renderInstallerBrand(
    await readFile(INSTALLER_BRAND_PATHS.source),
    await readFile(INSTALLER_BRAND_PATHS.wordmark),
  )
  await Promise.all([
    writeFile(INSTALLER_BRAND_PATHS.light, artwork.light),
    writeFile(INSTALLER_BRAND_PATHS.light2x, artwork.light2x),
    writeFile(INSTALLER_BRAND_PATHS.dark, artwork.dark),
    writeFile(INSTALLER_BRAND_PATHS.dark2x, artwork.dark2x),
    writeFile(INSTALLER_BRAND_PATHS.sidebar, artwork.sidebar),
  ])
  console.info(`installer brand: wrote ${String(Object.keys(artwork).length)} assets under ${fileURLToPath(new URL('../installer/assets', import.meta.url))}`)
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) await main()
