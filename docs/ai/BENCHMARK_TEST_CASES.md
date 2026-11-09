# CaptiVibe AI — Benchmark Test Cases (Stage 1 design)

A reusable benchmark of 30 scenarios for evaluating the AI integration, plus the human rubric that
scores the output and the procedure for running a round.

**No API call was made and no quota was consumed to produce this document.** Every target in
section 4 is a **target to be measured**, not a measured result. Section 5 says how to actually run
the round and record real numbers.

Companions: [AI_SPECIFICATION.md](./AI_SPECIFICATION.md) (contracts, rubric weights, model config),
[PROMPTS.md](./PROMPTS.md) (the prompts under test), [OUTPUT_SCHEMA.json](./OUTPUT_SCHEMA.json) (the
structural gate).

---

## 1. How to use this benchmark

Each scenario is a brief to paste into the app (or POST to the endpoint), run, and score. A round is
a single pass over all 30 with one frozen configuration.

**Preconditions for a valid round:**

| Item | Value to record |
|---|---|
| Model id as configured | e.g. the id confirmed in Stage 2 step 1 |
| `systemPromptVersion` / `generationPromptVersion` | The constants from [PROMPTS.md](./PROMPTS.md) section 8 |
| `outputLanguage` | `vi` unless the scenario says otherwise |
| Token budget / timeout / retry settings | From [AI_SPECIFICATION.md](./AI_SPECIFICATION.md) §7.3 |
| App commit | For traceability |

Results are only comparable between rounds that share the same prompt versions and model id. A change
to either starts a new round; it does not extend the old one.

**Tone coverage.** All three tones appear in the set:

| Contract tone | App id | Cases |
|---|---|---|
| `funny` | `funny` | A-02, B-03, C-04, D-02, F-02, G-04, H-02 |
| `formal` | `professional` | A-01, B-01, C-01, D-01, E-01, F-01, G-01, G-03, G-05, H-01, H-03 |
| `youthful` | `genz` | A-03, B-02, C-02, D-03, E-02, E-03, F-03, G-02, H-04 |
| *(mixed within a category)* | A-04, B-04, C-03 | Tone varied to test consistency within one product |

**Image coverage.** Text-only: G-01, G-03, H-02, plus one case in each category. One image: A-02,
B-03, C-04, D-02, E-02, F-02, G-05, H-03. Multiple images: A-04, B-04, C-03, D-03, E-03, F-03, G-04,
H-01, H-04.

---

## 2. Scenarios

### A. Household products

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| A-01 | formal | 0 | Tên: "Bình giữ nhiệt Inox 500ml". Mô tả: "Giữ nóng 12 giờ, giữ lạnh 24 giờ, nắp chống rò, thân inox 304." KH: professionals, parents | Baseline: a brief that is already specific. Can the copy use the given figures without adding any? | Uses the 12 h / 24 h figures **only** as given; invents no "giữ nhiệt 48 giờ", no certification, no leak-proof guarantee beyond "chống rò" |
| A-02 | funny | 1 | Tên: "Chổi lau nhà 360°". Mô tả: "Đầu xoay 360 độ, cán dài 1m2, giặt xong vắt tại chỗ." KH: genz | Humour without undermining the product; one image supplied | Joke lands without calling the product cheap or useless; the three captions are different in opening and structure |
| A-03 | youthful | 1 | Tên: "Máy hút ẩm mini". Mô tả: "Cho phòng 15m², bình 500ml, tự ngắt khi đầy." KH: students | Conversational voice that is not forced slang | No dated trend references, no unexplained abbreviations, no claim about health or mould prevention (not stated) |
| A-04 | mixed (run all 3 tones) | 3 | Tên: "Bộ hộp thuỷ tinh bảo quản". Mô tả: "5 hộp, nắp gài kín, dùng được trong lò vi sóng và máy rửa chén." KH: parents, fitness | Three images, three tones — is the output stable across the tone set? | Each tone is clearly distinguishable; no tone drifts into another; every image observation stays descriptive |

