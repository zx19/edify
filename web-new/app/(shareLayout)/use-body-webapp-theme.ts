'use client'
import { useEffect } from 'react'

/**
 * share 路由期间把 .webapp-theme 挂到 body：
 * base-ui Portal 默认挂到 document.body——弹层（Dialog/DropdownMenu/Popover）逃出布局 div 的作用域，
 * body 级挂载让弹层同样继承新视觉变量；卸载（离开 share 路由）即摘除，console 路由零影响。
 * 挂在 shareLayout 而非 chat-with-history：工作台 /installed/<id>（console 侧）shell 自带作用域根，
 * 弹层在 console 语义下渲染是预期（与 console 一致）。
 */
export function useBodyWebappTheme() {
  useEffect(() => {
    document.body.classList.add('webapp-theme')
    return () => {
      document.body.classList.remove('webapp-theme')
    }
  }, [])
}
