import { mkdirSync, writeFileSync } from 'node:fs'
import { compilePreviewRuntime } from './previewRuntime.ts'

const output = new URL('../dist/preview-editor-bridge.js', import.meta.url)
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true })
writeFileSync(output, compilePreviewRuntime())
console.log('Built dist/preview-editor-bridge.js')
