import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotices } from './useNotices'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useNotices', () => {
  it('starts with an empty stack', () => {
    const { result } = renderHook(() => useNotices())

    expect(result.current.notices).toEqual([])
  })

  it('shows a notice with the key and tone it was raised with', () => {
    const { result } = renderHook(() => useNotices())

    act(() => {
      result.current.notify({ key: 'notice.generateFailed', tone: 'error' })
    })

    expect(result.current.notices).toHaveLength(1)
    expect(result.current.notices[0].key).toBe('notice.generateFailed')
    expect(result.current.notices[0].tone).toBe('error')
  })

  it('keeps notice parameters so the sentence can be rebuilt in either language', () => {
    const { result } = renderHook(() => useNotices())

    act(() => {
      result.current.notify({ key: 'notice.historyImagesMissing', params: { count: 2 }, tone: 'error' })
    })

    expect(result.current.notices[0].params).toEqual({ count: 2 })
  })

  it('collapses a repeated message instead of stacking duplicates', () => {
    const { result } = renderHook(() => useNotices())

    act(() => {
      result.current.notify({ key: 'notice.historySaveFailed', tone: 'error' })
    })
    act(() => {
      result.current.notify({ key: 'notice.historySaveFailed', tone: 'error' })
    })

    expect(result.current.notices).toHaveLength(1)
  })

  it('keeps two different messages side by side', () => {
    const { result } = renderHook(() => useNotices())

    act(() => {
      result.current.notify({ key: 'notice.historySaveFailed', tone: 'error' })
    })
    act(() => {
      result.current.notify({ key: 'notice.historyRestored', tone: 'success' })
    })

    expect(result.current.notices).toHaveLength(2)
  })

  it('drops a notice the user dismisses', () => {
    const { result } = renderHook(() => useNotices())

    act(() => {
      result.current.notify({ key: 'notice.generateFailed', tone: 'error' })
    })
    const id = result.current.notices[0].id

    act(() => {
      result.current.dismiss(id)
    })

    expect(result.current.notices).toEqual([])
  })

  it('clears a transient notice on its own', () => {
    const { result } = renderHook(() => useNotices())

    act(() => {
      result.current.notify({ key: 'notice.historyRestored', tone: 'success' })
    })
    expect(result.current.notices).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(7000)
    })

    expect(result.current.notices).toEqual([])
  })

  it('leaves no pending timer behind when it unmounts', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')
    const { result, unmount } = renderHook(() => useNotices())

    act(() => {
      result.current.notify({ key: 'notice.historyRestored', tone: 'success' })
    })

    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
