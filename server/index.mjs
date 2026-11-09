import http from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_TOTAL_MAX_BYTES,
  fullResponseSchema,
  itemResponseSchema,
  normalizeCosmetics,
  parseRequestPayload,
  PROVIDER_FULL_SCHEMA,
  providerItemSchema,
} from './contract.mjs'
import { buildFullPrompt, buildItemPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from './prompts.mjs'
import { callOpenAI, DEFAULT_OPENAI_MODEL, ProviderError } from './provider.mjs'
import { analyzeLearningReference, parseLearningRequest } from './learning.mjs'
import { buildGlobalDna, parseGlobalDnaSources, hashGlobalDnaSources, getGlobalDnaSnapshot, refreshGlobalDnaCache, invalidateGlobalDnaCache } from './global-dna.mjs'


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8788)
const HOST = process.env.HOST || '127.0.0.1'
const MAX_BODY_BYTES = 22 * 1024 * 1024 // 20 MiB incoming-image budget + JSON/multipart overhead
// The app already caps combined uploaded image bytes at 20 MiB.
const AI_INLINE_IMAGE_MAX_BYTES = IMAGE_TOTAL_MAX_BYTES
const GENERATE_DEADLINE_MS = 18_000
const LEARNING_DEADLINE_MS = 30_000
const DNA_DEADLINE_MS = 30_000
const WINDOW_MS = 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const requestsByClient = new Map()
const inFlight = new Set()
let monthCount = 0
let monthKey = new Date().toISOString().slice(0, 7)

