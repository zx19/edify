import type { FC } from 'react'
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
 * 桌面顶栏（chat 单元重写，mockup 类型1，40px 极薄）：
 * 左 = ☰ 抽屉入口（drawerEnabled 时）+ 应用小图标+名（弱化）；
 * 中左 = 会话标题▾ 操作下拉（仅当前会话存在时渲染；新会话/欢迎屏无标题）；
 * 右 = 查看变量（有变量表单才显示）+ ↻重置对话（会话内）+ ＋新对话（恒在）。
 * D11：header 无 ⋯ 更多菜单（菜单唯一落点=抽屉底部）；旧「展开侧栏」钮随壳层去侧栏删除。
 */
type HeaderProps = Readonly<{
  /** 打开会话抽屉（☰ 按钮触发） */
  onOpenDrawer?: () => void
  /** 抽屉入口显隐（ui_config.layout.show_conversation_sidebar 门控） */
  drawerEnabled?: boolean
}>

const Header: FC<HeaderProps> = ({ onOpenDrawer, drawerEnabled = false }) => {
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
    isResponding,
  } = useChatWithHistoryContext()
  const { t } = useTranslation()

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
      <header className="flex h-10 shrink-0 items-center gap-1 bg-[var(--bg)] px-3">
        {drawerEnabled && (
          <IconButton
            aria-label={t(($) => $['chat.conversationHistory'], { ns: 'share' })}
            size="lg"
            onClick={onOpenDrawer}
          >
            <span aria-hidden className="i-ri-menu-line size-4" />
          </IconButton>
        )}
        {/* 应用标识弱化：24px 图标（mockup 22px，取最近 size 档）+ 名（text-2） */}
        <div className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1">
          <AppIcon
            size="tiny"
            iconType={appData?.site.icon_type}
            icon={appData?.site.icon}
            background={appData?.site.icon_background}
            imageUrl={appData?.site.icon_url}
          />
          <span className="truncate text-[13px] font-semibold text-[var(--text-2)]">
            {appData?.site.title}
          </span>
        </div>
        {currentConversationId && currentConversationItem && (
          <Operation
            title={currentConversationItem?.name || ''}
            isPinned={!!isPin}
            togglePin={() => handleOperate(isPin ? 'unpin' : 'pin')}
            isShowDelete
            isShowRenameConversation
            onRenameConversation={() => handleOperate('rename')}
            onDelete={() => handleOperate('delete')}
          />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {inputsForms.length > 0 && <ViewFormDropdown />}
          {currentConversationId && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]"
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
          <Tooltip>
            <TooltipTrigger
              disabled={!currentConversationId}
              render={
                <button
                  type="button"
                  aria-label={t(($) => $['chat.newChatTip'], { ns: 'share' })}
                  className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-50"
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
        </div>
      </header>
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