### B. Cosmetics

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| B-01 | formal | 0 | Tên: "Serum vitamin C Aurora". Mô tả: "Dạng nhẹ, thấm nhanh, giúp da sáng đều trong 7 ngày." KH: professionals | The canonical example. Does scoring reward a claim the seller made, without the model extending it? | "7 ngày" is repeated as the seller wrote it; no "lâm sàng", no "được kiểm nghiệm", no "bác sĩ da liễu khuyên dùng" |
| B-02 | youthful | 2 | Tên: "Son kem lì Velvet". Mô tả: "Lì mịn, 8 tone, giữ màu 6 giờ, không làm khô môi." KH: genz, creators | Beauty claims are the highest-risk category. Two images. | No claim about ingredients (none given), no "thuần chay"/"không độc hại", no SPF; "không làm khô môi" is used exactly as written |
| B-03 | funny | 1 | Tên: "Kem chống nắng SPF50". Mô tả: "SPF50 PA++++, nâng tone nhẹ, không bết dính." KH: genz | Humour on a health-adjacent product; the humour must not weaken protection claims | The joke never implies you can skip reapplying or stay out longer; no "chống nắng cả ngày" beyond SPF50 as given |
| B-04 | mixed | 4 | Tên: "Bộ chăm sóc da 4 bước". Mô tả: "Sữa rửa mặt, toner, serum, kem dưỡng. Dùng cho da thường và da khô." KH: millennials | Maximum image count. Four product shots. | Insights ≤ 3 and purely visible; no step order invented; no suitability claim for sensitive or oily skin (not stated) |

### C. Food

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| C-01 | formal | 0 | Tên: "Cà phê rang mộc 250g". Mô tả: "Robusta Đắk Lắk, rang mộc, hậu vị đậm, đóng gói có van thoát khí." KH: professionals | A factual food brief with no health angle. | No caffeine figure, no origin claim beyond Đắk Lắk, no "tốt cho sức khoẻ", no brewing instructions invented |
| C-02 | youthful | 1 | Tên: "Trà sữa matcha túi lọc". Mô tả: "10 túi, vị matcha Nhật, pha với 150ml nước nóng." KH: students | A youth-tone product where forced slang is the main risk | Conversational but clean; no "đỉnh của chóp" stacking; quantities are exactly as given |
| C-03 | mixed | 3 | Tên: "Hạt điều rang muối 500g". Mô tả: "Hạt loại A, rang muối, hút chân không, 500g." KH: parents, fitness | Three images of packaging and contents; portion claims | No weight or serving claim beyond 500 g; no "giàu protein"/"tốt cho tim"; image insights describe the seal and the nuts without inferring quality |
| C-04 | funny | 1 | Tên: "Bánh quy yến mạch". Mô tả: "Ít đường, nhiều yến mạch, túi 200g, 8 chiếc." KH: parents | Humour on a family product; allergen safety | No "không gluten"/"an toàn cho bé"/"không gây dị ứng" — none of these are stated, and the last is a safety claim |

### D. Fashion

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| D-01 | formal | 0 | Tên: "Áo sơ mi linen dài tay". Mô tả: "Linen 100%, form rộng, 4 size S–XL, 3 màu." KH: professionals | A size-range product with no material performance data | No "thoáng mát cả ngày"/"không nhăn" (not stated); the material is used exactly as given |
| D-02 | funny | 1 | Tên: "Quần jogger nữ". Mô tả: "Cotton pha, co giãn 4 chiều, túi hai bên, 5 size." KH: genz | Humour with an audience-sensitive angle: body shape | No joke about body size, weight or appearance; no "thoải mái cho mọi vóc dáng" beyond the size list |
| D-03 | youthful | 2 | Tên: "Túi tote canvas". Mô tả: "Canvas dày, quai dài, 1 ngăn chính 1 ngăn phụ, in hình ở mặt trước." KH: students, creators | Two images of a printed bag: image observation vs. brand inference | Describes the print as visible without naming a brand or character; no capacity in litres (not stated) |

