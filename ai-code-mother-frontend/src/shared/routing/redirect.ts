/** 将站内相对路径和同源旧式 URL 规范化为安全的回跳地址。 */
export function safeRedirect(value: unknown, origin?: string, base = '/'): string {
  if (
    typeof value !== 'string' ||
    Array.from(value).some((char) => char === '\\' || char.charCodeAt(0) <= 32)
  )
    return '/'
  let path = value
  if (/^https?:\/\//i.test(value)) {
    if (!origin) return '/'
    try {
      const url = new URL(value)
      if (url.origin !== origin) return '/'
      path = url.pathname + url.search + url.hash
      if (base !== '/' && path.startsWith(base)) path = '/' + path.slice(base.length)
    } catch {
      return '/'
    }
  }
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /^\/user\/(login|register)(?:[/?#]|$)/.test(path)
  )
    return '/'
  return path
}