function safeError(res, status, code, field) {
  const body = { code }
  if (field) body.field = field
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function clientKey(req) {
  const address = req.socket.remoteAddress || 'unknown'
  return createHash('sha256').update(`${process.env.RATE_LIMIT_SALT || 'captivibe-local'}:${address}`).digest('hex')
}

function allowRequest(key) {
  const now = Date.now()
  const entry = requestsByClient.get(key) ?? { minute: [], hour: [] }
  entry.minute = entry.minute.filter((stamp) => now - stamp < WINDOW_MS)
  entry.hour = entry.hour.filter((stamp) => now - stamp < HOUR_MS)
  if (entry.minute.length >= 10 || entry.hour.length >= 60) {
    requestsByClient.set(key, entry)
    return false
  }
  entry.minute.push(now)
  entry.hour.push(now)
  requestsByClient.set(key, entry)
  return true
}

function monthQuotaReached() {
  const current = new Date().toISOString().slice(0, 7)
  if (current !== monthKey) { monthKey = current; monthCount = 0 }
  const limit = Number(process.env.AI_MONTHLY_REQUEST_LIMIT || 300)
  return limit > 0 && monthCount >= limit
}

function mimeIsAccepted(mime) { return ACCEPTED_IMAGE_TYPES.includes(mime) }

function imageSignatureMatches(bytes, mime) {
  const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime
  if (normalized === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (normalized === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (normalized === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  return false
}

async function readBody(req) {
  const declared = Number(req.headers['content-length'] || 0)
  if (declared > MAX_BODY_BYTES) throw Object.assign(new Error('payload_too_large'), { status: 413, code: 'payload_too_large' })
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('payload_too_large'), { status: 413, code: 'payload_too_large' })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function parseIncoming(req, body) {
  const contentType = req.headers['content-type'] || ''
  if (contentType.startsWith('multipart/form-data')) {
    const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
      method: 'POST', headers: { 'content-type': contentType }, body,
    })
    const form = await request.formData()
    const entries = [...form.entries()]
    if (entries.some(([name]) => name !== 'payload' && name !== 'images')) {
      throw Object.assign(new Error('unexpected_part'), { status: 400, code: 'invalid_payload' })
    }
    const payloads = form.getAll('payload')
    const files = form.getAll('images')
    if (payloads.length !== 1 || typeof payloads[0] !== 'string') {
      throw Object.assign(new Error('missing_payload'), { status: 400, code: 'invalid_payload' })
    }
    let payload
    try { payload = JSON.parse(payloads[0]) } catch {
      throw Object.assign(new Error('invalid_json'), { status: 400, code: 'invalid_payload' })
    }
    if (payload?.mode !== 'full') throw Object.assign(new Error('multipart_mode'), { status: 400, code: 'invalid_payload' })
    if (!Array.isArray(payload.images) || payload.images.length !== files.length) {
      throw Object.assign(new Error('image_count_mismatch'), { status: 400, code: 'image_missing' })
    }
    if (entries.length !== 1 + files.length) throw Object.assign(new Error('extra_parts'), { status: 400, code: 'invalid_payload' })
    const images = []
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const descriptor = payload.images[index]
      if (!(file instanceof File) || file.size <= 0) throw Object.assign(new Error('image_missing'), { status: 400, code: 'image_missing' })
      if (!mimeIsAccepted(descriptor?.mimeType) || !mimeIsAccepted(file.type)) {
        throw Object.assign(new Error('unsupported_image_type'), { status: 400, code: 'unsupported_image_type' })
      }
      if (file.size > IMAGE_MAX_BYTES || file.size !== descriptor.bytes) {
        throw Object.assign(new Error('image_too_large_or_mismatch'), { status: 400, code: 'image_too_large' })
      }
      const bytes = Buffer.from(await file.arrayBuffer())
      if (!imageSignatureMatches(bytes, file.type)) throw Object.assign(new Error('invalid_image_signature'), { status: 400, code: 'unsupported_image_type' })
      images.push({ name: descriptor.filename, mimeType: file.type === 'image/jpg' ? 'image/jpeg' : file.type, bytes })
    }
    const total = images.reduce((sum, image) => sum + image.bytes.length, 0)
    if (total > IMAGE_TOTAL_MAX_BYTES) throw Object.assign(new Error('images_too_large'), { status: 400, code: 'images_too_large' })
    return { payload, images }
  }
  if (!contentType.startsWith('application/json')) {
    throw Object.assign(new Error('unsupported_content_type'), { status: 415, code: 'invalid_payload' })
  }
  let payload
  try { payload = JSON.parse(body.toString('utf8')) } catch {
    throw Object.assign(new Error('invalid_json'), { status: 400, code: 'invalid_payload' })
  }
  return { payload, images: [] }
}

function parseModelJson(text) {
  const candidate = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(candidate)
}

function validatePlatformLength(data, payload) {
  const limit = { instagram: 2200, tiktok: 4000, facebook: 63206, x: 280 }[payload.platformHint] || 4000
  const captions = data.captions ? data.captions : data.caption ? [data.caption] : []
  return captions.flatMap((item) => {
    const length = Array.from(item.text.normalize('NFC')).length
    return length > limit ? [`caption exceeds ${limit} characters`] : []
  })
}


async function validatedGeneration(payload, images, signal, deadline, metrics) {
  const isFull = payload.mode === 'full'
  const imageBytes = images.reduce((sum, image) => sum + image.bytes.length, 0)
  if (imageBytes > AI_INLINE_IMAGE_MAX_BYTES) throw new ProviderError('images_too_large', 413, false)
  const promptStarted = Date.now()
  const dnaSnapshot = getGlobalDnaSnapshot()
  if (dnaSnapshot?.version) metrics.globalDnaVersion = dnaSnapshot.version
  const inspirationCards = await loadApprovedInspirationCards(payload.inspirationIds ?? [])
  if (inspirationCards.length) metrics.inspirationCount = inspirationCards.length
  const promptRequest = { ...payload, globalDnaProfile: dnaSnapshot?.profile ?? null, inspirationCards }
  const prompt = isFull ? buildFullPrompt({ ...promptRequest, _images: images }) : buildItemPrompt(promptRequest)
  metrics.promptBuildMs = Date.now() - promptStarted
  const schema = isFull ? PROVIDER_FULL_SCHEMA : providerItemSchema(payload.target.kind, payload.target.strategy)
  const validator = isFull ? fullResponseSchema : itemResponseSchema(payload.target.kind, payload.target.strategy)

  // Exactly one model call. Structured Outputs handles the JSON shape; local sample content
  // is the recovery path for provider errors or any response that fails validation.
  const responseText = await callOpenAI({
    prompt,
    images,
    schema,
    signal,
    requestDeadline: deadline,
    systemInstruction: SYSTEM_PROMPT,
    maxOutputTokens: isFull ? 2000 : 600,
    metrics,
  })

  let parsed
  try { parsed = normalizeCosmetics(parseModelJson(responseText)) } catch {
    throw new ProviderError('ai_invalid_output', 502, false)
  }
  const valid = validator.safeParse(parsed)
  if (!valid.success) throw new ProviderError('ai_invalid_output', 502, false)
  const errors = validatePlatformLength(parsed, payload)
  if (isFull && images.length === 0 && !(payload.previousImageInsights?.length) && (parsed.image_insights?.length ?? 0) > 0) {
    errors.push('image_insights must be empty when no images were sent')
  }
  if (!isFull) {
    const kept = payload.keep[payload.target.kind === 'caption' ? 'captions' : 'headlines']
    const item = payload.target.kind === 'caption' ? parsed.caption : parsed.headline
    if (kept.some((sibling) => sibling && tokenSimilarity(item.text, sibling) >= 0.8)) {
      errors.push('replacement is too similar to a sibling item')
    }
  }
  if (errors.length) throw new ProviderError('ai_invalid_output', 502, false)
  return valid.data
}

function tokenSimilarity(a, b) {
  const normalise = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const first = new Set(normalise(a).split(/\s+/).filter(Boolean))
  const second = new Set(normalise(b).split(/\s+/).filter(Boolean))
  const intersection = [...first].filter((token) => second.has(token)).length
  return intersection / (first.size + second.size - intersection || 1)
}

function staticFile(res, pathname) {
  if (!existsSync(DIST)) return false
  let requested = decodeURIComponent(pathname)
  if (requested === '/') requested = '/index.html'
  const candidate = path.resolve(DIST, `.${requested}`)
  if (!candidate.startsWith(`${DIST}${path.sep}`) || !existsSync(candidate) || !statSync(candidate).isFile()) {
    return staticFileIndex(res)
  }
  return streamFile(res, candidate)
}
function staticFileIndex(res) {
  const index = path.join(DIST, 'index.html')
  if (!existsSync(index)) return false
  return streamFile(res, index)
}
function streamFile(res, file) {
  const ext = path.extname(file).toLowerCase()
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' })
  createReadStream(file).pipe(res)
  return true
}

async function authenticateSupabaseRequest(req) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!token || !baseUrl || !anonKey) return null

  let userResponse
  try {
    userResponse = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return null
  }
  if (!userResponse.ok) return null

  let user
  try { user = await userResponse.json() } catch { return null }
  if (typeof user?.id !== 'string') return null

  const query = new URLSearchParams({ select: 'user_id', user_id: `eq.${user.id}` })
  let roleResponse
  try {
    roleResponse = await fetch(`${baseUrl}/rest/v1/admin_roles?${query}`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return { user, isAdmin: false }
  }
  if (!roleResponse.ok) return { user, isAdmin: false }
  let roles = []
  try { roles = await roleResponse.json() } catch { /* role denied */ }
  return { user, isAdmin: Array.isArray(roles) && roles.some((row) => row?.user_id === user.id) }
}