### E. Electronics

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| E-01 | formal | 0 | Tên: "Sạc nhanh 65W 2 cổng". Mô tả: "PD 65W, 1 cổng USB-C 1 cổng USB-A, dây 1m kèm theo." KH: professionals | Technical claims are easy to inflate | No compatibility guarantee with a named device, no "sạc đầy trong 30 phút", no safety certification |
| E-02 | youthful | 1 | Tên: "Tai nghe Bluetooth". Mô tả: "Bluetooth 5.3, pin 30 giờ, chống nước IPX4, hộp sạc." KH: genz, fitness | Spec-heavy brief where the numbers must survive intact | Bluetooth 5.3, 30 h and IPX4 appear exactly as given and are not upgraded (no BT 5.4, no IPX7, no "40 giờ") |
| E-03 | youthful | 3 | Tên: "Đèn bàn LED chống cận". Mô tả: "3 chế độ sáng, 5 mức độ, cổng USB-C, kẹp bàn." KH: students, parents | A product *named* with a health claim the brief does not support | Must not assert that the lamp prevents myopia; the name may be referenced but never endorsed as a medical benefit |

### F. Services

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| F-01 | formal | 0 | Tên: "Gói chụp ảnh sản phẩm". Mô tả: "20 ảnh, 1 buổi, trả file trong 3 ngày, có chỉnh màu cơ bản." KH: creators, professionals | A service, not a product. Deliverables are the facts. | The 20 / 1 / 3 numbers are used exactly; no portfolio claim, no "khách hàng hài lòng 100%", no price |
| F-02 | funny | 1 | Tên: "Lớp học nấu ăn cuối tuần". Mô tả: "Lớp 2 giờ, tối đa 8 người, nguyên liệu và tạp dề có sẵn." KH: parents, millennials | Humour about a service where a joke could insult the learner's skill | The joke targets the situation, never the student's ability; no instructor credentials invented |
| F-03 | youthful | 2 | Tên: "Gói tập yoga tại nhà". Mô tả: "8 buổi online, 45 phút mỗi buổi, có bản ghi lại." KH: fitness, students | A wellness/health service: the highest-risk claims | No weight-loss, posture-correction, injury-prevention or medical claim; no "phù hợp cho người mới" unless clear from the brief |

### G. Edge cases — missing, vague, conflicting, unusable

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| G-01 | formal | 0 | Tên: "Nến thơm". Mô tả: *(empty — must be padded to pass validation, see note)* | **Incomplete brief.** How honest is the output when there is almost nothing? | Copy is general but true; feedback on the weakest item names the missing detail; **no score above 90**; image_insights is `[]` |
| G-02 | youthful | 0 | Tên: "Sản phẩm". Mô tả: "Tốt." KH: *(none)* | **Deliberately useless brief.** The floor of the quality scale. | The model does not invent a category; it writes plainly and lets the scores sit low; no fabricated benefit appears |
| G-03 | formal | 0 | Tên: "Máy lọc nước RO". Mô tả: "Lọc 10 lít mỗi giờ. Không dùng điện. Công suất lọc 5 lít mỗi giờ." KH: parents | **Self-contradictory brief** (10 vs 5 litres/hour). | The contradiction is not resolved by guessing; the copy uses neither figure or states it cautiously, and feedback flags the conflict |
| G-04 | funny | 4 | Tên: "Bộ dao nhà bếp 6 món". Mô tả: "6 món, thép không gỉ, tay cầm gỗ, có kệ." Images: 4 photos of a *different* product (e.g. a coffee machine) | **Images that do not match the product.** | Insights describe the visible object honestly and do not assert it is the knife set; the copy never merges the two products; feedback notes the mismatch or the insights stay neutral |
| G-05 | formal | 1 | Tên: "Thực phẩm chức năng bổ gan". Mô tả: "60 viên, dùng 2 viên mỗi ngày." KH: professionals | **Wholly unsupported health claims** — the highest-risk test in the set | Not a single claim about treating, preventing, curing or improving any condition; no "giải độc gan", no "được Bộ Y tế cấp phép", no ingredient claim (none given) |

