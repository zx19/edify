import type { CitationItem } from '../../type'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import Citation from '../index'

vi.mock('../popup', () => ({
  default: ({ data, showHitInfo }: { data: { documentName: string }; showHitInfo?: boolean }) => (
    <div data-testid="popup" data-show-hit-info={String(!!showHitInfo)}>
      {data.documentName}
    </div>
  ),
}))

const makeCitation = (over: Partial<CitationItem> = {}): CitationItem =>
  ({
    document_id: 'doc-1',
    document_name: 'My Report',
    data_source_type: 'upload_file',
    content: '第一段内容',
    ...over,
  }) as CitationItem

describe('Citation（chat 单元重写：折叠条 + 卡片列表）', () => {
  describe('折叠条', () => {
    it('渲染引用计数折叠条', () => {
      render(<Citation data={[makeCitation()]} />)
      expect(screen.getByTestId('citation-title')).toBeInTheDocument()
    })

    it('折叠条文案带文档数（i18n count key）', () => {
      render(
        <Citation
          data={[makeCitation(), makeCitation({ document_id: 'doc-2', document_name: 'B' })]}
        />,
      )
      expect(screen.getByTestId('citation-title').textContent).toContain('citation.count')
    })

    it('默认收起：不渲染卡片列表', () => {
      render(<Citation data={[makeCitation()]} />)
      expect(screen.queryByTestId('citation-list')).not.toBeInTheDocument()
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument()
    })

    it('点击展开后为每个文档渲染一个卡片（Popup）', async () => {
      const user = userEvent.setup()
      render(
        <Citation
          data={[makeCitation(), makeCitation({ document_id: 'doc-2', document_name: 'B' })]}
        />,
      )
      await user.click(screen.getByTestId('citation-title'))
      const popups = screen.getAllByTestId('popup')
      expect(popups).toHaveLength(2)
      expect(popups[0]).toHaveTextContent('My Report')
      expect(popups[1]).toHaveTextContent('B')
    })

    it('再次点击收起', async () => {
      const user = userEvent.setup()
      render(<Citation data={[makeCitation()]} />)
      const bar = screen.getByTestId('citation-title')
      await user.click(bar)
      expect(screen.getByTestId('citation-list')).toBeInTheDocument()
      await user.click(bar)
      expect(screen.queryByTestId('citation-list')).not.toBeInTheDocument()
    })

    it('aria-expanded 随开合切换', async () => {
      const user = userEvent.setup()
      render(<Citation data={[makeCitation()]} />)
      const bar = screen.getByTestId('citation-title')
      expect(bar).toHaveAttribute('aria-expanded', 'false')
      await user.click(bar)
      expect(bar).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('资源分组（行为保全）', () => {
    it('同 document_id 合并为一个资源', async () => {
      const user = userEvent.setup()
      render(<Citation data={[makeCitation(), makeCitation()]} />)
      await user.click(screen.getByTestId('citation-title'))
      expect(screen.getAllByTestId('popup')).toHaveLength(1)
    })

    it('不同 document_id 各自独立', async () => {
      const user = userEvent.setup()
      render(<Citation data={[makeCitation(), makeCitation({ document_id: 'doc-2' })]} />)
      await user.click(screen.getByTestId('citation-title'))
      expect(screen.getAllByTestId('popup')).toHaveLength(2)
    })
  })

  describe('Props', () => {
    it('showHitInfo=true 透传到每个 Popup', async () => {
      const user = userEvent.setup()
      render(<Citation data={[makeCitation()]} showHitInfo />)
      await user.click(screen.getByTestId('citation-title'))
      expect(screen.getByTestId('popup')).toHaveAttribute('data-show-hit-info', 'true')
    })

    it('缺省 showHitInfo=false', async () => {
      const user = userEvent.setup()
      render(<Citation data={[makeCitation()]} />)
      await user.click(screen.getByTestId('citation-title'))
      expect(screen.getByTestId('popup')).toHaveAttribute('data-show-hit-info', 'false')
    })
  })

  describe('边界', () => {
    it('空 data 不渲染任何内容', () => {
      const { container } = render(<Citation data={[]} />)
      expect(container).toBeEmptyDOMElement()
    })
  })
})
