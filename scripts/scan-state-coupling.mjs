#!/usr/bin/env node
// 扫描 web/ 状态隐式边 → baselines/state-coupling.json
// 执行计划 v2 §3.1：import 图看不见的两类边——① 共享 atom 文件与其跨模块引用者；② 同 queryKey 的读/写组件。
// 用途：迁移单元聚类时「同 atom / 同 queryKey 的组件同单元或后迁」（§5.1）。
// 提取口径（regex 级，非全量 AST）：jotai 导出原子 = export const x = atom|atomWith*|selectAtom；
// queryKey = oRPC 链式 .key() 调用路径 + [NAME_SPACE, 'suffix'] 数组字面量 + 内联数组首段；invalidateQueries 记为写边。
// 局限：动态拼接 key、跨文件转发的 keys 对象不追踪——误差由单元边界评审抽查兜底（计划口径）。
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const webDir = path.join(repoRoot, 'web')
const outFile = path.join(repoRoot, 'baselines/state-coupling.json')

const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage', 'dist', '__tests__', '__mocks__'])
const SRC_RE = /\.(ts|tsx)$/

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = path.join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (SRC_RE.test(name) && !/\.(spec|test|stories|story)\.(ts|tsx)$/.test(name)) acc.push(p)
  }
  return acc
}

const files = walk(webDir)
const rel = p => path.relative(repoRoot, p)

// ---------- Pass 1: atom 持有文件（定义即算，导出可为 hook 封装） ----------
const ATOM_DEF_RE = /=\s*(atom\s*[<(]|atomWith\w*\s*[(<]|selectAtom\s*\()/g
const EXPORT_NAME_RE = /export\s+(?:const|function|class)\s+(\w+)/g
const atomFiles = new Map() // absPath → { defined, exports }
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const defined = [...src.matchAll(ATOM_DEF_RE)]
  if (defined.length === 0) continue
  const exports_ = [...src.matchAll(EXPORT_NAME_RE)].map(m => m[1])
  atomFiles.set(f, { definedCount: defined.length, exports: exports_ })
}

// ---------- import 解析（@/ → web/；相对路径；补扩展名/index） ----------
const IMPORT_RE = /(?:import|export)[^\n]*?\bfrom\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
function resolveSpec(spec, importerDir) {
  let base
  if (spec.startsWith('@/')) base = path.join(webDir, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(importerDir, spec)
  else return undefined // 包名，非本仓文件
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return undefined
}

const atomImporters = new Map([...atomFiles.keys()].map(k => [k, new Set()]))
const queryKeyByFile = new Map() // absPath → { reads: Set, writes: Set }

const ORPC_KEY_RE = /\b(?:query|consoleQuery|consoleClient|client)\.([a-zA-Z][\w.]*?)\.key\(/g
const NAMESPACE_DECL_RE = /const\s+NAME_SPACE\s*=\s*['"]([\w-]+)['"]/
const QUERYKEY_ARR_RE = /queryKey:\s*\[([^\]]*)\]/g
const INVALIDATE_RE = /invalidateQueries|setQueryData|removeQueries/
const STRING_LIT_RE = /'([\w][\w:-]*)'|"([\w][\w:-]*)"/g

for (const f of files) {
  const src = readFileSync(f, 'utf8')

  // atom import 边
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2]
    if (!spec) continue
    const target = resolveSpec(spec, path.dirname(f))
    if (target && atomImporters.has(target)) atomImporters.get(target).add(f)
  }

  // queryKey 提取
  const keys = { reads: new Set(), writes: new Set() }
  for (const m of src.matchAll(ORPC_KEY_RE)) keys.reads.add(`orpc:${m[1]}`)
  const ns = src.match(NAMESPACE_DECL_RE)?.[1]
  for (const m of src.matchAll(QUERYKEY_ARR_RE)) {
    const segs = [...m[1].matchAll(STRING_LIT_RE)].map(s => s[1] ?? s[2])
    const parts = m[1].includes('NAME_SPACE') && ns ? [ns, ...segs] : segs
    if (parts.length > 0) keys.reads.add(`ns:${parts.join('/')}`)
  }
  if (INVALIDATE_RE.test(src)) {
    // 文件内出现的 key 若同时被 invalidate/setQueryData 引用，则该文件对「本文件出现的所有 key」记写边（粗粒度，够用于同单元判定）
    for (const k of keys.reads) keys.writes.add(k)
  }
  if (keys.reads.size > 0) queryKeyByFile.set(f, keys)
}

// ---------- 聚合 ----------
const sharedAtoms = [...atomFiles.entries()]
  .map(([file, info]) => {
    const importers = [...(atomImporters.get(file) ?? [])]
    const ownDir = path.dirname(file)
    const external = importers.filter(i => path.dirname(i) !== ownDir)
    return {
      file: rel(file),
      atomsDefined: info.definedCount,
      exports: info.exports,
      importerCount: importers.length,
      externalImporterCount: external.length,
      externalImporters: external.map(rel).sort(),
    }
  })
  .sort((a, b) => b.externalImporterCount - a.externalImporterCount)

// queryKey 聚类：同 key 出现在 ≥2 个不同目录 = 跨模块耦合边
const keyMap = new Map() // key → { readers: Set, writers: Set }
for (const [f, keys] of queryKeyByFile) {
  for (const k of keys.reads) {
    if (!keyMap.has(k)) keyMap.set(k, { readers: new Set(), writers: new Set() })
    keyMap.get(k).readers.add(f)
  }
  for (const k of keys.writes) keyMap.get(k)?.writers.add(f)
}
const queryKeyClusters = [...keyMap.entries()]
  .map(([key, v]) => {
    const readers = [...v.readers].map(rel).sort()
    const writers = [...v.writers].map(rel).sort()
    const dirs = new Set(readers.map(r => path.dirname(r)))
    return { key, readers, writers, crossDir: dirs.size > 1 }
  })
  .filter(c => c.readers.length > 1)
  .sort((a, b) => b.readers.length - a.readers.length)

const head = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim()
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  commit: head,
  method: 'regex 级提取（非全量 AST）；动态拼接 key / 跨文件转发 keys 对象不追踪，误差由单元边界评审抽查兜底（计划口径）',
  summary: {
    atomExportFiles: atomFiles.size,
    crossModuleAtomFiles: sharedAtoms.filter(a => a.externalImporterCount > 0).length,
    queryKeyFiles: queryKeyByFile.size,
    queryKeyClustersWithMultipleReaders: queryKeyClusters.length,
    crossDirClusters: queryKeyClusters.filter(c => c.crossDir).length,
  },
  sharedAtoms,
  queryKeyClusters,
}
writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`)
console.log('state-coupling 扫描完成 →', path.relative(repoRoot, outFile))
console.log(JSON.stringify(out.summary, null, 2))
