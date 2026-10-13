/** 优先读取 UTF-8 文件名，缺失或无效时使用应用名称。 */
export function getDownloadFileName(disposition: string | undefined, fallback: string): string {
  const encoded = /(?:^|;)\s*filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition || '')?.[1]
  const plain = /(?:^|;)\s*filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(disposition || '')
  let name = plain?.[1] || plain?.[2]?.trim() || fallback
  if (encoded) {
    try {
      name = decodeURIComponent(encoded.trim())
    } catch {
      // 非法编码仍可回退到普通 filename。
    }
  }
  name = name.split(/[\\/]/).at(-1)?.replace(/[\x00-\x1f\x7f]/g, '') || fallback
  return name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`
}
