import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'

for (const [name, language] of Object.entries({ xml, css, javascript, typescript, json, bash }))
  hljs.registerLanguage(name, language)
hljs.registerAliases(['vue', 'html'], { languageName: 'xml' })

/** 转义 HTML 特殊字符，避免消息文本被当作标签解析。 */
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  highlight: (code, language) => {
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`
      } catch {
        /* An incomplete stream chunk falls back to text. */
      }
    }
    return `<pre class="hljs"><code>${escape(code)}</code></pre>`
  },
})
type RenderEnvironment = { index: number; expanded: ReadonlySet<number> }
for (const rule of ['fence', 'code_block'] as const) {
  const render = markdown.renderer.rules[rule]
  if (!render) continue
  markdown.renderer.rules[rule] = (
    tokens,
    index,
    options,
    environment: RenderEnvironment,
    renderer,
  ) => {
    const codeIndex = environment.index++
    const language = tokens[index]?.info?.trim().split(/\s+/)[0] || ''
    return `<details class="code-block" data-code-index="${codeIndex}"${environment.expanded.has(codeIndex) ? ' open' : ''}><summary>代码块${language ? ' · ' + escape(language) : ''}</summary>${render(tokens, index, options, environment, renderer)}</details>`
  }
}
/** 将助手消息渲染为 HTML，并清理不安全的标签和链接。 */
export function renderAssistantMarkdown(content: string, expanded: ReadonlySet<number>): string {
  return content
    ? DOMPurify.sanitize(markdown.render(content, { index: 0, expanded }), {
        ADD_ATTR: ['target', 'rel'],
      })
    : ''
}
