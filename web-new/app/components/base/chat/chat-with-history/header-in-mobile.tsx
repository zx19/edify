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
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '@/app/components/base/app-icon'
import InputsFormContent from '@/app/components/base/chat/chat-with-history/inputs-form/content'
import RenameModal from '@/app/components/base/chat/chat-with-history/sidebar/rename-modal'
import { useChatWithHistoryContext } from './context'
import Operation from './header/operation'

/**
 * 移动顶栏（chat 单元重写 Task 8，对照桌面 header 与 mockup 移动端帧，40px 极薄）：
 * 左 = ☰ 抽屉入口（drawerEnabled 时，调 onOpenDrawer；legacy 全屏侧栏浮层路径已删除）；
 * 中 = 应用标识（图标+名，弱化，欢迎态）或 会话标题▾ 操作下拉（会话态，二者互斥同 mockup 双帧）；
 * 右 = 查看变量（有变量表单才显示，开全屏浮层）+ ↻重置（会话内）+ ＋新对话（恒在）——图标钮移动适配。
 * D11：header 无 ⋯ 更多菜单（菜单唯一落点=抽屉底部）；变量设置全屏浮层保留不动（仅随壳层 token 继承）。
 */
type HeaderInMobileProps = Readonly<{
  /** 打开会话抽屉（☰ 按钮触发） */
  onOpenDrawer?: () => void
  /** 抽屉入口显隐（ui_config.layout.show_conversation_sidebar 门控） */
  drawerEnabled?: boolean
}>

const HeaderInMobile: FC<HeaderInMobileProps> = ({ onOpenDrawer, drawerEnabled = false }) => {
  const {
    appData,
    currentConversationId,
    currentConversationItem,
    pinnedConversationList,
    handleNewConversation,
    handlePinConversation,
    handleUnpinConversation,
    handleDeleteConversation,
    handleRenameConversation,
    conversationRenaming,
    inputsForms,
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
    /* v8 ignore next 2 -- @preserve */
    if (showConfirm) handleDeleteConversation(showConfirm.id, { onSuccess: handleCancelConfirm })
  }, [showConfirm, handleDeleteConversation, handleCancelConfirm])
  const handleCancelRename = useCallback(() => {
    setShowRename(null)
  }, [])
  const handleRename = useCallback(
    (newName: string) => {
      /* v8 ignore next 2 -- @preserve */
      if (showRename)
        handleRenameConversation(showRename.id, newName, { onSuccess: handleCancelRename })
    },
    [showRename, handleRenameConversation, handleCancelRename],
  )
  const [showChatSettings, setShowChatSettings] = useState(false)

  return (
    <>
      <header className="flex h-10 shrink-0 items-center gap-1 bg-[var(--bg)] px-2.5">
        {drawerEnabled && (
          <IconButton
            aria-label={t(($) => $['chat.conversationHistory'], { ns: 'share' })}
            size="lg"
            className="shrink-0"
            onClick={onOpenDrawer}
          >
            <span aria-hidden className="i-ri-menu-line size-4" />
          </IconButton>
        )}
        {/* 应用标识（欢迎态）与会话标题（会话态）互斥，同 mockup 移动端双帧 */}
        {!currentConversationId && (
          <div className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1">
            <AppIcon
              size="tiny"
              icon={appData?.site.icon}
              iconType={appData?.site.icon_type}
              imageUrl={appData?.site.icon_url}
              background={appData?.site.icon_background}
            />
            <span className="truncate text-[13px] font-semibold text-[var(--text-2)]">
              {appData?.site.title}
            </span>
          </div>
        )}
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
          {inputsForms.length > 0 && (
            <IconButton
              aria-label={t(($) => $['chat.viewChatSettings'], { ns: 'share' })}
              size="lg"
              onClick={() => setShowChatSettings(true)}
            >
              <span aria-hidden className="i-ri-chat-settings-line size-4" />
            </IconButton>
          )}
          {currentConversationId && (
            <IconButton
              aria-label={t(($) => $['chat.resetChat'], { ns: 'share' })}
              size="lg"
              onClick={handleNewConversation}
            >
              <span aria-hidden className="i-ri-reset-left-line size-4" />
            </IconButton>
          )}
          <IconButton
            aria-label={t(($) => $['chat.newChatTip'], { ns: 'share' })}
            size="lg"
            disabled={!currentConversationId || isResponding}
            onClick={handleNewConversation}
          >
            <span aria-hidden className="i-ri-add-line size-4" />
          </IconButton>
        </div>
      </header>
      {/* 变量设置全屏浮层：保留不动（仅随壳层 token 继承） */}
      {showChatSettings && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-background-overlay p-1"
          onClick={() => setShowChatSettings(false)}
          data-testid="mobile-chat-settings-overlay"
        >
          <div
            className="flex h-full w-[calc(100vw-40px)] flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow-md)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="i-custom-public-other-message-3-fill size-6 shrink-0" />
              <div className="grow system-xl-semibold text-text-secondary">
                {t(($) => $['chat.chatSettingsTitle'], { ns: 'share' })}
              </div>
            </div>
            <div className="p-4">
              <InputsFormContent />
            </div>
          </div>
        </div>
      )}
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

export default HeaderInMobile
