# First Class Agency — Slide Design System

The visual standard established with the revamped `FC April Week 5.pptx` deck. Use this as the baseline for every future FC presentation.

## Aesthetic
Premium, cinematic, high-contrast. Dark navy backgrounds with radial blue glows, fine grid texture, grain, and edge vignettes. Big oversized display typography. Glass cards with colored top-edge accents. Generous use of glow, drop shadow, and tier-colored highlights. Gold reserved for top performers and record-breaking moments.

## Palette
- Ink: `#050810`
- FC Blue: `#0078ab`
- FC Blue Hi: `#00b8ff`
- Glow Blue: `#288cdc`
- Green: `#10b981` (Hi: `#4ade80`)
- Red: `#ef4444` (Hi: `#fca5a5`)
- Gold: `#fbbf24` (Hi: `#fde047`) — champions, RECORD HIGH only
- White: `#ffffff`, Off-white: `#e6edf3`, Dim: `#8c9eb8`

## Typography
- Display headlines: Inter Black (weight 900), 76–220pt
- Section headers: Inter Bold (700), 22–40pt
- Body / names: Inter SemiBold/Bold, 20–36pt
- Eyebrows / labels: Inter Bold/SemiBold all-caps with tracking +6 to +10
- Amounts: Inter Black, right-aligned, tabular

## Layout Rules
- Slide size: 10 × 5.625 in (16:9), rendered at 1920×1080
- Outer margin: 60px
- Header zone: ~170px tall — title + eyebrow + logo top-right with halo
- Footer: glowing horizontal brand bar at bottom + "BIG DREAMS. BIG ACTION. BIG RESULTS." tagline
- Cards: rounded 18–24px, glass fill `rgba(255,255,255,12)`, border `rgba(255,255,255,40)`
- Tier-coded top accent stripe (4px) with halo glow above each card
- Outer card glow color matches tier

## Slide Templates (see `design-system/slides/`)
1. **leaderboard_template.py** — 3-column tier system (GREEN/BLUE/RED). Row size scales inversely with tier count: bigger rows = higher tier. CHAMPION badge for #1 overall in gold.
2. **milestone_template.py** — Big hero headline, dramatic row table with rank, name, contextual badge, and right-aligned amount. Top row gets gold treatment if it's a record.
3. **agent_spotlight_template.py** — Editorial split: massive name + amount on left, agent graphic with glow/sparkles on right.

## How to Build a New Deck
1. Run `python3 design-system/bg_render.py` to regenerate backgrounds (or reuse).
2. Adapt the slide template scripts with new data (rows, names, amounts).
3. Run each slide script to render a 1920×1080 PNG into `assets/`.
4. Run `python3 design-system/build_pptx.py` to bundle into a `.pptx`.

## Tagline
Every slide ends with the FC tagline: **BIG DREAMS. BIG ACTION. BIG RESULTS.**
