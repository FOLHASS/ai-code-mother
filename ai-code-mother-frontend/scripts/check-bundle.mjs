import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const manifest = JSON.parse(fs.readFileSync('dist/.vite/manifest.json', 'utf8'))
const visited = new Set()
/** 收集构建产物的文件名和未压缩体积。 */
function collect(key) {
  if (visited.has(key)) return
  visited.add(key)
  for (const dependency of manifest[key]?.imports || []) collect(dependency)
}
collect('index.html')
const initial = [...visited]
  .map((key) => manifest[key]?.file)
  .filter((file) => file?.endsWith('.js'))
/** 计算构建产物经 gzip 压缩后的体积。 */
const gzip = (file) => gzipSync(fs.readFileSync(path.join('dist', file))).length
const total = initial.reduce((sum, file) => sum + gzip(file), 0)
const errors = []
if (total > 160000) errors.push('Entry static JS dependency gzip budget exceeded (160000 bytes)')
for (const item of Object.values(manifest))
  if (item.file.endsWith('.js') && gzip(item.file) > 200000)
    errors.push('Single JS chunk gzip budget exceeded: ' + item.file)
const logo = Object.values(manifest).find((item) => /logo-display-.*\.png$/.test(item.file))
if (!logo || fs.statSync(path.join('dist', logo.file)).size > 65536)
  errors.push('Display logo exceeds 64 KiB')
if (fs.statSync('dist/preview-editor-bridge.js').size > 16384)
  errors.push('Preview bridge exceeds 16 KiB')
console.log(
  JSON.stringify(
    {
      entryStaticJsFiles: initial,
      entryStaticJsGzipBytes: total,
      displayLogoBytes: logo ? fs.statSync(path.join('dist', logo.file)).size : undefined,
      previewBridgeBytes: fs.statSync('dist/preview-editor-bridge.js').size,
    },
    null,
    2,
  ),
)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
