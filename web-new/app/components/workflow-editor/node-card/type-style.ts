import type { EditorNodeType } from '../node-card'

/** 类型色板:语义照抄旧轨 block-icon 映射,软色对为新语言 pill 系(节点卡与配置面板共用) */
export const TYPE_STYLE: Record<EditorNodeType, { icon: string; chip: string }> = {
  start: { icon: 'i-ri-home-5-line', chip: 'bg-[#EFF6FF] text-[#175CD3]' },
  llm: { icon: 'i-ri-sparkling-line', chip: 'bg-[#F4F3FF] text-[#6938EF]' },
  answer: { icon: 'i-ri-chat-quote-line', chip: 'bg-[#FFF6E8] text-[#B76400]' },
  end: { icon: 'i-ri-stop-circle-line', chip: 'bg-[#FFF6E8] text-[#B76400]' },
  code: { icon: 'i-ri-code-s-slash-line', chip: 'bg-[#EFF6FF] text-[#175CD3]' },
  'if-else': { icon: 'i-ri-git-fork-line', chip: 'bg-[#ECFEFF] text-[#0E7490]' },
  http: { icon: 'i-ri-global-line', chip: 'bg-[#F4F3FF] text-[#6938EF]' },
  knowledge: { icon: 'i-ri-book-2-line', chip: 'bg-[#E9F9EF] text-[#12A150]' },
}