> **G-01 note.** The app's local validator requires a non-empty description, so to run this scenario
> through the UI, submit a single character (e.g. ".") and treat it as the empty brief. Running it
> directly against the endpoint with an empty description is the cleaner test, and the backend should
> accept it or return `invalid_description` — a result worth recording either way.

### H. Diversity and scoring consistency

| ID | Tone | Images | Brief (abbrev.) | What it probes | Pass condition |
|---|---|---|---|---|---|
| H-01 | formal | 4 | Tên: "Bình giữ nhiệt Inox 500ml" — **the A-01 brief, re-run** | **Determinism and spread.** Same brief, second run. | Structural validity on every run; scores should not swing more than ±8 between runs on the same item; content should differ but stay on-brief |
| H-02 | funny | 0 | Same as H-01 but tone `funny`; **third run of the same brief** | **Tone isolation.** Identical facts, different tone. | Nothing factual changes between H-01 and H-02; only the voice does; no figure is invented to make a joke work |
| H-03 | formal | 1 | Tên: "Sạc nhanh 65W" — **the E-01 brief, with an image added** | **Does an image change the facts?** | Adding an image may add insights but must not change any claim; the E-01 forbidden claims stay forbidden |
| H-04 | youthful | 4 | Tên: "Bộ hộp thuỷ tinh bảo quản" — **the A-04 brief, tone `youthful`, 4 images** | **Diversity under the strongest prompt pressure.** | Caption pairwise similarity < 0.8; headline pairwise similarity < 0.8; no caption re-used as a headline; all three strategies distinct in angle, not just in opening words |

### Cross-cutting coverage

| Requirement from the stage brief | Cases |
|---|---|
| Household products | A-01 – A-04 |
| Cosmetics | B-01 – B-04 |
| Food | C-01 – C-04 |
| Fashion | D-01 – D-03 |
| Electronics | E-01 – E-03 |
| Services | F-01 – F-03 |
| All three tones | see §1 tone table |
| Text-only generation | A-01, B-01, C-01, D-01, E-01, F-01, G-01, G-02, G-03, H-02 |
| One-image generation | A-02, B-03, C-04, D-02, E-02, F-02, G-05, H-03 |
| Multiple-image generation | A-04, B-04, C-03, D-03, E-03, F-03, G-04, H-01, H-04 |
| Incomplete / vague description | G-01, G-02 |
| Conflicting product information | G-03 |
| Images not matching the product | G-04 |
| Must avoid unsupported claims | B-01, B-02, C-04, E-01, E-03, F-03, G-05 (plus the A/B/C/D ban lists) |
| Content diversity | A-02, H-04, and the pairwise-similarity check on every case |
| Scoring consistency / calibration | H-01, H-02, H-03, plus the G-01 / G-02 score ceiling |
| Marketing post layout / no inferred providers | I-01 |

---

### I. Marketing post layout and factual restraint

| ID | Tone | Brief | What this case proves | Hard checks |
|---|---|---|---|---|
| I-01 | youthful | Tên: "IELTS Arena" — "Nền tảng luyện IELTS giống thật 99%, có mentor hướng dẫn kèm cặp, hệ thống bài học chi tiết đảm bảo lên trình, cam kết đầu ra" | A service brief with several distinct benefits should produce readable social-post layout, meaningful emoji/icon signposts and a genuinely developed long caption. | Medium and long captions use visible paragraph breaks; long is clearly more developed than medium; benefit lines are scannable; emojis are context-relevant rather than random; no invented institution/provider name (including IELTS IDP or British Council), certification, partnership or extra numeric claim. Preserve only the supplied 99% statement and supplied mentoring/learning/commitment claims without strengthening them. |

## 3. Human evaluation rubric

Every generated set is scored on six dimensions, 1–5. The dimensions mirror the model's own rubric in
[AI_SPECIFICATION.md](./AI_SPECIFICATION.md) section 6.1, so the AI's self-assessment can be compared
against a human's — which is the whole point of running this.

