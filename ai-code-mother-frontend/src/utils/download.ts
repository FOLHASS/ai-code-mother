/** 优先读取 UTF-8 文件名，缺失或无效时使用应用名称。 */
/**
 * 解析下载接口的 Content-Disposition：优先 filename*，其次 filename，最后使用调用方的回退名称。
 * 同时去掉路径前缀与控制字符，使后端返回值作为下载文件名使用，并确保 ZIP 扩展名存在。
 * 此处仅计算名称；Blob 的创建、点击下载和对象 URL 释放由下载业务负责。
 */
export function getDownloadFileName(disposition: string | undefined, fallback: string): string {
  // filename* 使用 RFC 风格的 UTF-8 百分号编码，普通 filename 则兼容带引号/不带引号两种形式。
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
  // 兼容 Windows 与 Unix 路径分隔符，只取末段，并清除文件名中的不可见控制字符。
  name =
    Array.from(name.split(/[\\/]/).at(-1) || '')
      .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
      .join('') || fallback
  // 忽略后缀大小写，避免把已有的 .ZIP 再追加一次。
  return name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`
}
