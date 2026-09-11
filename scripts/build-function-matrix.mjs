#!/usr/bin/env node
// 功能矩阵构建器 → baselines/function-matrix.json
// 执行计划 v2 §3.1：分期产出——种子版（W2，本脚本当前形态）= 路由穷举列，契约/i18n/测试/e2e 列留空待填；
// WebApp 行（W3，三件套填充）→ 全量（W6 前）。matrix-check 依此文件存在即可跑。
// 用法：node scripts/build-function-matrix.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const appDir = path.join(repoRoot, 'web/app')
const outFile = path.join(repoRoot, 'baselines/function-matrix.json')

const SKIP_DIRS = new Set(['node_modules', '__tests__', 'components'])

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = path.join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (name === 'page.tsx' || name === 'layout.tsx') acc.push(p)
  }
  return acc
}

function routeOf(file, kind) {
  let rel = path.relative(appDir, file)
  rel = rel.replace(/\/(page|layout)\.tsx$/, '')
  const segments = rel.split('/').filter(s => s && !/^\(.+\)$/.test(s)) // 剥路由组
  const route = `/${segments.join('/')}`
  return route === '/' && kind === 'page' ? '/' : route.replace(/\/$/, '') || '/'
}

const AUTH_DIRS = new Set(['auth', 'forgot-password', 'activate', 'install', 'oauth-callback', 'device', 'signin'])
function zoneOf(file) {
  const rel = path.relative(appDir, file)
  const group = rel.match(/^\(([^)]+)\)/)?.[1]
  if (group === 'shareLayout') return 'webapp'
  if (group === 'commonLayout') return 'console'
  if (group === 'education') return 'education'
  if (group === 'humanInputLayout') return 'human-input'
  const first = rel.split('/')[0]
  if (AUTH_DIRS.has(first)) return 'auth'
  return 'misc'
}

const files = walk(appDir)
const pages = files.filter(f => f.endsWith('page.tsx'))
const layouts = files.filter(f => f.endsWith('layout.tsx'))

const rows = pages.map(f => ({
  id: routeOf(f, 'page'),
  route: routeOf(f, 'page'),
  zone: zoneOf(f),
  file: path.relative(repoRoot, f),
  // 种子版留空，W3/W6 分期填充
  contracts: [],
  i18nKeys: [],
  tests: [],
  e2e: [],
  status: 'pending', // pending | 追平 | 已删核销 | 一期降级登记（收口追平率公式见计划 §6）
}))

const byZone = {}
for (const r of rows) byZone[r.zone] = (byZone[r.zone] ?? 0) + 1

const head = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim()
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  commit: head,
  stage: 'seed-routes-only',
  stagePlan: '种子（W2）→ WebApp 行（W3，design 三件套填充）→ 全量（W6 前）',
  summary: { pages: rows.length, layouts: layouts.length, total: files.length, byZone },
  notes: ['计划头部实测基线「路由 140」含 web/app/components/main-nav/layout.tsx——该文件位于非路由目录（app/components/），App Router 下不产生路由；本矩阵按语义计 139（106 page + 33 路由 layout）'],
  rows,
  layouts: layouts.map(f => ({
    route: routeOf(f, 'layout'),
    zone: zoneOf(f),
    file: path.relative(repoRoot, f),
  })),
}
writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`)
console.log(`function-matrix 种子版 → ${path.relative(repoRoot, outFile)}`)
console.log(`pages ${rows.length} + layouts ${layouts.length} = ${files.length}（计划基线 140）`, JSON.stringify(byZone))
