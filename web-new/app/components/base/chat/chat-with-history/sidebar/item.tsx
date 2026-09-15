import type { FC } from 'react'
import type { ConversationItem } from '@/models/share'
import { cn } from '@xsl/lomva-ui/cn'
import { useHover } from 'ahooks'
import { memo, useRef } from 'react'
import Operation from '@/app/components/base/chat/chat-with-history/sidebar/operation'

type ItemProps = {
  isPin?: boolean
  item: ConversationItem
  onOperate: (type: string, item: ConversationItem) => void
  onChangeConversation: (conversationId: string) => void
  currentConversationId: string
}
const Item: FC<ItemProps> = ({
  isPin,
  item,
  onOperate,
  onChangeConversation,
  currentConversationId,
}) => {
  const ref = useRef(null)
  const isHovering = useHover(ref)
  const isSelected = currentConversationId === item.id

  return (
    <div
      ref={ref}
      key={item.id}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-[9px] px-2.5 py-2 text-[13.5px] text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]',
        isSelected &&
          'bg-[var(--accent-soft)] font-semibold text-[var(--accent-deep)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-deep)]',
      )}
      onClick={() => onChangeConversation(item.id)}
    >
      <div className="grow truncate p-1 pl-0" title={item.name}>
        {item.name}
      </div>
      {item.id !== '' && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Operation
            isActive={isSelected}
            isPinned={!!isPin}
            isItemHovering={isHovering}
            togglePin={() => onOperate(isPin ? 'unpin' : 'pin', item)}
            isShowDelete
            isShowRenameConversation
            onRenameConversation={() => onOperate('rename', item)}
            onDelete={() => onOperate('delete', item)}
          />
        </div>
      )}
    </div>
  )
}

export default memo(Item)
