'use client'
import type { ConversationItem } from '@/models/share'
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogCancelButton,
  AlertDialogConfirmButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@xsl/lomva-ui/alert-dialog'
import { cn } from '@xsl/lomva-ui/cn'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatWithHistoryContext } from '../context'
import List from '../sidebar/list'
import RenameModal from '../sidebar/rename-modal'
import FooterMenu from './footer-menu'
import { filterConversationsByName, groupConversationsByTime } from './utils'

type Props = Readonly<{
  open: boolean
  onClose: () => void
}>

/**
 * 会话抽屉（chat 单元重写，方向 A：默认无侧栏，会话管理收进 overlay 抽屉）：
 * - 300px overlay + 蒙层，不推挤布局；蒙层点击 / ESC 关闭；选中会话 / 新建后自动关
 * - D1 顶部搜索框前端过滤（范围 = 已加载列表，分页 limit 20 见设计档 §9 待核项）
 * - D2 非置顶会话按 今天/昨天/更早 时间分组；置顶组不参与分组
 * - D11 底部平铺菜单区（主题/隐私/关于/退出 + 品牌行）见 footer-menu
 * - 壳层挂载/⌘K 唤起在 Task 3 接线，本组件不自挂
 */
const ConversationDrawer = ({ open, onClose }: Props) => {
  const { t } = useTranslation()
  const {
    isInstalledApp,
    appData,
    handleNewConversation,
    pinnedConversationList,
    conversationList,
    currentConversationId,
    handleChangeConversation,
    handlePinConversation,
    handleUnpinConversation,
    conversationRenaming,
    handleRenameConversation,
    handleDeleteConversation,
    isResponding,
    isMobile,
  } = useChatWithHistoryContext()
  const [keyword, setKeyword] = useState('')
  const [showConfirm, setShowConfirm] = useState<ConversationItem | null>(null)
  const [showRename, setShowRename] = useState<ConversationItem | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const prevOpenRef = useRef(false)

  // ⌘K/☰ 打开后显式聚焦搜索框：open false→true（含挂载即开）时落焦；autoFocus 只在挂载生效故弃用
  useEffect(() => {
    if (open && !prevOpenRef.current) searchInputRef.current?.focus()
    prevOpenRef.current = open
  }, [open])

  // ESC 关闭；重命名/删除弹窗打开时让位给弹窗自身的 ESC，避免抽屉连带关闭
  useEffect(() => {
    if (!open) return
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || showRename || showConfirm) return
      // footer「关于」InfoModal 等组件外弹窗开着时 ESC 也让位（state 不可见，改 DOM 检测，
      // 与壳层 ⌘K 让位同口径）：Base UI Dialog/AlertDialog popup 开态带 data-open；
      // 抽屉自身 aside 无 data-open，不自匹配
      const modalOpen = !!document.querySelector(
        '[role="dialog"][data-open], [role="alertdialog"][data-open]',
      )
      if (!modalOpen) onClose()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [open, onClose, showRename, showConfirm])

  const filtered = useMemo(
    () => filterConversationsByName(conversationList, keyword),
    [conversationList, keyword],
  )
  const filteredPinned = useMemo(
    () => filterConversationsByName(pinnedConversationList, keyword),
    [pinnedConversationList, keyword],
  )
  const groups = useMemo(() => groupConversationsByTime(filtered), [filtered])

  const pick = useCallback(
    (id: string) => {
      handleChangeConversation(id)
      onClose()
    },
    [handleChangeConversation, onClose],
  )
  const newChat = useCallback(() => {
    handleNewConversation()
    onClose()
  }, [handleNewConversation, onClose])

  const handleOperate = useCallback(
    (type: string, item: ConversationItem) => {
      if (type === 'pin') handlePinConversation(item.id)

      if (type === 'unpin') handleUnpinConversation(item.id)

      if (type === 'delete') setShowConfirm(item)

      if (type === 'rename') setShowRename(item)
    },
    [handlePinConversation, handleUnpinConversation],
  )
  const handleCancelConfirm = useCallback(() => {
    setShowConfirm(null)
  }, [])
  const handleDelete = useCallback(() => {
    if (showConfirm) handleDeleteConversation(showConfirm.id, { onSuccess: handleCancelConfirm })
  }, [showConfirm, handleDeleteConversation, handleCancelConfirm])
  const handleCancelRename = useCallback(() => {
    setShowRename(null)
  }, [])
  const handleRename = useCallback(
    (newName: string) => {
      if (showRename)
        handleRenameConversation(showRename.id, newName, { onSuccess: handleCancelRename })
    },
    [showRename, handleRenameConversation, handleCancelRename],
  )

  return (
    <>
      {/* 蒙层 */}
      <div
        aria-hidden
        data-testid="drawer-mask"
        onClick={onClose}
        className={cn(
          'absolute inset-0 z-40 bg-black/30 transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      {/* 抽屉本体：overlay 桌面 300px / 移动端 85%（mockup .phone .drawer：移动端去右边框），
          不推挤布局；断点随 context isMobile（≤640，与壳层 header 切换同口径）。
          关态 inert：移出 tab 序/禁交互（translate 动画照常，浏览器 inert 天然保留可见性） */}
      <aside
        role="dialog"
        aria-label={t(($) => $['chat.conversationHistory'], { ns: 'share' })}
        inert={!open}
        className={cn(
          'absolute inset-y-0 left-0 z-50 flex flex-col bg-[var(--card)] shadow-[var(--shadow-md)]',
          'transition-transform duration-200 ease-out',
          isMobile ? 'w-[85%]' : 'w-[300px] border-r border-[var(--border)]',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex shrink-0 flex-col gap-2.5 px-3 pt-3 pb-2">
          {/* D1 搜索框：壳层 ⌘K 唤起后由 open 副作用显式落焦（见上 useEffect） */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 text-[var(--text-3)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <span aria-hidden className="i-ri-search-line size-3.5" />
            <input
              ref={searchInputRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t(($) => $['chat.searchConversations'], { ns: 'share' })}
              className="w-full bg-transparent text-[13px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
            />
          </div>
          {/* 新建 CTA（accent，全页唯一主按钮；禁用态 isResponding 沿用） */}
          <button
            type="button"
            disabled={isResponding}
            onClick={newChat}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-[var(--accent)] text-[13.5px] font-semibold text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden className="i-ri-add-line size-4" />
            {t(($) => $['chat.newChat'], { ns: 'share' })}
          </button>
        </div>
        <div className="h-0 grow space-y-2 overflow-y-auto px-2 pt-0.5 pb-2">
          {!!filteredPinned.length && (
            <List
              isPin
              title={t(($) => $['chat.pinnedTitle'], { ns: 'share' })}
              list={filteredPinned}
              onChangeConversation={pick}
              onOperate={handleOperate}
              currentConversationId={currentConversationId}
            />
          )}
          {!!groups.today.length && (
            <List
              title={t(($) => $['chat.groupToday'], { ns: 'share' })}
              list={groups.today}
              onChangeConversation={pick}
              onOperate={handleOperate}
              currentConversationId={currentConversationId}
            />
          )}
          {!!groups.yesterday.length && (
            <List
              title={t(($) => $['chat.groupYesterday'], { ns: 'share' })}
              list={groups.yesterday}
              onChangeConversation={pick}
              onOperate={handleOperate}
              currentConversationId={currentConversationId}
            />
          )}
          {!!groups.earlier.length && (
            <List
              title={t(($) => $['chat.groupEarlier'], { ns: 'share' })}
              list={groups.earlier}
              onChangeConversation={pick}
              onOperate={handleOperate}
              currentConversationId={currentConversationId}
            />
          )}
        </div>
        <FooterMenu
          site={appData?.site}
          customConfig={appData?.custom_config}
          hideLogout={isInstalledApp}
        />
        {/* 重命名/删除弹窗：自 sidebar 原样移植 */}
        <AlertDialog open={!!showConfirm} onOpenChange={(open) => !open && handleCancelConfirm()}>
          <AlertDialogContent>
            <div className="flex flex-col gap-2 px-6 pt-6 pb-4">
              <AlertDialogTitle className="w-full truncate title-2xl-semi-bold text-text-primary">
                {t(($) => $['chat.deleteConversation.title'], { ns: 'share' })}
              </AlertDialogTitle>
              <AlertDialogDescription className="w-full system-md-regular wrap-break-word whitespace-pre-wrap text-text-tertiary">
                {t(($) => $['chat.deleteConversation.content'], { ns: 'share' })}
              </AlertDialogDescription>
            </div>
            <AlertDialogActions>
              <AlertDialogCancelButton>
                {t(($) => $['operation.cancel'], { ns: 'common' })}
              </AlertDialogCancelButton>
              <AlertDialogConfirmButton onClick={handleDelete}>
                {t(($) => $['operation.confirm'], { ns: 'common' })}
              </AlertDialogConfirmButton>
            </AlertDialogActions>
          </AlertDialogContent>
        </AlertDialog>
        {showRename && (
          <RenameModal
            isShow
            onClose={handleCancelRename}
            saveLoading={conversationRenaming}
            name={showRename?.name || ''}
            onSave={handleRename}
          />
        )}
      </aside>
    </>
  )
}

export default ConversationDrawer
