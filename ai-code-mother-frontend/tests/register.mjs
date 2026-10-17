import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const base = new URL('../src/' + specifier.slice(2), import.meta.url)
      for (const suffix of ['', '.ts', '/index.ts']) {
        const candidate = new URL(base.href + suffix)
        if (existsSync(candidate) && !candidate.pathname.endsWith('/')) {
          if (!/\.(ts|vue)$/.test(candidate.pathname)) continue
          return nextResolve(candidate.href, context)
        }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts') && !url.includes('/node_modules/')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        }).outputText,
      }
    }
    return nextLoad(url, context)
  },
})
