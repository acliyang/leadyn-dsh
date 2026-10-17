/** Public account notice options shared by Host and Client. */
import z from '@deepseek-ai/schemastery'

/** Bonus notice acknowledgement timings shared by Host and Client. */
export interface AccountConfig {
  /** First delay before retrying a failed bonus acknowledgement. */
  bonusAckRetryDelayMs: number
  /** Ceiling for the acknowledgement retry backoff. */
  bonusAckRetryMaxDelayMs: number
}
/** Validate public account notice options. */
export const AccountConfigFields = {
  bonusAckRetryDelayMs: z.number().min(1).default(1_000),
  bonusAckRetryMaxDelayMs: z.number().min(1).default(60_000),
}
/** Validate public account notice options. */
export const AccountConfig: z<Partial<AccountConfig>, AccountConfig> = z.object(AccountConfigFields)
/** Bootstrap key containing no account credentials. */
export const ACCOUNT_CONFIG_GLOBAL = '__DSH_ACCOUNT_CONFIG__'
