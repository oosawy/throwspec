import { RuleCreator } from '@typescript-eslint/utils/eslint-utils'
import { createRule } from '../utils'
import { ESLintUtils, TSESTree } from '@typescript-eslint/utils'
import ts from 'typescript'
import * as path from 'path'
import { RuleContext, RuleFixer } from '@typescript-eslint/utils/ts-eslint'

type MessageIds =
  | 'issue:missing-throws-annotation'
  | 'issue:throws-annotation-not-match'
  | 'fix:infer-throws-annotation'

type Options = [
  {
    strictMatch?: boolean
  }
]

export const rule = createRule<Options, MessageIds>({
  name: 'throws-annotation',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Checks for missing error annotation for `throws<YourError>(fn)`.',
    },
    hasSuggestions: true,
    messages: {
      'issue:missing-throws-annotation':
        'Missing error annotation. For example: `throws<YourError>(fn)`.',
      'issue:throws-annotation-not-match':
        'Error annotation does not match the actual error type.' +
        ' For example: `throws<FooError>(fn)` where fn throws `BarError`.',
      'fix:infer-throws-annotation':
        'Add error annotation. For example: `throws<YourError>(fn)`.',
    },
    schema: [
      {
        type: 'object',
        properties: {},
      },
    ],
  },
  defaultOptions: [{}],
  create: (context, options) => {
    const parserServices = ESLintUtils.getParserServices(context)
    const checker = parserServices.program.getTypeChecker()

    return {
      CallExpression: (node) => {
        // Skip if it's not `throws()`
        if (
          !(node.callee.type === 'Identifier' && node.callee.name === 'throws')
        ) {
          return
        }

        // Skip if it's not `throws(f())`
        // `throws(() => f()) will be checked by the rules-of-throw
        let calleeIdent: TSESTree.Identifier
        let arg = node.arguments[0]
        if (
          !(arg.type === 'CallExpression' && arg.callee.type === 'Identifier')
        ) {
          return
        }
        calleeIdent = arg.callee

        // Skip if it's not `throws<T>(fn)` where `T` is type reference or its union type if any
        // This will be checked by the rules-of-throw
        const firstGenericType = node.typeArguments?.params[0]
        if (firstGenericType) {
          if (firstGenericType.type === 'TSTypeReference') {
            // If it's `throws<T>(f)`
            return
          } else if (
            firstGenericType.type === 'TSUnionType' &&
            !firstGenericType.types.every((t) => t.type === 'TSTypeReference')
          ) {
            // If it's `throws<T1 | T2>(f)`
            return
          }
        }

        // Skip if it's not `throws(f())` where `f` is *not* `() => any | Throws<ErrorType>`
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(calleeIdent)
        const calleeType = checker.getTypeAtLocation(tsNode)
        const symbol = calleeType.getSymbol()
        if (!symbol) return

        const firstDecl = symbol.declarations?.[0]
        if (!firstDecl) return
        const throwable = getFunctionThrowsType(firstDecl)
        if (!throwable) return

        // Make import statement to the error type
        let importStat: string | undefined
        const errorType = checker.getTypeAtLocation(throwable)
        const errorText = checker.typeToString(errorType)

        const sourceFile = firstDecl?.getSourceFile()
        if (!sourceFile) return
        const importDecl = findImportDeclaration(sourceFile, errorText)
        if (importDecl) {
          importStat = importDeclarationToText(importDecl, context.filename)
        }

        context.report({
          node,
          messageId: 'issue:missing-throws-annotation',
          suggest: [
            {
              messageId: 'fix:infer-throws-annotation',
              fix: (fixer) => {
                const fixImport =
                  importStat &&
                  getInsertImportRuleFix({ context, fixer, importStat })

                // Fix `throws(f)` to `throws<ErrorText>(f)`
                const rangeStart = node.range[0]
                const range = [
                  rangeStart,
                  rangeStart + 6 /* 'throws'.length */ + 1,
                ] as const
                return [
                  ...(fixImport ? [fixImport] : []),
                  fixer.replaceTextRange(range, `throws<${errorText}>(`),
                ]
              },
            },
          ],
        })
      },
    }
  },
})

