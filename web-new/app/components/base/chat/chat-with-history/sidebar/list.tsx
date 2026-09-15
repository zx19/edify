import type { FC } from 'react'
import type { ConversationItem } from '@/models/share'
import Item from './item'

type ListProps = {
  isPin?: boolean
  title?: string
  list: ConversationItem[]
  onOperate: (type: string, item: ConversationItem) => void
  onChangeConversation: (conversationId: string) => void
  currentConversationId: string
}
const List: FC<ListProps> = ({
  isPin,
  title,
  list,
  onOperate,
  onChangeConversation,
  currentConversationId,
}) => {
  return (
    <div className="space-y-0.5">
      {title && (
        <div className="flex items-center gap-1 px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-[0.06em] text-[var(--text-3)]">
          {isPin && (
            <span aria-hidden className="i-ri-pushpin-fill size-3 text-[var(--accent-deep)]" />
          )}
          {title}
        </div>
      )}
      {list.map((item) => (
        <Item
          key={item.id}
          isPin={isPin}
          item={item}
          onOperate={onOperate}
          onChangeConversation={onChangeConversation}
          currentConversationId={currentConversationId}
        />
      ))}
    </div>
  )
}

export default List
