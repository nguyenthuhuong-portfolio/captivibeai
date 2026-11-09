import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../hooks/useLanguage'
import type { GeneratedContent } from '../types'
import { ResultsPanel } from './ResultsPanel'

/**
 * The panel ships in two languages, so every label assertion below accepts either dictionary. The
 * point of these tests is not the wording but that each control still carries a *distinct*
 * accessible name — the mobile icon-only layout depends on it.
 */
const REGENERATE_CAPTION = /^(Regenerate this caption|Tạo lại caption này)$/
const REGENERATE_HEADLINE = /^(Regenerate this headline|Tạo lại headline này)$/
const HEADLINES_TAB = /^(Headlines|Tiêu đề)$/
const REGENERATE_ALL = /^(Regenerate all|Tạo lại tất cả)$/
const COPY_POST = /^(Copy post|Sao chép bài)$/
const ACTIONS_CAPTION_1 = /^(Actions for Caption 1|Thao tác cho Caption 1)$/
const PREVIEWING = /(Previewing|Đang Preview)/

const content: GeneratedContent = {
  captions: ['Caption one body', 'Caption two body', 'Caption three body'],
  headlines: ['Hook one', 'Hook two', 'Hook three'],
  hashtags: ['#one', '#two'],
}


function renderPanel(panelContent: GeneratedContent = content) {
  const handlers = {
    onOpenPreview: vi.fn(),
    onRegenerate: vi.fn(),
    onRegenerateCaption: vi.fn(),
    onRegenerateHeadline: vi.fn(),
    onCaptionChange: vi.fn(),
    onHeadlineChange: vi.fn(),
    onUndo: vi.fn(),
    onUndoCaption: vi.fn(),
    onUndoHeadline: vi.fn(),
    onSelectedCaptionChange: vi.fn(),
    onSelectedHeadlineChange: vi.fn(),
    onToggleHashtag: vi.fn(),
    onSelectAllHashtags: vi.fn(),
    onClearHashtags: vi.fn(),
  }

  render(
    <LanguageProvider>
      <ResultsPanel
        content={panelContent}
        generating={false}
        previousContent={null}
        selectedCaptionIndex={0}
        selectedHeadlineIndex={0}
        selectedHashtags={[]}
        platform="instagram"
        {...handlers}
      />
    </LanguageProvider>,
  )

  return handlers
}

afterEach(cleanup)

describe('ResultsPanel per-item actions', () => {
  it('shows the active result group and keeps whole-set actions available', () => {
    renderPanel()

    expect(screen.getAllByRole('button', { name: REGENERATE_CAPTION })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: REGENERATE_HEADLINE })).toBeNull()
    expect(screen.getByRole('button', { name: REGENERATE_ALL })).toBeTruthy()
    expect(screen.getByRole('button', { name: COPY_POST })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: HEADLINES_TAB }))
    expect(screen.getAllByRole('button', { name: REGENERATE_HEADLINE })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: REGENERATE_CAPTION })).toBeNull()
  })

  it('re-rolls the card it belongs to and nothing else', () => {
    const handlers = renderPanel()

    fireEvent.click(screen.getAllByRole('button', { name: REGENERATE_CAPTION })[1])
    fireEvent.click(screen.getByRole('tab', { name: HEADLINES_TAB }))
    fireEvent.click(screen.getAllByRole('button', { name: REGENERATE_HEADLINE })[2])

    expect(handlers.onRegenerateCaption).toHaveBeenCalledWith(1)
    expect(handlers.onRegenerateHeadline).toHaveBeenCalledWith(2)
    expect(handlers.onRegenerate).not.toHaveBeenCalled()
  })
})

describe('ResultsPanel card structure', () => {
  it('preserves generated paragraph breaks in the caption card', () => {
    renderPanel({ ...content, captions: ['Hook line\n\nBenefit line', ...content.captions.slice(1)] })

    const caption = screen.getByText('Hook line\n\nBenefit line')
    expect(caption.className).toContain('whitespace-pre-line')
  })

  it('keeps the action cluster out of the row that holds the Previewing badge', () => {
    renderPanel()

    const menuTrigger = screen.getByRole('button', { name: ACTIONS_CAPTION_1 })
    // [button] → [data-action-menu] → [action cluster]
    const cluster = menuTrigger.parentElement?.parentElement
    const reRoll = screen.getAllByRole('button', { name: REGENERATE_CAPTION })[0]

    expect(cluster?.contains(reRoll)).toBe(true)
    expect(cluster?.textContent ?? '').not.toMatch(PREVIEWING)
  })

  it('keeps the badge below the header, so it can never push the menu down a row', () => {
    renderPanel()

    const label = screen.getByText('Caption 1')
    const badge = screen
      .getAllByText(PREVIEWING)
      .find((node) => node.closest('li')?.contains(label))

    // The badge exists on the picked caption, and it sits outside the label's own header row.
    expect(badge).toBeTruthy()
    expect(label.parentElement?.contains(badge!)).toBe(false)
  })
})
