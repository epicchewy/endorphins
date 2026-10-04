import ts from 'typescript'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

const root = resolve(import.meta.dir, '../app')
const failures: string[] = []
async function inspect(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      await inspect(file)
      continue
    }
    const name = relative(root, file)
    if (file.endsWith('.css') && name !== 'app.css') {
      failures.push(
        `${name}: Keep global CSS in app.css and component styles in Tailwind primitives.`,
      )
    }
    if (!/\.tsx?$/.test(file) || file.endsWith('.gen.ts')) continue
    const source = ts.createSourceFile(
      file,
      await readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const inspectImport = (specifier: string, typeOnly: boolean) => {
      const local = specifier.startsWith('~/')
        ? specifier.slice(2)
        : specifier.startsWith('.')
          ? relative(root, resolve(dirname(file), specifier))
          : null
      const fail = (reason: string) => failures.push(`${name}: ${specifier} — ${reason}`)
      if (name.startsWith('services/')) {
        if (local && /^(hooks|components|routes|pages|auth|server)\//.test(local))
          fail('Services must remain independent of UI, auth adapters, and route state.')
        if (
          !typeOnly &&
          /^(react|@tanstack\/react-query|@tanstack\/react-router|motion|lucide-react)(\/|$)/.test(
            specifier,
          )
        )
          fail('React orchestration belongs in hooks or presentation.')
      }
      if (name.startsWith('hooks/') && local && /^(components|pages|routes)\//.test(local))
        fail('Shared hooks must not depend on presentation.')
      if (
        name.startsWith('components/ui/') &&
        local &&
        /^(hooks|services|auth|routes|pages|server)\//.test(local)
      )
        fail('UI primitives must be controlled and application-independent.')
      if (specifier.startsWith('motion/') && !name.startsWith('components/ui/'))
        fail('Consume the shared UI motion primitives.')
      if (specifier.startsWith('@clerk/') && !name.startsWith('auth/'))
        fail('Identity SDK access belongs in the auth adapter.')
    }
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause
        const typeOnly = Boolean(
          clause?.isTypeOnly ||
            (!clause?.name &&
              clause?.namedBindings &&
              ts.isNamedImports(clause.namedBindings) &&
              clause.namedBindings.elements.every((item) => item.isTypeOnly)),
        )
        inspectImport(node.moduleSpecifier.text, typeOnly)
      }
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        inspectImport(node.moduleSpecifier.text, node.isTypeOnly)
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        inspectImport(node.arguments[0].text, false)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
}
await inspect(root)
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('Frontend dependency and motion boundaries passed.')
