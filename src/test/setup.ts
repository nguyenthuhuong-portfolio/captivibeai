/**
 * Shared test environment.
 *
 * Two adjustments are needed to make the browser APIs the app relies on line up under jsdom.
 *
 * `fake-indexeddb/auto` installs an in-memory `indexedDB` on the global object, so the real image
 * store runs unmodified. It serialises through `structuredClone`, which is Node's implementation
 * here — while `Blob` and `File` are jsdom's. Node refuses to serialise a jsdom `Blob` (it comes
 * back as an empty object) and rejects it as an argument to `URL.createObjectURL`, so both are
 * pointed at Node's counterparts, which the serialiser and the Object URL helpers both understand.
 *
 * `IS_REACT_ACT_ENVIRONMENT` tells React it is running under a test, so `act()` flushes updates.
 */
import 'fake-indexeddb/auto'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

globalThis.Blob = NodeBlob as unknown as typeof Blob
globalThis.File = NodeFile as unknown as typeof File

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom registers its own Object URL helpers, but they can only hand out URLs for jsdom `Blob`s,
// while `structuredClone` below needs Node's. Neither can serve a `blob:` URL to an `<img>` anyway,
// and the app only treats one as an opaque handle, so a plain counter stands in for both.
let objectUrlCount = 0

URL.createObjectURL = () => `blob:test/${(objectUrlCount += 1)}`
URL.revokeObjectURL = () => {}