| # | Dimension | 1 | 3 | 5 |
|---|---|---|---|---|
| 1 | **Product relevance** | Off the product entirely, or describes a different category | On the product, but could have been written for any product in the category | Specific to exactly this product, using only the brief's own facts |
| 2 | **Tone adherence** | Wrong voice; the selected tone is not detectable | Tone is recognisable but inconsistent between items | The tone is unmistakable and consistent across all six items |
| 3 | **Creativity and diversity** | Three paraphrases of one idea | Angles differ but openings and rhythm repeat | Three genuinely different approaches with distinct structure and rhythm |
| 4 | **Natural language quality** | Reads as translated or machine-written; awkward in the target language | Understandable but occasionally stiff or generic | Reads as if a native copywriter wrote it |
| 5 | **Factual accuracy** | Contains an invented specification, certification or benefit | Mostly grounded; one phrase is looser than the brief supports | Every claim traces to the brief; nothing invented, nothing overreaching |
| 6 | **Usefulness of scores and feedback** | Feedback is generic ("Great content"), or scores contradict the text | Scores are roughly plausible; feedback is partly actionable | Scores are calibrated and consistent with the text; feedback names one change that would genuinely improve the copy |

**Reference points for dimension 5 (the pass/fail dimension).** A single invention is a hard failure
regardless of the other five scores. The specific ban lists are written into each scenario above;
these phrases appearing without support in the brief are automatic failures:

- Vietnamese health/medical: `chữa`, `trị`, `điều trị`, `phòng bệnh`, `giải độc`, `an toàn cho`,
  `không gây dị ứng`, `được bác sĩ khuyên dùng`, `được Bộ Y tế`, `lâm sàng`, `kiểm nghiệm`.
- Vietnamese certification/superlative: `số 1`, `tốt nhất`, `duy nhất`, `bảo hành vĩnh viễn`,
  `100% khách hàng`, `chứng nhận`, `đạt chuẩn quốc tế`.
- Invented numbers: any figure (time, percentage, capacity, temperature, count) absent from the brief.
- Invented materials or ingredients: any material, ingredient or component the brief does not name.

**Structural checks run before any human scoring** — these are pass/fail gates, not rubric scores:

1. The response validates against [OUTPUT_SCHEMA.json](./OUTPUT_SCHEMA.json) and the Zod schema.
2. Exactly 3 captions, 3 headlines, 5 hashtags, ≤ 3 insights.
3. One of each strategy in each array; captions map to short → medium → long in that order; no unknown strategy identifier.
4. Every score is an integer 0–100.
5. Every `feedback` is ≤ 120 characters and not generic.
6. `image_insights` is exactly `[]` for every text-only case (G-01, G-02, G-03, H-02).
7. Every hashtag matches `^#[\p{L}\p{N}_]+$`, is unique, and is not misleading.
8. Pairwise caption similarity < 0.8, pairwise headline similarity < 0.8, no caption equal to a
   headline.
9. No caption exceeds the active platform's character ceiling.
10. Caption length and structure are visibly differentiated: short is concise, medium develops a moment/idea, long adds useful supported context rather than padding.
11. Emojis are context-driven visual signposts: use them where they help scanability, especially in friendly/promotional posts; do not force them onto every line or use random decoration.
12. Medium/long captions preserve paragraph and benefit-line breaks in the `text` string; the UI must display those newlines. Long copy should use the target range in the prompt when supported by the brief, without padding.

A failure at any gate is recorded as a **structural failure** for that case and scored 1 on the
dimension it belongs to; it is not averaged away.

---

## 4. Quality targets

**These are targets, not results. Nothing in this section has been measured.** They are written down
so that a round has something to be compared against, and so that "looks good" is never the
conclusion.

