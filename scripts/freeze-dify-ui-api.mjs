#!/usr/bin/env node
// 冻结 packages/dify-ui 各原语的 public API 签名 → baselines/dify-ui-api.json
// 执行计划 v2 §3.1 基线轨产出物：2a/2b 原语闭环步骤 1 的契约源。
// 用法：node scripts/freeze-dify-ui-api.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const uiDir = path.join(repoRoot, 'packages/dify-ui')
const outFile = path.join(repoRoot, 'baselines/dify-ui-api.json')

const require = createRequire(path.join(repoRoot, 'web/package.json'))
const ts = require('typescript')

// 执行计划 v2 §4：2a = WebApp 直接闭包 18 + 管理台基础原语；table 为 2a 新建（无既有实现，不在冻结范围）
const TRACK_2A = new Set([
  'cn', 'button', 'icon-button', 'toast', 'tooltip', 'textarea', 'select', 'dropdown-menu',
  'popover', 'dialog', 'alert-dialog', 'avatar', 'toggle', 'tabs', 'input', 'form', 'field',
  'collapsible', 'pagination', 'checkbox', 'radio-group', 'status-dot',
])

const pkg = JSON.parse(readFileSync(path.join(uiDir, 'package.json'), 'utf8'))

// --- 用 dify-ui 的 tsconfig 建 program（extends 链由 ts 解析） ---
const configFile = ts.readConfigFile(path.join(uiDir, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, uiDir)
const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } })
const checker = program.getTypeChecker()

function textOf(node) {
  return node.getText()
}

function jsdocOf(node) {
  const tags = ts.getJSDocCommentsAndTags?.(node) ?? []
  const texts = []
  for (const t of tags) {
    if (t.comment) texts.push(typeof t.comment === 'string' ? t.comment : '')
  }
  return texts.join(' ').trim() || undefined
}

// 每个原语目录的 接口/类型别名 索引（供组件 props 类型引用回查）
function buildTypeIndex(dirFiles) {
  const index = new Map()
  for (const sf of dirFiles) {
    ts.forEachChild(sf, function visit(node) {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
        index.set(node.name.text, { node, file: sf })
      }
      ts.forEachChild(node, visit)
    })
  }
  return index
}

function ownMembersOf(decl) {
  // interface 成员 / 类型别名内联对象成员
  const members = {}
  const bodies = []
  if (ts.isInterfaceDeclaration(decl)) bodies.push(decl.members)
  else if (ts.isTypeAliasDeclaration(decl)) {
    if (ts.isTypeLiteralNode(decl.type)) bodies.push(decl.type.members)
    else if (ts.isIntersectionTypeNode(decl.type)) {
      for (const part of decl.type.types) if (ts.isTypeLiteralNode(part)) bodies.push(part.members)
    }
  }
  for (const body of bodies) {
    for (const m of body) {
      if (!ts.isPropertySignature(m) || !m.name) continue
      members[m.name.getText()] = {
        type: m.type ? m.type.getText() : 'unknown',
        optional: !!m.questionToken,
        ...(jsdocOf(m) ? { doc: jsdocOf(m) } : {}),
      }
    }
  }
  return members
}

function heritageOf(decl) {
  // interface extends 列表 / 类型别名交叉项中的非内联部分（verbatim）
  if (ts.isInterfaceDeclaration(decl) && decl.heritageClauses) {
    return decl.heritageClauses.flatMap(h => h.types.map(textOf))
  }
  if (ts.isTypeAliasDeclaration(decl) && ts.isIntersectionTypeNode(decl.type)) {
    return decl.type.types.filter(t => !ts.isTypeLiteralNode(t)).map(textOf)
  }
  if (ts.isTypeAliasDeclaration(decl) && !ts.isTypeLiteralNode(decl.type)) {
    return [textOf(decl.type)]
  }
  return []
}

function signatureOfExport(sym) {
  const decls = sym.getDeclarations() ?? []
  for (const d of decls) {
    if (ts.isFunctionDeclaration(d)) return textOf(d).replace(/\s*\{[\s\S]*$/, '')
    if (ts.isVariableDeclaration(d) && d.initializer) {
      const init = d.initializer
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        return `const ${d.name.getText()} = ${textOf(init).replace(/\s*=>\s*\{[\s\S]*$/, ' => …')}`
      }
      // forwardRef / memo 等包装：取 checker 签名
      const t = checker.getTypeOfSymbolAtLocation(sym, d)
      const sigs = t.getCallSignatures()
      if (sigs.length > 0) return `${d.name.getText()}${checker.signatureToString(sigs[0])}`
      return `const ${d.name.getText()}: ${checker.typeToString(t)}`
    }
    if (ts.isClassDeclaration(d)) return `class ${d.name?.getText()}`
  }
  return undefined
}

