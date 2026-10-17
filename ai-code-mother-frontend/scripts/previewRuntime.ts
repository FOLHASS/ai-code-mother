import { readFileSync } from 'node:fs'
import ts from 'typescript'

/** iframe 入口需要独立运行，因此运行时脚本不能包含模块导入。 */
export function compilePreviewRuntime(): string {
  const filename = new URL(
    '../src/features/preview-editor/runtime/iframeRuntime.ts',
    import.meta.url,
  )
  let source = readFileSync(filename, 'utf8')
  const ast = ts.createSourceFile(filename.pathname, source, ts.ScriptTarget.Latest, true)
  for (const statement of [...ast.statements].reverse()) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!statement.importClause?.isTypeOnly)
      throw new Error('Preview runtime must not import runtime dependencies')
    source = source.slice(0, statement.getStart(ast)) + source.slice(statement.end)
  }
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleDetection: ts.ModuleDetectionKind.Legacy,
    },
    reportDiagnostics: true,
  })
  if (result.diagnostics?.some((item) => item.category === ts.DiagnosticCategory.Error))
    throw new Error('Preview runtime compilation failed')
  return `;(() => {\n${result.outputText}\n})();\n`
}
