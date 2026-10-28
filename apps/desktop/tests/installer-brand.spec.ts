import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  INSTALLER_BRAND_PATHS,
  INSTALLER_BRAND_SIZE,
  UNINSTALLER_SIDEBAR_SIZE,
  renderInstallerBrand,
} from '../scripts/render-installer-brand.ts'

/** Alpha of one pixel of a raw RGBA buffer. */
function alphaAt(data: Buffer, width: number, x: number, y: number): number {
  return data[(y * width + x) * 4 + 3]!
}

describe('Windows installer brand artwork', () => {
  it('ships the Leadyn lockup in the light, dark, and 2× variants', async () => {
    const artwork = await renderInstallerBrand(
      readFileSync(INSTALLER_BRAND_PATHS.source),
      readFileSync(INSTALLER_BRAND_PATHS.wordmark),
    )
    expect(readFileSync(INSTALLER_BRAND_PATHS.light)).toEqual(artwork.light)
    expect(readFileSync(INSTALLER_BRAND_PATHS.light2x)).toEqual(artwork.light2x)
    expect(readFileSync(INSTALLER_BRAND_PATHS.dark)).toEqual(artwork.dark)
    expect(readFileSync(INSTALLER_BRAND_PATHS.dark2x)).toEqual(artwork.dark2x)
    expect(readFileSync(INSTALLER_BRAND_PATHS.sidebar)).toEqual(artwork.sidebar)
  })

  it('keeps the 2× variant the same artwork as the 1× canvas', async () => {
    const { width, height } = INSTALLER_BRAND_SIZE
    // Downscale the wide variant onto the logical canvas so both files compare pixel for pixel.
    const pixels = async (path: string): Promise<Buffer> => (await sharp(readFileSync(path))
      .resize(width, height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })).data
    const single = await pixels(INSTALLER_BRAND_PATHS.light)
    const double = await pixels(INSTALLER_BRAND_PATHS.light2x)
    let difference = 0
    for (let index = 0; index < single.length; index++) difference += Math.abs(single[index]! - double[index]!)
    // Both files carry the same layout; only rasterisation differs.
    expect(difference / single.length).toBeLessThan(6)
  })

  it('keeps the canvas the welcome page and progress overlay expect', async () => {
    const { width, height } = INSTALLER_BRAND_SIZE
    for (const path of [INSTALLER_BRAND_PATHS.light, INSTALLER_BRAND_PATHS.dark]) {
      const metadata = await sharp(readFileSync(path)).metadata()
      expect([metadata.width, metadata.height, metadata.hasAlpha]).toEqual([width, height, true])
    }
    for (const path of [INSTALLER_BRAND_PATHS.light2x, INSTALLER_BRAND_PATHS.dark2x]) {
      const metadata = await sharp(readFileSync(path)).metadata()
      expect([metadata.width, metadata.height]).toEqual([width * 2, height * 2])
    }
    const sidebar = await sharp(readFileSync(INSTALLER_BRAND_PATHS.sidebar)).metadata()
    expect([sidebar.width, sidebar.height]).toEqual([UNINSTALLER_SIDEBAR_SIZE.width, UNINSTALLER_SIDEBAR_SIZE.height])
  })

  it('leaves the brand margins transparent for the theme background', async () => {
    const { data, info } = await sharp(readFileSync(INSTALLER_BRAND_PATHS.light))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(alphaAt(data, info.width, 0, 0)).toBe(0)
    expect(alphaAt(data, info.width, info.width - 1, info.height - 1)).toBe(0)
  })

  it('inverts the wordmark ink between the two installer themes', async () => {
    const band = async (path: string, background: string): Promise<{ darkest: number; lightest: number }> => {
      const { data, info } = await sharp(readFileSync(path))
        .flatten({ background }).raw().toBuffer({ resolveWithObject: true })
      // Sample the wordmark row rather than the mark, whose palette is identical in both themes.
      const row = Math.round(info.height * 0.93)
      let darkest = 255
      let lightest = 0
      for (let x = 0; x < info.width; x++) {
        const value = data[(row * info.width + x) * info.channels]!
        darkest = Math.min(darkest, value)
        lightest = Math.max(lightest, value)
      }
      return { darkest, lightest }
    }
    const light = await band(INSTALLER_BRAND_PATHS.light, '#ffffff')
    expect(light.lightest).toBeGreaterThan(250)
    expect(light.darkest).toBeLessThan(40)
    const dark = await band(INSTALLER_BRAND_PATHS.dark, '#151517')
    expect(dark.darkest).toBeLessThan(40)
    expect(dark.lightest).toBeGreaterThan(240)
  })

  it('rejects artwork that is not an SVG document', async () => {
    const wordmark = readFileSync(INSTALLER_BRAND_PATHS.wordmark)
    await expect(renderInstallerBrand(Buffer.from('not an SVG'), wordmark)).rejects.toThrow()
    await expect(renderInstallerBrand(readFileSync(INSTALLER_BRAND_PATHS.source), Buffer.from('not an SVG')))
      .rejects.toThrow('installer brand: artwork is not an SVG document')
  })
})
