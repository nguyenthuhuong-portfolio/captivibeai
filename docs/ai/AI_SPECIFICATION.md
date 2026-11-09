# CaptiVibe AI — AI Integration Specification


> **Implementation status (2026-11-08):** Stage 2 integration is now wired in the working source: Node same-origin API, OpenAI Responses API provider (`gpt-6-luna`), server-side Zod validation, strict Structured Outputs, image upload from IndexedDB, full and single-item regeneration, AI metadata in history/Undo, and local-generator fallback. See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md). This is an implementation milestone, not a benchmark sign-off: real-provider latency, quota and copy quality still need a deliberate run with the project's API key.

Design and implementation record for connecting the local generator to a real AI backend.

**Status:** Stage 2 is wired into the source; Generate-path prompt and latency optimisation is the current first phase as of 2026-11-08. Section 2.3 is a historical snapshot
of the app before the integration; subsequent sections define the contract and record the current
implementation. The local generator ([generate.ts](../../src/lib/generate.ts)) remains intact as a
fallback when the AI service is unavailable. Real-provider benchmark and production hardening are
still pending.

Companions: [PROMPTS.md](./PROMPTS.md), [OUTPUT_SCHEMA.json](./OUTPUT_SCHEMA.json),
[BENCHMARK_TEST_CASES.md](./BENCHMARK_TEST_CASES.md).

**Date of initial architecture inspection:** 2026-11-01. Current operational values are updated in sections 7.3 and 9.

---

## 1. Scope

**In scope:** input contract, output contract, validation, scoring rubric, prompt design, model
configuration, generate/regenerate flows, error handling, and the Stage 2 plan.

**Out of scope for Stage 1:** any real API call, any API quota consumption, any change to running
application code, any change to the existing generator.

---

## 2. What actually exists today

### 2.1 Input — `ProductForm`

