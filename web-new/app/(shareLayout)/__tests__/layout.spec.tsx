import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import Layout from '../layout'

vi.mock('@/context/web-app-context', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('../components/splash', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe('(shareLayout)/layout', () => {
  it('根节点挂 webapp-theme 作用域类', () => {
    render(
      <Layout>
        <div data-testid="page-child" />
      </Layout>,
    )
    const child = screen.getByTestId('page-child')
    const root = child.closest('.webapp-theme')
    expect(root).not.toBeNull()
  })
})
