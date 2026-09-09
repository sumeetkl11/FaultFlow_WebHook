---
name: no-ai-slop-ui
description: Use this skill whenever building, redesigning, or reviewing any UI, dashboard, landing page, admin panel, or web app — before writing any HTML/CSS/React/frontend code. It kills "AI slop" default aesthetics (purple neon glows, glassmorphism, oversized rounded corners, decorative card-soup grids, fake stats, generic icons) and replaces them with intentional, product-first, data-dense design. Also use when the user says a UI "looks AI-generated," "looks like a template," "looks generic," or asks for something to look "more human-designed," "more professional," or "less slop." Also covers purposeful motion/animation (transitions, hover states, loading states) so interfaces feel alive without being gimmicky. ALWAYS check this skill before frontend-design work — don't wait for the user to explicitly ask for "anti-slop" design.
---

# No AI Slop UI

A checklist-driven skill for producing UI that looks intentionally engineered rather than generated. Read this in full before writing frontend code, and re-check the "Audit Checklist" at the end before considering any UI done.

## The Core Diagnosis

"AI slop" UI is visual noise masquerading as polish. It reliably shows up as:

- Generic dark-mode-by-default dashboards
- Gratuitous 24–40px rounded corners on every surface
- Purple/indigo neon glow gradients (`#6366F1`, `#8B5CF6`) used as a decorative crutch
- Glassmorphism (`backdrop-filter: blur()`) over dark backgrounds, tanking contrast
- Low-contrast micro-text (11–12px gray-on-black) that fails WCAG
- Dense-looking layouts that convey almost zero real data ("card soup")
- Every metric = a big bold number + a vague label ("84% Efficiency") with no context
- Decorative icon-in-a-rounded-square next to a 3-word title next to 2 lines of filler
- Only the happy path is designed — no error states, no empty states, no truncation handling

None of this is "wrong" in isolation. It's slop because it's applied by default, decoratively, without being earned by the actual data or workflow.

## 1. Strip the AI Aesthetic Default Kit

- **No decorative neon glows.** If a glow/gradient doesn't encode meaning (status, urgency, brand accent used sparingly), cut it. Pick a palette from the product's actual domain — slate, deep navy, warm stone, muted olive — not generic SaaS-purple.
- **Kill blanket glassmorphism.** `backdrop-filter: blur()` stacked on dark backgrounds is a template tell and hurts readability. Use solid surfaces with distinct elevation via subtle border/shadow, not blur.
- **Tame border radii.** Enterprise/data-dense UI: 4–8px. Standard consumer cards: 10–12px. Reserve anything bigger (16px+) for a hero/marketing moment, not every card on a dashboard.
- **No low-contrast micro-text.** Body text should meet WCAG AA (4.5:1) at minimum. If a label needs to be small, it still needs to be legible — don't use size to hide a lack of hierarchy.

## 2. Design Around Real Data, Not Card Soup

Default AI-generated UI reaches for a 3-column grid of {icon, bold title, 2 lines of filler}. Replace it:

| Slop pattern | Do this instead |
|---|---|
| Grid of decorative explainer cards | A real data table/list: sortable, filterable, with actionable row states |
| Stat callout with no context ("248 events/min") | Metric + baseline/comparison + sparkline + time range |
| Abstract decorative SVG squiggles | Actual system/architecture diagrams, or just clean typography |
| Empty "hero" illustration panels | An immediate workspace, live preview, or task entry point |
| Fake activity feed showing "0" everywhere | Either seed with real/plausible data, or design a genuine, non-apologetic empty state |

If a component would show all-zero placeholder data in the first render a real user sees, that's a sign it's decoration, not function — redesign it as an empty state (see §4) instead of a "3 zeroes in cards" tableau.

## 3. Enforce a Strict Design Token System

- **Spacing:** lock to a 4px or 8px grid only (4, 8, 12, 16, 24, 32, 48). Reject any padding/gap that doesn't land on the scale.
- **Type scale:** max 4–5 sizes total in one view (e.g. 12 caption / 14 body / 16 section label / 20 header / 24 title). No one-off sizes.
- **Fonts:** boring and battle-tested — Inter, Geist, system-ui stack, JetBrains Mono for numeric/code — with real tabular figures for anything numeric (metrics, tables, timers). Avoid trendy geometric display fonts for body/data text.
- **Color:** define semantic tokens (success, warning, danger, info, neutral surfaces at 2–3 elevation levels) and use nothing outside that set. A UI with 6+ ad hoc colors is a slop tell.

## 4. Design the Whole State Space, Not Just the Happy Path

