import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { Markdown } from './Markdown'

describe('Markdown headings', () => {
  it('strips the # markers and renders the heading text as a bold line', () => {
    const { container } = render(<Markdown text={'## 1. Physical AI experiment'} />)
    // The raw markers must not leak into the rendered text.
    expect(container.textContent).toBe('1. Physical AI experiment')
    expect(container.textContent).not.toContain('#')
    // Rendered as an emphasised line, not a huge <h2>.
    const el = container.querySelector('p')
    expect(el?.className).toContain('font-semibold')
  })

  it('handles all heading levels and keeps inline citations', () => {
    const { container } = render(<Markdown text={'### Results [3]'} />)
    expect(container.textContent).toBe('Results [3]')
    expect(container.querySelector('sup')?.textContent).toBe('[3]')
  })

  it('leaves a normal paragraph (no leading #) untouched', () => {
    const { container } = render(<Markdown text={'plain text line'} />)
    expect(container.textContent).toBe('plain text line')
  })
})
