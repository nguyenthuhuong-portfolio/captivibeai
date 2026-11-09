import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A stand-in IndexedDB connection whose write can be driven one step at a time.
 *
 * The point of these cases is the exact moment `putImage` decides a picture is stored. A record
 * hits the store the moment its request succeeds, but the write is only durable once the enclosing
 * transaction commits — and only the commit is allowed to be reported as success.
 */
interface WriteDriver {
  /** Fires the request's own success callback. Nothing is committed at this point. */
  succeed: () => void
  /** Fires the transaction's completion callback. This is the commit. */
  complete: () => void
  /** Fires the transaction's abort callback. Nothing was kept. */
  abort: () => void
}

function driveableIndexedDB(onWrite: (driver: WriteDriver) => void) {
  const request: Record<string, unknown> = {}
  const database = {
    onversionchange: null as null | (() => void),
    transaction: () => {
      const transaction: Record<string, unknown> = {}
      transaction.objectStore = () => ({
        put: () => {
          onWrite({
            succeed: () => (request.onsuccess as (() => void) | undefined)?.(),
            complete: () => (transaction.oncomplete as (() => void) | undefined)?.(),
            abort: () => (transaction.onabort as (() => void) | undefined)?.(),
          })
          return request
        },
      })
      return transaction
    },
  }

  const openRequest: Record<string, unknown> = { result: database }

  return {
    open: () => {
      // Fired after the caller has attached its handlers, mimicking the async open.
      queueMicrotask(() => (openRequest.onsuccess as (() => void) | undefined)?.())
      return openRequest
    },
  }
}

beforeEach(() => {
  // The module caches its connection, so each case needs a freshly evaluated copy.
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('putImage and the transaction lifecycle', () => {
  it('does not report success on the request alone — only a commit counts', async () => {
    let driver: WriteDriver | undefined
    vi.stubGlobal('indexedDB', driveableIndexedDB((next) => {
      driver = next
    }))
    const { putImage } = await import('./imageStore')

    let settled: boolean | undefined
    const pending = putImage('a', new Blob(['x'])).then((ok) => {
      settled = ok
      return ok
    })

    await vi.waitFor(() => expect(driver).toBeDefined())
    driver!.succeed()
    await Promise.resolve()

    // The record reached the store, but the transaction has not committed: not saved yet.
    expect(settled).toBeUndefined()

    driver!.complete()
    await expect(pending).resolves.toBe(true)
  })

  it('reports failure when the transaction aborts after the request succeeded', async () => {
    let driver: WriteDriver | undefined
    vi.stubGlobal('indexedDB', driveableIndexedDB((next) => {
      driver = next
    }))
    const { putImage } = await import('./imageStore')

    const pending = putImage('a', new Blob(['x']))

    await vi.waitFor(() => expect(driver).toBeDefined())
    driver!.succeed()
    driver!.abort()

    await expect(pending).resolves.toBe(false)
  })

  it('is willing to open the database again after a failed attempt', async () => {
    // A failed open used to be cached for the life of the tab, which is wrong on a phone: an
    // `onblocked` from another tab, or a refusal under memory pressure, passes. Only the cooldown
    // in between keeps a hard failure from being retried in a tight loop.
    let clock = 0
    vi.spyOn(Date, 'now').mockImplementation(() => clock)

    let attempts = 0
    vi.stubGlobal('indexedDB', {
      open: () => {
        attempts += 1
        const request: Record<string, unknown> = {}
        queueMicrotask(() => {
          if (attempts === 1) {
            ;(request.onerror as (() => void) | undefined)?.()
            return
          }
          request.result = {
            onversionchange: null,
            transaction: () => {
              const transaction: Record<string, unknown> = {}
              transaction.objectStore = () => ({
                put: () => {
                  queueMicrotask(() => (transaction.oncomplete as (() => void) | undefined)?.())
                  return {}
                },
              })
              return transaction
            },
          }
          ;(request.onsuccess as (() => void) | undefined)?.()
        })
        return request
      },
    })

    const { putImage } = await import('./imageStore')

    await expect(putImage('a', new Blob(['x']))).resolves.toBe(false)
    expect(attempts).toBe(1)

    clock += 5000
    await expect(putImage('a', new Blob(['x']))).resolves.toBe(true)
    expect(attempts).toBe(2)
  })
})
