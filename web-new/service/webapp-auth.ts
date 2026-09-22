/* oxlint-disable no-restricted-globals, no-restricted-imports */
/* 命令式 service 模块（被 base.ts 请求链非 React 调用），foxact hook 形态不适用；
 * fork 带入的既有存储边界 + 既有 base 请求通道（login/status·passport·logout 无契约生成件），
 * 迁 createLocalStorageState / 契约化单列重构。 */
import type { WebAppAddress } from './webapp-address'
import { ACCESS_TOKEN_LOCAL_STORAGE_NAME, PASSPORT_LOCAL_STORAGE_NAME } from '@/config'
import { AccessMode } from '@/models/access-control'
import { getPublic, postPublic } from './base'
import { getWebAppPassportKey, resolveWebAppAddress } from './webapp-address'

export function setWebAppAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_LOCAL_STORAGE_NAME, token)
}

export function setWebAppPassport(address: WebAppAddress, token: string) {
  localStorage.setItem(PASSPORT_LOCAL_STORAGE_NAME(getWebAppPassportKey(address)), token)
}

export function getWebAppAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_LOCAL_STORAGE_NAME) || ''
}

/** 解码 passport JWT payload 的 app_code（失败/无字段 → null，不阻断原行为） */
const decodePassportAppCode = (token: string): string | null => {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const code = (json as { app_code?: unknown })?.app_code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

export function getWebAppPassport(address: WebAppAddress | null) {
  if (!address) return ''
  const key = PASSPORT_LOCAL_STORAGE_NAME(getWebAppPassportKey(address))
  const token = localStorage.getItem(key) || ''
  // 陈旧/错配 passport 防护（2026-09-22 实证）：后端按 passport JWT 解析应用、优先于 URL code，
  // 错配时页面渲染错应用（Safari 对 Chrome 错案）。校验 payload.app_code 与当前地址一致，
  // 不匹配即废弃 → splash 走重新签发。environment 形态 passport 结构未实证，暂不校验。
  if (token && address.kind === 'default') {
    const passportCode = decodePassportAppCode(token)
    if (passportCode && passportCode !== address.code) {
      localStorage.removeItem(key)
      return ''
    }
  }
  return token
}

function clearWebAppAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_LOCAL_STORAGE_NAME)
}

function clearWebAppPassport(address: WebAppAddress | null) {
  if (!address) return
  localStorage.removeItem(PASSPORT_LOCAL_STORAGE_NAME(getWebAppPassportKey(address)))
}

type isWebAppLogin = {
  logged_in: boolean
  app_logged_in: boolean
}

export async function webAppLoginStatus(
  shareCode: string,
  accessMode: AccessMode,
  userId?: string,
) {
  // always need to check login to prevent passport from being outdated
  // check remotely, the access token could be in cookie (enterprise SSO redirected with https)
  const address = resolveWebAppAddress()
  const params = new URLSearchParams()
  if (address?.kind !== 'environment') params.set('app_code', shareCode)
  if (userId) params.append('user_id', userId)
  const { logged_in, app_logged_in } = await getPublic<isWebAppLogin>(
    `/login/status?${params.toString()}`,
  )
  return {
    userLoggedIn:
      address?.kind === 'environment' && accessMode === AccessMode.PUBLIC ? true : logged_in,
    appLoggedIn: app_logged_in,
  }
}

export async function webAppLogout(address: WebAppAddress | null) {
  clearWebAppAccessToken()
  clearWebAppPassport(address)
  await postPublic('/logout')
}
