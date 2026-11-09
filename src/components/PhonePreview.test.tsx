import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../hooks/useLanguage'
import type { PreviewDevice, ProductForm } from '../types'
import { PhonePreview, PreviewControls } from './PhonePreview'

/**
 * jsdom has no layout engine, so `matchMedia` is stubbed with a plain width test. The preview reads
 * exactly one query — `(max-width: 639px)` — to tell a phone browser from a desktop one, and this
 * mirror of it is what drives the choice between the two shells.
 */
function stubViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query)
      return {
        matches: max ? width <= Number(max[1]) : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }
    }),
  )
}

const form: ProductForm = {
  productName: 'Blend',
  description: 'Fresh',
  audiences: ['genz'],
  customAudience: '',
  tone: 'funny',
  images: [],
}

function renderPreview(
  device: PreviewDevice,
  platform: 'instagram' | 'facebook' | 'tiktok' = 'instagram',
  images: string[] = [],
) {
  return render(
    <LanguageProvider>
      <PhonePreview
        form={form}
        headline="A hook"
        caption="Body copy"
        hashtags={[]}
        images={images}
        platform={platform}
        device={device}
      />
    </LanguageProvider>,
  )
}

function renderControls() {
  return render(
    <LanguageProvider>
      <PreviewControls
        platform="instagram"
        onPlatformChange={() => {}}
        device="mobile"
        onDeviceChange={() => {}}
      />
    </LanguageProvider>,
  )
}

function shell(container: HTMLElement) {
  const node = container.querySelector('[data-preview-shell]')
  return node ? node.getAttribute('data-preview-shell') : null
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PhonePreview shell', () => {
  it('renders the selected headline as a distinct emphasized line above the caption', () => {
    stubViewport(390)

    renderPreview('mobile', 'facebook')

    const headline = screen.getByText('A hook')
    expect(headline.tagName).toBe('STRONG')
    expect(screen.getByText('Body copy')).toBeTruthy()
  })

  it('keeps Instagram edge-to-edge when the browser itself is a phone', () => {
    stubViewport(390)

    const { container } = renderPreview('mobile', 'instagram')

    expect(shell(container)).toBe('frameless')
    expect(container.querySelector('.preview-fluid-container')).not.toBeNull()
  })

  it('keeps Facebook edge-to-edge and inside a responsive type container on phones', () => {
    stubViewport(390)

    const { container } = renderPreview('mobile', 'facebook')

    expect(shell(container)).toBe('frameless')
    expect(container.querySelector('.preview-fluid-container')).not.toBeNull()
  })

  it('uses the standard handset frame for TikTok mobile previews on real phones', () => {
    stubViewport(390)

    const { container } = renderPreview('mobile', 'tiktok')
    const frame = container.querySelector('[data-preview-shell="handset"]')

    expect(shell(container)).toBe('handset')
    expect(frame?.getAttribute('data-preview-frame')).toBe('standard')
    expect(frame?.className).toContain('border-[9px]')
    expect(frame?.getAttribute('style')).toContain('920px')
    expect(frame?.getAttribute('style')).toContain('safe-area-inset-top')
    expect(frame?.getAttribute('style')).toContain('57px')
    expect(container.querySelector('[data-testid="preview-dynamic-island"]')?.className).toContain('w-[25%]')
    expect(container.querySelector('.preview-fluid-container')).not.toBeNull()
  })

  it('keeps the standard handset mockup on a desktop browser', () => {
    stubViewport(1280)

    const { container } = renderPreview('mobile', 'instagram')

    expect(shell(container)).toBe('handset')
  })

  it('leaves the desktop-device mockup untouched at phone and desktop widths alike', () => {
    stubViewport(390)
    const narrow = renderPreview('desktop')
    expect(shell(narrow.container)).toBeNull()
    narrow.unmount()

    stubViewport(1280)
    const wide = renderPreview('desktop')
    expect(shell(wide.container)).toBeNull()
  })
})

describe('PreviewControls', () => {
  it('keeps the device switcher on a real phone, so PC preview stays reachable', () => {
    stubViewport(390)

    renderControls()

    expect(screen.getAllByRole('group')).toHaveLength(1)
  })

  it('shows the device switcher on a desktop browser', () => {
    stubViewport(1280)

    renderControls()

    expect(screen.getAllByRole('group')).toHaveLength(1)
  })
})


describe('TikTok mobile feed chrome and gallery controls', () => {
  const twoImages = [
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=2',
  ]

  it('shows localized Following and For You tabs above the media', () => {
    stubViewport(390)

    renderPreview('mobile', 'tiktok')

    expect(screen.getByText('Đang theo dõi')).toBeTruthy()
    expect(screen.getByText('Dành cho bạn')).toBeTruthy()
  })

  it('hides arrow buttons on TikTok mobile preview across phone and desktop viewports', () => {
    stubViewport(390)

    renderPreview('mobile', 'tiktok', twoImages)

    expect(screen.queryByRole('button', { name: 'Ảnh trước' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ảnh tiếp theo' })).toBeNull()
    expect(screen.getByText('1/2')).toBeTruthy()

    cleanup()
    stubViewport(1280)
    renderPreview('mobile', 'tiktok', twoImages)
    expect(screen.queryByRole('button', { name: 'Ảnh trước' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ảnh tiếp theo' })).toBeNull()
  })

  it('changes the active image when the preview receives a horizontal swipe', () => {
    stubViewport(390)

    renderPreview('mobile', 'tiktok', twoImages)

    const stage = screen.getByTestId('tiktok-screen')
    fireEvent.pointerDown(stage, {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      clientX: 280,
      clientY: 240,
    })
    fireEvent.pointerUp(stage, {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      clientX: 190,
      clientY: 245,
    })

    expect(screen.getByText('2/2')).toBeTruthy()
  })

  it('supports mouse drag on the PC mobile mockup without visible arrow controls', () => {
    stubViewport(1280)

    renderPreview('mobile', 'tiktok', twoImages)

    const stage = screen.getByTestId('tiktok-screen')
    fireEvent.pointerDown(stage, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 280, clientY: 240 })
    fireEvent.pointerUp(stage, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 180, clientY: 242 })
    expect(screen.getByText('2/2')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ảnh tiếp theo' })).toBeNull()
  })
})

describe('Instagram mobile swipe gallery', () => {
  const twoImages = [
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=2',
  ]

  it('uses swipe-only navigation on a real phone and changes the active image', () => {
    stubViewport(390)

    renderPreview('mobile', 'instagram', twoImages)

    expect(screen.queryByRole('button', { name: 'Ảnh trước' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ảnh tiếp theo' })).toBeNull()

    const media = screen.getByTestId('instagram-media')
    fireEvent.pointerDown(media, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 280, clientY: 240 })
    fireEvent.pointerUp(media, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 180, clientY: 242 })

    expect(screen.getByText('2/2')).toBeTruthy()
  })

  it('keeps desktop hover arrows in the desktop browser mobile mockup', () => {
    stubViewport(1280)

    renderPreview('mobile', 'instagram', twoImages)

    expect(screen.getByRole('button', { name: 'Ảnh trước' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ảnh tiếp theo' })).toBeTruthy()
  })
})