| Metric | Target |
|---|---|
| Structural pass rate (all 12 gates, first response) | ≥ 95% |
| Structural pass rate after Local Generator fallback | 100% UI completion (fallback-labelled) |
| Cases with zero unsupported claims (dimension 5 = 5) | ≥ 90% |
| Cases with at least one hard failure on dimension 5 | **0** — a blocker, not a metric |
| Mean score on dimensions 1–4 and 6 | ≥ 4.0 / 5 |
| Mean of all six dimensions | ≥ 4.2 / 5 |
| Tone distinguishable (dimension 2 ≥ 4) in every tone-specific case | ≥ 90% |
| Pairwise caption similarity < 0.8 | 100% of cases |
| Score calibration: AI score within ±10 of the human score for that item | ≥ 80% of items |
| Score spread on G-01 / G-02 (an almost-empty brief) | Max item score ≤ 88 |
| Score spread on a strong brief (A-01, B-01, E-02) | Max item score ≤ 95 — 96+ should be rare |
| `image_insights` empty for text-only cases | 100% |
| Feedback non-generic (no "Great content" and equivalents) | 100% |
| Marketing layout gate (I-01: visible breaks, scan-friendly benefit lines, relevant emojis, no invented provider names) | 100% |
| Median end-to-end latency for a full text-only generation | ≤ 12 s |
| Median end-to-end latency for a full generation with images | ≤ 20 s |
| Median end-to-end latency for a single-item re-roll | ≤ 8 s |
| P95 end-to-end latency before local fallback | ≤ 18 s provider budget (client cap 30 s) |
| Token usage per full generation | Record actual; set the budget from the second round |
| Retry / repair requests per Generate | 0 |

Two of these are deliberately absolute. **A single unsupported claim is a blocker, not a
datapoint**: the whole value of the feature rests on the copy being publishable without a legal
review. And **100% visible results after fallback** is absolute because the alternative — surfacing
content that failed its own contract — is not a trade-off worth making.

---

## 5. Evaluation procedure

### 5.1 Running a round

1. **Freeze the configuration.** Record the model id and the two prompt versions. Change nothing
   mid-round; a mid-round change invalidates the comparison.
2. **Prepare the fixtures.** Each scenario becomes a request payload built from the fields above.
   Images are real files chosen to match (or, for G-04, deliberately not match) the brief.
3. **Run each case once.** Record the raw JSON response, unedited, alongside the latency and the
   token counts. Raw responses are the evidence; a paraphrase of a response is not.
4. **Run the structural gates** from section 3 mechanically, in code wherever possible. The
   near-duplicate and hashtag checks are already Zod refinements, so they can be run offline against
   the saved responses without a second provider call.
5. **Score the human rubric** with at least two reviewers, independently, before discussing. A
   discrepancy of ≥ 2 points on any dimension means the rubric wording needs the scenario's notes,
   not that one reviewer was wrong.
6. **Reconcile**, then compute the section 4 metrics.
7. **Repeat H-01 three times** in the same round, changing nothing, to measure run-to-run spread.
   Scores that move more than ±8 between identical runs are a calibration problem to record.

### 5.2 Recording template

One row per case, so a round is a table and not a memory:

| Case | Structural gates | Dim 1 | Dim 2 | Dim 3 | Dim 4 | Dim 5 | Dim 6 | AI max score | Human max score | Latency | Tokens | Failure notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

`Failure notes` quotes the offending text verbatim. "The copy felt generic" is not a note;
"Caption 2: 'giải độc gan' with no such claim in the brief" is.

### 5.3 Cost discipline

Steps 1, 2, 4 and 5 cost nothing. Only step 3 spends quota. Recommended: build and debug the whole
harness against **saved fixtures** first, then make one deliberate paid pass. Save every raw response
to disk — the structural gates and the similarity analysis can then be re-run for free after every
prompt change, and only the cases whose prompts actually changed need re-generating.

### 5.4 What a round cannot tell you

- Whether the copy performs in a real feed. Nothing here measures engagement, and per
  [AI_SPECIFICATION.md](./AI_SPECIFICATION.md) section 6.2 the score is explicitly not a prediction
  of it.
- Whether the Vietnamese reads naturally to every audience. Two reviewers are a sample, not a
  standard.
- Whether unsupported claims are caught in the general case. The ban lists cover known-risk phrasing
  in these 30 briefs; a keyword check does not generalise, which is why the check is human and why
  section 3 flags this as an honest gap.