For every data-bearing component, explicitly design:
- **Empty state** — real guidance/action, not just "0" with celebratory copy
- **Loading state** — skeletons matching final layout, not a generic spinner
- **Error state** — an actual banner/inline message with a retry action, not a silent failure
- **Truncation/overflow** — long names, missing avatars, long numbers
- **Dense/full state** — what it looks like with 500 rows, not 3

Favor information density over decorative whitespace once there's real data — production tools need to show more than 2 records without scrolling forever.

## 5. Keyboard-First, Not Just Mouse-First

- Visible focus rings on every interactive element (never `outline: none` without a replacement)
- Logical tab order
- Shortcut badges where relevant (`⌘K`, `Esc`, `/` to search) — a detail AI templates almost universally skip
- Command palette / quick actions for power-user surfaces (dashboards, admin tools)

## 6. Motion: Purposeful, Not Decorative

Motion should communicate state change or hierarchy — never exist just to look "alive."

**Rules of thumb:**
- **Duration:** 120–200ms for micro-interactions (hover, toggle, button press), 200–350ms for layout/panel transitions, 400ms+ only for large, rare transitions (page-level, modal open). Anything slower reads as sluggish, not premium.
- **Easing:** use `ease-out` for things entering/appearing (feels responsive), `ease-in` for things leaving, `ease-in-out` for looping/ambient motion. Avoid linear easing for anything user-triggered — it feels robotic.
- **Hover/press states:** every clickable element needs a state change (subtle elevation, border, or background shift) — but keep the delta small (opacity 0.9→1, translateY(-1px), not a huge scale jump).
- **Loading:** skeleton screens > spinners for anything with a known final layout. Shimmer subtly, don't pulse aggressively.
- **Status/live indicators:** a small pulsing dot for "live"/"connected" is fine *once*, used consistently — don't scatter pulse animations across five unrelated elements, it reads as noise.
- **Page/section transitions:** fade + slight vertical offset (8–12px) on entry beats slide-ins from off-screen for most dashboard/app UI; reserve directional slides for things that spatially make sense (drawers, tabs, wizards).
- **Never animate for its own sake.** If removing an animation loses zero information, remove it. Reduced-motion users should get an equally functional (just static) experience — respect `prefers-reduced-motion`.
- **No glow pulsing on static content.** A card that isn't live/active/urgent should not glow, breathe, or shimmer. Reserve animated glow strictly for "this needs your attention right now" states.

## 7. Audit Checklist (run before calling any UI done)

- [ ] Any purple/indigo decorative glow that isn't encoding real status? → cut it
- [ ] Any `backdrop-filter: blur` stacked over dark bg reducing contrast? → replace with solid surface
- [ ] Any card whose content could be summarized in one row of a table? → make it a table
- [ ] Any stat shown with zero context (no baseline, no trend, no time range)? → add context or cut it
- [ ] Any spacing/padding value not on the 4/8px grid? → snap to grid
- [ ] More than 5 distinct font sizes in one view? → consolidate
- [ ] Any interactive element with no visible focus state? → add one
- [ ] Any component only designed for its happy path? → add empty/loading/error/overflow states
- [ ] Any animation running longer than ~350ms for a routine interaction? → shorten or cut
- [ ] Any element pulsing/glowing that isn't actually live or urgent? → make it static

## Applying This: Worked Example

Given a monitoring/ops dashboard with the classic slop markers — purple glow header, glassmorphism story-mode card explaining the product to the user *inside the product*, a 3-card "how it works" explainer row, four metric cards that all read `0`, and an event table with no rows — the fix pattern is:

1. **Cut the in-product marketing copy.** A "Story: How X Protects Your Business" narrative card belongs on a marketing site, not inside the tool the user already opened. Replace with a compact status/context bar.
2. **Collapse the 3-step explainer cards into a single line or a help tooltip.** Users who are already in the product don't need "1. Server Outage → 2. Data Absorbed → 3. Zero Lost" spelled out as three big cards every time they load the page.
3. **Redesign the all-zero metric cards as a real empty state**, or seed them with a tiny live-feeling number and a sparkline, with a clear "no activity yet" microcopy instead of implying the product is broken.
4. **Turn the event table's empty state into an action**, not just "No events found" — a subtle prompt to send a test event, matching the existing sandbox affordance but without needing a whole side panel dedicated to it.
5. **Kill the neon purple glow on the logo/header** and reserve color for actual status (HEALTHY green, RECONNECTING amber/red) — which this UI already does well; extend that discipline to the rest of the palette instead of layering purple gradients on top.
6. **Tighten radii** on the metric cards and nav pills — the current large rounding on every element flattens the hierarchy between primary actions (Send Test Order) and passive status pills (HEALTHY).
7. **Increase data density** in the transaction table region — right now it's mostly empty chrome around a "no events" message; a real table needs visible column structure and row states even while empty (e.g. a single grayed-out example row) so users understand the shape of data to expect.
