# Flow — AI-Native Canvas Workspace

## Design Specification v1.0

---

## 1. Product Overview

**Flow** is a canvas-based operating environment where files, browsers, terminals, agents, and web apps coexist on an infinite spatial canvas. It replaces the tab-switching, window-juggling paradigm with a single unified workspace where AI agents work alongside you — visible, context-aware, and always running.

**Platform:** Electron + React (desktop app, macOS/Windows/Linux)
**Agent Backend:** Orbiter framework (local Python process)
**Design Language:** Liquid Glass — inspired by Apple's iOS 26 / macOS Tahoe / visionOS 26

### Core Principles

1. **Spatial over sequential** — Everything lives on a canvas, not in tabs or windows
2. **Agents are peers, not tools** — They work beside you, not when summoned
3. **Context flows everywhere** — Every node on the canvas can feed into any agent
4. **Premium minimalism** — Liquid Glass aesthetic: translucent, fluid, layered depth
5. **Keyboard-first, mouse-friendly** — Spotlight command palette as primary interaction

---

## 2. Design Language: Liquid Glass

### 2.1 Material Properties

Flow's UI chrome is built from a single material:  **Frosted Glass** . Since true liquid glass refraction isn't achievable in web/Electron rendering, we use a layered frost blur system that creates depth, legibility, and premium feel through progressive blur intensities.

**Core technique — Progressive Frost Blur:**
Every glass element uses multiple layered blurs that intensify from edge to center, creating a "thick glass" depth effect. A semi-opaque tinted fill sits on top to guarantee text legibility. The combination of blur + fill + border produces a convincing frosted glass that works on any background.

```css
/* Base glass — all chrome elements */
.glass {
  background: rgba(20, 20, 24, 0.65);           /* Dark tinted fill for legibility */
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid rgba(255,255,255, 0.08);
  box-shadow:
    0 8px 32px rgba(0,0,0,0.25),                /* Drop shadow */
    inset 0 1px 0 rgba(255,255,255,0.06),        /* Top edge highlight */
    inset 0 -1px 0 rgba(0,0,0,0.10);            /* Bottom edge shadow */
}

/* Progressive blur — pseudo-element adds a second blur layer
   at wider radius creating a soft halo/feathered edge */
.glass::before {
  content: '';
  position: absolute; inset: -4px;
  background: rgba(20, 20, 24, 0.30);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: inherit;
  z-index: -1;
  mask-image: radial-gradient(ellipse, transparent 60%, black 100%);
  -webkit-mask-image: radial-gradient(ellipse, transparent 60%, black 100%);
  pointer-events: none;
}
```

**Why this works:**

* The inner `blur(24px)` frosts the immediate background
* The `::before` layer at `blur(40px)` with `-4px inset` creates a progressive halo — the blur is *stronger* at the edges, creating a feathered transition into the canvas
* The `mask-image` radial gradient makes the outer blur layer only visible at edges
* The dark tinted fill (`rgba(20,20,24, 0.65)`) ensures text contrast on any background
* No shimmer, no sweep, no specular — just clean, honest frosted glass

**Pill Containers — Frosted Glass Pills:** All floating UI groups (top bar, corner pills) use a pill shape with the frosted glass treatment. The progressive blur creates a soft glow around the pill that makes it feel like it's floating. The glass has subtle thickness via inset box-shadows (light top edge, dark bottom edge).

```css
.glass-pill {
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.70);
  backdrop-filter: blur(28px) saturate(1.5);
  border: 1px solid rgba(255,255,255, 0.08);
  box-shadow:
    0 8px 32px rgba(0,0,0,0.22),
    0 0 0 1px rgba(0,0,0,0.30),                 /* Outer ring for depth */
    inset 0 1px 0 rgba(255,255,255,0.08),
    inset 0 -1px 0 rgba(0,0,0,0.12);
  position: relative;
  overflow: visible;
}
/* Progressive blur halo around pill */
.glass-pill::before {
  content: '';
  position: absolute; inset: -6px;
  background: rgba(20, 20, 24, 0.20);
  backdrop-filter: blur(48px);
  border-radius: inherit;
  z-index: -1;
  pointer-events: none;
}
```

**Hierarchy Levels:**

| Level                      | Fill opacity | Blur (inner) | Blur (halo) | Use                                 |
| -------------------------- | ------------ | ------------ | ----------- | ----------------------------------- |
| Chrome (panels, bars)      | 0.65–0.70   | 24–28px     | 40–48px    | Top bar, side panels, spotlight     |
| Surface (cards, menus)     | 0.72–0.78   | 20px         | 36px        | Dropdowns, context menus, tooltips  |
| Elevated (modals, dialogs) | 0.80–0.85   | 32px         | 56px        | Onboarding, settings, confirmations |
| Node title bar             | 0.55–0.60   | 16px         | none        | Window title bars (when visible)    |

### 2.2 Color System

**Philosophy: Monochromatic by default.** The resting UI is entirely grayscale — whites, grays, and blacks. Color only appears as a *reaction* to user interaction: hover states bloom with subtle color, clicks ripple with accent hues, active agents pulse with their identity color, and notifications arrive with colored indicators. This creates a calm workspace that comes alive when you touch it.

**Dark Mode (default):**

```
── Monochrome Base (resting state) ──
--bg-canvas:        #0A0A0C
--bg-canvas-dot:    rgba(255,255,255,0.035)
--glass-bg:         rgba(255,255,255,0.10)
--glass-border:     rgba(255,255,255,0.12)
--glass-hover:      rgba(255,255,255,0.18)
--glass-active:     rgba(255,255,255,0.24)
--text-primary:     rgba(255,255,255,0.90)
--text-secondary:   rgba(255,255,255,0.48)
--text-tertiary:    rgba(255,255,255,0.28)
--node-bg:          #111113

── Interaction Colors (appear on hover/active/focus) ──
--accent-blue:      #0A84FF           // Primary action, links, send buttons
--accent-green:     #30D158           // Success, agent running
--accent-orange:    #FF9F0A           // Warnings, pending
--accent-red:       #FF453A           // Errors, destructive
--accent-purple:    #BF5AF2           // Agent identity
```

**Interaction color rules:**

* **Buttons at rest:** Icon is white at 48% opacity. No color.
* **Buttons on hover:** Icon brightens to 88%. A faint color bloom radiates from the icon center (e.g., blue glow for action buttons, green for agent-related). Implemented via a radial-gradient background or box-shadow with accent color at ~15% opacity.
* **Buttons on click:** Accent color flashes briefly (scale 0.94 + accent shadow), then fades back to monochrome.
* **Agent glyphs:** Monochrome circles at rest (white-on-gray), colored only when actively running.
* **Notifications:** Arrive with their status color (green dot for success), but the card itself is monochrome glass.
* **Focused node:** Border subtly tints toward accent-blue (from pure white border to blue-tinted white).
* **Quirky animation touches:**
  * Hover on a node title bar → a barely perceptible prismatic shimmer sweeps left-to-right (rainbow refraction)
  * Spotlight open → the search icon does a playful 360° rotation during entrance
  * Agent glyph click → the circle "pops" outward briefly (scale 1.3 → 1.0 spring)
  * Add element dropdown items → each item entrance is staggered by 30ms with a subtle slide-up
  * Notification dismiss → card tumbles slightly (rotate 2°) as it slides away
  * File drag from explorer → a ghost preview follows cursor with a trailing blur

**Light Mode:**

```
--bg-canvas:        #F2F2F7
--glass-bg:         rgba(255,255,255,0.55)
--glass-border:     rgba(0,0,0,0.06)
--text-primary:     rgba(0,0,0,0.85)
--text-secondary:   rgba(0,0,0,0.45)
```

### 2.3 Typography

```
--font-display:     "SF Pro Display", -apple-system, "Segoe UI", sans-serif
--font-body:        "SF Pro Text", -apple-system, "Segoe UI", sans-serif
--font-mono:        "SF Mono", "JetBrains Mono", "Fira Code", monospace

--text-xs:          11px / 1.4    // Labels, window IDs
--text-sm:          13px / 1.5    // Secondary text, metadata
--text-base:        15px / 1.55   // Body text, chat messages
--text-lg:          17px / 1.45   // Section titles
--text-xl:          22px / 1.3    // Panel titles
--text-2xl:         28px / 1.2    // Onboarding headings
```

### 2.4 Motion & Animation

All transitions follow Apple's spring-based easing:

```
--ease-spring:      cubic-bezier(0.22, 1, 0.36, 1)   // Primary (open, expand)
--ease-spring-snappy: cubic-bezier(0.34, 1.56, 0.64, 1) // Bouncy (buttons, toggles)
--ease-decel:       cubic-bezier(0, 0, 0.2, 1)        // Enter/appear
--ease-accel:       cubic-bezier(0.4, 0, 1, 1)        // Exit/disappear

--duration-instant: 100ms     // Hover states, toggles
--duration-fast:    200ms     // Menus, tooltips
--duration-normal:  350ms     // Panels, spotlight
--duration-slow:    500ms     // Page transitions, onboarding
```

**Animation principles:**

* Everything animates. No instant state changes.
* Panels slide + fade simultaneously (transform + opacity)
* Spotlight scales from 0.95 → 1.0 with blur entrance
* Menus grow from their trigger point (transform-origin)
* Notifications slide in from bottom-right, stack upward
* Agent glyphs pulse subtly when active (opacity oscillation)
* Window nodes scale 0.98 → 1.0 on focus with subtle shadow expansion

### 2.5 Iconography

**Primary Library: Lucide React** (`lucide-react` — MIT licensed)
Lucide is the maintained fork of Feather Icons with 1,500+ icons. It matches the SF Symbols aesthetic: consistent 24×24 viewbox, 1.5–2px strokes, rounded joins and caps, optically balanced.

**Why Lucide:**

* Closest open-source equivalent to SF Symbols weight and style
* Tree-shakeable — only bundle what you use
* React-native components with props for size, stroke-width, color
* Active maintenance, new icons monthly

**Rendering rules:**

* `stroke-width: 1.75` globally (thinner than Lucide default of 2, closer to SF Symbols light weight)
* `stroke-linecap: round` + `stroke-linejoin: round` (already Lucide default)
* Sizes: 18×18px standard, 14×14px compact (node chrome), 22×22px prominent (spotlight, onboarding)
* Color: inherits from parent `color` property (monochrome system)
* States: `opacity: 0.42` rest → `0.85` hover → `1.0` active/focused (all via `color` alpha)

**Complete icon mapping:**

