/**
 * Preview URL and readiness adapter.
 *
 * URL construction remains delegated to the existing utility. The small HEAD
 * probe is shared by future preview views and intentionally does not load the
 * generated document into the host page.
 */
import { getPreviewUrl } from '@/utils/app.ts'

export { getPreviewUrl }

export type PreviewCheckResult = {
  url: string
  ok: boolean
  status: number
}

export async function checkPreviewReady(
  url: string,
  signal?: AbortSignal,
): Promise<PreviewCheckResult> {
  const response = await fetch(url, {
    method: 'HEAD',
    credentials: 'include',
    cache: 'no-store',
    signal,
  })
  return { url, ok: response.ok, status: response.status }
}