[types.ts](file:///Users/a/Desktop/Apps/CapAI/src/types.ts#L42-L52):

| Field | Type | Notes |
|---|---|---|
| `productName` | `string` | ≤ 80 characters, trimmed before use |
| `description` | `string` | ≤ 500 characters, trimmed before use |
| `audiences` | `AudienceId[]` | Multi-select. 8 ids: `genz`, `millennials`, `professionals`, `parents`, `students`, `fitness`, `creators`, `luxury`. **At least one required.** |
| `customAudience` | `string \| undefined` | Optional free text, ≤ 150 characters |
| `tone` | `Tone` | Single-select. `'funny' \| 'professional' \| 'genz'` |
| `images` | `ProductImage[]` | 0–4 items |

`ProductImage` holds `{ id, name, size, url }` — the **bytes are not in the form**. `id` is the
IndexedDB key, `name` is the original file name, `size` is the *original* file size (used by the
upload budget), and `url` is a throwaway `blob:` Object URL for previews.

Ceilings live in one place, [limits.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/limits.ts):
`TEXT_LIMITS` (80 / 500 / 150), `IMAGE_LIMITS` (`maxCount: 4`, `maxFileBytes: 10 MB`,
`maxTotalBytes: 20 MB`), and `ACCEPTED_IMAGE_TYPES` (`image/jpeg`, `image/png`, `image/webp` plus the
`image/jpg` alias browsers report).

Rules are expressed as data, not sentences, in
[validation.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/validation.ts): `validateBrief` returns
`{ productName?: 'required' | 'tooLong', description?: …, audiences?: 'required', customAudience?: … }`,
measured **after trimming**, so a whitespace-only field counts as empty.

### 2.2 Output — `GeneratedContent`

[types.ts](file:///Users/a/Desktop/Apps/CapAI/src/types.ts#L54-L58):

```ts
export interface GeneratedContent {
  captions: string[]
  headlines: string[]
  hashtags: string[]
}
```

Three flat string arrays. `generateContent` always returns exactly 3 captions, 3 headlines and 5
hashtags (the tag list is sliced to 5). There is **no** strategy, score, feedback or insight field
in the content model.

Scores are computed separately and on the fly:

| Function | Returns | Used by |
|---|---|---|
| `scoreContent(content, selection)` | `ContentScore { overall, hook, cta, readability }` | The local fallback ScoreCard ring and its three metric bars |
| `scoreHeadline(text)` | `number` | Each headline card's `n/100` badge |
| `scoreCaption(text)` | `number` | Each caption card's `n/100` badge |

These local-fallback figures are 0–100 integers derived deterministically from word counts, a cue-word list
(`CTA_WORDS`, `HOOK_WORDS`, plus Vietnamese phrases) and hashtag coverage. Nothing is learned and
nothing is sent anywhere.

A history row is `HistoryItem extends GeneratedContent` plus `id`, `createdAt`, the brief fields,
and `imageIds` / `imageNames` (IndexedDB keys only — no bytes).

### 2.3 Where the current app diverges from the proposed contract

Historical baseline: this table records the gaps identified before Stage 2 implementation.

| # | Aspect | Current app | Proposed contract | Resolution |
|---|---|---|---|---|
| 1 | **Tone ids** | `funny`, `professional`, `genz` | `funny`, `formal`, `youthful` | Map at the backend boundary: `professional → formal`, `genz → youthful`. The app ids are persisted in every history row, so they are **never renamed** (see the comment in [options.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/options.ts#L8)). |
| 2 | **Audience** | `AudienceId[]` (multi, ≥ 1 required) **plus** optional free text `customAudience` | single `targetAudience: string` (≤ 150) | Send both. `generate.ts` already composes them into one phrase (`audienceLabel`); the backend does the same. Collapsing them in the frontend would lose a persisted field and break history. |
| 3 | **Audience labels** | `AUDIENCE_EN_LABEL` in [options.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/options.ts#L27-L36) is **English only** and feeds the generator | `outputLanguage: 'vi'` default | Stage 2 needs Vietnamese audience descriptors. The UI dictionaries already carry `audiences.*` in both languages, but the generator's own table does not. |
| 4 | **Output language** | Does not exist. Generated copy is **hardcoded English** inside `captionBank` / `headlineBank`. The UI language (`en`/`vi`, [i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts)) is a separate concern and defaults to `'en'` ([storage.ts `loadLanguage`](file:///Users/a/Desktop/Apps/CapAI/src/lib/storage.ts#L279-L287)) | Vietnamese by default | Add `outputLanguage` to the request, defaulting to `'vi'`. Decide in Stage 2 whether it follows the UI language or becomes its own setting (§12, open decision 2). |
| 5 | **Images in transit** | Bytes live only in IndexedDB; the form holds keys and `blob:` Object URLs | 0–4 images transmitted to the backend | Read the Blobs back with `getImages(ids)` from [imageStore.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/imageStore.ts) and send them as binary request parts. **Never** send a `blob:` URL — it is origin-local and meaningless to the server. |
| 6 | **Scoring** | Deterministic `scoreContent` / `scoreHeadline` / `scoreCaption` | AI-assigned integer per item, in the same request as generation | AI scores become primary; the deterministic functions remain the fallback for local-generator output and for history rows saved before the integration. |
| 7 | **Content shape** | 3 flat string arrays | 3 objects carrying `strategy`, `score`, `feedback`, plus `image_insights` | A thin adapter flattens the objects into the existing arrays and carries the metadata alongside (§10). |
| 8 | **Regeneration** | Synchronous bank rotation; no network, no history entry, no loading state | One item per server call, quota-conscious | Keep "regeneration never writes a history row". Add per-card loading and failure handling. |
| 9 | **Backend** | **None.** The repo is a Vite SPA that builds to static `dist/` | React → Backend API → OpenAI GPT-6 Luna | Stage 2 must add a deployable server. See §11. |

> **Model verification update (2026-11-08).** The active provider is OpenAI Responses API with
> `gpt-6-luna`, `reasoning.effort=none`, low-verbosity JSON Schema output and a single request per action.
> The user's OpenAI API key, project quota and live latency still need to be verified in their own account.

### 2.4 Image storage and what a request can actually carry

[utils.ts `compressImageToBlob`](file:///Users/a/Desktop/Apps/CapAI/src/lib/utils.ts#L34-L97) is
called once per upload and has three deliberate outcomes:

1. a **re-encoded Blob** — longest edge fitted to `MAX_IMAGE_EDGE = 800`, encoded at
   `IMAGE_QUALITY = 1`, WebP when the source carried alpha and JPEG otherwise, never enlarged;
2. the **original `File`**, untouched — for a JPEG already inside 800 px (re-encoding would only
   cost quality), or when canvas/encoding is unavailable;
3. **`null`** — the bytes could not be decoded at all (a corrupt or mislabelled file).

Consequence for the request: **the stored Blob is already the final, single-compression artefact.**
The backend must not re-encode or downscale it again — that would be the second compression pass the
stage brief forbids.

Consequence for MIME types: a stored Blob may be `image/jpeg`, `image/webp`, `image/png`, or the
original file's type. The backend must accept all of `ACCEPTED_IMAGE_TYPES`.

---

## 3. AI input contract

One endpoint, two modes. The contract never exposes the model, the key, or the prompt.

### 3.1 Full generation

`POST /api/ai/generate` — `multipart/form-data` when images are present, `application/json` when not.

| Part | Type | Rules |
|---|---|---|
| `payload` | JSON string (see below) | Required, and it is the only text part. ≤ 64 KB. |
| `images` | binary part, repeated | 0–4 occurrences, sent **in the same order as `payload.images`**. The i-th `images` part is the bytes of `payload.images[i]`. |

```jsonc
{
  "mode": "full",
  "productName": "Aurora Glow Serum",          // string, trimmed, 1..80
  "description": "A lightweight vitamin C serum that brightens tired skin in 7 days.",
                                                // string, trimmed, 1..500
  "audiences": ["genz", "creators"],            // AudienceId[], may be empty
  "customAudience": "new mums",                 // string, trimmed, 0..150
  "tone": "formal",                             // "funny" | "formal" | "youthful"
  "outputLanguage": "vi",                       // "vi" | "en", default "vi"
  "platformHint": "instagram",                  // "instagram" | "tiktok" | "facebook" | "x" | null
  "images": [                                   // 0..4; the JSON entry index is the pairing key
    { "filename": "front.jpg", "mimeType": "image/jpeg", "bytes": 214913 }
  ]
}
```

**Images are paired by position, not by name.** `payload.images[i]` describes the i-th `images`
binary part; `filename` is carried for logs and error messages and is treated as untrusted text. It
is deliberately *not* a key: two photos named `IMG_0001.jpg` are perfectly possible, and a filename
that is missing, duplicated or non-ASCII must never be able to mis-pair a picture with a brief. The
server therefore enforces two things instead of trusting names:

- the number of `images` binary parts equals `payload.images.length`;
- the total number of parts is `1 + payload.images.length` — no extra fields, no extra images.

`bytes` is advisory metadata so the backend can reject an obviously oversized request before it
buffers the parts; the authoritative figure is the size of the received part (§3.5).

**The server never re-encodes an image.** The stored Blob is already the final single-compression
artefact (§2.4); resizing or re-encoding it server-side would be the second compression pass the
stage brief forbids, and it would silently change the artefact the user approved in the preview.
The parts are forwarded to the provider exactly as received.

### 3.2 Single-item regeneration

`POST /api/ai/generate` with `application/json` (no image parts).

```jsonc
{
  "mode": "item",
  "productName": "Aurora Glow Serum",
  "description": "…",
  "audiences": ["genz"],
  "customAudience": "",
  "tone": "formal",
  "outputLanguage": "vi",
  "target": { "kind": "caption", "strategy": "storytelling" },
                                                // kind: "caption" | "headline"
  "keep": {                                     // sibling items, so the new copy cannot echo them
    "captions": ["…", "…"],
    "headlines": ["…", "…", "…"]
  },
  "imageInsights": ["Chai serum thuỷ tinh trong suốt có nắp nhỏ giọt."]
}
```

Images are **not** re-uploaded. The previously observed insights are reused, which is what keeps a
re-roll cheap (§8).

### 3.3 Validation rules (server-side, authoritative)

The backend re-validates everything, because a browser attribute is advice and a request can be
crafted. The rules are the same numbers as
[limits.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/limits.ts) — restated here because the
backend is a separate deployable and cannot import the frontend module.

| Field | Rule | Failure code |
|---|---|---|
| `productName` | trimmed length 1–80 | `invalid_product_name` |
| `description` | trimmed length 1–500 | `invalid_description` |
| `audiences[]` | each must be one of the 8 ids; duplicates dropped | `invalid_audience` |
| `customAudience` | trimmed length 0–150 | `invalid_custom_audience` |
| `tone` | one of `funny` \| `formal` \| `youthful` | `invalid_tone` |
| `outputLanguage` | one of `vi` \| `en` | `invalid_language` |
| `images[]` | ≤ 4 entries, each `mimeType` in `ACCEPTED_IMAGE_TYPES`, each `bytes` ≤ 10 MB, sum ≤ 20 MB, each part present and non-empty | `too_many_images` / `unsupported_image_type` / `image_too_large` / `images_too_large` / `image_missing` |
| `target.strategy` | must match `target.kind` | `invalid_strategy` |
| whole body | decompressed/multipart size ≤ **22 MiB** (20 MiB image-byte budget plus multipart/JSON overhead) | `payload_too_large` |

`audiences` may legitimately be empty **in the contract**, even though the current form requires at
least one pill — the free-text field is a valid audience on its own. When both are empty the backend
substitutes a neutral phrase exactly as `audienceLabel` does today (`'your audience'` →
`'khách hàng của bạn'`).

### 3.4 Image transmission strategy

**Chosen: `multipart/form-data` with binary parts, over HTTPS, to a first-party endpoint.**

| Option | Verdict |
|---|---|
| `multipart/form-data` binary parts | **Chosen.** No Base64 inflation (saves ~33% of bytes), streams naturally, one request carries JSON + pictures, and no image ever becomes a string. |
| Base64 inside JSON | Rejected. Larger body, larger memory spike, and it puts image data into a JSON document where it is easy to log by accident. |
| Direct browser → provider upload | Rejected. Would require exposing credentials or a signed URL flow, and the brief forbids image data in public URLs. |
| A `blob:` Object URL | Impossible. It is origin-local and the server cannot resolve it. |

Rules that come with the choice:

- The API key exists only in the server process. It is never a `VITE_` variable — anything prefixed
  `VITE_` is inlined into the client bundle by Vite and would be readable by any visitor.
- Images are carried as request **parts**, never as prompt text, and never interpolated into a
  prompt string.
- The body cap is enforced by the Node request reader; image-byte caps are checked against both the declared `bytes` and the actual uploaded files
  metadata the client sends.
- No image is persisted server-side: the parts are read into memory for the provider call and
  dropped with the request. Nothing is written to disk and nothing is publicly addressable.
- The client strips nothing but also sends nothing extra: only `filename`, `mimeType` and `bytes`
  travel as metadata; EXIF is whatever survived the canvas round-trip.

---

## 4. AI output contract

The response is the object defined by [OUTPUT_SCHEMA.json](./OUTPUT_SCHEMA.json). Summary:

| Field | Type | Cardinality | Purpose |
|---|---|---|---|
| `captions` | `ScoredCaption[]` | exactly 3 | One per strategy: `benefit` (short), `storytelling` (medium), `problem_solution` (long) |
| `captions[].strategy` | enum | — | Stable identifier; guarantees the three approaches differ |
| `captions[].text` | `string` | 1–4000 chars | The caption, ready to paste |
| `captions[].score` | `integer` | 0–100 | The AI's quality verdict for **this** caption |
| `captions[].feedback` | `string` | 1–120 chars | One concrete strength or weakness |
| `headlines` | `ScoredHeadline[]` | exactly 3 | One per strategy: `direct_benefit`, `curiosity`, `emotional` |
| `headlines[].strategy` \| `.text` \| `.score` \| `.feedback` | — | As above |
| `hashtags` | `string[]` | exactly 5 | Each `^#[^\s#]+$`. No score, no feedback |
| `image_insights` | `string[]` | 0–3 | Visible-evidence observations only; **empty array** when no images |

`additionalProperties: false` applies to the response object and to both item types, so an
unexpected key is a validation failure rather than a silent extra.

**Cardinality matches the app's existing shape.** `generateContent` already emits 3 / 3 / 5, and the
empty-state string in [i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts#L94-L95) already
promises "3 captions, 3 headlines, and 5 hashtags" — so the AI contract does not change what the
results panel displays. It adds metadata to it.

**Order is not trusted.** The schema enforces one-of-each strategy but cannot enforce array order, so
the adapter sorts captions into `[benefit, storytelling, problem_solution]` (short → medium → long) and headlines into
`[direct_benefit, curiosity, emotional]` before mapping to cards 1–3. This is what keeps a card's
strategy stable across regenerations.

**Where the insight field surfaces.** The app currently renders a single templated insight sentence
in the score card (`results.insightTemplate`, assembled from threshold checks on `score.cta` and the
hook score). `image_insights` and per-item `feedback` are new information; §10 says what the UI does
with them.

---

## 5. Schema and server-side validation

### 5.1 Why the JSON Schema is not enough

[OUTPUT_SCHEMA.json](./OUTPUT_SCHEMA.json) is necessary but not sufficient. Structured-output support
in any provider constrains the *shape* of a response; it does not guarantee that the content is
sensible. Every one of the following must be re-checked in code:

| Check | Enforceable in JSON Schema? | Where it runs |
|---|---|---|
| Exactly 3 captions / 3 headlines / 5 hashtags | Yes (`minItems` + `maxItems`) | Schema |
| One of each strategy identifier | Yes (`contains` + `minContains`/`maxContains` on the array) | Schema + Zod |
| Score is an integer 0–100 | Yes | Schema + Zod |
| Feedback ≤ 120 characters | Yes (`maxLength`) | Schema + Zod |
| Non-empty text after trimming | Partly (`minLength`) — whitespace-only still passes | Zod `.trim().min(1)` |
| Hashtag format, no inner whitespace | Partly (`pattern`) — Unicode letters are not expressible portably | Zod with a Unicode-aware regex |
| **Near-duplicate items** | **No** | Zod refine (normalised similarity) |
| **Duplicate or near-duplicate hashtags** | **No** | Zod refine |
| **Item copied verbatim from a sibling** | **No** | Zod refine against the request's `keep` list |
| **Unsupported claim not in the brief** | **No** | Prompt rule + human benchmark review; a keyword check would produce false positives |
| **Response is valid JSON at all** | N/A | Parse layer, before the schema |

Note the honest gap: the last row cannot be automated reliably in Stage 2. It is a prompt rule,
measured by the human rubric in [BENCHMARK_TEST_CASES.md](./BENCHMARK_TEST_CASES.md), not a gate.

### 5.2 Zod design

One module owns the whole response contract, so the schema and the code that consumes it cannot drift
apart. Zod is chosen because the schema is then a runtime check *and* a TypeScript type — the frontend
already leans on `tsc --noEmit` for correctness, and this keeps the same discipline on the server.

```ts
// server/src/ai/contract.ts
import { z } from 'zod'

export const CAPTION_STRATEGIES = ['benefit', 'storytelling', 'problem_solution'] as const
export const HEADLINE_STRATEGIES = ['direct_benefit', 'curiosity', 'emotional'] as const

const trimmedText = (max: number) => z.string().trim().min(1).max(max)

/** The feedback cap is a hard product rule, so it is trimmed before it is measured. */
const feedback = z.string().trim().min(1).max(120)

const score = z.number().int().min(0).max(100)

const captionItem = z
  .object({
    strategy: z.enum(CAPTION_STRATEGIES),
    text: trimmedText(4000),
    score,
    feedback,
  })
  .strict()

const headlineItem = z
  .object({
    strategy: z.enum(HEADLINE_STRATEGIES),
    text: trimmedText(300),
    score,
    feedback,
  })
  .strict()

/** `#tag` — a Unicode-aware form of the JSON Schema pattern. */
const HASHTAG = /^#[\p{L}\p{N}_]+$/u

/** Normalised form used for the duplicate checks: case, accents, spacing and punctuation removed. */
const normalise = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Token-set Jaccard similarity, 0..1. Cheap, and good enough to catch a paraphrase. */
function similarity(a: string, b: string) {
  const A = new Set(normalise(a).split(' '))
  const B = new Set(normalise(b).split(' '))
  const shared = [...A].filter((token) => B.has(token)).length
  return shared / (A.size + B.size - shared || 1)
}

const MAX_SIMILARITY = 0.8

function oneOfEach<T extends string>(allowed: readonly T[], label: string) {
  return (items: { strategy: T }[], ctx: z.RefinementCtx) => {
    for (const strategy of allowed) {
      const count = items.filter((item) => item.strategy === strategy).length
      if (count !== 1) {
        ctx.addIssue({ code: 'custom', message: `${label}: expected exactly one "${strategy}", got ${count}` })
      }
    }
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (similarity(items[i].text, items[j].text) >= MAX_SIMILARITY) {
          ctx.addIssue({ code: 'custom', message: `${label} ${i + 1} and ${j + 1} are too similar` })
        }
      }
    }
  }
}

export const aiResponseSchema = z
  .object({
    captions: z
      .array(captionItem)
      .length(3)
      .superRefine(oneOfEach(CAPTION_STRATEGIES, 'captions')),
    headlines: z
      .array(headlineItem)
      .length(3)
      .superRefine(oneOfEach(HEADLINE_STRATEGIES, 'headlines')),
    hashtags: z
      .array(z.string().trim().min(2).max(40).regex(HASHTAG))
      .length(5)
      .superRefine((tags, ctx) => {
        const seen = new Set(tags.map((tag) => normalise(tag)))
        if (seen.size !== tags.length) {
          ctx.addIssue({ code: 'custom', message: 'hashtags contain duplicates' })
        }
      }),
    image_insights: z.array(z.string().trim().min(1).max(160)).max(3),
  })
  .strict()

export type AiResponse = z.infer<typeof aiResponseSchema>
```

Two rules for the sibling-copy check, which needs request context and so cannot live in the schema
above: it runs as a second `superRefine` that closes over the `keep` list, and it never rejects the
whole response — a single too-similar caption is rejected and falls back locally, not by
discarding an otherwise useful set.

### 5.3 One request, then local fallback

The Generate path makes **one provider request maximum**. There is no transient retry, no `Retry-After` wait and no schema-repair request. OpenAI Structured Outputs reduces malformed JSON; Zod remains the final application-level gate.

| Condition | Backend behaviour | Maximum provider calls |
|---|---|---:|
| Normal generation | One GPT-6 Luna Responses API request | 1 |
| `429`, `5xx`, network error or timeout | Return a typed error; frontend invokes Local Generator | 1 |
| Invalid or incomplete structured output | Return `ai_invalid_output`; frontend invokes Local Generator | 1 |
| Missing API key | Fail before calling the provider; frontend invokes Local Generator | 0 |

The design deliberately chooses a fast, clearly-labelled local fallback over another paid attempt. Full generation is all-or-nothing; single-item regeneration preserves sibling cards.

## 6. Scoring and feedback design

### 6.1 Rubric

| Criterion | Weight | What it asks |
|---|---:|---|
| Product relevance | 25% | Does the copy actually describe **this** product as the brief describes it? |
| Tone and target audience adherence | 20% | Is it in the requested voice, and does it read as written for these people? |
| Creativity and differentiation | 20% | Is it fresh, and are the three items genuinely distinct from each other? |
| Natural language and readability | 15% | Does it sound like a person wrote it in this language? |
| Purpose and platform suitability | 10% | Does the length and shape fit a social feed? |
| Factual accuracy, no unsupported claims | 10% | Does every claim trace back to the brief? |

One final integer 0–100 per caption and per headline. **No per-criterion breakdown is returned** —
the weights are the model's internal reasoning, and surfacing a six-part table would cost tokens,
invite over-fitting to the rubric, and give the user numbers they cannot act on.

Hashtags are not scored: "relevance" for a five-tag set is not comparable to the score of a
sentence, and mixing the two scales in one UI row would mislead.

### 6.2 Why this is not `scoreContent`

`scoreContent` is a *heuristic* and stays useful, but it cannot be the primary quality signal once
copy is written by a model.

| | `scoreContent` / `scoreHeadline` / `scoreCaption` (today) | AI-assigned score (Stage 2) |
|---|---|---|
| Input | The text alone | The text **and** the brief, the tone, the audience and the images |
| Method | Word counts, average word length, fixed cue-word lists (`CTA_WORDS`, `HOOK_WORDS`, Vietnamese phrases), hashtag coverage | Holistic judgement against the six-criterion rubric |
| Can judge relevance to the product? | No — it never sees the product | Yes |
| Can judge tone adherence? | No — `ProductForm.tone` is not passed in at all | Yes |
| Can detect an unsupported claim? | No | Partially, and named in the prompt as a hard rule |
| Language aware? | Only via a short Vietnamese phrase list | Yes |
| Explainable | `overall = virality×0.34 + cta×0.33 + readability×0.33` | One sentence of `feedback`, no formula |
| Cost | Free, synchronous | Free — computed inside the generation request |
| Deterministic | Yes | No |

The two overlap in only one respect: `overall` is a single 0–100 number that drives the same ring.
Everything else is different, which is why they must not be blended silently.

**What happens to the deterministic functions:**

1. **Kept.** They are not deleted. They are covered by
   [generate.test.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/generate.test.ts) and they are the
   only scorer available when there is no AI response.
2. **Demoted to fallback.** The `ScoreCard` ring and the two headline/caption metric sets read the
   AI score when the current content carries AI metadata, and fall back to `scoreContent` otherwise.
3. **Not blended.** Mixing an average of the two would produce a number that means nothing and
   changes meaning depending on whether a response arrived. One source or the other, never a
   weighted compromise.

**Why the ring keeps its name and shape.** The user already reads it as "AI Content Score". The
subtitle wording that describes how it is derived is what changes, not the component.

**Metric bars.** The three bars are `virality`, `cta` and `readability`. Only `readability` has an
AI analogue (natural language and readability, 15%). `virality` and `cta` have no AI counterpart, and
the brief explicitly says a score *"represents an AI quality assessment, not a prediction of real
engagement, sales or virality"*. Stage 2 therefore must not relabel an AI number as "virality".
Recommended: derive the ring from the AI score of the selected pair (headline + caption, averaged
and rounded), keep `cta` and `readability` mapped onto the closest rubric criteria, and drop or
re-purpose the `virality` bar — see §12, open decision 3. This is a wording-and-mapping question, not
a redesign, so it stays inside the "no UI redesign" constraint.

### 6.3 Feedback requirements

- One `feedback` per caption and per headline. Hashtags get none.
- Maximum **120 characters**, enforced by
  [OUTPUT_SCHEMA.json](./OUTPUT_SCHEMA.json) and by Zod; a longer one is truncated locally rather
  than failing the request.
- One meaningful strength **or** weakness. Not both, not a list.
- Actions, not compliments: "Cut the second sentence — the benefit is already clear." is good;
  "Great content!" is a validation failure of intent, not just of taste.
- No breakdown, no chain-of-thought, no confidence figures.

### 6.4 Self-review before scoring

The generation prompt contains an explicit six-step checklist (see
[PROMPTS.md](./PROMPTS.md) section 7). Scores must describe the **revised** text. Calibration
anchors are stated in the prompt so numbers are comparable between briefs, and the prompt
explicitly caps a vague, self-contradictory brief in the mid-80s — "nothing to work with" cannot
produce 95.

---

## 7. Model configuration

The active provider is OpenAI's Responses API. Model ID and prices below were checked against OpenAI's published model and pricing documentation on 2026-11-08; availability, tier limits and actual latency remain account-specific.

### 7.1 Active model

| Item | Value |
|---|---|
| Model ID | `gpt-6-luna` |
| Intended workload | Low-cost, high-volume structured generation |
| Input / output price | $0.10 / $0.50 per 1 million tokens (published list price) |
| Reasoning | `reasoning.effort: none` |
| Text output | Strict JSON Schema via Responses API Structured Outputs |
| Image input | Supported; app sends attached images with `detail: low` to reduce visual-token spend |
| Data storage | `store: false` |
| Secret | `OPENAI_API_KEY` on the server only |

Official references: [Models](https://developers.openai.com/api/docs/models), [Pricing](https://developers.openai.com/api/docs/pricing), [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Images and vision](https://developers.openai.com/api/docs/guides/images-vision).

### 7.2 Latency and token settings

| Setting | Current value | Rationale |
|---|---|---|
| Full response output budget | 2,000 tokens | Sized for 3 captions, 3 headlines, 5 hashtags, score/feedback and image insights |
| Single-item output budget | 600 tokens | One caption or headline only |
| Reasoning effort | `none` | Avoids unnecessary reasoning tokens for a well-defined generation task |
| Text verbosity | `low` | Avoids explanatory prose; JSON schema remains the contract |
| Generate provider deadline | 18 s after request body and images are read | Hard stop before returning to local fallback |
| Frontend timeout | 30 s | Allows request upload overhead beyond provider deadline |
| Retry / repair | 0 | Exactly one provider request maximum |
| Synchronous Generate-path database lookups | 0 | Active Global DNA is served from the server memory cache; Inspiration Library remains deferred |
| Operational logging | request id, hashed client, mode, model, prompt version, total latency, provider latency, prompt-build time, request count, image count and outcome | No brief text, captions, image bytes or credentials in logs |

These are guardrails, not measured performance guarantees. Benchmark with the user's API key before public launch.

## 7.3 Admin-owned Global DNA

- The ten seed posts are supplied and controlled by the project Admin. They are not user posts, personal references or community submissions.
- `global_dna_sources` stores the ten source slots privately under Admin-only RLS. `global_style_profiles` stores compact, versioned profiles with `draft`, `active` and `archived` states.
- Building a new DNA version sends all ten saved posts in one GPT request. The result is always a draft and requires explicit Admin activation after preview. Activating a new version archives the previous active version atomically.
- The profile captures only style (brand voice, hook patterns, rhythm/structure, emoji guidance, persuasion, wording and CTA). It is not a source of product facts or claims.
- Generate and single-item regeneration receive the active profile from a five-minute server-side memory cache. The cache is warmed before server startup completes; after its five-minute TTL, the next Generate uses the stale snapshot while triggering a background refresh. Activation explicitly refreshes it before returning. No synchronous database round trip is added to Generate; if the cache is empty or Supabase is unavailable, generation continues without DNA.
- The Global DNA source tables and RPCs are isolated from `learning_references` and `learning_patterns`. Community and personal content cannot update the Global DNA profile.

## 8. Generate and regenerate flows

### 8.1 Full generation — one request

```
User presses "Generate"
  → frontend validates locally (validateBrief, already implemented)
  → reads image Blobs from IndexedDB (getImages / loadProductImages)
  → POST /api/ai/generate  (multipart: payload JSON + <= 4 image parts)
  → backend validates input (§3.3)
  → attaches cached active Global DNA (style only), builds compact prompt (PROMPTS.md §§4–5) and calls the provider (no synchronous Supabase lookup)
  → JSON.parse → JSON Schema → Zod (§5)
  → validate JSON and Zod schema (§5)
  → returns the validated AiResponse
  → frontend adapts it (§10) and writes content + selectedHashtags
  → addItem(form, content) → one history row
```

Everything the UI needs arrives together: 3 captions, 3 headlines, 5 hashtags, image insights, and
all six scores/feedback. **One request, one history row** — exactly the current behaviour, with the
`setTimeout(650)` placeholder in
[handleSubmit](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx#L316) replaced by the real call.

### 8.2 Regenerating one caption or one headline

`POST /api/ai/generate` in `mode: "item"`. One item back, one provider call, no images re-sent.

Mapping onto existing state — designed to match what the app already does:

| Step | Current local behaviour | AI behaviour |
|---|---|---|
| Preserve undo | `rememberForUndo(content)` | Identical — unchanged |
| Choose target | `handleRegenerateCaption(index)` | Same handler, now `async` |
| New value | `rotateInBank(bank, current, taken)` | `POST mode:"item"`, `strategy` taken from the card's existing metadata |
| Write back | `captions[index] = …` | Same index write, plus the new `score` and `feedback` for that item |
| Siblings | Untouched | Untouched |
| History | No new row | **No new row** — regenerate revisits a brief, it does not create one |
| Failure | Impossible (synchronous) | Automatically create a local replacement for the requested card and show the fallback notice; sibling cards remain unchanged |

`strategy` is carried on the card precisely so a re-roll cannot silently turn card 2 into a second
"benefit" caption. If a card has no AI metadata (local-generator output), the backend assigns the
strategy from the card's index using the fixed order in §4.

### 8.3 Regenerating the whole set

`handleRegenerate()` re-runs the full generation. Recommended optimisation, since the brief has not
changed: send `mode: "full"` **without** image parts, passing the previously observed
`imageInsights`, and pass `keep`/`previousCaptions`/`previousHeadlines` so the new set does not
repeat what is already on screen. One provider call, no image re-upload.

### 8.4 Quota economics

| Action | Provider calls | Images resent | Rationale |
|---|---:|---|---|
| Initial Generate | 1 | Yes | Everything is new |
| Regenerate all | 1 | No | Reuse insights; the brief is unchanged |
| Regenerate one caption | 1 (small) | No | Only one item is new; the request body is a fraction of a full generation |
| Regenerate one headline | 1 (small) | No | As above |
| Edit, Undo, Copy, preview toggle, hashtag toggle | **0** | — | Pure client-side behaviour, unchanged |
| Open a history row | **0** | — | Reads IndexedDB and localStorage only |

Every AI-backed action is limited to one provider call. There are no retries or repair requests; any provider or validation failure immediately selects the local fallback. The six-item redesign — one call per item — remains explicitly avoided: initial Generate stays one request.

### 8.5 Duplicate-submit protection, already in place

[App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx#L118-L119) already holds `submittingRef` and
`processingRef`, and the Generate button is `disabled={generating}`. Those guards were built for a
synchronous generator and remain exactly what is needed for an asynchronous one: `submittingRef`
closes the window between the click and the re-render, and the `finally` block guarantees
`generating` returns to `false` on every path. Stage 2 adds nothing here except that the per-card
regenerate actions need their own in-flight guard, since six cards can now each start a request.

---

## 9. Error handling, timeouts and provider failures

### 9.1 Failure matrix

The user never sees a provider error, a stack trace, a status code or the raw message. Every case
maps to one short sentence, in the active interface language, via the existing notice channel
([useNotices.ts](file:///Users/a/Desktop/Apps/CapAI/src/hooks/useNotices.ts) +
[NoticeStack.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/NoticeStack.tsx)). No `alert()`.

| Condition | Server response | Frontend behaviour | Notice (planned i18n key) |
|---|---|---|---|
| Invalid input | `400` + `{ code, field }` | Nothing is submitted; the field is marked | Reuse `errors.*` from the local validator; the backend is a backstop, not a second source of messages |
| Missing/expired key (server misconfig) | `503` + `code: "ai_unavailable"` | Automatically run the Local Generator | `notice.aiFallback` |
| Provider `429` | Typed error immediately; no retry | Automatically run Local Generator and show fallback notice | `notice.aiFallback` |
| Provider `5xx` | Typed error immediately; no retry | Automatically run Local Generator and show fallback notice | `notice.aiFallback` |
| Provider timeout | 18 s provider deadline / 30 s client timeout | Automatically run Local Generator and show fallback notice | `notice.aiFallback` |
| Output invalid after schema validation | `502` + `code: "ai_invalid_output"` | Automatically run Local Generator; preserve previous content until fallback succeeds | `notice.aiFallback` |
| Monthly quota exhausted | `503` + `code: "quota_exhausted"` | Automatically run the Local Generator | `notice.aiFallback` |
| Rate limited by our own limiter | `429` | Automatically run Local Generator and show fallback notice | `notice.aiFallback` |
| Network offline / request aborted | fetch rejects | Automatically run Local Generator and show fallback notice | `notice.aiFallback` |
| Response not JSON | Parse failure → treated as invalid output | Automatically run Local Generator and show fallback notice | `notice.aiFallback` |

Rules that hold in every row:

1. **`generating` always ends.** The existing `try/catch/finally` in `handleSubmit` is kept verbatim;
   no path may leave the button stuck on "Generating captions…".
2. **Unvalidated GPT output is never rendered.** The app writes a fully validated GPT result, or a completed Local Generator fallback. If both providers fail (including a local fallback failure), the previous visible result remains untouched.
3. **Partial GPT output is not rendered.** Full generation is all-or-nothing. A single-item re-roll either installs one validated AI replacement or one local replacement; sibling cards are preserved.
4. **One broken call cannot break the app.** The existing
   [ErrorBoundary](file:///Users/a/Desktop/Apps/CapAI/src/components/ErrorBoundary.tsx) already wraps
   the whole tree; a rejected promise is not a render error, so it is handled in the handler rather
   than by the boundary.
5. **The user does not have to trigger recovery manually.** GPT failure automatically invokes the local generator; a later Generate action makes one fresh GPT request with the same brief and images.

### 9.2 What is never sent to the browser

- The provider API key, in any form.
- The raw provider error body, status text or stack trace.
- The model id or prompt text.
- Usage or quota figures beyond a coarse "unavailable"/"try later" signal.

---

## 10. Stage 2 frontend changes

### 10.1 Types

The safest change is additive, because `GeneratedContent` is persisted verbatim in
`localStorage` and read back by `reviveItem`, which coerces field by field.

```ts
/** Metadata the AI returns alongside one scored item. Optional: local-generator output has none. */
export interface ScoredMeta {
  strategy: string
  score: number
  feedback: string
}

/** Extends the existing shape rather than replacing it. */
export interface GeneratedContent {
  captions: string[]      // unchanged — rendering, editing, copy and undo all read these
  headlines: string[]     // unchanged
  hashtags: string[]      // unchanged
  /** Parallel to `captions`. Absent for locally generated content and pre-AI history rows. */
  captionMeta?: ScoredMeta[]
  /** Parallel to `headlines`. */
  headlineMeta?: ScoredMeta[]
  /** Visible-evidence observations, reused by single-item regeneration. */
  imageInsights?: string[]
}
```

Why additive: `ResultsPanel` maps over `content.captions` / `content.headlines` / `content.hashtags`
and writes back by index. Keeping the string arrays authoritative means Edit, Copy, Undo, the master
copy action, `totalPostLength`, `hashtagsLength` and every preview keeps working unchanged, and a
restored history row written before the AI integration still renders exactly as it does today.

| File | Change | Risk if skipped |
|---|---|---|
| [types.ts](file:///Users/a/Desktop/Apps/CapAI/src/types.ts) | add `ScoredMeta`; add the three optional fields | none — optional |
| [storage.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/storage.ts) | `reviveItem` coerces the new fields; drop them silently when malformed | an old row must still open; an AI row must survive a reload |
| [generate.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/generate.ts) | keep `generateContent` as the fallback; add an adapter `toGeneratedContent(aiResponse)` | the local path must not be removed |
| new `src/lib/ai.ts` | request building, fetch, typed errors, response adaptation | keeps the fetch out of `App.tsx` |
| [App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx) | real call in `handleSubmit`; `async` per-card regenerate; per-card in-flight guard | otherwise double requests and stuck loading |
| [ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx) | prefer AI score over `scoreContent`; render `feedback`; add a per-card loading state | the ring would contradict the copy |
| [i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts) | new `notice.ai*` keys in **both** `en` and `vi` | `TranslationKey = keyof typeof en` and `vi: Record<TranslationKey, string>` make a missing Vietnamese key a compile error, by design |

### 10.2 UI additions that stay inside the "no redesign" constraint

Only states and messages change; no layout, no new panel, no colour or spacing revision:

1. Per-card loading on the card being regenerated (the existing `RotateCw` icon already has an
   `animate-spin` class in use for "Regenerate all").
2. The `feedback` line under a card's text, in the existing `text-xs text-muted-foreground` role.
3. The score ring reading the AI number, with its existing `role="img"` label.
4. New notices for the failure cases in §9.1.

---

## 11. Security architecture

```
React frontend (browser)
  → POST /api/ai/generate            first-party endpoint, HTTPS only
     Backend API
       → input validation (§3.3)
       → prompt + model configuration (server-side constants)
       → provider API call with the server-held key
       → JSON Schema + Zod validation (§5)
       → one-response validation (§5.3)
     ← validated AiResponse
  ← adapt to GeneratedContent, update state, write one history row
```

Non-negotiable rules:

1. **The key is server-side only.** It lives in a server environment variable. It is never
   `VITE_*`-prefixed, never in `src/`, never in a request the browser can read, and never in a
   response body. Vite inlines every `VITE_`-prefixed variable into the client bundle, so a
   `VITE_OPENAI_API_KEY` would be published to every visitor by design.
2. **A new deployable is required.** The current repo is a Vite SPA that builds to static `dist/`;
   there is no server in it. Stage 2 must add one — a small Node service, or serverless functions on
   the same origin — and it must be able to hold a secret.
3. **Server-side rate limiting and cost ceiling** are the real protection for free-tier quota,
   because the browser cannot be trusted to be the only caller.
4. **No image data is stored server-side.** Parts are consumed in memory and discarded with the
   request. Nothing is written to disk and nothing is publicly addressable.
5. **No image data or credentials in prompt strings or URLs.** Images travel as binary request
   parts; the prompt references them only as "attached images".
6. **User text is data, not instructions.** Everything from the brief is delimited inside `<brief>`
   and the system prompt states that it is never an instruction — see
   [PROMPTS.md](./PROMPTS.md) section 1. This is prompt-injection hygiene, not a licence to skip
   output validation.
7. **Only sanitised errors cross the boundary.** §9.2.
8. **CORS is narrow.** The endpoint answers the app's own origins only.

---

## 12. Unresolved decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **The actual model id** | `gpt-6-luna` | Resolved against OpenAI's published model documentation; the owner's account must still confirm access, quota and billing. |
| 2 | **How `outputLanguage` is chosen** | Follow the interface language / its own setting / always Vietnamese | Resolved: follows the persisted interface language. New users default to `vi`; returning users retain their saved language. |
| 3 | **The `virality` metric bar** | Keep / re-purpose / remove | Resolved: the results card uses hook, CTA and readability metrics; it does not claim to predict virality. |
| 4 | **Where `feedback` and `image_insights` appear** | Under each card / replace the templated insight sentence / both | Resolved: per-item feedback appears below each scored caption/headline; image observations appear in the score card. |
| 5 | **Backend hosting** | Node service / serverless functions / provider-adjacent runtime | Resolved for this repository: a small Node service is proxied behind the same app origin. The key remains in server environment variables. |
| 6 | **Persisting AI metadata in history** | Full metadata / scores only / none | Resolved: full scores, feedback, image insights and source marker are saved/restored with history and Undo. |
| 7 | **Fallback when the AI is unavailable** | Local generator / error only | Local generator, clearly labelled. It already exists and is tested; deleting it is out of scope. |
| 8 | **Near-duplicate threshold** | `MAX_SIMILARITY` 0.8, token-set Jaccard | Start here and tune against [BENCHMARK_TEST_CASES.md](./BENCHMARK_TEST_CASES.md) cases H-04 and B-04, which apply the most pressure to diversity. A wrong threshold either rejects good copy or lets paraphrases through. |
| 9 | **Vietnamese audience descriptors** | New table in the backend / extend `AUDIENCE_EN_LABEL` | Resolved: backend-owned Vietnamese and English audience labels are defined in `server/prompts.mjs`. |
| 10 | **Automated unsupported-claim detection** | Keyword blocklist / second model call / human review only | Human review only in Stage 2. A blocklist would flag legitimate copy ("không chứa cồn") and a second call doubles cost for a marginal gain. |

---

## 13. Stage 2 implementation plan and status

The implementation items below are wired into the source as of 2026-11-07. Real-provider benchmark and tuning remain outstanding; a successful local build/test in the developer's environment is still required after installing dependencies.

1. **Model/API verification — done for API shape.** Current OpenAI docs confirm `gpt-6-luna`, Responses API, image input and strict structured output. User-project access and quota remain account-specific.
2. **Contract and Zod validation — implemented.** `server/contract.mjs`, with Node tests in `server/contract.test.mjs`.
3. **Prompt builders — implemented.** `server/prompts.mjs`; server-owned prompts and seller-data separation.
4. **Backend — implemented.** `server/index.mjs` + `server/provider.mjs`, one OpenAI request with no retry/repair, basic in-process rate/quota guards.
5. **Frontend adapter — implemented.** `src/lib/ai.ts`; maps responses and metadata to the app's shape.
6. **App wiring/fallback/history — implemented.** AI attempt first, existing local generator remains the fallback, AI metadata is saved/restored.
7. **Real-provider benchmark — pending.** Run [BENCHMARK_TEST_CASES.md](./BENCHMARK_TEST_CASES.md) deliberately using the owner's key; this can consume API quota.
8. **Tune and production hardening — pending.** Use measured latency/quality and move rate/quota counters to persistent shared storage before horizontal scaling.

Contract, prompt, backend and adapter tests can be run without provider quota. The deliberate benchmark in step 7 is the first integration check that calls the live model and may consume quota.

---

## 14. Acceptance criteria for Stage 2

- Generate returns 3 captions, 3 headlines, 5 hashtags and 0–3 image insights, matching
  [OUTPUT_SCHEMA.json](./OUTPUT_SCHEMA.json), in one request.
- Every caption and headline carries a strategy, an integer score 0–100, and feedback ≤ 120
  characters.
- Every response that reaches the UI has passed the Zod gate.
- No API key, model id, prompt text or provider error body exists in the client bundle or in any
  response the browser can read (verified by grepping `dist/` for the key and the model id).
- Regenerating one item costs exactly one small request and sends no images.
- A failed or invalid generation leaves the previous content, the brief and the selection untouched,
  ends the loading state, and can be retried without a reload.
- The local generator still works and is still the fallback.
- The existing test suite from the previous stability pass still passes, with the contract and
  adapter suites added.


## 15. Implementation notes and known limitations

- The Node API accepts up to 22 MiB for the multipart envelope, validates JPEG/PNG/WebP file signatures, and retains the app’s 20 MiB image-byte budget (10 MiB each, max four). OpenAI receives the app’s existing combined image budget (up to 20 MiB) as low-detail data URLs. Oversized or invalid image requests fall back to the local generator; the UI upload limit itself is unchanged.
- Monthly quota and per-client throttling are currently in-memory, single-process protections. They reset on restart and are not a durable billing control.
- Per-client identity uses the socket address visible to Node. Behind a reverse proxy, configure trusted-proxy handling before relying on per-user limits.
- Provider token usage is not yet persisted to an analytics store. Logs deliberately omit brief text, captions, image bytes and secrets.
- No real-provider benchmark has been run by the implementation author because the user's API key is not available in the workspace. A generated response must be checked against the benchmark suite before treating the rubric as calibrated.