| Location                       | Icon Name (Lucide)            | Usage                                  |
| ------------------------------ | ----------------------------- | -------------------------------------- |
| **Top Bar**              |                               |                                        |
| Add element                    | `Plus`                      | Opens add dropdown                     |
| File explorer                  | `FolderOpen`                | Toggles left panel                     |
| Agents                         | `Cpu`                       | Toggles agent dropdown + panel         |
| Save                           | `Download`                  | Save canvas state                      |
| Restore                        | `History`                   | Restore from snapshot                  |
| Settings                       | `SlidersHorizontal`         | Opens settings overlay                 |
| Notifications                  | `Bell`                      | Toggles notification panel             |
| **Top-Left**             |                               |                                        |
| Focus mode                     | `EyeOff`/`Eye`            | Toggle top bar. Morphs between the two |
| Docs                           | `BookOpen`                  | Opens documentation                    |
| **Bottom-Left**          |                               |                                        |
| Spotlight                      | `Search`                    | Opens command palette                  |
| **Add Dropdown**         |                               |                                        |
| Terminal                       | `TerminalSquare`            | New terminal session                   |
| Browser                        | `Globe`                     | New Chromium tab                       |
| File                           | `FileUp`                    | Open file picker                       |
| Web App                        | `AppWindow`                 | Configured web apps sub-menu           |
| Quick Note                     | `StickyNote`                | New sticky note                        |
| **Spotlight Results**    |                               |                                        |
| Quick action                   | `Zap`                       | Command/action items                   |
| Window result                  | (per type)                    | Matches node type icon                 |
| Agent result                   | `Cpu`                       | Agent suggestion rows                  |
| File result                    | `File`                      | Workspace file matches                 |
| Canvas result                  | `Layout`                    | Canvas switch results                  |
| **Node Chrome**          |                               |                                        |
| Window ID                      | (numeric text)                | Monospace badge, not an icon           |
| Browser back                   | `ChevronLeft`               | Navigation                             |
| Browser reload                 | `RotateCw`                  | Refresh page                           |
| Context menu                   | `MoreHorizontal`            | Three dots, horizontal                 |
| **Node Type Indicators** |                               |                                        |
| Terminal                       | `TerminalSquare`            | File explorer + spotlight              |
| Browser                        | `Globe`                     |                                        |
| Image file                     | `Image`                     |                                        |
| Code file                      | `FileCode`                  |                                        |
| Document (PDF/DOCX)            | `FileText`                  |                                        |
| Audio file                     | `Music`                     |                                        |
| Video file                     | `Video`                     |                                        |
| Spreadsheet                    | `Table`                     |                                        |
| Markdown                       | `FileType`                  |                                        |
| Unknown file                   | `File`                      |                                        |
| Quick note                     | `StickyNote`                |                                        |
| **Context Menu**         |                               |                                        |
| Run command                    | `Play`                      | Terminal: run command                  |
| Pipe to agent                  | `ArrowRightToLine`          | Send output to agent                   |
| Export log                     | `FileDown`                  | Terminal: save log                     |
| Clear                          | `Eraser`                    | Terminal: clear                        |
| Copy output                    | `ClipboardCopy`             | Copy last output                       |
| Search in node                 | `Search`                    | In-node find                           |
| Screenshot                     | `Camera`                    | Browser: capture page                  |
| Extract text                   | `FileText`                  | Browser: extract content               |
| Connect agent                  | `Cpu`                       | Browser: CDP connection                |
| Save as PDF                    | `FileDown`                  | Browser: save page                     |
| Copy URL                       | `Link`                      | Browser: clipboard                     |
| Open external                  | `ExternalLink`              | System browser/app                     |
| Edit in canvas                 | `Pencil`                    | File: enable editing                   |
| Convert format                 | `RefreshCw`                 | File: format conversion                |
| Send to agent                  | `MessageSquarePlus`         | Any: attach to agent                   |
| Delete file                    | `Trash2`                    | File: remove                           |
| Copy path                      | `Copy`                      | File: clipboard                        |
| Rename                         | `PenLine`                   | Any: rename node                       |
| Move to group                  | `FolderPlus`                | Any: group management                  |
| Duplicate                      | `CopyPlus`                  | Any: clone node                        |
| Close                          | `X`                         | Any: remove from canvas                |
| Summarize                      | `Sparkles`                  | Universal: AI summarize                |
| Compare                        | `GitCompareArrows`          | Universal: diff two nodes              |
| Pin                            | `Pin`                       | Universal: lock position               |
| Bookmark                       | `Bookmark`                  | Universal: quick access                |
| Link nodes                     | `Link2`                     | Universal: connect nodes               |
| **Agent Panel**          |                               |                                        |
| Settings (cog)                 | `SlidersHorizontal`         | iOS control center button              |
| Attach file                    | `Paperclip`                 | Input: attach file                     |
| Send                           | `ArrowUp`                   | Input: send message                    |
| Tool call                      | `Zap`                       | Inline tool call indicator             |
| Tool success                   | `Check`                     | Completed tool call                    |
| Tool error                     | `AlertCircle`               | Failed tool call                       |
| Tool running                   | (CSS spinner)                 | Animated border spinner                |
| Expand/collapse                | `ChevronDown`/`ChevronUp` | Tool call detail toggle                |
| **Node Badges**          |                               |                                        |
| Pinned                         | `Pin`                       | 14px, top-right of title bar           |
| Agent connected                | `Cpu`                       |                                        |
| Linked                         | `Link2`                     |                                        |
| Unsaved                        | `Pencil`                    |                                        |
| Bookmarked                     | `Bookmark`                  |                                        |
| **Notification**         |                               |                                        |
| Agent status dot               | (CSS circle)                  | Colored dot, not an icon               |
| View results                   | `ArrowRight`                | Primary action                         |
| Dismiss                        | `X`                         | Secondary action                       |
| **Selection Bar**        |                               |                                        |
| Agent picker                   | `Cpu`                       | Dropdown trigger                       |
| Send to agent                  | `Send`                      | Primary action                         |
| Group                          | `Group`                     | Create group                           |
| Close all                      | `XCircle`                   | Destructive action                     |
| Clear selection                | `X`                         | Dismiss bar                            |

**Icon animation guide:**

* `Search` (spotlight trigger): 360° rotation on hover (0.6s)
* `Plus` (add): 90° rotation on hover (0.25s) — becomes an ×
* `Cpu` (agents): gentle bounce on hover (translateY -3px)
* `Eye`↔`EyeOff`: crossfade morph (opacity swap, 0.2s)
* `ChevronDown`↔`ChevronUp`: 180° rotation (0.2s)
* `Pin`: slight tilt (-15°) when pinned
* All others: no icon-specific animation, just the standard opacity transition

**Fallback:** If Lucide doesn't have a needed icon, custom SVGs follow the same grid: 24×24 viewbox, 1.75px stroke, round caps/joins, centered optical weight.

**Secondary Library: Phosphor Icons** (`@phosphor-icons/react`)
For cases where Lucide lacks a specific glyph — particularly for file-type indicators, brand-adjacent symbols, and duotone variants. Phosphor offers six weights (thin, light, regular, bold, fill, duotone) and 9,000+ icons. When mixing:

* Use Lucide for all UI chrome (buttons, menus, panels) — these must be visually consistent
* Use Phosphor only for supplementary or decorative icons (file type badges in explorer, onboarding illustrations, empty states)
* Always match stroke weight: Phosphor "light" (1.5px) is closest to our Lucide config (1.75px)

**Custom Flow Icons** (4 total, shipped as SVGs):
These icons don't exist in any library because they represent Flow-specific concepts:

| Name                  | Description                                                                | Usage                                               |
| --------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| `flow-canvas`       | Overlapping rounded rectangles with a dot grid behind them                 | Canvas switching, onboarding, about screen          |
| `flow-agent-beam`   | A small circle (agent) with a radiating dashed line toward a square (node) | Agent-to-node connection indicator, tool call beams |
| `flow-multi-select` | Two overlapping rectangles with a plus badge                               | Selection bar, multi-select hint tooltips           |
| `flow-spotlight`    | A circle with radiating lines and a search glass overlay                   | Onboarding spotlight step, keyboard shortcut hints  |

Custom icons follow the same 24×24 grid, 1.75px stroke, and ship as `.svg` files in `src/assets/icons/`.

### 15.36 Error Recovery & Undo Stack

**Problem:** The user accidentally closes a node, deletes a file, or an agent makes a bad change.
**Solution:** Flow maintains a deep undo stack (100 operations) for all canvas-level actions:

* Node create/close/move/resize
* Group/ungroup
* File rename/delete (moves to `~/.Trash` / trash bin, not permanent)
* Agent inline edits (accept/reject individually, or undo-all)

`⌘ Z` walks backward, `⌘ ⇧ Z` walks forward. Undo history persists across auto-saves (stored alongside canvas state). A "History" panel (accessible via Spotlight `history:`) shows a timestamped list of all actions — click any entry to revert to that point.

For agent errors specifically: if an agent writes to a file or executes a terminal command that causes an error, the notification card shows a prominent "Undo Agent Action" button that reverts the specific change without affecting other canvas state.

### 15.37 Model Usage & Token Awareness

**Problem:** Users have no idea how much AI usage their agents are consuming.
**Solution:** A small token counter appears in the agent panel header, next to the agent name:

```
research-agent  ·  2.4K tokens this session
```

* Tracks input + output tokens per agent per canvas session
* Click the counter → expands to show a breakdown: tokens per conversation, per tool call, estimated cost (based on model pricing the user configures in settings)
* When an agent approaches a high-token conversation (>50K tokens), a subtle amber indicator appears and the agent panel shows a hint: "Long conversation — consider starting fresh for better results"
* Monthly usage summary available in Settings → Data → "Usage"

### 15.38 Accessibility

**Keyboard-only operation:** Every feature in Flow is accessible without a mouse (§11 covers this). Additionally:

* **Screen reader support:** All interactive elements have `aria-label` attributes. Node types announced as "Terminal window 1", "Image file, architecture.png, window 3". Tool call cards announce status changes.
* **Reduced motion:** Respects `prefers-reduced-motion` OS setting. When active: all spring animations become instant, no bounces, no rotation on icon hover, no materialization effects. Panels still slide but with a simple 200ms ease.
* **High contrast mode:** Toggle in Settings → Appearance. Increases border opacity to `0.20`, text opacity to `1.0`, frosted glass fill becomes more opaque (`0.88`). Focus ring becomes 3px solid white.
* **Minimum touch targets:** All interactive elements are ≥36×36px (exceeds WCAG 2.5.8 minimum of 24×24)
* **Color independence:** The monochromatic-by-default design means no information is conveyed through color alone. Agent states use both color AND text labels ("running", "idle", "error"). Node badges use icons, not just colors.

### 15.39 OS Integration

**System tray / Menu bar:**

* Flow lives in the system tray (Windows/Linux) or menu bar (macOS) when the window is closed
* Click the tray icon → shows: current canvas name, running agents with status, "Open Flow", "Quick Note" (creates a note without opening the full window)
* Global hotkey: `Super + Alt + Space` opens Spotlight even when Flow is in the background — type a command, hit Enter, Flow executes it without bringing the window to front

**File associations:**

* Flow registers as a handler for common file types (optional, off by default)
* When enabled: double-clicking a `.py`, `.md`, `.json`, etc. in Finder/Explorer opens it as a file node on the current canvas
* Drag files from Finder/Explorer directly onto the Flow window → creates file nodes

**Deep links:**

* `flow://canvas/project-alpha` opens Flow and switches to that canvas
* `flow://agent/research-agent?prompt=find+papers+on+RLHF` opens Flow and runs the agent
* Useful for automation, Raycast/Alfred integration, and cross-app workflows

### 15.40 Agent Corrections & Learning

**Problem:** You tell an agent to do something, it does it wrong, you correct it — but it makes the same mistake next time.
**Solution:** Per-agent "Corrections" memory:

* When a user follows an agent response with a correction ("No, I meant..." / "That's wrong, actually..."), Flow detects the correction pattern
* The agent panel shows a small "Save as correction" button
* Clicking it adds the correction to the agent's persistent instruction set (stored per-agent, per-user)
* Corrections are injected into the agent's system prompt on future runs: `[User corrections: 1. Always use pytest, not unittest. 2. Prefer async over sync patterns.]`
* Manage corrections in agent settings: view, edit, delete individual corrections

This is not fine-tuning — it's just prompt augmentation. But it creates the illusion of an agent that learns from you.

### 15.41 Workflow Chains

**Problem:** You keep doing the same multi-step agent interaction: "search for X, then summarize, then write a report."
**Solution:** Spotlight supports chaining with `>>`:

```
@research-agent find papers on RLHF >> @code-agent write a summary >> a: file
```

This means: run research-agent with the prompt, pipe its output to code-agent as input, then create a file node from the final output. Each step runs sequentially. Progress shows as a multi-step notification:

```
┌─────────────────────────────────────────┐
│ ◉ Workflow (3 steps)          running   │
│                                         │
│ ✓ Step 1: research-agent      2.1s     │
│ ⚡ Step 2: code-agent         running   │
│ ○ Step 3: Create file node    pending   │
└─────────────────────────────────────────┘
```

Saved workflows: after running a chain, the notification offers "Save as workflow" → gives it a name → available in Spotlight as `run: [workflow name]`.

### 15.42 Drop Zone Hints

When dragging anything (file from explorer, node, external file from OS), valid drop targets subtly illuminate:

* Agent panel input area gets a faint blue border pulse
* Terminal nodes show a brief "Drop to paste path" tooltip
* Canvas shows a faint "+" cursor
* Invalid targets show no change

The hints only appear during drag operations — zero visual noise at rest.

