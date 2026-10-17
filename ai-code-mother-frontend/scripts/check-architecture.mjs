import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ts from 'typescript'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const files = fs
  .readdirSync(sourceRoot, { recursive: true })
  .filter((name) => /\.(ts|vue)$/.test(name))
  .map((name) => path.join(sourceRoot, name))
const errors = []
const graph = new Map(files.map((file) => [file, []]))
/** 读取业务 feature 的公开入口和依赖配置。 */
const feature = (file) => path.relative(sourceRoot, file).split(path.sep).slice(0, 2).join('/')
/** 汇总架构检查发现并输出诊断结果。 */
const report = (file, message) => errors.push(path.relative(root, file) + ': ' + message)

for (const file of files) {
  if (file.startsWith(path.join(sourceRoot, 'api') + path.sep)) continue
  let source = fs.readFileSync(file, 'utf8')
  if (file.endsWith('.vue'))
    source = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .join('\n')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  if (/controller\s*\[\s*['"]/.test(source)) report(file, 'Do not bypass controller private state')
  if (/\bAPI\./.test(source) && !file.includes(path.sep + 'api' + path.sep))
    report(file, 'Generated API types belong in transport adapters')
  function dependency(specifier) {
    const candidate = specifier.startsWith('@/')
      ? path.join(sourceRoot, specifier.slice(2))
      : specifier.startsWith('.')
        ? path.resolve(path.dirname(file), specifier)
        : undefined
    if (!candidate) return
    const target = [
      candidate,
      candidate + '.ts',
      candidate + '.vue',
      path.join(candidate, 'index.ts'),
    ].find((value) => fs.existsSync(value) && fs.statSync(value).isFile())
    if (!target) {
      report(file, 'Unresolved local import ' + specifier)
      return
    }
    if (graph.has(target)) graph.get(file).push(target)
    if (
      file.includes(path.sep + 'features' + path.sep) &&
      target.includes(path.sep + 'features' + path.sep) &&
      feature(file) !== feature(target)
    ) {
      const relative = path.relative(sourceRoot, target).split(path.sep)
      if (
        !(relative.length === 3 && relative[2] === 'index.ts') &&
        !(
          relative.length === 4 &&
          ['api', 'components'].includes(relative[2]) &&
          relative[3] === 'index.ts'
        )
      )
        report(file, 'Use the public feature entry: ' + specifier)
    }
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      dependency(node.moduleSpecifier.text)
      if (
        file.includes(path.sep + 'services' + path.sep) &&
        node.importClause &&
        !node.importClause.isTypeOnly
      ) {
        const module = node.moduleSpecifier.text
        if (module === 'ant-design-vue') report(file, 'Inject UI effects into services/controllers')
        const names =
          node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
            ? node.importClause.namedBindings.elements.map((item) => item.name.text)
            : []
        if (
          names.some((name) =>
            [
              'onMounted',
              'onUnmounted',
              'onScopeDispose',
              'watch',
              'useRouter',
              'useRoute',
              'useLoginUserStore',
            ].includes(name),
          )
        )
          report(file, 'Register Vue lifecycle only in the app composition layer')
      }
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) dependency(node.moduleSpecifier.text)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    )
      dependency(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(ast)
}
const visited = new Set(),
  active = []
/** 遍历源码导入关系并记录模块依赖。 */
function visit(file) {
  if (active.includes(file)) {
    report(
      file,
      'Import cycle: ' +
        [...active.slice(active.indexOf(file)), file]
          .map((value) => path.relative(sourceRoot, value))
          .join(' -> '),
    )
    return
  }
  if (visited.has(file)) return
  active.push(file)
  for (const target of graph.get(file)) visit(target)
  active.pop()
  visited.add(file)
}
for (const file of files) visit(file)
const manifest = JSON.parse(fs.readFileSync('scripts/generated-api.sha256.json', 'utf8'))
const generated = fs
  .readdirSync('src/api', { recursive: true })
  .filter((file) => fs.statSync(path.join('src/api', file)).isFile())
  .map((file) => 'src/api/' + file)
  .sort()
if (JSON.stringify(generated) !== JSON.stringify(Object.keys(manifest).sort()))
  errors.push('src/api: generated file set changed')
for (const [file, expected] of Object.entries(manifest)) {
  if (
    !fs.existsSync(file) ||
    crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== expected
  )
    errors.push(file + ': protected generated file changed')
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else
  console.log(
    'Architecture checks passed: feature boundaries, lifecycle, domain types, import graph, and 6 protected API files',
  )