function cvaInfoOf(dirFiles) {
  // 检测 xxxVariants = cva(...) 常量，提取 variants 键/选项/defaultVariants（类名属视觉实现，不入契约）
  const out = {}
  for (const sf of dirFiles) {
    ts.forEachChild(sf, function visit(node) {
      if (
        ts.isVariableDeclaration(node) && node.initializer
        && ts.isCallExpression(node.initializer)
        && node.initializer.expression.getText() === 'cva'
        && node.initializer.arguments.length >= 2
        && ts.isObjectLiteralExpression(node.initializer.arguments[1])
      ) {
        const name = node.name.getText()
        const config = node.initializer.arguments[1]
        const info = {}
        for (const prop of config.properties) {
          if (!ts.isPropertyAssignment(prop)) continue
          const key = prop.name.getText()
          if (key === 'variants' && ts.isObjectLiteralExpression(prop.initializer)) {
            const variants = {}
            for (const v of prop.initializer.properties) {
              if (ts.isPropertyAssignment(v) && ts.isObjectLiteralExpression(v.initializer)) {
                variants[v.name.getText()] = v.initializer.properties.map(p => p.name.getText().replace(/^['"]|['"]$/g, ''))
              }
            }
            info.variants = variants
          }
          if (key === 'defaultVariants' && ts.isObjectLiteralExpression(prop.initializer)) {
            const dv = {}
            for (const v of prop.initializer.properties) {
              if (ts.isPropertyAssignment(v)) dv[v.name.getText()] = v.initializer.getText().replace(/^['"]|['"]$/g, '')
            }
            info.defaultVariants = dv
          }
          if (key === 'compoundVariants' && ts.isArrayLiteralExpression(prop.initializer)) {
            info.compoundVariantCount = prop.initializer.elements.length
          }
        }
        out[name] = info
      }
      ts.forEachChild(node, visit)
    })
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const primitives = {}
const warnings = []

for (const [subpath, target] of Object.entries(pkg.exports)) {
  const name = subpath.replace(/^\.\//, '')
  if (name === 'styles.css') continue
  const entryRel = typeof target === 'string' ? target : target.import ?? target.types
  if (!entryRel) continue
  const entryAbs = path.join(uiDir, entryRel)
  if (!existsSync(entryAbs)) { warnings.push(`${name}: entry ${entryRel} 不存在`); continue }

  const dir = path.dirname(entryAbs)
  const dirFiles = program.getSourceFiles().filter(f =>
    f.fileName.startsWith(dir) && !f.fileName.includes('__tests__') && !f.fileName.endsWith('.d.ts'),
  )
  const entrySf = program.getSourceFile(entryAbs)
  if (!entrySf) { warnings.push(`${name}: entry 不在 program 内`); continue }

  const typeIndex = buildTypeIndex(dirFiles)
  const moduleSymbol = checker.getSymbolAtLocation(entrySf) ?? entrySf.symbol
  const exportSymbols = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []

  const exports_ = {}
  for (const sym of exportSymbols) {
    const resolved = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym
    const decls = resolved.getDeclarations() ?? []
    const decl = decls[0]
    if (!decl) continue
    if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) {
      exports_[sym.name] = { kind: 'type', declaration: textOf(decl) }
    }
    else {
      const sig = signatureOfExport(resolved)
      const isComponent = /^[A-Z]/.test(sym.name)
      exports_[sym.name] = {
        kind: isComponent ? 'component' : 'function',
        ...(sig ? { signature: sig } : {}),
      }
      // 组件：回查 props 类型声明
      if (isComponent) {
        const t = checker.getTypeOfSymbolAtLocation(resolved, decl)
        const sig0 = t.getCallSignatures()[0]
        const param0 = sig0?.getParameters()[0]
        if (param0) {
          const pDecl = param0.getDeclarations()?.[0]
          const typeName = pDecl && ts.isParameter(pDecl) && pDecl.type ? pDecl.type.getText() : undefined
          if (typeName && typeIndex.has(typeName)) {
            const tdecl = typeIndex.get(typeName).node
            exports_[sym.name].props = {
              type: typeName,
              declaration: textOf(tdecl),
              ownMembers: ownMembersOf(tdecl),
              heritage: heritageOf(tdecl),
            }
          }
          else if (typeName) {
            exports_[sym.name].props = { type: typeName }
          }
        }
      }
    }
  }

  primitives[name] = {
    track: TRACK_2A.has(name) ? '2a' : '2b',
    entry: entryRel,
    exports: exports_,
    ...(cvaInfoOf(dirFiles) ? { cva: cvaInfoOf(dirFiles) } : {}),
  }
}

const head = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim()
const out = {
  frozenAt: new Date().toISOString().slice(0, 10),
  commit: head,
  package: pkg.name,
  purpose: '执行计划 v2 §3.1 基线轨：原语 public API 冻结签名——2a/2b 闭环步骤 1 的契约源；props.declaration 为 verbatim 锚点，cva 只录键/default（类名属视觉实现）',
  omissions: ['table 为 2a 新建原语，dify-ui 无既有实现，无冻结对象'],
  primitives,
  ...(warnings.length > 0 ? { warnings } : {}),
}

writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`)
const n2a = Object.values(primitives).filter(p => p.track === '2a').length
console.log(`frozen ${Object.keys(primitives).length} primitives（2a: ${n2a}，2b: ${Object.keys(primitives).length - n2a}）→ ${path.relative(repoRoot, outFile)}`)
if (warnings.length > 0) console.log('warnings:', warnings)