### 15.43 Conversation Branching

In the agent panel, any agent message can be "branched" — click the `GitBranch` icon (Lucide) that appears on hover next to an agent message. This creates a new conversation starting from that point, preserving all prior context but letting you explore a different direction. The conversations list shows branches as indented children of the original conversation. Useful when an agent is heading in the wrong direction and you want to try a different prompt without losing the good work.

### 15.44 Node Lock

Beyond pinning (which prevents accidental moves), `⌘ L` on a focused node **locks** it — the node becomes read-only. Terminal stops accepting input, code files can't be edited, browser navigation is frozen. A small `Lock` (Lucide) badge appears on the title bar. Useful when you want to preserve a terminal output or a specific browser state as a reference while working. `⌘ L` again unlocks.

### 15.45 Hover Timestamps

When hovering over any node's title bar for more than 800ms, a small tooltip appears showing:

* When the node was created: "Created 2h ago"
* Last modified: "Modified 14m ago"
* For terminals: "Session started 45m ago"
* For browsers: "Last navigated 8m ago"

Uses Lucide `Clock` icon (14px) inline with the text. No click required — pure passive information.

### 15.46 Canvas Comments Thread

`⌘ ⇧ C` on a focused node opens a small comment thread attached to that node — a floating mini-panel (240px wide) anchored to the node's right edge. Users can leave timestamped notes for themselves: "TODO: fix this after the API changes", "Agent suggested X but I think Y is better". Comments are searchable in Spotlight and persist across sessions. Different from Quick Notes (which are standalone canvas objects) — comments are *attached* to specific nodes.

### 15.47 Performance Indicator

A tiny (barely visible) FPS counter lives in the bottom-right corner, just above the notification area. Shows a colored dot:

* Green (no label): >50fps, everything smooth
* Amber + "slow": 30–50fps, some jank
* Red + "laggy": <30fps, performance issues

Clicking the dot opens a lightweight performance panel showing: node count, terminal sessions running, browser nodes active, memory usage, Orbiter process status. Helps users understand when they have too many nodes open.

### 15.48 Smart Terminal Titles

Terminal nodes auto-detect and update their title based on what's running:

* If you `ssh user@server`, title becomes `user@server`
* If you `cd ~/projects/orbiter`, title becomes `~/projects/orbiter`
* If a long-running process is active (`python train.py`), title shows `python train.py (running)`
* Falls back to just "terminal" when idle at prompt

Detection works by parsing the terminal's window title escape sequence (which most shells emit automatically with the right PS1 config). No magic — just reading what the shell already broadcasts.

### 15.49 Node Thumbnail Strip

When there are more than 8 nodes on the canvas, a thin horizontal strip (32px tall) can appear at the very bottom of the viewport (toggle with `⌘ ⇧ T`). It shows miniature thumbnails of every node, ordered by window ID. Click a thumbnail to pan to that node. Hovering a thumbnail shows the node's title as a tooltip. This is a faster alternative to the minimap for quickly jumping between nodes.

### 15.50 Paste Routing

When you press `⌘ V` with nothing focused, Flow intelligently routes the paste:

* Clipboard contains text → creates a Quick Note node
* Clipboard contains an image → creates an image file node
* Clipboard contains a URL → creates a browser node
* Clipboard contains a file reference → creates a file node

When a specific node IS focused, paste goes directly into that node (terminal, code editor, etc.) as normal. This means `⌘ V` always does the right thing regardless of context.

---

---

## 3. Application Shell Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [TL]                    [TOP BAR]                           [TR] │ ← Floating, z-index: 1000
│                                                                  │
│                                                                  │
│ [LE]              INFINITE CANVAS                          [RE]  │ ← z-index: 0
│ (File                                                   (Agent   │
│  Explorer)              (nodes live here)                 Panel)  │ ← Collapsible, z-index: 500
│                                                                  │
│                                                                  │
│ [BL]                                                       [BR]  │ ← Floating, z-index: 1000
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Top-Left Corner — Focus Controls

**Container:** Pill shape, Liquid Glass material, horizontal layout
**Position:** Fixed, 16px from top-left corner
**Contents (left to right):**

| # | Icon               | Action                                 | Tooltip         |
| - | ------------------ | -------------------------------------- | --------------- |
| 1 | `EyeOff`/`Eye` | Toggle top bar visibility (focus mode) | "Focus Mode"    |
| 2 | `BookOpen`       | Open docs/guides in default browser    | "Documentation" |

**Behavior:**