function getFunctionThrowsType(decl: ts.Declaration) {
  let funcNode: ts.FunctionLikeDeclarationBase | undefined

  if (
    ts.isFunctionDeclaration(decl) ||
    ts.isFunctionExpression(decl) ||
    ts.isArrowFunction(decl)
  ) {
    funcNode = decl
  } else if (ts.isVariableDeclaration(decl) && decl.initializer) {
    if (
      ts.isFunctionExpression(decl.initializer) ||
      ts.isArrowFunction(decl.initializer)
    ) {
      funcNode = decl.initializer
    }
  }

  const returnType = funcNode?.type
  if (!returnType) return

  if (ts.isUnionTypeNode(returnType)) {
    const throwsType = returnType.types.find(
      (type): type is ts.TypeReferenceType => {
        if (type && ts.isTypeReferenceNode(type)) {
          const typeName = type.typeName
          return ts.isIdentifier(typeName) && typeName.text === 'Throws'
        }
        return false
      }
    )

    return throwsType?.typeArguments?.[0]
  }
  if (ts.isTypeReferenceNode(returnType)) {
    const typeName = returnType.typeName
    if (ts.isIdentifier(typeName) && typeName.text === 'Throws') {
      return returnType.typeArguments?.[0]
    }
  }
}

function findImportDeclaration(
  sourceFile: ts.SourceFile,
  identifierName: string
) {
  return sourceFile.statements.find((stmt): stmt is ts.ImportDeclaration => {
    if (!ts.isImportDeclaration(stmt)) return false
    if (
      !stmt.importClause?.namedBindings ||
      !ts.isNamedImports(stmt.importClause.namedBindings)
    )
      return false

    return stmt.importClause.namedBindings.elements.some((el) => {
      // const importedName = (el.propertyName ?? el.name).escapedText
      const importedName = el.propertyName?.text ?? el.name.text
      return importedName === identifierName
    })
  })
}

function normalizeImportDeclaration(
  importDecl: ts.ImportDeclaration,
  targetFilePath: string
): ts.ImportDeclaration {
  if (!ts.isStringLiteral(importDecl.moduleSpecifier)) return importDecl

  const moduleSpecifierText = importDecl.moduleSpecifier.text

  const resolvedPath = resolveImportPath(
    moduleSpecifierText,
    importDecl.getSourceFile().fileName,
    targetFilePath
  )

  return ts.factory.updateImportDeclaration(
    importDecl,
    importDecl.modifiers,
    importDecl.importClause,
    ts.factory.createStringLiteral(resolvedPath),
    importDecl.attributes
  )
}

function importDeclarationToText(
  importDecl: ts.ImportDeclaration,
  targetFilePath: string
): string {
  const normalizedImportDecl = normalizeImportDeclaration(
    importDecl,
    targetFilePath
  )

  const printer = ts.createPrinter()
  const file = ts.createSourceFile(
    'temp.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  )

  return printer.printNode(ts.EmitHint.Unspecified, normalizedImportDecl, file)
}

function resolveImportPath(
  moduleSpecifierText: string,
  sourceFilePath: string,
  targetFilePath: string
): string {
  if (!moduleSpecifierText.startsWith('.')) {
    return moduleSpecifierText
  }

  const absoluteModulePath = path.resolve(
    path.dirname(sourceFilePath),
    moduleSpecifierText
  )

  let relativePath = path.relative(
    path.dirname(targetFilePath),
    absoluteModulePath
  )

  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath
  }

  relativePath = relativePath.replace(/\\/g, '/')

  return relativePath
}

function getInsertImportRuleFix({
  context,
  fixer,
  importStat,
}: {
  context: RuleContext<MessageIds, Options>
  fixer: RuleFixer
  importStat: string
}) {
  const program = context.sourceCode.ast
  const insertAfter = program.body.findLast(
    (stmt) => stmt.type === 'ImportDeclaration'
  )

  if (insertAfter) {
    return fixer.insertTextAfter(insertAfter, '\n' + importStat)
  } else {
    const firstNode = program.body[0]
    if (firstNode) {
      return fixer.insertTextBefore(firstNode, importStat + '\n')
    } else {
      return fixer.insertTextBeforeRange(
        [program.range[0], program.range[0]],
        importStat + '\n'
      )
    }
  }
}
