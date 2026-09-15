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
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '@/app/components/base/app-icon'
import List from '@/app/components/base/chat/chat-with-history/sidebar/list'
import RenameModal from '@/app/components/base/chat/chat-with-history/sidebar/rename-modal'
import { resolveUiConfig } from '@/models/ui-config'
import { useChatWithHistoryContext } from '../context'
import MoreMenu from './more-menu'

type Props = Readonly<{
  isPanel?: boolean
  panelVisible?: boolean
}>

/**
 * 侧栏（chat 单元重写，mockup 类型1）：
 * - 直接消费作用域 token（壳层根恒挂 .webapp-theme）
 * - 品牌页脚链（design §2.4/附录D）：remove_webapp_brand 隐藏 → 应用级 ui_config.brand.footer_text
 *   → 工作区级 custom_config.replace_webapp_logo → 默认「杏树林」；DifyLogo/systemFeatures.branding
 *   （社区版恒 false 分支）移除
 */
const Sidebar = ({ isPanel }: Props) => {
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
    sidebarCollapseState,
    handleSidebarCollapse,
    isMobile,
    isResponding,
  } = useChatWithHistoryContext()
  const isSidebarCollapsed = sidebarCollapseState
  const [showConfirm, setShowConfirm] = useState<ConversationItem | null>(null)
  const [showRename, setShowRename] = useState<ConversationItem | null>(null)

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
  const pinnedTitle = t(($) => $['chat.pinnedTitle'], { ns: 'share' }) || ''
  const deleteConversationContent =
    t(($) => $['chat.deleteConversation.content'], { ns: 'share' }) || ''

  const uiConfig = resolveUiConfig(appData?.site)
  const customConfig = appData?.custom_config
  const showBrand = !customConfig?.remove_webapp_brand

  return (
    <div
      className={cn(
        'flex w-full grow flex-col bg-[var(--bg)]',
        isPanel &&
          'rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]',
      )}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-3.5 pt-3.5 pb-2">
        <div className="shrink-0">
          <AppIcon
            size="large"
            iconType={appData?.site.icon_type}
            icon={appData?.site.icon}
            background={appData?.site.icon_background}
            imageUrl={appData?.site.icon_url}
          />
        </div>
        <div className="grow truncate text-sm font-semibold text-[var(--text-1)]">
          {appData?.site.title}
        </div>
        {!isMobile && isSidebarCollapsed && (
          <IconButton
            aria-label={t(($) => $['sidebar.expandSidebar'], { ns: 'layout' })}
            onClick={() => handleSidebarCollapse(false)}
          >
            <span aria-hidden className="i-ri-expand-right-line size-4" />
          </IconButton>
        )}
        {!isMobile && !isSidebarCollapsed && (
          <IconButton
            aria-label={t(($) => $['sidebar.collapseSidebar'], { ns: 'layout' })}
            onClick={() => handleSidebarCollapse(true)}
          >
            <span aria-hidden className="i-ri-layout-left-2-line size-4" />
          </IconButton>
        )}
      </div>
      <div className="shrink-0 px-3 pb-2.5">
        <button
          type="button"
          disabled={isResponding}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-[var(--accent)] text-[13.5px] font-semibold text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleNewConversation}
        >
          <span aria-hidden className="i-ri-add-line size-4" />
          {t(($) => $['chat.newChat'], { ns: 'share' })}
        </button>
      </div>
      <div className="h-0 grow space-y-2 overflow-y-auto px-2 pt-2">
        {!!pinnedConversationList.length && (
          <div className="mb-3">
            <List
              isPin
              title={pinnedTitle}
              list={pinnedConversationList}
              onChangeConversation={handleChangeConversation}
              onOperate={handleOperate}
              currentConversationId={currentConversationId}
            />
          </div>
        )}
        {!!conversationList.length && (
          <List
            title={
              (pinnedConversationList.length &&
                t(($) => $['chat.unpinnedTitle'], { ns: 'share' })) ||
              ''
            }
            list={conversationList}
            onChangeConversation={handleChangeConversation}
            onOperate={handleOperate}
            currentConversationId={currentConversationId}
          />
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] px-3 py-2">
        <div className="flex min-w-0 grow items-center gap-1 text-[11.5px] whitespace-nowrap text-[var(--text-3)]">
          {showBrand && (
            <>
              <span>{t(($) => $['chat.poweredBy'], { ns: 'share' })}</span>
              {uiConfig.brand.footer_text ? (
                <span className="truncate">{uiConfig.brand.footer_text}</span>
              ) : customConfig?.replace_webapp_logo ? (
                <img
                  src={String(customConfig.replace_webapp_logo)}
                  alt="logo"
                  className="block h-5 w-auto"
                />
              ) : (
                <b className="font-semibold text-[var(--text-2)]">杏树林</b>
              )}
            </>
          )}
        </div>
        <MoreMenu hideLogout={isInstalledApp} data={appData?.site} />
        <AlertDialog open={!!showConfirm} onOpenChange={(open) => !open && handleCancelConfirm()}>
          <AlertDialogContent>
            <div className="flex flex-col gap-2 px-6 pt-6 pb-4">
              <AlertDialogTitle className="w-full truncate title-2xl-semi-bold text-text-primary">
                {t(($) => $['chat.deleteConversation.title'], { ns: 'share' })}
              </AlertDialogTitle>
              <AlertDialogDescription className="w-full system-md-regular wrap-break-word whitespace-pre-wrap text-text-tertiary">
                {deleteConversationContent}
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
      </div>
    </div>
  )
}

export default Sidebar