* When focus mode is active, the top bar slides up with `transform: translateY(-100%)` over 350ms
* The top-left pill remains visible (it's the only way to restore the bar)
* Icon 1 morphs between `EyeOff` ↔ `Eye` with a crossfade

### 3.2 Top Bar — Primary Toolbar

**Container:** Pill shape, Liquid Glass material, centered horizontally
**Position:** Fixed, 16px from top, horizontally centered
**Height:** 44px
**Max-width:** Adaptive to content, min 600px

**Contents (left to right):**

| #  | Icon           | Label  | Action                                                     |
| -- | -------------- | ------ | ---------------------------------------------------------- |
| 1  | `Plus`       | —     | **Add Elements**dropdown (see §3.2.1)               |
| 2  | `FolderOpen` | —     | **File Explorer**toggle (left panel)                 |
| 3  | `Bot`        | —     | **Agents Menu**dropdown + panel toggle (see §3.2.2) |
| — |                | `│` | Vertical divider (1px, glass-border color, 24px tall)      |
| 4  | `Save`       | —     | **Save**canvas state                                 |
| 5  | `RotateCcw`  | —     | **Restore**canvas from saved state                   |
| 6  | `Settings`   | —     | **Settings**(opens full settings view)               |
| 7  | `Bell`       | —     | **Notifications**panel toggle                        |
| 8  | *(avatar)*   | —     | **User menu**dropdown (see §3.2.3)                  |

**Visual details:**

* Each button is 36×36px with 8px padding, `border-radius: 10px`
* Hover: glass-hover background + icon opacity 0.88
* Active/pressed: glass-active background + scale(0.95) spring animation
* Divider has `opacity: 0.3` and 8px horizontal margin
* Notification bell shows a small red dot (6px) when there are unread notifications

#### 3.2.1 Add Elements Dropdown

**Trigger:** Click `Plus` icon
**Position:** Below trigger, aligned left
**Container:** Liquid Glass surface, `border-radius: 14px`, padding 6px

| Icon          | Label    | Description                           | Shortcut |
| ------------- | -------- | ------------------------------------- | -------- |
| `Terminal`  | Terminal | New terminal session                  | `⌘ T` |
| `Globe`     | Browser  | Chromium browser tab                  | `⌘ B` |
| `File`      | File     | Open file picker → drops onto canvas | `⌘ O` |
| `AppWindow` | Web App  | Select from configured apps           | `⌘ W` |

**Web App sub-menu (on hover/click "Web App"):**

* Shows list of user-configured web apps
* Default suggestions: ChatGPT, Notion, Figma, Linear, GitHub, Gmail, Slack, Discord
* "Configure Apps..." option at bottom opens settings
* Web apps open as browser nodes with locked URL (no address bar editing)

Each menu item: 36px height, icon 18px, text `--text-sm`, hover state with `glass-hover`

#### 3.2.2 Agents Menu Dropdown

**Trigger:** Click `Bot` icon
**Position:** Below trigger, aligned center
**Container:** Liquid Glass surface, width 280px

**Contents:**

* **Header row:** "Agents" title + "See All →" link (opens full agent library view)
* **Agent list:** Scrollable, max 5 visible
  * Each row: Agent icon (colored circle with initial) + Name + Status indicator
  * Status: 🟢 Running | ⚪ Idle | 🟡 Waiting
  * Click agent → opens that agent in right side panel
* **Divider**
* **"+ Custom Agent"** button → opens agent creation flow
* **"Open Agent Panel →"** button → toggles right side panel

#### 3.2.3 User Menu Dropdown

**Trigger:** Click user avatar
**Avatar:** 28×28px circle, Liquid Glass border, shows user initial if no photo
**Position:** Below trigger, aligned right

| Icon        | Label      | Action                   |
| ----------- | ---------- | ------------------------ |
| `User`    | Profile    | View/edit user info      |
| `Palette` | Appearance | Light/Dark/System toggle |
| —          | divider    | —                       |
| `LogOut`  | Sign Out   | Confirm + sign out       |

### 3.3 Bottom-Left Corner — Spotlight Trigger + Active Agents

**Container:** Pill shape, Liquid Glass material
**Position:** Fixed, 16px from bottom-left corner

**Contents (left to right):**

| # | Element               | Description                                                       |
| - | --------------------- | ----------------------------------------------------------------- |
| 1 | `Search`icon button | Opens Spotlight (§4)                                             |
| 2 | Agent glyphs          | Small (20×20px) colored circles for each active background agent |

**Agent glyphs:**

* Each glyph is a circle with the agent's assigned color
* Contains the first letter of the agent name
* Subtle pulse animation (opacity 0.7 → 1.0, 2s cycle) when agent is actively working
* Click glyph → opens that agent's notification/output panel
* Hover → tooltip with agent name + current task summary
* Max 5 visible, "+N" overflow indicator if more

### 3.4 Bottom-Right Corner — Notifications

**Position:** Fixed, 16px from bottom-right corner
**Layout:** Notifications stack upward from this anchor point

*(Detailed notification spec in §6)*

### 3.5 Left Side Panel — File Explorer

**Trigger:** File Explorer button in top bar OR `⌘ ⇧ E`
**Position:** Left edge, below top bar, full height minus margins
**Width:** 280px (resizable, min 220px, max 400px)
**Container:** Liquid Glass material, `border-radius: 14px` on right side
**Default state:** Collapsed/hidden

**Layout:**

```
┌─────────────────────┐
│ FILES          [×]   │  ← Header + close button
│ [search input      ] │  ← Filter files
├─────────────────────┤
│ 📁 Documents        │
│   📄 report.md      │  ← Draggable to canvas
│   📄 data.csv       │
│ 📁 Projects         │
│   📁 orbiter/       │
│     📄 main.py      │
│ 📁 Downloads        │
│   🖼️ photo.png      │
└─────────────────────┘
```

**Behavior:**

* VS Code-style tree view with expand/collapse
* Files are **draggable** — drag onto canvas to create a file node
* Right-click context menu: Open, Rename, Delete, Copy Path
* Watches the user's configured workspace directory (default: `~/Flow/`)
* File icons are color-coded by type (blue=code, green=data, purple=media, gray=other)
* Search input filters in real-time with fuzzy matching

**Entry animation:** Slides in from left edge, 350ms spring easing, with backdrop blur fade-in

### 3.6 Right Side Panel — Agent Chat

**Trigger:** "Open Agent Panel" from agents menu, clicking agent from dropdown, or `⌘ ⇧ A`
**Position:** Right edge, full height minus margins
**Width:** 380px (resizable, min 320px, max 520px)
**Container:** Liquid Glass material, `border-radius: 14px` on left side
**Default state:** Collapsed/hidden

**Layout:**

```
┌──────────────────────────────┐
│ [Agent ▾]    [Convos] [⚙️]   │  ← Tab bar (squircle tabs)
├──────────────────────────────┤
│                              │
│  Chat messages area          │
│  (scrollable)                │
│                              │
│  Agent: "I found 3 results   │
│  matching your query..."     │
│                              │
│  User: "Focus on the first   │
│  two"                        │
│                              │
├──────────────────────────────┤
│ [📎] [Type a message...  ][↑]│  ← Input bar
└──────────────────────────────┘
```

**Pill Tab Bar (top of panel):**

* **Shape:** The entire tab row is a single pill container (`border-radius: 999px`) with Liquid Glass material, sitting inside the panel with 10px margin on all sides. Tabs inside the pill are segments — the active tab has a slightly brighter glass fill that slides between positions (animated, 300ms spring).
* **Left segment — Active Agent:**
  * Shows current agent name + colored dot (dot is monochrome at rest, agent color when running)
  * Click → dropdown to switch between available agents
  * Each agent has its own conversation context scoped to the current canvas
* **Right segment — Conversations:**
  * Lists all conversations with the active agent on this canvas
  * Each conversation shows: title (auto-generated or manual), date, preview
  * Click conversation → loads it in the chat area
  * Different canvases have independent conversation histories

**Settings button — iOS Control Center style:**

* **Shape:** A standalone rounded square / squircle button (44×44px, `border-radius: 12px`), positioned at the top-right of the panel header, outside the pill tab bar
* **Material:** Same Liquid Glass as other controls — frosted, refractive
* **Icon:** Sliders/tune icon (`SlidersHorizontal` from Lucide), monochrome at rest
* **Interaction:** On hover, the icon subtly rotates 15° and a faint gear-tooth pattern blooms behind it (like the iOS control center module background). On click, the settings panel slides in from the right edge, pushing the chat view out (a lateral page transition, not an overlay).
* **Inspired by:** The square module buttons in iOS Control Center (brightness, volume, screen mirroring) — each is an independent tactile square with its own glass surface

**Input Bar (bottom of panel):**

* Text input with placeholder "Message [agent name]..."
* 📎 button for file attachment (opens file picker, supports drag-drop)
* Send button (arrow-up icon, accent-blue when input has text)
* Supports multiline (Shift+Enter for newline, Enter to send)
* Supports commands (same as Spotlight commands, prefixed with `/`)

**Note:** This is the **secondary** way to interact with agents. The **primary** way is Spotlight (§4).

---

## 4. Spotlight — Primary Command Interface

### 4.1 Overview

Spotlight is the central nervous system of Flow. It's a floating command palette that handles search, navigation, element creation, web search, and — most importantly — agent interaction.

**Trigger:** `Super + Alt + Space` (global) or click search icon in bottom-left
**Position:** Centered on screen, vertically offset ~30% from top
**Container:** Liquid Glass elevated material, `border-radius: 18px`, width 640px

### 4.2 Layout

```
┌──────────────────────────────────────────────────────┐
│  🔍 [                                            ]   │  ← Input field
├──────────────────────────────────────────────────────┤
│  ⭐ Quick Actions                                    │  ← Section header
│    📋  Paste clipboard as node          ⌘⇧V          │
│    📸  Screenshot region to canvas      ⌘⇧S          │
│    🔄  Refresh all browsers             ⌘⇧R          │
│                                                      │
│  🪟  Open Windows                                    │  ← Active canvas nodes
│    [1] terminal — ~/projects/orbiter                 │
│    [2] browser — github.com                          │
│    [3] report.md                                     │
│                                                      │
│  🤖 Agents                                           │  ← Available agents
│    ◉ research-agent (running)                        │
│    ○ code-agent (idle)                               │
└──────────────────────────────────────────────────────┘
```

### 4.3 Command Grammar

All commands use a short prefix followed by a colon and the query:

| Prefix     | Function                                               | Example                                 |
| ---------- | ------------------------------------------------------ | --------------------------------------- |
| *(none)* | Global fuzzy search (windows, files, agents, actions)  | `report`                              |
| `w:`     | **Go to Window**— jump to node by ID or title   | `w: 3`or `w: terminal`              |
| `fw:`    | **Find Window**— search open canvas nodes       | `fw: terminal`                        |
| `fc:`    | **Find Canvas**— switch to another canvas       | `fc: project-alpha`                   |
| `a:`     | **Add Element**— create node on canvas          | `a: terminal`                         |
| `goog:`  | **Google Search**— opens result in browser node | `goog: liquid glass CSS`              |
| `yt:`    | **YouTube Search**                               | `yt: orbiter framework demo`          |
| `rdt:`   | **Reddit Search**                                | `rdt: best AI frameworks 2026`        |
| `twt:`   | **Twitter/X Search**                             | `twt: #aiagents`                      |
| `gh:`    | **GitHub Search**                                | `gh: multi-agent framework`           |
| `so:`    | **StackOverflow Search**                         | `so: electron IPC best practices`     |
| `@`      | **Agent Command**— invoke agent by name         | `@research-agent find papers on RLHF` |

**`w:` command behavior:**

* `w: 3` → instantly pans canvas to center window #3 and focuses it
* `w: term` → fuzzy matches against all window titles, shows matching nodes
* If single match, jumps immediately on Enter
* Canvas animates smoothly to the target node (300ms spring pan + zoom-to-fit)

### 4.4 Agent Interaction via Spotlight

This is the **primary** way users interact with agents.

**Flow:**

1. User opens Spotlight
2. Types agent name (fuzzy matched), e.g., `rese` → suggestion shows `@research-agent`
3. Presses Enter or Tab to select → input transforms to: `@research-agent ▍`
4. Types the prompt: `@research-agent find recent papers on multi-agent coordination`
5. Presses Enter
6. Spotlight closes
7. A persistent notification appears in bottom-right (§6) showing agent progress
8. Agent runs in background via Orbiter
9. When complete, notification updates with summary + "View Results" action

**Agent suggestions:**

* When user starts typing, matching agents appear in suggestions with their status
* Active agents show at top with current task preview
* Recently used agents are prioritized

### 4.5 Suggestions Engine

As user types, suggestions update in real-time (debounced 100ms):

**Priority order:**

1. **Exact command match** (if input starts with a known prefix)
2. **Open windows** matching the query
3. **Agents** matching the query (with status indicators)
4. **Recent actions** matching the query
5. **Files** from workspace matching the query
6. **Available canvases** matching the query
7. **Quick actions** relevant to current context

Each suggestion row: 40px height, icon + label + secondary text + shortcut badge
Keyboard navigation: ↑↓ to select, Enter to execute, Esc to close
Mouse: hover highlights, click executes

### 4.6 Visual Details

**Entrance animation:**

1. Backdrop dims (canvas darkens to 60% opacity, 200ms)
2. Spotlight container scales from 0.95 → 1.0 + opacity 0 → 1 (300ms spring)
3. Input field auto-focuses

**Exit animation:**

1. Spotlight scales 1.0 → 0.97 + opacity 1 → 0 (200ms decel)
2. Backdrop clears (200ms)

**Input field styling:**

* No visible border — just the glass material
* Search icon (🔍) on left, 18px, secondary text color
* Text: `--text-lg`, `--font-body`
* Placeholder: "Search, add, or ask an agent..." in `--text-tertiary`

---

## 5. Canvas & Nodes

### 5.1 Canvas Behavior

**Infinite Canvas:**

* Pan: Middle-click drag, or Space + left-click drag, or trackpad two-finger scroll
* Zoom: `⌘ +` / `⌘ -` / `⌘ 0` (reset) / trackpad pinch / scroll wheel with Ctrl
* Zoom range: 25% → 200%
* Background: Subtle dot grid (`--bg-canvas-dot` color, 24px spacing), fades out below 50% zoom
* No minimap (per spec — doesn't make sense for a workspace canvas)

**Node Placement:**

* New nodes appear at canvas center (or where the user last interacted)
* Nodes are freely draggable with momentum/inertia
* Nodes can overlap (z-order is most-recently-focused on top)
* No forced grid snapping, but optional snap-to-grid with `⌘ ⇧ G` toggle
* Grouping: Select multiple nodes → right-click → "Group" (creates a labeled container)

**Auto-save:**

* Canvas state auto-saves every 30 seconds
* Manual save via top bar button or `⌘ S`
* Session titles are auto-generated from content but user-editable

### 5.2 Node Anatomy (Universal)

Every node on the canvas shares this structure:

```
┌─────────────────────────────────────────┐
│ [ID]  [◀ 🔄]  Title              [···] │  ← Title bar (32px, Liquid Glass node material)
├─────────────────────────────────────────┤
│                                         │
│           Node Content Area             │  ← Type-specific rendering
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

**Title bar layout (left to right):**

* **Window ID:** Integer badge, monospace `--text-xs`, muted background pill (e.g., `[1]`, `[2]`)
  * Starts at 1, auto-increments/decrements as nodes are added/removed
  * Used in Spotlight `fw:` command for quick jumping
* **Navigation buttons (browser nodes only):** Back `◀` and Reload `🔄`, 24×24px
* **Title:** Truncated with ellipsis, `--text-sm`, `--font-body`
  * Files → filename (e.g., `report.md`)
  * Terminal → `terminal`
  * Browser → domain name (e.g., `github.com`)
  * Web Apps → app name (e.g., `Notion`)
* **Context menu trigger:** `···` (three dots), 24×24px, right-aligned

**Visual treatment:**

* Title bar uses Node-level Liquid Glass (subtlest, `opacity: 0.08-0.12`)
* Content area has a solid dark background (`#111113`) for readability
* Border: 1px `--glass-border`, `border-radius: 12px` (outer), 0px (inner content)
* Subtle shadow: `0 4px 16px rgba(0, 0, 0, 0.2)`
* Resize handle: bottom-right corner, subtle grip dots

**Focus state:**

* Focused node: brighter border (`--glass-hover`), slightly larger shadow
* Animation: 200ms spring transition on focus change

### 5.3 Node Context Menu

**Trigger:** Right-click anywhere on node, or click `···` in title bar (visible on hover)
**Container:** Frosted Glass surface, `border-radius: 12px`, progressive blur halo
**Entrance:** Scale 0.97 → 1.0 + opacity fade, 200ms spring, origin at cursor position

#### 5.3.1 Terminal Context Menu

| Icon           | Label                   | Shortcut | Notes                                                        |
| -------------- | ----------------------- | -------- | ------------------------------------------------------------ |
| `Play`       | Run command...          | —       | Opens inline input — types and executes a command           |
| `ArrowRight` | Pipe output to agent... | —       | Sub-menu: lists agents. Sends last command output as context |
| `FileText`   | Export session log      | —       | Saves full terminal history as `.txt`file node on canvas   |
| `Eraser`     | Clear terminal          | `⌘ K` | Clears scrollback, keeps session alive                       |
| —             | *divider*             | —       | —                                                           |
| `Copy`       | Copy last output        | —       | Copies the output of the most recent command                 |
| `Search`     | Search in terminal      | `⌘ F` | Activates inline search bar                                  |
| —             | *divider*             | —       | —                                                           |
| `Edit3`      | Rename window           | `F2`   | —                                                           |
| `FolderPlus` | Move to group...        | —       | Sub-menu: existing groups + "New Group"                      |
| `Copy`       | Duplicate               | `⌘ D` | Creates new terminal with same cwd                           |
| `X`          | Close                   | `⌘ W` | Kills tmux session + removes node                            |

**"Pipe output to agent" behavior:**

* Captures the last command + its full stdout/stderr
* Opens agent panel with selected agent active
* Pre-fills: `[Terminal #1 output attached — 42 lines from 'pytest -q']`
* Agent receives the terminal output as context in its next prompt

#### 5.3.2 Browser Context Menu

| Icon             | Label                  | Shortcut | Notes                                                                 |
| ---------------- | ---------------------- | -------- | --------------------------------------------------------------------- |
| `Camera`       | Screenshot page        | —       | Full-page screenshot → creates image file node on canvas             |
| `FileText`     | Extract page text      | —       | Extracts visible text content → creates text file node               |
| `Bot`          | Connect agent via CDP  | —       | Sub-menu: lists agents. Gives selected agent the CDP URL for this tab |
| `FileDown`     | Save as PDF            | —       | Saves current page as PDF → creates file node                        |
| —               | *divider*            | —       | —                                                                    |
| `Link`         | Copy URL               | —       | Copies current URL to clipboard                                       |
| `ExternalLink` | Open in system browser | —       | Opens the URL in the user's default browser                           |
| `RotateCcw`    | Reload                 | `⌘ R` | —                                                                    |
| —               | *divider*            | —       | —                                                                    |
| `Edit3`        | Rename window          | `F2`   | —                                                                    |
| `FolderPlus`   | Move to group...       | —       | —                                                                    |
| `Copy`         | Duplicate              | `⌘ D` | Opens same URL in new browser node                                    |
| `X`            | Close                  | `⌘ W` | —                                                                    |

**"Connect agent via CDP" behavior:**

* Selects an agent from the sub-menu
* Passes the CDP WebSocket URL (`ws://localhost:[port]`) to the agent
* Agent can now use Playwright MCP to navigate, click, fill forms, scrape
* A small `🤖` badge appears on the browser node's title bar while an agent is connected
* Agent actions are visible in the browser in real-time (user sees pages navigating)

#### 5.3.3 File Context Menu

| Icon              | Label               | Shortcut | Notes                                                                |
| ----------------- | ------------------- | -------- | -------------------------------------------------------------------- |
| `ExternalLink`  | Open in default app | —       | Opens with system default (Preview, VS Code, etc.)                   |
| `Pencil`        | Edit in canvas      | —       | Enables inline editing (Monaco for code, rich editor for docs)       |
| `RefreshCw`     | Convert format...   | —       | Sub-menu: available conversions (e.g., MD→PDF, CSV→XLSX, PNG→JPG) |
| `MessageSquare` | Send to agent...    | —       | Sub-menu: lists agents. Attaches file content as context             |
| —                | *divider*         | —       | —                                                                   |
| `Download`      | Save as...          | —       | Save copy to filesystem                                              |
| `Copy`          | Copy path           | —       | Copies absolute file path                                            |
| `Trash2`        | Delete file         | —       | Confirm dialog → deletes from workspace + removes node              |
| —                | *divider*         | —       | —                                                                   |
| `Edit3`         | Rename              | `F2`   | Renames both the node title and the actual file                      |
| `FolderPlus`    | Move to group...    | —       | —                                                                   |
| `Copy`          | Duplicate           | `⌘ D` | Copies file + creates new node                                       |
| `X`             | Close               | `⌘ W` | Removes node from canvas (file persists in workspace)                |

**"Send to agent" behavior per file type:**

* **Code/text:** Full file content injected as context
* **Images:** Sent as base64 if LLM supports vision, otherwise agent is told the file path
* **PDFs/Docs:** Extracted text content sent as context
* **Audio/Video:** Agent receives file path + metadata (duration, format, size)

#### 5.3.4 Web App Context Menu

| Icon           | Label                 | Shortcut | Notes                  |
| -------------- | --------------------- | -------- | ---------------------- |
| `Camera`     | Screenshot            | —       | → file node on canvas |
| `Bot`        | Connect agent via CDP | —       | Same as browser        |
| —             | *divider*           | —       | —                     |
| `Edit3`      | Rename window         | `F2`   | —                     |
| `FolderPlus` | Move to group...      | —       | —                     |
| `X`          | Close                 | `⌘ W` | —                     |

#### 5.3.5 Universal Context Menu Items

These appear at the bottom of every node's context menu:

| Icon           | Label                   | Notes                                                   |
| -------------- | ----------------------- | ------------------------------------------------------- |
| `Sparkles`   | Summarize with agent... | Agent generates a summary of the node's content         |
| `GitCompare` | Compare with...         | Selects another node → agent compares both contents    |
| `Pin`        | Pin to canvas           | Prevents accidental moves. Pinned nodes show a small 📌 |
| `Bookmark`   | Bookmark                | Adds to a quick-access bookmarks list in Spotlight      |

### 5.4 Node Types — Detailed Rendering

**All nodes are resizable by default.** Drag any edge or corner to resize. Minimum sizes vary by type. Nodes use generous default sizes to show content clearly.

#### 5.4.1 File Nodes — Chromeless Design

**Key principle:** File nodes have NO visible border, title bar, or window chrome in their resting state. The file content renders directly on the canvas as if it's "placed" there — like a photo on a desk or a document pinned to a wall. Chrome only appears on hover, and clicking opens a fullscreen lightbox view.

**Resting state (no hover):**

* Content renders directly: image as thumbnail, code with syntax highlighting, document preview
* No border, no title bar, no window ID badge
* Subtle shadow only: `0 2px 12px rgba(0,0,0,0.15)` for depth
* `border-radius: 8px` with overflow hidden
* Cursor: `pointer`

**Hover state:**

* A frosted glass title bar fades in at the top (200ms ease)
* Shows: Window ID badge + filename + `···` menu button
* A subtle 1px border appears (`rgba(255,255,255,0.08)`)
* Resize handles become visible at corners/edges

**Click → Fullscreen Lightbox:**

* Node content expands to fill the viewport with a 48px margin on all sides
* Dark overlay behind (`rgba(0,0,0,0.85)`, blur: 8px on the canvas)
* Content renders at full resolution / full document view
* **Bottom info bar:** Frosted glass pill at the bottom center, showing:

  ```
  ┌──────────────────────────────────────────────────┐│  📄 report.md  ·  12.4 KB  ·  Modified 2h ago  [×] │└──────────────────────────────────────────────────┘
  ```

  * Filename, file size, last modified time
  * Close button `[×]` on the right
* **Exit:** Press `Esc`, click the `[×]` button, or click the dark overlay
* **Transition:** Node position → fullscreen: 350ms spring scale + position animation

**File type rendering:**

**Images** (png, jpg, gif, webp, svg):

* Resting: Resizable thumbnail, default 360×360px (maintains aspect ratio)
* Fullscreen: Full resolution, centered, zoomable with scroll wheel

**Documents** (pdf, docx, xlsx, pptx):

* Resting: First page preview, default 480×640px
* Fullscreen: Full document viewer with page navigation, editing support
* PDFs: `pdf.js` renderer
* DOCX: mammoth.js render
* XLSX: spreadsheet grid, editable cells

**Audio** (mp3, wav, ogg, flac):

* Resting: Compact waveform card (320×100px), album art if available
* Play/pause on click (doesn't go fullscreen)
* Fullscreen (via context menu): expanded player with full waveform, scrubbing, EQ visualization

**Video** (mp4, webm, mov):

* Resting: Video thumbnail with play button overlay, default 560×315px (16:9)
* Single click: starts/pauses playback inline
* Double click: fullscreen lightbox with full controls

**Code/Text** (py, js, ts, md, txt, json, yaml, toml, etc.):

* Resting: Syntax-highlighted preview (Monaco, read-only), default 560×400px
* Fullscreen: Full Monaco editor, editable, with save support
* Line numbers, no minimap, word wrap on

**Markdown** (md):

* Resting: Rendered markdown preview (not raw source), default 520×400px
* Fullscreen: Split view — rendered left, source right (toggleable)

**Unknown files:**

* Resting: Large file-type icon + filename + size, 200×160px
* Click: opens "Open in default app" dialog

#### 5.4.2 Terminal Nodes

* **Always has title bar** (terminals need chrome for usability)
* **Backend:** Each terminal node is a tmux session (or node-pty session)
* **Renderer:** xterm.js with WebGL renderer
* **Default size:** 680×440px (generous — shows ~30 lines)
* **Shell:** User's default shell (detected from `$SHELL`)
* **Resizable:** Min 320×200px, no max
* **Features:**
  * Full terminal emulation (colors, cursor, scrollback)
  * Scrollback: 10,000 lines
  * Font: `--font-mono`, 13px
  * Copy/paste: standard OS shortcuts
  * Search within terminal: `⌘ F`
* **Context awareness:** Orbiter agents can read terminal input/output across the session

#### 5.4.3 Browser Nodes

* **Always has title bar**
* **Backend:** Chromium via Electron's `<webview>` or BrowserView
* **Default size:** 800×560px (generous — usable viewport)
* **Resizable:** Min 400×300px, no max
* **Title bar extras:** Back button `◀` + Reload button `🔄`
* **Title:** Shows domain name only (e.g., `github.com`)
* **URL bar:** None visible (URL shown in title bar as domain only)
  * For new browser nodes, opens with a minimal start page showing a URL input
  * Once navigated, URL editing is only via Spotlight `goog:` commands or the start page
* **Context awareness:** Each browser node exposes a CDP (Chrome DevTools Protocol) URL
  * Agents can connect via Playwright MCP using the CDP URL
  * Enables browser-use agents (navigation, form filling, scraping)
  * CDP URL is unique per browser node tab
  * When agent is connected: small `🤖` badge on title bar

#### 5.4.4 Web App Nodes

* **Always has title bar** (minimal — just app name)
* **Default size:** 800×560px
* **Same as browser nodes** but with restrictions:
  * URL is locked to the configured app URL (no address bar, no navigation)
  * Title shows the app name, not the domain
  * No back/reload buttons in title bar
  * Cannot change URL (links that would navigate away open in a new browser node)
* **Default apps (pre-configured, user can add more):**
  * ChatGPT, Claude, Notion, Figma, Linear, GitHub, Gmail, Google Docs, Slack, Discord
* **Configuration (in Settings):**
  * Name, URL, Icon (auto-fetched favicon or custom), Category

---

## 6. Notification System

### 6.1 Notification Anatomy

**Position:** Stack upward from bottom-right corner (16px margin)
**Max visible:** 3 notifications stacked, older ones collapse into a count badge
**Container:** Liquid Glass surface, `border-radius: 14px`, width 340px

```
┌────────────────────────────────────────┐
│ ◉ research-agent              2m ago  │  ← Agent icon + name + timestamp
│                                        │
│ Found 3 papers on multi-agent          │  ← Summary text (2 lines max)
│ coordination. Most cited: "Swarm..."   │
│                                        │
│ [View Results]  [Dismiss]              │  ← Action buttons
└────────────────────────────────────────┘
```

### 6.2 Notification Types

**Agent notifications (persistent):**

* Created when an agent is spawned via Spotlight
* Shows: agent name, current status, progress summary
* Updates in-place as agent works (text changes, no new notification)
* States: Running (pulsing accent-green dot) → Complete (static green) → Error (red)
* "View Results" → opens agent panel with results
* Persists until dismissed or agent output is viewed

**System notifications (transient):**

* Auto-save confirmation, canvas restored, file downloaded
* Auto-dismiss after 5 seconds
* No action buttons (or single "Undo" where applicable)

**Artifact notifications (transient → persistent):**

* When an agent generates a file or the browser downloads something
* Shows: filename + type + preview thumbnail
* Auto-creates a file node on the canvas
* "Jump to Node" action button → pans canvas to the new node

### 6.3 Animation

* **Enter:** Slide up from below viewport + fade in (350ms spring)
* **Stack:** Existing notifications slide up to make room (250ms spring)
* **Dismiss:** Slide right + fade out (200ms decel)
* **Collapse:** When >3, older notifications shrink to 8px height pills, showing count

---

## 7. Agent ↔ Canvas Integration

### 7.1 Context Awareness Architecture

```
┌─────────────────────────────────┐
│         Orbiter Runtime          │  ← Python process (local)
│  ┌───────────┐  ┌────────────┐  │
│  │  Agent 1   │  │  Agent 2   │  │
│  │ (research) │  │ (code)     │  │
│  └─────┬─────┘  └─────┬──────┘  │
│        │               │         │
│  ┌─────┴───────────────┴─────┐  │
│  │     Canvas Context API     │  │  ← Exposes canvas state to agents
│  └────────────┬──────────────┘  │
└───────────────┼──────────────────┘
                │ IPC (Electron)
┌───────────────┼──────────────────┐
│  ┌────────────┴──────────────┐   │
│  │    Canvas State Manager    │   │  ← React/Electron
│  │  • All nodes + metadata    │   │
│  │  • Active agents           │   │
│  │  • User workspace files    │   │
│  │  • Terminal sessions       │   │
│  │  • Browser CDP URLs        │   │
│  └───────────────────────────┘   │
│           Flow App (Electron)     │
└──────────────────────────────────┘
```

**What agents can see:**

* List of all canvas nodes (type, title, window ID, position)
* File contents (for file nodes)
* Terminal session history (input + output per terminal node)
* Browser CDP URLs (for browser-use / Playwright MCP integration)
* Other agents' status and recent outputs
* User's workspace file tree

### 7.2 Hint Agent

A special lightweight agent runs continuously using a cheap/small model (e.g., Gemini Flash, Haiku):

* Periodically (every 60s or on significant canvas changes) reviews canvas state
* Generates contextual hints/suggestions via notifications
* Examples:
  * "You have terminal output with errors in window #2. Want me to debug?"
  * "The report in window #4 references data that might be in your workspace"
  * "You've had the same 3 browser tabs open for 30 minutes — need a summary?"
* Hints appear as subtle, dismissible notifications (lower visual priority)
* User can disable hints globally or mute per-session

### 7.3 Artifact Auto-Surfacing

When any agent generates output files:

1. File is saved to `~/Flow/artifacts/[agent-name]/[timestamp]/`
2. A file node is automatically created on the canvas near the user's viewport
3. A notification appears linking to the new node
4. The node animates in with a subtle "materialization" effect (scale 0 → 1 + blur clears)

Similarly, browser downloads:

1. File saved to `~/Flow/downloads/`
2. Node created on canvas
3. Notification shown

---

## 8. Tool Call UI — How Agent Work Appears

### 8.1 Overview

When an agent runs (via Spotlight `@agent` command or agent panel chat), its tool calls and reasoning are shown **both** in the agent panel (inline in chat) **and** as subtle canvas indicators. This dual approach means the user gets detail when they want it (panel) and ambient awareness when they don't (canvas).

### 8.2 Inline Tool Calls (Agent Panel)

Tool calls appear in the agent chat as collapsible cards between the agent's text messages:

```
┌──────────────────────────────────────┐
│  Agent: "Let me search for that..."  │  ← Normal agent text message
├──────────────────────────────────────┤
│  ⚡ web_search("multi-agent RLHF")  │  ← Tool call card (collapsed)
│     ✓ 3 results · 1.2s              │     Status line
├──────────────────────────────────────┤
│  ⚡ read_file("/tmp/paper.pdf")     │  ← Another tool call
│     ✓ 24 pages extracted · 0.8s     │
├──────────────────────────────────────┤
│  Agent: "I found 3 relevant papers.  │  ← Agent continues
│  Here are the summaries..."          │
└──────────────────────────────────────┘
```

**Tool call card anatomy:**

```
┌─────────────────────────────────────────┐
│ ⚡ tool_name("arg_preview...")    [▾]   │  ← Header: icon + name + args preview + expand toggle
│    ✓ Summary · Duration                  │  ← Status line (only when collapsed)
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ Input:                                   │  ← Expanded view (hidden by default)
│   { "query": "multi-agent RLHF" }       │     Shows full input JSON
│ Output:                                  │
│   [3 search results...]                  │     Shows truncated output
│                                    [Copy]│     Copy raw output button
└─────────────────────────────────────────┘
```

**Visual styling:**

* Background: `rgba(255,255,255, 0.03)` — barely visible, almost flat
* Left border: 2px solid, color based on status:
  * Running: `--text-tertiary` (monochrome, pulsing opacity)
  * Success: `--accent-green` (appears after completion)
  * Error: `--accent-red`
* Font: `--font-mono` for tool name and args, `--text-sm` size
* ⚡ icon: monochrome at rest, green on success, red on error
* Collapsed by default — click `[▾]` to expand and see full input/output
* Multiple sequential tool calls stack tightly (4px gap)

**Streaming behavior:**

* Tool call card appears as soon as the LLM emits a tool_use block
* Status shows "Running..." with a subtle spinner (monochrome)
* When tool returns, status updates to "✓ [summary] · [duration]"
* If tool errors, shows "✗ [error message]" in red

### 8.3 Canvas Tool Call Indicators

When an agent is running tool calls, the agent glyph in the bottom-left corner shows subtle activity. Additionally:

**Agent activity beam:**

* A thin line (1px, `--text-tertiary` at 30% opacity) connects the active agent glyph to any canvas node the agent is currently interacting with
* Example: if agent calls `read_file` on window #3, a brief beam pulses between the agent glyph and window #3
* Duration: visible for 600ms, then fades out (200ms)
* Only shown for tool calls that reference specific canvas nodes

**Node interaction flash:**

* When an agent reads/writes a canvas node (terminal command, browser navigation, file read), the target node's border briefly flashes (opacity 0 → 0.3 → 0, 400ms) with a subtle glow
* This creates an ambient "the agent just touched that" awareness without interrupting

**Browser node agent actions:**

* When an agent is connected to a browser node via CDP and performing actions:
  * The `🤖` badge on the browser title bar pulses
  * Agent's navigation/clicks are visible in the browser in real-time
  * A small floating label appears briefly showing the action: "Navigating to...", "Clicking...", "Extracting text..."
  * Label uses frosted glass pill styling, positioned just below the browser's title bar
  * Auto-dismisses after 2 seconds

### 8.4 Tool Call Notifications

For agents running via Spotlight (background execution), tool calls update the persistent notification card:

```
┌────────────────────────────────────────┐
│ ◉ research-agent              running  │
│                                        │
│ ⚡ web_search (3/3 done)              │  ← Compact tool call progress
│ ⚡ read_file (running...)              │
│                                        │
│ 4 tools called · 12s elapsed           │  ← Summary footer
└────────────────────────────────────────┘
```

---

## 9. Canvas Operations

### 9.1 Multi-Canvas Support

* Users can have multiple canvases (like workspaces/desktops)
* Switch via Spotlight: `fc: [canvas name]`
* Each canvas has independent:
  * Node layout and state
  * Agent conversation history
  * Auto-save snapshots
* Canvas list shown in Settings and via Spotlight `fc:` prefix

### 8.2 Save & Restore

**Auto-save:** Every 30 seconds, saves full canvas state:

* Node positions, sizes, z-order
* Node content state (terminal scrollback, browser URLs, file edit state)
* Active agents and their state
* Panel open/closed states

**Manual save:** `⌘ S` or Save button → creates named snapshot
**Restore:** Restore button → shows list of snapshots (auto + manual) with timestamps
**Data format:** JSON, stored in `~/Flow/canvases/[canvas-id]/`

### 8.3 Node Grouping

* Select multiple nodes: click + drag selection box, or Shift+click
* Right-click → "Group" → creates a named container
* Group has a subtle border and label
* Grouped nodes move together when the group is dragged
* Ungroup via context menu
* Groups can be collapsed (hides children, shows only group label pill)

---

## 9. Settings

**Access:** Settings button in top bar
**View:** Full-screen overlay (not a modal — replaces canvas view)
**Layout:** Left sidebar navigation + right content area

### 9.1 Settings Sections

| Section              | Contents                                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| **General**    | Canvas name, default workspace directory, auto-save interval, startup canvas |
| **Appearance** | Theme (Dark/Light/System), accent color, zoom level, dot grid toggle         |
| **Agents**     | Agent library, create/edit/delete agents, default model, API keys            |
| **Web Apps**   | Add/edit/remove web app configurations                                       |
| **Keyboard**   | Shortcut customization, Spotlight trigger key                                |
| **Orbiter**    | Orbiter runtime status, Python path, model provider configs                  |
| **Data**       | Export/import canvases, clear cache, storage usage                           |
| **About**      | Version, licenses, links                                                     |

---

## 11. Keyboard Shortcuts & Navigation

### 11.1 Keyboard Navigation System

Flow is keyboard-first. Every element is reachable without a mouse. The navigation model has three layers:  **Canvas navigation** ,  **Node focus** , and  **Panel focus** .

**Focus ring:** The currently focused element shows a 2px ring (`rgba(255,255,255, 0.25)`, `border-radius` matching the element). No color — monochrome ring only. Animates in with 150ms ease.

**Navigation layers:**

| Layer       | When active          | How to enter                            | How to exit              |
| ----------- | -------------------- | --------------------------------------- | ------------------------ |
| Canvas      | Default state        | `Esc`from any panel/node              | —                       |
| Node focus  | A node is selected   | Click node,`Tab`, or `1-9`          | `Esc`→ back to canvas |
| Panel focus | A side panel is open | `⌘⇧E`/`⌘⇧A`or `Tab`into panel | `Esc`→ back to canvas |

**Canvas layer shortcuts:**

| Shortcut                   | Action                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `Tab`                    | Cycle focus to next node (by window ID: 1 → 2 → 3 → ...) |
| `Shift + Tab`            | Cycle focus to previous node                                |
| `1`–`9`               | Jump focus directly to node by window ID                    |
| `Arrow keys`             | Pan canvas (40px per press, smooth)                         |
| `Shift + Arrow keys`     | Pan canvas fast (120px per press)                           |
| `⌘ +`/`⌘ -`/`⌘ 0` | Zoom in / out / reset to 100%                               |
| `Space + drag`           | Pan canvas freely                                           |
| `⌘ A`                   | Select all nodes                                            |

**Node focus shortcuts (when a node is focused):**

| Shortcut                          | Action                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `Enter`                         | Activate node (enter editing: type in terminal, interact with browser, fullscreen file) |
| `Esc`                           | Deactivate node → back to node focus. Second `Esc`→ back to canvas                  |
| `F2`                            | Rename focused node                                                                     |
| `⌘ W`                          | Close focused node                                                                      |
| `⌘ D`                          | Duplicate focused node                                                                  |
| `Delete`/`Backspace`          | Close focused node (with confirm if node has unsaved state)                             |
| `Arrow keys`                    | Move focused node on canvas (10px per press)                                            |
| `Shift + Arrow keys`            | Move focused node fast (40px per press)                                                 |
| `⌘ Enter`                      | Open node's context menu                                                                |
| `⌘ .`                          | Send node content to active agent (quick "Send to agent")                               |
| `⌘ /`                          | Open quick agent picker → attach focused node to chosen agent's context                |
| `⌘ Click`(on another node)     | **Multi-select**— add node to selection. See §11.3                              |
| `Ctrl + Click`(on another node) | Same as `⌘ Click`on Linux/Windows                                                    |

### 11.3 Multi-Select & Agent Context Binding

**The power move:** `⌘ + Click` (or `Ctrl + Click`) lets you select multiple nodes, then feed them all to an agent as combined context in one action. This is how you say "look at all of this together."

**Selection flow:**

1. Click any node to focus it
2. `⌘ + Click` additional nodes — each gets a selection ring (dashed 2px border, monochrome)
3. Selected nodes show their window ID badges highlighted
4. A floating **selection bar** appears at the bottom center of the canvas:

```
┌──────────────────────────────────────────────────────────────┐
│  3 nodes selected: [1] terminal  [3] architecture.png  [4]  │
│  agent.py                                                    │
│                                                              │
│  [@agent ▾]  [Send to Agent]   [Group]   [Close All]   [×]  │
└──────────────────────────────────────────────────────────────┘
```

**Selection bar actions:**

* **[@agent ▾]** — dropdown to pick which agent receives the context
* **[Send to Agent]** — opens agent panel, attaches all selected nodes as context. The agent receives a structured context block:
  ```
  [Context: 3 nodes attached]- Window #1 (terminal): last 50 lines of output- Window #3 (architecture.png): image file, 340×280px- Window #4 (agent.py): full file content, 16 lines
  ```
* **[Group]** — create a named group from selection
* **[Close All]** — close all selected nodes (with confirmation)
* **[×]** — clear selection

**Keyboard shortcuts for multi-select:**

| Shortcut                         | Action                          |
| -------------------------------- | ------------------------------- |
| `⌘ A`                         | Select all nodes on canvas      |
| `⌘ Click`/`Ctrl Click`      | Toggle node in/out of selection |
| `⌘ ⇧ A`(when nodes selected) | Send selection to agent panel   |
| `Esc`                          | Clear selection                 |
| Click empty canvas               | Clear selection                 |
| Drag on empty canvas             | Lasso select (rubber band)      |

**Why this matters:** Most AI tools force you to manually copy-paste context or attach files one at a time. In Flow, you visually select the exact windows you want an agent to see — a terminal with an error, the code file that caused it, and the docs you're referencing — and hand all of it over in one gesture.

**Global shortcuts (work from any layer):**

| Shortcut                | Action                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| `Super + Alt + Space` | Open Spotlight                                                     |
| `⌘ T`                | Add terminal node                                                  |
| `⌘ B`                | Add browser node                                                   |
| `⌘ O`                | Add file node (opens picker)                                       |
| `⌘ S`                | Save canvas                                                        |
| `⌘ Z`/`⌘ ⇧ Z`    | Undo / Redo canvas operations                                      |
| `⌘ ⇧ E`             | Toggle file explorer panel                                         |
| `⌘ ⇧ A`             | Toggle agent panel                                                 |
| `⌘ ⇧ G`             | Toggle snap-to-grid                                                |
| `⌘ ⇧ F`             | Global search (opens Spotlight with `fw:`prefix)                 |
| `Esc`                 | Close topmost overlay (Spotlight → Panel → Node focus → Canvas) |

**Panel focus shortcuts (when file explorer or agent panel is active):**

| Shortcut      | Action                                                               |
| ------------- | -------------------------------------------------------------------- |
| `↑`/`↓` | Navigate items in file tree or conversation list                     |
| `Enter`     | Open selected file / conversation                                    |
| `Esc`       | Close panel, return to canvas                                        |
| `Tab`       | Move focus to next panel element (search input → file list → etc.) |

**Spotlight shortcuts (when Spotlight is open):**

| Shortcut           | Action                                                        |
| ------------------ | ------------------------------------------------------------- |
| `↑`/`↓`      | Navigate suggestions                                          |
| `Enter`          | Execute selected suggestion                                   |
| `Tab`            | Autocomplete (for agent names:`rese`→`@research-agent `) |
| `Esc`            | Close Spotlight                                               |
| `⌘ 1`–`⌘ 9` | Quick execute the Nth suggestion                              |

### 11.2 Focus Trap & Tab Order

When a modal or overlay is open (Spotlight, Settings, Onboarding), focus is trapped within it — `Tab` cycles through only the elements inside the overlay, not the canvas behind it. `Esc` always closes the topmost overlay first.

---

## 11. Onboarding

**First launch experience:**

1. **Welcome screen** (centered on empty canvas)
   * Liquid Glass elevated card, 520×400px
   * "Welcome to Flow" heading (`--text-2xl`)
   * "Your AI-native workspace" subtitle
   * Animated illustration showing nodes appearing on a canvas
   * "Get Started" button (accent-blue, full-width)
2. **Step 1: Workspace Setup**
   * Choose workspace directory (default: `~/Flow/`)
   * Optionally connect to existing project directory
3. **Step 2: Agent Setup**
   * Configure at least one model provider (OpenAI, Anthropic, Google, local)
   * API key input with validation
   * Creates a default "assistant" agent
4. **Step 3: Quick Tour** (interactive)
   * Highlights Spotlight: "Press `Super+Alt+Space` to do anything"
   * Shows adding a terminal: "Type `a: terminal` and press Enter"
   * Shows agent interaction: "Type `@assistant hello` to talk to your agent"
   * "You're ready!" → dismisses onboarding, canvas is now active

**Onboarding can be replayed from Settings → About → "Replay Tour"**

---

## 12. Technical Architecture

### 12.1 Electron Process Model

```
Main Process
├── Orbiter Runtime Manager (spawns/manages Python process)
├── File Watcher (workspace directory, chokidar)
├── Auto-save Manager
├── IPC Router
└── Global Shortcut Handler (Spotlight trigger)

Renderer Process (React)
├── Canvas Engine (react-flow or custom, with WebGL acceleration)
├── Node Renderers
│   ├── FileNodeRenderer (Monaco, pdf.js, media players)
│   ├── TerminalNodeRenderer (xterm.js)
│   └── BrowserNodeRenderer (Electron BrowserView)
├── UI Chrome (top bar, panels, spotlight, notifications)
├── State Management (Zustand)
└── Agent Communication (IPC ↔ Orbiter)
```

### 12.2 Key Dependencies

| Purpose           | Library                                                 |
| ----------------- | ------------------------------------------------------- |
| Framework         | Electron 33+                                            |
| UI                | React 19 + TypeScript                                   |
| Canvas            | `@xyflow/react`(React Flow) or custom infinite canvas |
| State             | Zustand                                                 |
| Terminal          | xterm.js + node-pty                                     |
| Code Editor       | Monaco Editor                                           |
| PDF Viewer        | pdf.js                                                  |
| Icons             | Lucide React                                            |
| Animations        | Framer Motion                                           |
| Styling           | Tailwind CSS + CSS custom properties                    |
| Liquid Glass SVG  | Custom SVG filter +`backdrop-filter`                  |
| IPC Serialization | electron-trpc or custom IPC                             |

### 12.3 Orbiter Integration

* Electron main process spawns a Python subprocess running Orbiter server
* Communication via JSON-RPC over stdio or local WebSocket
* API surface:
  * `agent.list()` → available agents
  * `agent.run(name, input, context)` → run agent with canvas context
  * `agent.stream(name, input, context)` → streaming run
  * `agent.status(name)` → current status
  * `agent.stop(name)` → cancel running agent
  * `canvas.context()` → serialize current canvas state for agent consumption
* Agents receive canvas context as part of their context engine state
* Agent outputs are streamed back via the same channel

### 12.4 Browser Node CDP Integration

Each browser/webview node in Electron exposes a CDP debugging port:

* Electron assigns a unique debug port per BrowserView
* CDP URL format: `http://localhost:[port]`
* Agents can use Playwright MCP server configured with the CDP URL
* This enables:
  * Navigation and interaction with web pages
  * Form filling and data extraction
  * Screenshot capture
  * Full browser automation
* CDP URL is stored in the node's metadata and accessible via canvas context API

---

## 13. File Structure (Electron App)

```
flow/
├── electron/
│   ├── main.ts                 # Electron main process
│   ├── preload.ts              # Context bridge
│   ├── orbiter.ts              # Orbiter runtime manager
│   ├── file-watcher.ts         # Workspace file watcher
│   ├── autosave.ts             # Canvas auto-save
│   └── ipc/                    # IPC handlers
│       ├── agents.ts
│       ├── canvas.ts
│       └── files.ts
├── src/
│   ├── app/
│   │   ├── App.tsx             # Root component
│   │   ├── Canvas.tsx          # Infinite canvas wrapper
│   │   └── Providers.tsx       # Zustand + context providers
│   ├── components/
│   │   ├── chrome/             # UI shell
│   │   │   ├── TopBar.tsx
│   │   │   ├── TopLeftPill.tsx
│   │   │   ├── BottomLeftPill.tsx
│   │   │   ├── FileExplorer.tsx
│   │   │   ├── AgentPanel.tsx
│   │   │   └── Spotlight.tsx
│   │   ├── nodes/              # Canvas node renderers
│   │   │   ├── NodeShell.tsx   # Universal title bar + wrapper
│   │   │   ├── FileNode.tsx
│   │   │   ├── TerminalNode.tsx
│   │   │   ├── BrowserNode.tsx
│   │   │   └── WebAppNode.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationStack.tsx
│   │   │   └── NotificationCard.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingFlow.tsx
│   │   └── ui/                 # Shared primitives
│   │       ├── GlassPanel.tsx  # Liquid Glass material component
│   │       ├── GlassPill.tsx   # Pill-shaped glass container
│   │       ├── GlassMenu.tsx   # Dropdown menu
│   │       ├── GlassButton.tsx # Icon button with glass hover
│   │       ├── GlassInput.tsx  # Text input with glass styling
│   │       └── GlassDivider.tsx
│   ├── stores/
│   │   ├── canvas.ts           # Nodes, positions, groups, zoom
│   │   ├── agents.ts           # Agent list, status, conversations
│   │   ├── ui.ts               # Panel states, spotlight, theme
│   │   └── settings.ts         # User preferences
│   ├── hooks/
│   │   ├── useCanvas.ts
│   │   ├── useAgent.ts
│   │   ├── useSpotlight.ts
│   │   └── useShortcuts.ts
│   ├── lib/
│   │   ├── liquid-glass.ts     # SVG filter generation
│   │   ├── cdp.ts              # CDP URL management
│   │   └── orbiter-client.ts   # IPC client for Orbiter
│   └── styles/
│       ├── globals.css         # CSS variables, glass materials
│       └── animations.css      # Keyframe definitions
├── package.json
├── electron-builder.yml
└── tsconfig.json
```

---

## 14. MVP Scope

### Phase 1 — Canvas + Nodes (Week 1-2)

* [ ] Electron shell with React renderer
* [ ] Infinite canvas (pan, zoom, dot grid background)
* [ ] Node system: create, move, resize, close, z-ordering
* [ ] File nodes (images, text/code, PDF)
* [ ] Terminal nodes (xterm.js)
* [ ] Liquid Glass material system (GlassPanel, GlassPill, GlassButton)
* [ ] Top bar with basic buttons
* [ ] Auto-save / restore

### Phase 2 — Spotlight + Browser (Week 3-4)

* [ ] Spotlight command palette (full command grammar)
* [ ] Browser nodes (Chromium webview)
* [ ] Web app nodes (locked browser)
* [ ] File explorer side panel
* [ ] Keyboard shortcuts
* [ ] Node context menus

### Phase 3 — Agent Integration (Week 5-6)

* [ ] Orbiter runtime manager (spawn, health check, restart)
* [ ] Agent panel (chat, conversations, agent switching)
* [ ] Spotlight agent commands (`@agent prompt`)
* [ ] Notification system (agent progress, completion)
* [ ] Canvas context API (expose canvas state to agents)
* [ ] Artifact auto-surfacing

### Phase 4 — Polish + Onboarding (Week 7-8)

* [ ] Onboarding flow
* [ ] Settings panel
* [ ] Node grouping
* [ ] Multi-canvas support
* [ ] Hint agent integration
* [ ] Browser CDP exposure for agent browser-use
* [ ] Animation polish pass
* [ ] Performance optimization

## 15. UX & Quality-of-Life Features

### 15.1 Quick Peek

**Problem:** You want to glance at a node's content without leaving what you're doing.
**Solution:** Hold `Space` and hover over any node → a temporary magnified preview floats near the cursor (400×300px, frosted glass frame). Release `Space` and it vanishes. No click required, no state change.

Works for all node types: shows terminal output, browser page screenshot, file preview, code snippet. For file nodes that are chromeless, this is especially useful since the title isn't always visible.

### 15.2 Clipboard Node

**Problem:** You copy something from outside Flow and want it on the canvas.
**Solution:** `⌘ ⇧ V` pastes clipboard content as a new node:

* Text → creates a text/code file node (auto-detects language)
* Image data → creates an image file node
* URL → creates a browser node navigated to that URL
* File path → creates a file node pointing to that file

The node appears at the canvas center with a brief "materialization" animation (scale 0.8 → 1.0, 250ms).

### 15.3 Drag Between Nodes

**Problem:** You want to move a file from the file explorer into a terminal (cd to its directory) or into an agent chat.
**Solution:** Drag-and-drop is universal:

* **File explorer → Canvas:** Creates a file node
* **File explorer → Terminal node:** Inserts the file's path at the cursor, or `cd`s to its directory
* **File explorer → Agent panel input:** Attaches the file as context
* **File node → Agent panel input:** Attaches the file
* **Terminal node → Agent panel input:** Attaches recent terminal output
* **Any node → Another node's title bar:** No-op (nodes stay independent), but shows a helpful tooltip "Use ⌘+Click to multi-select and send to agent"

### 15.4 Split View

**Problem:** You want to see two nodes side by side without manually positioning them.
**Solution:** Select two nodes (⌘+Click), then press `⌘ ⇧ S` (or right-click → "Split View"). The two nodes snap to fill the viewport — one on the left half, one on the right half, with an 8px gap. Press `Esc` to exit split view and return to free canvas.

Useful combos: code + terminal, docs + browser, two code files for comparison.

### 15.5 Node Linking

**Problem:** Certain nodes are conceptually related (a test file and the code it tests, a browser tab and notes about it).
**Solution:** Select two or more nodes → right-click → "Link nodes." A subtle dashed line (1px, `rgba(255,255,255, 0.06)`) connects the linked nodes on the canvas. Linked nodes:

* Appear as a group in Spotlight results
* Can be sent to an agent together via "Send linked nodes to agent"
* Move independently (not locked like groups) — the line stretches
* Unlink via context menu

### 15.6 Node Snapping & Alignment

**Problem:** Manually aligning nodes is tedious.
**Solution:** When dragging a node, alignment guides appear (thin lines, `rgba(255,255,255, 0.08)`) when the node's edges align with other nodes' edges or centers. The node softly snaps to the guide (4px tolerance).

Additional commands:

* Select multiple nodes → `⌘ ⇧ H`: Align horizontally (same top edge)
* Select multiple nodes → `⌘ ⇧ J`: Distribute evenly with equal spacing
* `⌘ ⇧ G` toggles a persistent grid snap (24px grid matching the dot pattern)

### 15.7 Recent Nodes & History

**Problem:** You closed a node and want it back, or you want to reopen a recent file.
**Solution:** Spotlight recognizes `recent:` prefix:

* `recent:` → shows last 10 closed nodes with timestamps
* Select one → re-creates the node at its original position with its state restored (terminal scrollback, browser URL, file content)

Also: `⌘ Z` undoes the last canvas operation (including node close), and `⌘ ⇧ Z` redoes.

### 15.8 Canvas Zoom-to-Fit

**Problem:** You've panned far from your nodes and lost track of the workspace.
**Solution:**

* `⌘ 0` resets zoom to 100% and pans to center of all nodes
* `⌘ 1` zooms to fit all nodes in the viewport with 48px padding
* Double-click empty canvas → zooms to fit (same as `⌘ 1`)

### 15.9 Node Badges & Status Indicators

Nodes can show small badge icons in the top-right corner of their title bar:

| Badge | Meaning                                                      |
| ----- | ------------------------------------------------------------ |
| 📌    | Pinned (won't move accidentally)                             |
| 🤖    | Agent connected (browser/terminal being controlled by agent) |
| 🔗    | Linked to other nodes                                        |
| ✏️  | Unsaved changes (file nodes in edit mode)                    |
| ⭐    | Bookmarked                                                   |

Badges are 14×14px, monochrome by default, positioned in a row with 4px spacing.

### 15.10 Agent Quick Actions

**Problem:** Common agent interactions require too many steps (open panel → type → send).
**Solution:** Quick action shortcuts that skip the panel:

| Shortcut    | Action                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `⌘ .`    | Send focused node to active agent (one keystroke)                                                                                                                        |
| `⌘ ⇧ .` | Send focused node to agent with a prompt: opens a small inline input floating above the node — type a question and hit Enter. Agent responds in the notification panel. |
| `⌘ /`    | Agent picker: shows a small floating menu listing agents. Select one → it becomes the active agent for `⌘ .`commands                                                 |

**Inline prompt popup** (for `⌘ ⇧ .`):

```
┌───────────────────────────────────────────┐
│  🤖 research-agent                        │
│  [What would you like to ask about this?] │
│                                    [Send] │
└───────────────────────────────────────────┘
```

* Frosted glass surface, appears just above the focused node
* Auto-focuses the input
* Enter sends, Esc dismisses
* Agent runs in background, results appear as notification

### 15.11 Command History

Spotlight remembers your last 50 commands. Press `↑` in an empty Spotlight input to cycle through recent commands. This works like shell history — invaluable when you're repeatedly running similar agent queries or searching for the same things.

### 15.12 Canvas Minimap Toggle

The spec says no minimap (and that's the default). But for users with 20+ nodes, there's a hidden toggle: `⌘ M` shows a small (160×120px) translucent minimap in the bottom-right corner above the notification area. It shows node positions as small colored rectangles. Click on the minimap to pan the canvas. The minimap itself uses frosted glass material.

### 15.13 Node Templates

**Problem:** You keep creating the same setup (terminal + code file + browser) for every new task.
**Solution:** Save any selection of nodes as a  **template** :

1. Multi-select the nodes you want
2. Right-click → "Save as Template..."
3. Name it (e.g., "Dev Setup", "Research Workspace")
4. Templates are available in Spotlight: `t: [template name]`
5. Instantiating a template recreates all the nodes with their relative positions preserved

Default templates ship with Flow:

* **Dev Setup:** Terminal + Code editor + Browser
* **Research:** Browser + Browser + Text file for notes
* **Review:** Two code files side by side + Terminal

### 15.14 Persistent Node Memory

Each node optionally remembers context across sessions:

* **Terminal nodes:** Full scrollback history persists (not just the tmux session — Flow saves it to disk)
* **Browser nodes:** URL + scroll position + tab history
* **File nodes:** Last cursor position, scroll offset, and view state (fullscreen vs canvas)
* **All nodes:** Position, size, z-order, group membership, links, bookmarks

This means when you restore a canvas, everything is exactly where you left it — down to which line you were reading in a code file.

### 15.15 Workspace Directory Sync

The file explorer stays synced with the workspace directory in real-time (via `chokidar` file watcher). If you create a file from a terminal node or an agent generates an artifact, it appears in the file explorer instantly without refresh. Similarly, deleting a file from the explorer removes it from disk.

### 15.16 Quick Note

`⌘ N` creates a minimal sticky-note node on the canvas — a small (240×160px) text area with no title bar, just raw text. Useful for jotting thoughts while working. Quick notes auto-save and are searchable via Spotlight. They use a slightly warmer background (`rgba(255, 248, 230, 0.04)`) to differentiate from code/file nodes.

### 15.17 Focus Mode Enhancements

When focus mode is active (top bar hidden):

* Panels can still be opened via keyboard shortcuts (`⌘⇧E`, `⌘⇧A`)
* Spotlight still works (`Super+Alt+Space`)
* A small clock appears in the bottom-right corner (frosted glass pill, `HH:MM` format)
* Press `⌘ ⇧ F11` for  **Zen mode** : hides everything except the focused node and a very faint dot grid. The focused node expands to fill the viewport. Press `Esc` to exit.

### 15.18 Smart Node Placement

When adding new nodes, Flow doesn't just dump them at canvas center. It uses spatial intelligence:

* New nodes appear in the nearest empty space to the viewport center
* If you just created a terminal, the next terminal appears 24px to the right of the last one (tiling)
* File nodes from drag-drop land exactly where you dropped them
* Agent-generated artifacts appear near the agent glyph's position on canvas, then fan out if there are multiple

### 15.19 Universal Search Within Nodes

`⌘ F` when a node is focused opens a search bar specific to that node:

* **Terminal:** Searches scrollback history
* **Browser:** Triggers the browser's native find-in-page
* **Code/text files:** Monaco editor search
* **PDF:** Text search across pages

When no node is focused, `⌘ F` opens Spotlight instead.

### 15.20 Agent Output Modes

When an agent completes work, the user can choose how the result appears:

* **Notification** (default): Results in the notification card, click to see full output in agent panel
* **Canvas artifact** : Agent output auto-creates a new file node on canvas (for generated code, reports, summaries)
* **Inline replace** : If the agent was sent a file node, the agent can propose edits that appear as a diff within the file node (accept/reject per change)

Configured per-agent in the agent tuning panel. The inline replace mode is especially powerful for code review workflows — select a code file, `⌘ .` to send to code-agent, and get back inline suggestions.

### 15.21 Edge Scroll

When dragging a node toward any viewport edge, the canvas auto-pans in that direction. Speed increases the closer you drag to the edge (0px/s at 100px from edge → 200px/s at the edge). This lets you reposition nodes across large canvases without dropping and re-grabbing.

### 15.22 Node Color Tags

Right-click any node → "Tag color..." → pick from 8 muted colors (slate, rose, amber, emerald, sky, violet, pink, stone). A 3px colored bar appears at the top of the node's title bar (or at the very top edge for chromeless file nodes). Used purely for personal organization — no functional effect, but colors are searchable in Spotlight: `tag: rose` shows all rose-tagged nodes.

### 15.23 Breadcrumb Trail

When you jump to a node via Spotlight (`w: 3`) or by clicking a notification, Flow remembers where you were. Press `⌘ [` to go back to the previous viewport position, `⌘ ]` to go forward. Works like browser history but for canvas position + zoom. Stores last 20 viewport states.

### 15.24 Terminal → Node Pipe

Inside a terminal node, output can be piped directly to the canvas:

* `command | flow-clip` → captures stdout and creates a text file node on canvas
* `command | flow-img` → if output is an image (base64 or file path), creates an image node
* These are small CLI utilities bundled with Flow, available in every terminal session's PATH.

### 15.25 Double-Tap Zoom

Double-tap (or double-click) on any node → canvas zooms to fit that single node in the viewport with comfortable padding. Double-tap empty canvas → zoom to fit all nodes (same as `⌘ 1`). Makes navigating large canvases feel like a map app.

### 15.26 Ghost Nodes

When an agent is working and references a file or URL that isn't on the canvas yet, a "ghost node" appears — a semi-transparent placeholder (30% opacity, dashed border) at the canvas edge showing what the agent is accessing. If the user clicks the ghost, it materializes into a real node. If ignored, it fades away when the agent finishes. This gives ambient awareness of agent activity without cluttering the canvas.

### 15.27 Session Timer

A small, unobtrusive timer in the bottom-left corner (next to the agent glyphs, only in focus mode) shows how long the current session has been active. Format: `2h 14m`. Helps with time awareness during deep work. Click to see a breakdown of active time per canvas.

### 15.28 Node Opacity / Dim

Right-click → "Dim" on any node sets it to 50% opacity. The node is still fully functional but visually recedes. Useful when you want a reference visible but not distracting. "Un-dim" restores full opacity. Dimmed nodes are skipped during Tab cycling unless explicitly focused via `w:` or number key.

### 15.29 Paste Into Terminal

When the clipboard contains a file path and you press `⌘ V` while a terminal node is focused, Flow offers a choice via a small popup: "Paste path" or "cd to directory." This prevents the common accident of pasting a long path and accidentally executing something.

### 15.30 Canvas Annotations

`⌘ ⇧ N` creates a floating text label directly on the canvas (not inside a node). The label is a simple text string with no background — just text rendered at `--text-sm` in `--text-3` color. Useful for labeling regions of the canvas: "Backend", "Research", "TODO". Annotations are draggable and deletable but not interactive beyond that.

### 15.31 Notification Grouping

When multiple agents are running simultaneously, notifications from the same agent stack into a single expandable card rather than flooding the stack. The card shows a count badge ("3 updates") and expands on click to show all individual updates with timestamps. Max 3 notification cards visible; older cards auto-collapse into a small "+N more" pill.

### 15.32 Ambient Sound Cues

Optional (off by default, toggle in Settings → Appearance):

* Soft click on node focus
* Gentle chime on agent task completion
* Subtle woosh on panel open/close
* Quiet tick on Spotlight open

All sounds are short (<200ms), low-volume, and use Web Audio API synthesis — no audio files. The goal is tactile feedback, not notification noise. Volume is independent from system volume and adjustable in settings.

### 15.33 Export Canvas as Image

`⌘ ⇧ P` (or Spotlight: `export:`) captures the entire canvas as a high-resolution PNG. All nodes are rendered at their current state. Useful for sharing workspace layouts, documenting project states, or creating screenshots for presentations. The export dialog lets you choose: "Visible viewport" or "All nodes" with a padding option.

### 15.34 Agent Handoff

When sending multiple nodes to an agent, you can add a handoff note — a brief instruction that frames the context:

```
┌──────────────────────────────────────────────────────┐
│  Sending 3 nodes to research-agent                    │
│                                                       │
│  [1] terminal  [3] architecture.png  [4] agent.py    │
│                                                       │
│  Handoff note (optional):                            │
│  [The tests are failing — compare the output with    │
│   the code and figure out what's wrong           ]   │
│                                                       │
│                              [Cancel]  [Send ⌘↵]     │
└──────────────────────────────────────────────────────┘
```

This dialog appears when sending multi-select to an agent. The handoff note becomes the user message, and the node contents become the attached context. Single-node sends via `⌘ .` skip this dialog for speed.

### 15.35 Spatial Audio Positioning

When ambient sounds are enabled and you have stereo output, notification chimes are subtly panned to match their visual position — a notification from the bottom-right plays slightly right-panned. Agent completion sounds pan toward the agent glyph's position. Barely perceptible, but subconsciously reinforces the spatial nature of the workspace.

---

*Product: Flow*
*Version: 1.0 Design Spec*
*Date: February 2026*
*Backend: Orbiter Framework*
