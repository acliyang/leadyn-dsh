import { LeadynLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the brand mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the Leadyn mark.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <LeadynLogo size={size} />
}

/**
 * Render the brand name text separately from its slotted mark.
 * @returns the brand name.
 */
export function OfficialBrandName() {
  return <>LeadynDSH</>
}
