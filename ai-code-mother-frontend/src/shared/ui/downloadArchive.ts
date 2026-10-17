import { getDownloadFileName } from '@/utils/download.ts'

export type ArchiveResponse = { data: Blob; headers: Record<string, unknown> }

/** 将代码归档保存为用户可下载的文件。 */
export async function saveArchive(response: ArchiveResponse, fallback: string): Promise<void> {
  const { data: archive, headers } = response
  const type = String(headers['content-type'] || '').toLowerCase()
  if (!(archive instanceof Blob) || !type.includes('application/zip') || !archive.size) {
    let reason = '下载代码失败，请稍后重试'
    if (archive instanceof Blob && type.includes('application/json')) {
      try {
        reason = (JSON.parse(await archive.text()) as { message?: string }).message || reason
      } catch {
        /* Use the readable fallback. */
      }
    }
    throw new Error(reason)
  }
  const url = URL.createObjectURL(archive)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = getDownloadFileName(String(headers['content-disposition'] || ''), fallback)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
