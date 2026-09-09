# Skill: Anti-Slop High-Density & Intentional Motion UI

## Philosophy
Design software for human operators, not Dribbble likes. Prioritize utility, data density, readable contrast, and purposeful, physics-driven micro-interactions over decorative trends.

---

## 1. Anti-Slop Negative Constraints (Strict Rules)
* **No Neon Glows:** Never use purple/cyan drop-shadow glows (`box-shadow: 0 0 25px rgba(...)`).
* **No Unnecessary Glassmorphism:** Avoid `backdrop-blur-xl` over dark backgrounds. Use flat, solid elevation layers (`bg-zinc-950` canvas, `bg-zinc-900` surface, `border-zinc-800` borders).
* **Tame Border Radii:** Cap corner radii at `4px` (`rounded`) or `6px` (`rounded-md`) for enterprise/tabular interfaces. Never use `rounded-2xl` or `rounded-3xl` on data cards.
* **No Decorative Terminals:** Never embed fake hacker terminal windows (`/dev/tty/...`) on main dashboard views. Place logs inside an on-demand slide-over drawer.
* **Kill "Card Soup":** Never split simple stats into 4 oversized, empty cards. Consolidate them into a single inline metric ribbon.
* **Legible Contrast:** No 10px–11px low-contrast gray text on dark backgrounds. All body labels must pass WCAG AA contrast against their immediate background.

---

## 2. Layout & Typography Rules
* **Spatial System:** Enforce a strict 4px/8px grid (`p-2`, `p-4`, `gap-2`, `gap-4`). No arbitrary paddings (`p-5`, `p-7`).
* **Strict Type Hierarchy:**
  * **Page Title:** 15px–16px (`text-sm font-semibold text-zinc-100`)
  * **Table Cells / Body:** 13px (`text-[13px] text-zinc-200`)
  * **Column Headers / Meta:** 11px Monospace Caps (`text-[11px] font-mono uppercase tracking-wider text-zinc-400`)
* **Numeric Data:** Always use `tabular-nums` and monospace fonts (`JetBrains Mono`, `Geist Mono`, or `ui-monospace`) for IDs, timestamps, latencies, and metrics.
* **Information Density:** Design for $\ge 25$ visible table rows above the fold. Keep row height tight (`py-1.5 px-3`).

---

## 3. Intentional Motion UI System
Motion must convey state changes, not visual flair. Never use bouncing, rotating, or long decorative animations.

* **Duration Budget:**
  * Micro-interactions (hover, press, toggle): $\le 120\text{ms}$
  * State transitions (badge changes, row additions): $\le 200\text{ms}$
  * Overlay panels (slide-over drawers, dialogs): $\le 250\text{ms}$
* **Performance Guarantee:** Animate *only* `transform` and `opacity`. Never animate `height`, `width`, `margin`, or `padding`.
* **Framer Motion Presets:**
  ```typescript
  // Instant, spring-based surface transition
  export const surfaceTransition = {
    type: "spring",
    stiffness: 500,
    damping: 35,
    mass: 0.8
  };

  // Row status delta transition
  export const rowVariants = {
    initial: { opacity: 0, y: -4 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
    exit: { opacity: 0, transition: { duration: 0.1 } }
  };