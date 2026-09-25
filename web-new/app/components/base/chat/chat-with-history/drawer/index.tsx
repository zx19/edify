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
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  } = useChatWithHistoryContext()
  const [keyword, setKeyword] = useState('')
  const [showConfirm, setShowConfirm] = useState<ConversationItem | null>(null)
  const [showRename, setShowRename] = useState<ConversationItem | null>(null)

  // ESC 关闭；重命名/删除弹窗打开时让位给弹窗自身的 ESC，避免抽屉连带关闭
  useEffect(() => {
    if (!open) return
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showRename && !showConfirm) onClose()
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
      {/* 抽屉本体：overlay 300px，不推挤布局；移动端 85% 宽由 Task 8 处理 */}
      <aside
        role="dialog"
        aria-label={t(($) => $['chat.conversationHistory'], { ns: 'share' })}
        className={cn(
          'absolute inset-y-0 left-0 z-50 flex w-[300px] flex-col border-r border-[var(--border)]',
          'bg-[var(--card)] shadow-[var(--shadow-md)] transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex shrink-0 flex-col gap-2.5 px-3 pt-3 pb-2">
          {/* D1 搜索框：壳层 ⌘K 唤起时 autoFocus 落焦 */}
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 text-[var(--text-3)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <span aria-hidden className="i-ri-search-line size-3.5" />
            <input
              autoFocus={open}
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
