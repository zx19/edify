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
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@xsl/lomva-ui/tooltip'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '@/app/components/base/app-icon'
import ViewFormDropdown from '@/app/components/base/chat/chat-with-history/inputs-form/view-form-dropdown'
import RenameModal from '@/app/components/base/chat/chat-with-history/sidebar/rename-modal'
import { useChatWithHistoryContext } from '../context'
import Operation from './operation'

/**
 * 桌面顶栏（chat 单元重写，mockup 类型1）：
 * 左 = 应用图标+名称（恒显）+ 当前会话名下拉（恒显，原仅侧栏收起时）；
 * 右 = 查看变量（有表单时）+ 重置对话（icon+文字）+ 降级组（侧栏隐藏/收起时：展开钮 + 新对话）。
 */
const Header = () => {
  const {
    appData,
    currentConversationId,
    currentConversationItem,
    inputsForms,
    pinnedConversationList,
    handlePinConversation,
    handleUnpinConversation,
    conversationRenaming,
    handleRenameConversation,
    handleDeleteConversation,
    handleNewConversation,
    sidebarCollapseState,
    handleSidebarCollapse,
    isResponding,
  } = useChatWithHistoryContext()
  const { t } = useTranslation()
  const isSidebarCollapsed = sidebarCollapseState

  const isPin = pinnedConversationList.some((item) => item.id === currentConversationId)

  const [showConfirm, setShowConfirm] = useState<ConversationItem | null>(null)
  const [showRename, setShowRename] = useState<ConversationItem | null>(null)
  const handleOperate = useCallback(
    (type: string) => {
      if (type === 'pin') handlePinConversation(currentConversationId)

      if (type === 'unpin') handleUnpinConversation(currentConversationId)

      if (type === 'delete') setShowConfirm(currentConversationItem as any)

      if (type === 'rename') setShowRename(currentConversationItem as any)
    },
    [
      currentConversationId,
      currentConversationItem,
      handlePinConversation,
      handleUnpinConversation,
    ],
  )
  const handleCancelConfirm = useCallback(() => {
    setShowConfirm(null)
  }, [])
  const handleDelete = useCallback(() => {
    /* v8 ignore next -- defensive guard; onConfirm is only reachable when showConfirm is truthy. @preserve */
    if (showConfirm) handleDeleteConversation(showConfirm.id, { onSuccess: handleCancelConfirm })
  }, [showConfirm, handleDeleteConversation, handleCancelConfirm])
  const handleCancelRename = useCallback(() => {
    setShowRename(null)
  }, [])
  const handleRename = useCallback(
    (newName: string) => {
      /* v8 ignore next -- defensive guard; onSave is only reachable when showRename is truthy. @preserve */
      if (showRename)
        handleRenameConversation(showRename.id, newName, { onSuccess: handleCancelRename })
    },
    [showRename, handleRenameConversation, handleCancelRename],
  )

  return (
    <>
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-4">
        {isSidebarCollapsed && (
          <IconButton
            aria-label={t(($) => $['sidebar.expandSidebar'], { ns: 'layout' })}
            onClick={() => handleSidebarCollapse(false)}
          >
            <span aria-hidden className="i-ri-layout-left-2-line size-4" />
          </IconButton>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0">
            <AppIcon
              size="small"
              iconType={appData?.site.icon_type}
              icon={appData?.site.icon}
              background={appData?.site.icon_background}
              imageUrl={appData?.site.icon_url}
            />
          </div>
          <div className="truncate text-[13.5px] font-semibold text-[var(--text-1)]">
            {appData?.site.title}
          </div>
        </div>
        {currentConversationId && currentConversationItem && (
          <>
            <div className="mx-1 h-[18px] w-px shrink-0 bg-[var(--border)]" />
            <Operation
              title={currentConversationItem?.name || ''}
              isPinned={!!isPin}
              togglePin={() => handleOperate(isPin ? 'unpin' : 'pin')}
              isShowDelete
              isShowRenameConversation
              onRenameConversation={() => handleOperate('rename')}
              onDelete={() => handleOperate('delete')}
            />
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {currentConversationId && inputsForms.length > 0 && <ViewFormDropdown />}
          {currentConversationId && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]"
                    onClick={handleNewConversation}
                  >
                    <span aria-hidden className="i-ri-reset-left-line size-3.5" />
                    {t(($) => $['chat.resetChat'], { ns: 'share' })}
                  </button>
                }
              />
              <TooltipContent>{t(($) => $['chat.resetChat'], { ns: 'share' })}</TooltipContent>
            </Tooltip>
          )}
          {isSidebarCollapsed && (
            <Tooltip>
              <TooltipTrigger
                disabled={!currentConversationId}
                render={
                  <button
                    type="button"
                    aria-label={t(($) => $['chat.newChatTip'], { ns: 'share' })}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!currentConversationId || isResponding}
                    onClick={handleNewConversation}
                  >
                    <span aria-hidden className="i-ri-add-line size-3.5" />
                    {t(($) => $['chat.newChat'], { ns: 'share' })}
                  </button>
                }
              />
              <TooltipContent>{t(($) => $['chat.newChatTip'], { ns: 'share' })}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <AlertDialog open={!!showConfirm} onOpenChange={(open) => !open && handleCancelConfirm()}>
        <AlertDialogContent>
          <div className="flex flex-col gap-2 px-6 pt-6 pb-4">
            <AlertDialogTitle className="w-full truncate title-2xl-semi-bold text-text-primary">
              {t(($) => $['chat.deleteConversation.title'], { ns: 'share' })}
            </AlertDialogTitle>
            <AlertDialogDescription className="w-full system-md-regular wrap-break-word whitespace-pre-wrap text-text-tertiary">
              {t(($) => $['chat.deleteConversation.content'], { ns: 'share' }) || ''}
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
    </>
  )
}

export default Header