function supabaseRestConfig() {
  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  return baseUrl && anonKey ? { baseUrl, anonKey } : null
}

async function adminSupabaseRest(pathname, token, options = {}) {
  const config = supabaseRestConfig()
  if (!config) throw Object.assign(new Error('supabase_not_configured'), { status: 503, code: 'supabase_not_configured' })
  const response = await fetch(`${config.baseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(9000),
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { /* retain null */ }
  if (!response.ok) {
    const code = data?.code || data?.message || `supabase_http_${response.status}`
    throw Object.assign(new Error(String(code).slice(0, 120)), { status: response.status >= 500 ? 503 : 400, code: 'supabase_request_failed' })
  }
  return data
}

function bearerToken(req) {
  const authorization = req.headers.authorization || ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
}

function compactPatternForPrompt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const text = (key, max) => typeof value[key] === 'string' ? value[key].slice(0, max) : ''
  const list = (key, maxItems = 4) => Array.isArray(value[key])
    ? value[key].filter((item) => typeof item === 'string').slice(0, maxItems).map((item) => item.slice(0, 160))
    : []
  return {
    recommended_style: text('recommended_style', 180),
    summary: text('summary', 360),
    hook_patterns: list('hook_patterns'),
    structure_patterns: list('structure_patterns'),
    emoji_guidance: text('emoji_guidance', 180),
    tone_patterns: list('tone_patterns'),
    cta_patterns: list('cta_patterns'),
    do_patterns: list('do_patterns'),
    avoid_patterns: list('avoid_patterns'),
  }
}

async function loadApprovedInspirationCards(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return []
  const config = supabaseRestConfig()
  if (!config) return []
  try {
    const query = new URLSearchParams({
      select: 'id,title,platform,category,pattern',
      id: `in.(${ids.join(',')})`,
      scope: 'eq.global',
      status: 'eq.approved',
      limit: '2',
    })
    const response = await fetch(`${config.baseUrl}/rest/v1/learning_patterns?${query}`, {
      headers: { apikey: config.anonKey, authorization: `Bearer ${config.anonKey}` },
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) return []
    const rows = await response.json()
    if (!Array.isArray(rows)) return []
    return rows.slice(0, 2).map((row) => ({
      title: typeof row.title === 'string' ? row.title.slice(0, 120) : 'Inspiration',
      platform: typeof row.platform === 'string' ? row.platform : 'all',
      category: typeof row.category === 'string' ? row.category : 'general',
      stylePatterns: compactPatternForPrompt(row.pattern),
    }))
  } catch {
    // Inspiration is optional; a library lookup must never block generation.
    return []
  }
}

async function handleGlobalDnaBuild(req, res) {
  const requestId = randomUUID()
  const started = Date.now()
  const key = clientKey(req)
  if (inFlight.has(key)) { safeError(res, 429, 'too_many_requests'); return }
  if (!allowRequest(key)) { safeError(res, 429, 'too_many_requests'); return }
  inFlight.add(key)
  const abortController = new AbortController()
  const metrics = { providerAttempts: 0, providerLatencyMs: 0 }
  res.on('close', () => { if (!res.writableEnded) abortController.abort() })
  try {
    const identity = await authenticateSupabaseRequest(req)
    if (!identity) { safeError(res, 401, 'authentication_required'); return }
    if (!identity.isAdmin) { safeError(res, 403, 'admin_required'); return }
    const buildBody = await readBody(req)
    if (buildBody.length > 0) { safeError(res, 400, 'unexpected_request_body'); return }
    if (!process.env.OPENAI_API_KEY) { safeError(res, 503, 'ai_unavailable'); return }
    if (monthQuotaReached()) { safeError(res, 503, 'quota_exhausted'); return }

    const query = new URLSearchParams({ select: 'id,position,title,source_text', order: 'position.asc' })
    const sources = await adminSupabaseRest(`global_dna_sources?${query}`, bearerToken(req), { signal: AbortSignal.timeout(9000) })
    const parsedSources = parseGlobalDnaSources(sources)
    if (!parsedSources.success) { safeError(res, 400, parsedSources.code); return }

    monthCount += 1
    const deadline = Date.now() + DNA_DEADLINE_MS
    const profile = await buildGlobalDna(parsedSources.data, abortController.signal, deadline, metrics)
    const sourceIds = parsedSources.data.map((row) => row.id)
    const sourceHash = hashGlobalDnaSources(parsedSources.data)
    const draft = await adminSupabaseRest('rpc/create_global_style_draft', bearerToken(req), {
      method: 'POST',
      body: JSON.stringify({ p_profile: profile, p_source_ids: sourceIds, p_source_hash: sourceHash }),
      signal: AbortSignal.timeout(9000),
    })
    const row = Array.isArray(draft) ? draft[0] : draft
    if (!row?.id || !Number.isInteger(row?.version)) throw Object.assign(new Error('dna_draft_not_created'), { status: 502, code: 'dna_draft_not_created' })

    console.info(JSON.stringify({ requestId, client: key.slice(0, 12), userId: identity.user.id, operation: 'global_dna_build', sourceCount: 10, version: row.version, model: process.env.OPENAI_MODEL_ID || DEFAULT_OPENAI_MODEL, latencyMs: Date.now() - started, outcome: 'draft_created', ...metrics }))
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ id: row.id, version: row.version, status: row.status, profile: row.profile, created_at: row.created_at }))
  } catch (error) {
    const safe = error instanceof ProviderError ? error : null
    const status = safe?.status || error?.status || 502
    const code = safe?.code || error?.code || 'dna_build_failed'
    console.warn(JSON.stringify({ requestId, client: key.slice(0, 12), latencyMs: Date.now() - started, operation: 'global_dna_build', outcome: 'error', code, upstreamStatus: safe?.upstreamStatus ?? null, status: safe?.status ?? error?.status ?? null, attempts: safe?.attempts ?? 1, details: safe?.details ?? undefined, ...metrics }))
    if (!res.headersSent) safeError(res, status, code)
  } finally {
    inFlight.delete(key)
  }
}

async function handleGlobalDnaActivate(req, res) {
  const key = clientKey(req)
  if (inFlight.has(key)) { safeError(res, 429, 'too_many_requests'); return }
  if (!allowRequest(key)) { safeError(res, 429, 'too_many_requests'); return }
  inFlight.add(key)
  try {
    const identity = await authenticateSupabaseRequest(req)
    if (!identity) { safeError(res, 401, 'authentication_required'); return }
    if (!identity.isAdmin) { safeError(res, 403, 'admin_required'); return }
    const body = await readBody(req)
    let payload
    try { payload = JSON.parse(body.toString('utf8')) } catch { safeError(res, 400, 'invalid_payload'); return }
    const profileId = typeof payload?.profileId === 'string' ? payload.profileId : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
      safeError(res, 400, 'invalid_dna_profile_id'); return
    }
    const token = bearerToken(req)
    const draftQuery = new URLSearchParams({ select: 'id,status,source_hash', id: `eq.${profileId}`, limit: '1' })
    const draftRows = await adminSupabaseRest(`global_style_profiles?${draftQuery}`, token)
    const draft = Array.isArray(draftRows) ? draftRows[0] : null
    if (!draft || !['draft', 'archived'].includes(draft.status)) { safeError(res, 400, 'dna_version_not_found'); return }
    if (draft.status === 'draft') {
      const sourceQuery = new URLSearchParams({ select: 'id,position,title,source_text', order: 'position.asc' })
      const sourceRows = await adminSupabaseRest(`global_dna_sources?${sourceQuery}`, token)
      const parsedSources = parseGlobalDnaSources(sourceRows)
      if (!parsedSources.success) { safeError(res, 400, parsedSources.code); return }
      const currentSourceHash = hashGlobalDnaSources(parsedSources.data)
      if (currentSourceHash !== draft.source_hash) { safeError(res, 409, 'dna_sources_changed_rebuild_required'); return }
    }
    const result = await adminSupabaseRest('rpc/activate_global_style_profile', token, {
      method: 'POST', body: JSON.stringify({ p_profile_id: profileId }),
    })
    invalidateGlobalDnaCache()
    await refreshGlobalDnaCache()
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ ok: true, profile: result }))
  } catch (error) {
    const code = error?.code || 'dna_activation_failed'
    console.warn(JSON.stringify({ client: key.slice(0, 12), operation: 'global_dna_activate', outcome: 'error', code }))
    if (!res.headersSent) safeError(res, error?.status || 502, code)
  } finally {
    inFlight.delete(key)
  }
}

async function handleLearningAnalyze(req, res) {
  const requestId = randomUUID()
  const started = Date.now()
  const key = clientKey(req)
  if (inFlight.has(key)) { safeError(res, 429, 'too_many_requests'); return }
  if (!allowRequest(key)) { safeError(res, 429, 'too_many_requests'); return }
  if (!process.env.OPENAI_API_KEY) { safeError(res, 503, 'ai_unavailable'); return }
  if (monthQuotaReached()) { safeError(res, 503, 'quota_exhausted'); return }
  inFlight.add(key)

  const abortController = new AbortController()
  const deadline = started + LEARNING_DEADLINE_MS
  const providerMetrics = {}
  res.on('close', () => { if (!res.writableEnded) abortController.abort() })
  try {
    const identity = await authenticateSupabaseRequest(req)
    if (!identity) { safeError(res, 401, 'authentication_required'); return }

    const body = await readBody(req)
    let value
    try { value = JSON.parse(body.toString('utf8')) } catch { safeError(res, 400, 'invalid_payload'); return }
    const parsed = parseLearningRequest(value)
    if (!parsed.success) { safeError(res, 400, parsed.code); return }
    if (parsed.data.scope === 'global' && !identity.isAdmin) { safeError(res, 403, 'admin_required'); return }

    monthCount += 1
    const analysis = await analyzeLearningReference(parsed.data, abortController.signal, deadline, providerMetrics)
    console.info(JSON.stringify({
      requestId, client: key.slice(0, 12), userId: identity.user.id,
      scope: parsed.data.scope, model: process.env.OPENAI_MODEL_ID || DEFAULT_OPENAI_MODEL,
      latencyMs: Date.now() - started, providerAttempts: providerMetrics.providerAttempts ?? 0,
      providerLatencyMs: providerMetrics.providerLatencyMs ?? 0,
      outcome: 'ok', sourceStatus: analysis.source_status,
    }))
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(analysis))
  } catch (error) {
    const safe = error instanceof ProviderError ? error : null
    const status = safe?.status || error?.status || 502
    const code = safe?.code || error?.code || 'learning_analysis_failed'
    console.warn(JSON.stringify({
      requestId, client: key.slice(0, 12), latencyMs: Date.now() - started,
      outcome: 'learning_error', code, upstreamStatus: safe?.upstreamStatus ?? null,
      status: safe?.status ?? error?.status ?? null, attempts: safe?.attempts ?? 1,
      retryable: safe?.retryable ?? false,
      providerAttempts: providerMetrics.providerAttempts ?? 0,
      providerLatencyMs: providerMetrics.providerLatencyMs ?? 0,
      validationIssues: error?.validationIssues ?? undefined,
    }))
    if (!res.headersSent) safeError(res, status, code)
  } finally {
    inFlight.delete(key)
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const isGenerateRoute = url.pathname === '/api/ai/generate'
  const isLearningRoute = url.pathname === '/api/learning/analyze'
  const isDnaBuildRoute = url.pathname === '/api/learning/dna/build'
  const isDnaActivateRoute = url.pathname === '/api/learning/dna/activate'
  if (!isGenerateRoute && !isLearningRoute && !isDnaBuildRoute && !isDnaActivateRoute) {
    if (req.method === 'GET' && staticFile(res, url.pathname)) return
    res.writeHead(404).end()
    return
  }
  if (req.method !== 'POST') { safeError(res, 405, 'method_not_allowed'); return }

  // Browser requests must use the app's own origin. Deploy the API behind the same host.
  const origin = req.headers.origin
  if (origin) {
    let sameOriginHost = false
    try { sameOriginHost = new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase() } catch { /* reject */ }
    if (!sameOriginHost) { safeError(res, 403, 'origin_not_allowed'); return }
  }

  if (isLearningRoute) {
    await handleLearningAnalyze(req, res)
    return
  }
  if (isDnaBuildRoute) {
    await handleGlobalDnaBuild(req, res)
    return
  }
  if (isDnaActivateRoute) {
    await handleGlobalDnaActivate(req, res)
    return
  }

  const key = clientKey(req)
  if (inFlight.has(key)) { safeError(res, 429, 'too_many_requests'); return }
  if (!allowRequest(key)) { safeError(res, 429, 'too_many_requests'); return }
  if (!process.env.OPENAI_API_KEY) { safeError(res, 503, 'ai_unavailable'); return }
  if (monthQuotaReached()) { safeError(res, 503, 'quota_exhausted'); return }
  inFlight.add(key)

  const requestId = randomUUID()
  const started = Date.now()
  const abortController = new AbortController()
  const metrics = { providerAttempts: 0, providerLatencyMs: 0, promptBuildMs: 0 }
  res.on('close', () => { if (!res.writableEnded) abortController.abort() })

  try {
    const body = await readBody(req)
    const { payload: rawPayload, images } = await parseIncoming(req, body)
    const parsed = parseRequestPayload(rawPayload)
    if (!parsed.success) { safeError(res, 400, parsed.error.code, parsed.error.field); return }
    const payload = parsed.data
    if (payload.mode === 'full' && payload.images.length !== images.length) { safeError(res, 400, 'image_missing'); return }
    if (payload.mode === 'item' && images.length) { safeError(res, 400, 'invalid_payload'); return }
    if (payload.mode === 'full' && payload.images.some((meta, index) => images[index]?.bytes.length !== meta.bytes)) { safeError(res, 400, 'image_missing'); return }

    // Start the single-request budget after the request body and uploaded images are fully read.
    const providerDeadline = Date.now() + GENERATE_DEADLINE_MS
    // Count every valid generation attempt, including provider failures, for the monthly guard.
    monthCount += 1
    const result = await validatedGeneration(payload, images, abortController.signal, providerDeadline, metrics)
    const outcome = 'ok'
    console.info(JSON.stringify({ requestId, client: key.slice(0, 12), mode: payload.mode, model: process.env.OPENAI_MODEL_ID || DEFAULT_OPENAI_MODEL, promptVersion: PROMPT_VERSION, latencyMs: Date.now() - started, outcome, imageCount: images.length, ...metrics }))
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(result))
  } catch (error) {
    const safe = error instanceof ProviderError ? error : null
    const status = safe?.status || error?.status || 502
    const code = safe?.code || error?.code || 'ai_failed'
    console.warn(JSON.stringify({
      requestId,
      client: key.slice(0, 12),
      latencyMs: Date.now() - started,
      outcome: 'provider_error',
      code,
      upstreamStatus: safe?.upstreamStatus ?? null,
      status: safe?.status ?? error?.status ?? null,
      attempts: safe?.attempts ?? 1,
      retryable: safe?.retryable ?? false,
      ...metrics,
    }))
    if (!res.headersSent) safeError(res, status, code)
  } finally {
    inFlight.delete(key)
  }
})

// Warm the active global DNA before accepting Generate requests. This adds only a
// bounded startup lookup; individual Generate requests never wait for Supabase.
await refreshGlobalDnaCache()

server.listen(PORT, HOST, () => {
  console.info(`[captivibe] API server listening on http://${HOST}:${PORT}`)
})
