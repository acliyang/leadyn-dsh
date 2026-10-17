import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { renderWindowsAppIcon, WINDOWS_APP_ICON_PATHS, WINDOWS_APP_ICON_SIZES } from '../scripts/render-windows-app-icon.ts'
import { unpackIco } from '../scripts/render-tray-icon.ts'

describe('Windows application icon', () => {
  it('ships the Leadyn logo in the PNG and every ICO bitmap', async () => {
    const { png, entries } = await renderWindowsAppIcon(readFileSync(WINDOWS_APP_ICON_PATHS.source))
    expect(readFileSync(WINDOWS_APP_ICON_PATHS.png)).toEqual(png)
    const committed = unpackIco(readFileSync(WINDOWS_APP_ICON_PATHS.ico))
    expect(committed.map(entry => entry.size)).toEqual([...WINDOWS_APP_ICON_SIZES])
    expect(committed).toEqual(entries)
    const metadata = await sharp(png).metadata()
    expect([metadata.width, metadata.height, metadata.hasAlpha]).toEqual([1024, 1024, true])
    const trimmed = await sharp(png).trim({ background: '#00000000', threshold: 0 }).toBuffer({ resolveWithObject: true })
    expect(trimmed.info.width).toBeGreaterThanOrEqual(1022)
    expect(trimmed.info.height).toBeGreaterThanOrEqual(1022)
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(data[3]).toBe(0)
    expect(data[((512 * info.width + 512) * info.channels) + 3]).toBe(255)
  })

  it('rejects an invalid vector document', async () => {
    await expect(renderWindowsAppIcon(Buffer.from('not an SVG'))).rejects.toThrow()
  })
})
