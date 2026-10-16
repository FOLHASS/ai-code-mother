/** Preview status exposed by the preview feature. */
export type PreviewStatus = 'idle' | 'checking' | 'ready' | 'error'

/** Value object used by preview consumers without depending on page state. */
export type PreviewState = {
  url: string
  error: string
  hasGeneratedWebsite: boolean
}
