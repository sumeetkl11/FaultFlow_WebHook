# SKILL: High-Density Motion UI (SaaS/Enterprise)
**Goal:** Premium, snappy Vercel/Linear style motion. Zero slop.
**Stack:** `framer-motion` (layout/physics), `tailwindcss` (simple color/opacity fades).
**Core Rule:** 60fps constraint. Animate ONLY `transform` (x,y,scale) & `opacity`. NEVER animate `height/width/margin/padding`.

## Motion Dictionary & Snippets

### 1. Spring Drawer (Modals/Overlays)
*   **Config:** `transition={{ type: "spring", stiffness: 500, damping: 40 }}`
*   **Use:** Slide-over trace inspectors. Provides native, rigid snap. Zero floatiness.

### 2. SSE Data Drop (Table Rows)
*   **Config:** 
    `initial={{ opacity: 0, y: -10 }}`
    `animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}`
*   **Use:** New events entering `<AnimatePresence>`. 
*   **Requirement:** MUST use `<motion.tr layout>` so existing rows slide down without teleporting.

### 3. Tactile Press (Buttons/Interactive Rows)
*   **Config:** `whileTap={{ scale: 0.97 }}`
*   **Use:** Primary actions (Crash Server, Blast Traffic). Instant physical UI feedback.

### 4. State Crossfade (Badges)
*   **Config:** Tailwind class: `transition-colors duration-300 ease-in-out`
*   **Use:** Job status shifts (e.g., Amber `QUEUED` -> Emerald `DELIVERED`). No framer-motion needed.

### 5. Active Wait Pulse (System Indicators)
*   **Config:** `animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }}`
*   **Use:** 'SSE Active' connection dots or 'Retrying' states. Pulse opacity ONLY, never scale.

### 6. Number Ticker (Metrics)
*   **Config:** `useSpring` + `useTransform` linked to Zustand store.
*   **Use:** Top KPI stats (Rescued Payloads). Smooth count-up on bursts instead of instant jumps.