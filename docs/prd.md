# PRD: Flow — AI-Native Canvas Workspace

## Introduction

**Flow** is a desktop application (Electron + React) that replaces the conventional tab/window model with an infinite spatial canvas where files, browsers, terminals, and AI agents coexist simultaneously. Instead of alt-tabbing between contexts, everything lives on one persistent canvas. Agents run beside you — they can see your terminals, read your files, navigate your browsers, and surface results without breaking your flow.

The resting UI is deliberately monochromatic (Liquid Glass aesthetic). Color only appears as a response to interaction — hover blooms, active agents pulse, notifications arrive with status colors. The primary interaction model is keyboard-first: a Spotlight command palette (`Super+Alt+Space`) handles navigation, node creation, and agent invocation.

**Platform:** Electron 33+ / React 19 / TypeScript
**Design Language:** Liquid Glass (frosted glass, progressive blur, spring animations)
**Agent Backend:** Orbiter (local Python process, JSON-RPC)
**Branch:** `main`

---

## Goals

- Build a working infinite-canvas desktop workspace with Electron + React
- Implement the Liquid Glass design system (frosted glass chrome, monochromatic resting state)
- Support four node types: file, terminal, browser, web app
- Integrate Orbiter agent runtime via IPC with streaming output
- Provide a keyboard-first interface via the Spotlight command palette
- Enable agents to see canvas context (files, terminals, browsers) and surface results on-canvas
- Ship a polished onboarding flow and settings view

---

## User Stories

---

### US-001: Project Scaffolding
**Description:** As a developer, I need the Electron + React project properly scaffolded so all subsequent work has a solid foundation.

**Acceptance Criteria:**
- [ ] Electron 33+ app with Vite + React 19 + TypeScript renders a blank window
- [ ] Tailwind CSS configured with custom CSS property support
- [ ] Framer Motion installed
- [ ] Lucide React installed
- [ ] Zustand installed
- [ ] `electron-builder` or `electron-forge` configured for dev and production builds
- [ ] `npm run dev` starts the app in development mode
- [ ] Typecheck/lint passes

---

### US-002: Design System — CSS Tokens & Glass Material
**Description:** As a developer, I need the Liquid Glass design tokens and CSS material classes available globally so all components can use them consistently.

**Acceptance Criteria:**
- [ ] CSS custom properties defined in `src/styles/global.css`:
  - Colors: `--bg-canvas`, `--bg-canvas-dot`, `--glass-bg`, `--glass-border`, `--glass-hover`, `--glass-active`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--node-bg`
  - Accent colors: `--accent-blue`, `--accent-green`, `--accent-orange`, `--accent-red`, `--accent-purple`
  - Typography: `--font-display`, `--font-body`, `--font-mono`, `--text-xs` through `--text-2xl`
  - Motion: `--ease-spring`, `--ease-spring-snappy`, `--ease-decel`, `--ease-accel`, `--duration-instant` through `--duration-slow`
- [ ] `.glass` base class: `backdrop-filter: blur(24px) saturate(1.4)`, dark tinted fill, border, drop shadow, inset edge highlights
- [ ] `.glass::before` progressive blur halo via `::before` pseudo-element with radial-gradient mask
- [ ] `.glass-pill` class: `border-radius: 999px` variant with `-6px` inset halo
- [ ] Glass hierarchy levels implemented (chrome, surface, elevated, node title bar) as modifier classes or utility classes
- [ ] Light mode variables defined (toggled via `[data-theme="light"]` on `<html>`)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-003: Glass Component Library
**Description:** As a developer, I need reusable Liquid Glass primitive components so the UI can be assembled consistently.

**Acceptance Criteria:**
- [ ] `GlassPanel` component: glass chrome material, configurable border-radius, accepts children
- [ ] `GlassPill` component: pill-shaped glass container (border-radius: 999px), horizontal layout, with progressive halo
- [ ] `GlassButton` component: 36×36px icon button, `border-radius: 10px`, hover → `glass-hover` bg + icon opacity 0.88, click → `glass-active` + scale(0.95) spring
- [ ] `GlassMenu` component: glass surface dropdown, `border-radius: 14px`, 6px padding, with staggered entrance animation (30ms per item)
- [ ] `GlassInput` component: text input with glass styling, no visible border, placeholder in `--text-tertiary`
- [ ] `GlassDivider` component: 1px vertical divider at 30% opacity, 24px tall, 8px horizontal margin
- [ ] All components respect `prefers-reduced-motion` (animations collapse to instant)
- [ ] All interactive elements have `aria-label` attributes
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-004: Application Shell Layout
**Description:** As a user, I want to see the application shell with the canvas background, top bar, and corner elements in their correct positions.

**Acceptance Criteria:**
- [ ] Canvas area fills the full viewport (`#0A0A0C` background)
- [ ] Dot grid rendered on canvas background (24px spacing, `rgba(255,255,255,0.035)` dots, fades below 50% zoom)
- [ ] Top bar (`GlassPill`) centered horizontally, 16px from top, z-index 1000, height 44px
- [ ] Top-left pill (`GlassPill`) at 16px from top-left corner, z-index 1000
- [ ] Bottom-left pill (`GlassPill`) at 16px from bottom-left corner, z-index 1000
- [ ] Bottom-right corner reserved for notification stack (16px margin), z-index 1000
- [ ] Left panel zone (280px wide) and right panel zone (380px wide) positioned correctly, default hidden
- [ ] Layout uses CSS fixed positioning for all chrome elements
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-005: Top Bar — Primary Toolbar
**Description:** As a user, I want to see and use the top bar toolbar with all its buttons and dropdowns.

**Acceptance Criteria:**
- [ ] Top bar contains (left to right): Plus, FolderOpen, Bot icons → divider → Download (save), RotateCcw (restore), SlidersHorizontal (settings), Bell (notifications), user avatar
- [ ] Each button is a `GlassButton` (36×36px, `border-radius: 10px`)
- [ ] Divider rendered between Bot and save buttons at 30% opacity
- [ ] Bell button shows a red 6px dot when `unreadNotifications > 0` in store
- [ ] User avatar is 28×28px circle with glass border, shows first initial if no photo
- [ ] Plus button: on hover, rotates 90° over 0.25s (becomes a ×)
- [ ] Bot button: on hover, bounces translateY(-3px)
- [ ] Bell button: icon toggles to `BellOff` (no animation, just swap) when notifications panel is open
- [ ] All buttons have tooltip text (visible on hover after 800ms, glass surface, `--text-sm`)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-006: Add Elements Dropdown
**Description:** As a user, I want to click the Plus button in the top bar to see a dropdown for adding new canvas elements.

**Acceptance Criteria:**
- [ ] Clicking Plus opens a `GlassMenu` below the button, aligned left
- [ ] Menu contains: Terminal (`TerminalSquare`), Browser (`Globe`), File (`FileUp`), Web App (`AppWindow`) rows
- [ ] Each row: 36px height, icon 18px left, label in `--text-sm`, shortcut badge right-aligned
- [ ] Keyboard shortcuts shown: ⌘T, ⌘B, ⌘O, ⌘W
- [ ] "Web App" row has a `>` chevron indicating sub-menu
- [ ] Web App sub-menu appears on hover/click with pre-configured apps list (ChatGPT, Notion, Figma, Linear, GitHub, Gmail, Slack, Discord) + "Configure Apps…" at bottom
- [ ] Menu closes on Esc, click-outside, or item selection
- [ ] Entrance animation: items stagger slide-up at 30ms each
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: Agents Menu Dropdown & User Menu
**Description:** As a user, I want to open an agents overview dropdown from the top bar and access my user profile/appearance settings.

**Acceptance Criteria:**
- [ ] Clicking Bot opens a `GlassMenu` (width 280px) below the button
- [ ] Menu header: "Agents" title + "See All →" link
- [ ] Agent list: scrollable, max 5 visible; each row shows colored circle glyph + name + status dot (🟢 running / ⚪ idle / 🟡 waiting)
- [ ] Clicking an agent opens the right agent panel focused on that agent
- [ ] Divider below agent list
- [ ] "+ Custom Agent" button and "Open Agent Panel →" button at bottom
- [ ] Clicking user avatar opens a 3-row dropdown: Profile (`User`), Appearance (`Palette`), divider, Sign Out (`LogOut`)
- [ ] Appearance row cycles Dark / Light / System themes (updates `[data-theme]` on `<html>`)
- [ ] Menus grow from trigger point (transform-origin on trigger element)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-008: Top-Left & Bottom-Left Corner Pills
**Description:** As a user, I want quick-access controls in the top-left (focus mode, docs) and bottom-left (spotlight trigger, agent glyphs) corners.

**Acceptance Criteria:**
- [ ] Top-left pill: `EyeOff` icon (focus mode toggle) + `BookOpen` icon (opens docs URL in system browser)
- [ ] Focus mode: clicking `EyeOff` slides top bar off-screen (`translateY(-100%)`, 350ms spring), icon morphs to `Eye` via crossfade; clicking `Eye` restores
- [ ] Top-left pill remains visible when top bar is hidden
- [ ] Bottom-left pill: `Search` icon + up to 5 agent glyph circles (20×20px) with overflow "+N" badge
- [ ] Search icon: 360° rotation on hover over 0.6s
- [ ] Agent glyphs: colored circles with first letter, pulse animation (opacity 0.7→1.0, 2s cycle) when agent is running
- [ ] Hovering an agent glyph shows tooltip with name + current task summary (glass surface pill)
- [ ] Clicking an agent glyph opens that agent's panel/output
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-009: Infinite Canvas Engine
**Description:** As a user, I want an infinite zoomable/pannable canvas where nodes can be placed and moved freely.

**Acceptance Criteria:**
- [ ] Canvas pans via: middle-click drag, Space + left-drag, or two-finger trackpad scroll
- [ ] Canvas zooms via: Ctrl+scroll wheel, `⌘+`/`⌘-`/`⌘0`, trackpad pinch
- [ ] Zoom range: 25% → 200%
- [ ] Dot grid scales and fades appropriately (invisible below 50% zoom)
- [ ] Nodes can be freely dragged with momentum (slight inertia on release)
- [ ] Nodes overlap; most-recently-focused node is on top (z-order managed in store)
- [ ] Optional snap-to-grid: `⌘⇧G` toggles; when on, nodes snap to 24px grid
- [ ] Canvas state (positions, zoom, pan offset) stored in Zustand `canvasStore`
- [ ] Canvas zoom level shown as a small percentage pill in the bottom-right area (excluding notification zone)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-010: Universal Node Shell (Title Bar + Resize)
**Description:** As a user, I want every canvas node to have a consistent title bar with a window ID, title, context menu trigger, and resize handles.

**Acceptance Criteria:**
- [ ] Node shell wraps all node types with a common container
- [ ] Title bar (32px): `[ID]` monospace badge (left) + title text (center, truncated) + `···` `MoreHorizontal` icon button (right, visible on title bar hover)
- [ ] Browser nodes additionally show `ChevronLeft` (back) and `RotateCw` (reload) buttons left of title
- [ ] Window IDs auto-increment from 1; re-assigned/decremented when nodes close
- [ ] Node border: `1px --glass-border`, `border-radius: 12px`
- [ ] Focused node: brighter border (`--glass-hover`) + slightly larger shadow, 200ms spring transition
- [ ] Resize handles visible at all 4 corners + 4 edges on hover; dragging any handle resizes node
- [ ] Each node type has a minimum size (Terminal: 320×200, Browser: 400×300, File: 200×160)
- [ ] Title bar hover for 800ms shows tooltip: "Created X ago · Modified Y ago" with `Clock` icon
- [ ] Node title bar: prismatic shimmer sweep (rainbow refraction) on hover — barely perceptible, left-to-right
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-011: Node Context Menu System
**Description:** As a user, I want to right-click any node (or click `···`) to access node-specific actions.

**Acceptance Criteria:**
- [ ] Right-click on node or clicking `···` opens a context menu (GlassMenu) at cursor position
- [ ] Menu entrance: scale 0.97→1.0 + fade, 200ms spring, origin at cursor
- [ ] Terminal node menu: Run command, Pipe output to agent (sub-menu with agents), Export session log, Clear terminal, divider, Copy last output, Search in terminal, divider, Rename, Move to group, Duplicate, Close
- [ ] Browser node menu: Screenshot page, Extract page text, Connect agent via CDP (sub-menu), Save as PDF, divider, Copy URL, Open in system browser, Reload, divider, Rename, Move to group, Duplicate, Close
- [ ] File node menu: Open in default app, Edit in canvas, Convert format (sub-menu), Send to agent (sub-menu), divider, Save as, Copy path, Delete file, divider, Rename, Move to group, Duplicate, Close
- [ ] All node menus end with universal items: Summarize with agent, Compare with, Pin to canvas, Bookmark
- [ ] Each menu item has the correct Lucide icon (per spec §5.3)
- [ ] Sub-menus open on hover/click; list available agents dynamically
- [ ] `⌘W` closes focused node, `F2` renames, `⌘D` duplicates (keyboard shortcuts work too)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-012: Canvas State Management (Zustand Stores)
**Description:** As a developer, I need well-structured Zustand stores for canvas, UI, agents, and settings state so all components share consistent state.

**Acceptance Criteria:**
- [ ] `canvasStore`: nodes array (id, type, title, position, size, zIndex, metadata), zoom, panOffset, selectedIds, groups, snapToGrid flag; actions: addNode, removeNode, updateNode, focusNode, moveNode, resizeNode
- [ ] `uiStore`: spotlightOpen, fileExplorerOpen, agentPanelOpen, activeAgent, theme, focusMode, unreadNotifications, notifications array
- [ ] `agentStore`: agents list (id, name, color, status, currentTask), conversations per agent per canvas
- [ ] `settingsStore`: workspaceDir, autoSaveInterval, webApps, keyboardShortcuts, orbiterPath
- [ ] All stores persist relevant state to `localStorage` (canvas layout, settings, theme)
- [ ] Stores export typed selectors and actions
- [ ] Typecheck/lint passes

---

### US-013: Terminal Nodes
**Description:** As a user, I want to open terminal sessions as canvas nodes and interact with them fully.

**Acceptance Criteria:**
- [ ] `⌘T` or "Add → Terminal" creates a new terminal node at canvas center (default 680×440px)
- [ ] Terminal rendered via xterm.js with WebGL renderer
- [ ] Backend: node-pty spawns user's `$SHELL`; Electron main process manages PTY
- [ ] Full terminal emulation: colors, cursor, scrollback (10,000 lines)
- [ ] Font: `--font-mono`, 13px; standard copy/paste OS shortcuts work
- [ ] Terminal node always has title bar (no chromeless mode)
- [ ] `⌘F` activates inline search bar within the terminal
- [ ] Terminal title auto-updates based on shell escape sequences (PS1 window title): shows cwd, running process name, or SSH host
- [ ] Idle state title: "terminal"
- [ ] Minimum size: 320×200px; no maximum
- [ ] "Clear terminal" (`⌘K`) clears scrollback, keeps session alive
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-014: Browser Nodes
**Description:** As a user, I want Chromium browser tabs as canvas nodes with full navigation.

**Acceptance Criteria:**
- [ ] `⌘B` or "Add → Browser" creates a browser node (default 800×560px)
- [ ] Browser uses Electron `WebContentsView` (or `BrowserView` for older Electron) embedded in node
- [ ] Title bar shows: Back (`ChevronLeft`), Reload (`RotateCw`), domain name of current page
- [ ] No visible URL address bar; URL editing done via Spotlight `goog:` or the start page
- [ ] New browser node opens with a minimal start page showing a URL input field (enter URL → navigate)
- [ ] CDP (Chrome DevTools Protocol) URL for each browser node stored in node metadata
- [ ] When an agent is CDP-connected, a small `🤖` badge appears on the title bar (pulsing)
- [ ] Agent actions visible in real-time (pages navigate, forms fill); floating label pill below title bar shows "Navigating to…", "Clicking…", "Extracting text…" (2s auto-dismiss)
- [ ] Minimum size: 400×300px
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-015: File Nodes — Chromeless Design
**Description:** As a user, I want to open files as canvas nodes that display content directly without visible chrome at rest.

**Acceptance Criteria:**
- [ ] `⌘O` or "Add → File" opens an OS file picker; selected file creates a file node
- [ ] **Resting state (no hover):** content renders directly on canvas — no border, no title bar; shadow only (`0 2px 12px rgba(0,0,0,0.15)`); `border-radius: 8px`; cursor: pointer
- [ ] **Hover state:** frosted glass title bar fades in (200ms) showing window ID + filename + `···`; 1px border appears; resize handles visible
- [ ] **File type rendering:**
  - Images: resizable thumbnail, default 360×360px, maintains aspect ratio
  - Code/text files: Monaco Editor (read-only), syntax highlighting, 560×400px default
  - Markdown: rendered HTML preview (not raw source), 520×400px
  - PDF: pdf.js first page preview, 480×640px
  - Audio: compact waveform card (320×100px), click to play/pause inline
  - Video: thumbnail + play overlay (560×315px); single click plays inline
  - Unknown: large file-type icon + filename + size (200×160px)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-016: File Node Fullscreen Lightbox
**Description:** As a user, I want to click a file node to view it fullscreen with full interaction capabilities.

**Acceptance Criteria:**
- [ ] Clicking a file node (not while hovering chrome) expands it to fullscreen lightbox
- [ ] Dark overlay behind: `rgba(0,0,0,0.85)`, blur: 8px on canvas
- [ ] Node scales and moves from canvas position to fullscreen (48px margin all sides), 350ms spring
- [ ] Bottom info bar: frosted glass pill showing filename + file size + "Modified X ago" + close `×` button
- [ ] Fullscreen rendering:
  - Images: full resolution, centered, scroll-to-zoom
  - Code/text: full Monaco editor, editable, with `⌘S` save support
  - Markdown: split view (rendered left, source right), toggleable
  - PDFs: page navigation controls, full document
  - Video: full controls (scrub, volume, fullscreen-within-fullscreen)
  - Audio: expanded player with full waveform, scrubbing
- [ ] Exit: `Esc`, click `×`, or click dark overlay
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-017: Web App Nodes
**Description:** As a user, I want to pin web apps (Notion, Figma, etc.) as canvas nodes with locked URLs.

**Acceptance Criteria:**
- [ ] "Add → Web App" shows sub-menu with pre-configured apps + "Configure Apps…"
- [ ] Default apps: ChatGPT, Claude, Notion, Figma, Linear, GitHub, Gmail, Google Docs, Slack, Discord
- [ ] Web app node behaves like a browser node but:
  - Title shows the app name, not the domain
  - No back/reload buttons in title bar
  - URL is locked — links that would navigate away open in a new browser node
  - No address bar or URL editing
- [ ] Apps configurable in Settings → Web Apps (name, URL, icon, category)
- [ ] CDP connection available (same as browser nodes) for agent automation
- [ ] Minimum size: 400×300px; default size: 800×560px
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-018: File Explorer Panel
**Description:** As a user, I want a left-side file explorer panel to browse and drag files onto the canvas.

**Acceptance Criteria:**
- [ ] Toggle: `⌘⇧E` or FolderOpen button in top bar
- [ ] Panel: 280px wide (resizable 220–400px), left edge, full height minus margins, `border-radius: 14px` on right side
- [ ] Entrance: slides in from left edge, 350ms spring + backdrop blur fade-in
- [ ] Header: "FILES" label + close `×` button
- [ ] Search input (GlassInput): real-time fuzzy filter of file tree
- [ ] VS Code-style tree view: folder expand/collapse with `ChevronRight`/`ChevronDown` icons
- [ ] File icons color-coded by type: blue=code, green=data, purple=media, gray=other (using Lucide icons per type mapping in spec)
- [ ] Dragging a file from tree onto canvas creates a file node at drop position with ghost preview + trailing blur
- [ ] Right-click file: context menu with Open, Rename, Delete, Copy Path
- [ ] Watches user's configured workspace directory (default: `~/Flow/`)
- [ ] `Tab` / `↑↓` keyboard navigation within panel
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-019: Agent Chat Panel
**Description:** As a user, I want a right-side agent chat panel to have ongoing conversations with agents.

**Acceptance Criteria:**
- [ ] Toggle: `⌘⇧A` or "Open Agent Panel →" from agents menu
- [ ] Panel: 380px wide (resizable 320–520px), right edge, full height minus margins, `border-radius: 14px` on left side
- [ ] Panel header: pill tab bar (single pill container, `border-radius: 999px`, Liquid Glass) with two segments — active agent selector (left) + conversations list (right); active segment has brighter fill that slides between positions (300ms spring)
- [ ] Settings button: 44×44px squircle (`border-radius: 12px`) outside the pill, top-right; `SlidersHorizontal` icon; on hover rotates 15° + gear bloom effect; on click, settings sub-panel slides in laterally
- [ ] Agent selector (left segment): shows agent name + status dot; click → dropdown to switch agents
- [ ] Conversations (right segment): list of conversations with current agent on this canvas (title, date, preview)
- [ ] Chat area: scrollable messages, user messages right-aligned, agent messages left-aligned
- [ ] Input bar: GlassInput with "Message [agent name]..." placeholder + `Paperclip` attach button + `ArrowUp` send button (accent-blue when input non-empty)
- [ ] Send on Enter; Shift+Enter for newline
- [ ] Supports `/commands` (same as Spotlight commands)
- [ ] Each canvas has independent conversation history per agent
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-020: Spotlight — Foundation & UI
**Description:** As a user, I want the Spotlight command palette to open centered on screen with smooth animations and a search input.

**Acceptance Criteria:**
- [ ] Trigger: `Super+Alt+Space` (global Electron shortcut, works even when window is unfocused) or click Search icon in bottom-left pill
- [ ] Container: GlassPanel elevated material, `border-radius: 18px`, width 640px, centered horizontally, 30% from top
- [ ] Entrance animation: canvas dims to 60% opacity (200ms) → container scales 0.95→1.0 + opacity 0→1 (300ms spring) → input auto-focuses; search icon does 360° rotation during entrance
- [ ] Exit animation: scales 1.0→0.97 + opacity 1→0 (200ms decel) → backdrop clears (200ms)
- [ ] Input field: no visible border, search icon left (18px, `--text-secondary`), placeholder "Search, add, or ask an agent…" in `--text-tertiary`, `--text-lg` font
- [ ] Suggestions section headers with icons (Quick Actions, Open Windows, Agents)
- [ ] Each suggestion row: 40px height, icon + label + secondary text + shortcut badge
- [ ] Keyboard navigation: ↑↓ moves selection, Enter executes, Tab autocompletes, Esc closes
- [ ] Mouse: hover highlights, click executes
- [ ] `⌘1`–`⌘9` quick-executes the Nth suggestion
- [ ] Focus trapped within Spotlight when open (Tab cycles only Spotlight elements)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-021: Spotlight — Search & Commands
**Description:** As a user, I want Spotlight to execute all command prefixes and provide real-time fuzzy search results.

**Acceptance Criteria:**
- [ ] **Default (no prefix):** Fuzzy searches open windows (by title/ID), workspace files, agents, recent actions, canvases; priority order per spec §4.5
- [ ] **`w: [id/title]`:** Pans canvas to target node (300ms spring pan + zoom-to-fit), `w: 3` → node #3, `w: term` → fuzzy match; single match executes immediately
- [ ] **`fw: [query]`:** Filter open canvas nodes by title/type
- [ ] **`fc: [name]`:** Switch to another canvas
- [ ] **`a: [type]`:** Create node — `a: terminal`, `a: browser`, `a: file` (opens picker), `a: note` (quick note)
- [ ] **`goog:`, `yt:`, `rdt:`, `twt:`, `gh:`, `so:`:** Open browser node with the appropriate search URL pre-loaded
- [ ] Suggestions debounce at 100ms
- [ ] Typing a node window ID (e.g., `3`) alone shows that node as top suggestion
- [ ] Results update in real-time as user types
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-022: Spotlight — Agent Interaction
**Description:** As a user, I want to invoke agents directly from Spotlight using the `@agent` prefix with a natural language prompt.

**Acceptance Criteria:**
- [ ] Typing `@` shows agent suggestions, fuzzy-matched by name (e.g., `rese` → `@research-agent`)
- [ ] Tab or Enter selects an agent → input transforms to `@research-agent ▍` (cursor after space)
- [ ] User types prompt; pressing Enter: Spotlight closes → persistent notification appears in bottom-right → agent starts running via Orbiter
- [ ] Active agents appear at top of suggestions with current task preview
- [ ] Recently used agents are prioritized
- [ ] Workflow chaining supported: `@agent1 prompt >> @agent2 prompt >> a: file` (sequential execution, multi-step notification)
- [ ] Saved workflows available as `run: [name]` in Spotlight after user saves a chain
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-023: Orbiter Integration (IPC)
**Description:** As a developer, I need the Electron main process to spawn and communicate with the Orbiter Python agent runtime via IPC.

**Acceptance Criteria:**
- [ ] Electron main process spawns Orbiter as a Python subprocess from configured path
- [ ] Communication via JSON-RPC over stdio or local WebSocket
- [ ] IPC handlers exposed to renderer via `contextBridge` preload:
  - `agent.list()` → returns available agents with status
  - `agent.run(name, input, context)` → runs agent, returns job ID
  - `agent.stream(name, input, context)` → streaming run, emits SSE-like events to renderer
  - `agent.status(name)` → current status
  - `agent.stop(name)` → cancel running agent
  - `canvas.context()` → serializes current canvas state (nodes, terminal histories, browser URLs, file contents)
- [ ] Orbiter startup failure shows an error notification with a "Check Orbiter Config" button that opens Settings → Orbiter
- [ ] Orbiter status indicator in Settings → Orbiter shows: running/stopped/error
- [ ] Typecheck/lint passes

---

### US-024: Tool Call UI — Inline Agent Panel Cards
**Description:** As a user, I want to see agent tool calls as collapsible cards in the agent chat panel while agents are running.

**Acceptance Criteria:**
- [ ] Tool call card appears in chat as soon as the LLM emits a tool_use block (streaming)
- [ ] **Collapsed state:** `Zap` icon + `tool_name("arg_preview…")` + `ChevronDown` expand toggle on right; status line below: "Running…" (monochrome spinner) → "✓ [summary] · [duration]" on success → "✗ [error]" on failure
- [ ] **Expanded state (click chevron):** shows Input section (full JSON) + Output section (truncated) + Copy button
- [ ] Left border: 2px solid — monochrome pulsing (running), `--accent-green` (success), `--accent-red` (error)
- [ ] Background: `rgba(255,255,255, 0.03)` — barely visible
- [ ] Font: `--font-mono` for tool name and args
- [ ] Sequential tool calls stack with 4px gap
- [ ] Notification card (for background Spotlight-invoked agents) shows compact tool call progress: `⚡ tool_name (N/N done)` list + "X tools called · Xs elapsed" footer
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-025: Notification System
**Description:** As a user, I want notifications to appear in the bottom-right corner informing me of agent progress, system events, and artifact creation.

**Acceptance Criteria:**
- [ ] Notifications stack upward from bottom-right (16px margin), max 3 visible; older ones collapse to 8px height pills with count badge
- [ ] Container: GlassMenu surface, `border-radius: 14px`, width 340px
- [ ] **Agent notifications (persistent):** Show agent name + status dot (pulsing green=running, static green=done, red=error) + 2-line summary text + "View Results" + "Dismiss" buttons; update in-place (no new card per update)
- [ ] **System notifications (transient):** Auto-dismiss after 5s, no action buttons (or single "Undo")
- [ ] **Artifact notifications:** Show filename + type + preview thumbnail + "Jump to Node" button; auto-creates a file node on canvas with materialization effect (scale 0→1 + blur clears, 350ms spring)
- [ ] **Enter animation:** slide up from below viewport + fade in (350ms spring)
- [ ] **Stack animation:** existing notifications slide up 250ms spring when new one arrives
- [ ] **Dismiss animation:** slide right + fade out (200ms decel); card tumbles 2° on dismiss
- [ ] Bell button in top bar shows red dot when unread notifications exist
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-026: Agent ↔ Canvas Integration (Context & Visual Indicators)
**Description:** As a user, I want to feel that agents are aware of and operating on my canvas through visual feedback.

**Acceptance Criteria:**
- [ ] `canvas.context()` IPC call serializes: all nodes (type, title, position), terminal session histories (last 200 lines per terminal), browser CDP URLs, file node content (text/code), other agents' status
- [ ] **Agent activity beam:** thin 1px line (`--text-tertiary` at 30%) connects agent glyph to targeted node for 600ms then fades; only for tool calls referencing specific canvas nodes (read_file → file node, terminal command → terminal node)
- [ ] **Node interaction flash:** when agent reads/writes a node, that node's border flashes (opacity 0→0.3→0, 400ms) with subtle glow
- [ ] **Hint agent:** lightweight background agent (cheap model) reviews canvas state every 60s; surfaces contextual hints as low-priority dismissible notifications (e.g., "Terminal #2 has errors, want me to debug?")
- [ ] User can disable hints in Settings → Agents → "Hints"
- [ ] Artifact auto-surfacing: agent-generated files saved to `~/Flow/artifacts/[agent]/[timestamp]/`, auto-created as file node near viewport, notification shown
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-027: Canvas Save & Restore
**Description:** As a user, I want my canvas to auto-save and be restorable from snapshots.

**Acceptance Criteria:**
- [ ] Canvas auto-saves every 30s (interval configurable in settings) → stores JSON to `~/Flow/canvases/[canvas-id]/auto-[timestamp].json`
- [ ] Manual save: `⌘S` or Save button → creates named snapshot, prompts for name if first manual save
- [ ] Save format: JSON with all node positions/sizes/z-order, node content state (URLs, file paths, terminal scrollback references), panel states, zoom/pan
- [ ] Restore button in top bar opens a list of snapshots (auto + manual) with timestamps and canvas thumbnail
- [ ] Clicking a snapshot restores all nodes (with smooth materialization effect per node)
- [ ] Auto-save triggers a brief system notification ("Canvas saved") that auto-dismisses in 5s
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-028: Node Grouping
**Description:** As a user, I want to group multiple nodes together so they move as a unit.

**Acceptance Criteria:**
- [ ] Select multiple nodes (Shift+click or lasso drag) → right-click → "Group" → prompts for group name
- [ ] Group renders a subtle labeled container border around member nodes with the group name as a pill label
- [ ] Dragging the group border/label moves all member nodes together
- [ ] Groups can be collapsed: clicking the group label pill toggles collapse — collapsed state shows only the group label pill (children hidden), expanded shows all children
- [ ] Ungroup via context menu on group: removes group, nodes remain in place
- [ ] "Move to group…" in node context menu shows sub-menu with existing groups + "New Group"
- [ ] Groups stored in `canvasStore.groups`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-029: Multi-Canvas Support
**Description:** As a user, I want to maintain multiple independent canvases (workspaces) and switch between them.

**Acceptance Criteria:**
- [ ] Each canvas has a unique ID, name, and independent node layout + agent conversation history
- [ ] Canvas list accessible via Spotlight `fc: [name]` and in Settings → General
- [ ] Switching canvases: current canvas saves → new canvas loads with smooth transition
- [ ] "New Canvas" option in Settings → General → Canvases; auto-generates name from timestamp
- [ ] Canvas name shown in window title bar
- [ ] Canvas names are user-editable (double-click in settings list or Settings → General → "Canvas Name" field)
- [ ] Deep links: `flow://canvas/[name]` opens Flow and switches to named canvas
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-030: Multi-Select & Selection Bar
**Description:** As a user, I want to select multiple canvas nodes and perform bulk operations or send all to an agent at once.

**Acceptance Criteria:**
- [ ] `⌘+Click` (Mac) / `Ctrl+Click` (Linux/Windows) adds/removes nodes from selection
- [ ] Lasso select: drag on empty canvas creates rubber-band selection box; all nodes within box become selected on release
- [ ] `⌘A` selects all nodes
- [ ] Selected nodes show dashed 2px monochrome selection ring with highlighted window ID badge
- [ ] When 2+ nodes selected, a floating **selection bar** appears at canvas bottom-center:
  - Shows "N nodes selected: [1] title [2] title…" summary
  - `[@agent ▾]` dropdown to pick target agent
  - `[Send to Agent]` button: opens agent panel, attaches all selected nodes as structured context block
  - `[Group]` button: creates group from selection
  - `[Close All]` button: closes all selected nodes (with confirm dialog)
  - `[×]` clears selection
- [ ] `Esc` or clicking empty canvas clears selection
- [ ] Context block format sent to agent: lists each node's type, title, and relevant content (terminal: last 50 lines, file: full content, browser: URL)
- [ ] `⌘⇧A` (when nodes selected) sends selection to agent panel
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-031: Keyboard Shortcuts & Navigation Layers
**Description:** As a user, I want to navigate the entire app by keyboard alone using a three-layer focus system.

**Acceptance Criteria:**
- [ ] Three focus layers: Canvas (default) → Node focus → Panel focus; `Esc` moves up one layer
- [ ] Focus ring: 2px `rgba(255,255,255,0.25)` ring on focused element, animates in 150ms
- [ ] **Canvas layer:** Tab/Shift+Tab cycles node focus by window ID; number keys `1`-`9` jump to node by ID; Arrow keys pan canvas (40px/press, Shift = 120px); `⌘+/-/0` zoom; `⌘A` select all
- [ ] **Node focus layer (node is focused):** Enter activates node (begins editing/interaction); Esc deactivates (second Esc → canvas); F2 renames; `⌘W` closes; `⌘D` duplicates; Delete/Backspace closes (with confirm if unsaved); Arrow keys move node 10px (Shift = 40px); `⌘Enter` opens context menu; `⌘.` sends to active agent; `⌘/` opens quick agent picker
- [ ] **Panel focus layer:** ↑↓ navigate list items; Enter opens item; Esc closes panel
- [ ] **Global shortcuts (always active):** `Super+Alt+Space` Spotlight; `⌘T/B/O` add nodes; `⌘S` save; `⌘Z`/`⌘⇧Z` undo/redo; `⌘⇧E/A` toggle panels; `⌘⇧G` snap-to-grid; `⌘⇧F` global search
- [ ] All interactive elements ≥ 36×36px click targets
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-032: Undo / Redo Stack
**Description:** As a user, I want to undo and redo canvas-level actions so I can recover from mistakes.

**Acceptance Criteria:**
- [ ] Undo stack (100 operations max) tracks: node create/close/move/resize, group/ungroup, node rename
- [ ] `⌘Z` walks back; `⌘⇧Z` walks forward
- [ ] Undo history persists across auto-saves (stored alongside canvas state JSON)
- [ ] File delete via context menu: file moved to `~/.Trash` (or OS trash), not permanently deleted; undo restores file + node
- [ ] Agent inline edits (future feature): can be undone individually or en-masse with "Undo Agent Action" button on error notifications
- [ ] "History" panel accessible via Spotlight `history:` command: shows timestamped list of all actions; click any entry to revert to that point
- [ ] Undo/redo state shown in top bar Restore button (grays out when history is empty)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-033: Settings View
**Description:** As a user, I want a full-screen settings view where I can configure all aspects of Flow.

**Acceptance Criteria:**
- [ ] Settings opens as full-screen overlay (replaces canvas view, not a modal)
- [ ] Left sidebar navigation + right content area layout
- [ ] **General:** Canvas name, workspace directory picker, auto-save interval slider, startup canvas selector
- [ ] **Appearance:** Theme toggle (Dark/Light/System), accent color picker (6 presets), zoom level default, dot grid toggle, high-contrast mode toggle
- [ ] **Agents:** Agent library list (name, model, color, status); create/edit/delete agent forms; default model selector; API key fields per provider (OpenAI, Anthropic, Google, local)
- [ ] **Web Apps:** List of configured web apps with add/edit/delete; fields: name, URL, icon (favicon fetch or upload), category
- [ ] **Keyboard:** Shortcut table, click any shortcut to rebind (record new key combo)
- [ ] **Orbiter:** Runtime status indicator (running/stopped/error), Python path input, model provider configs, "Restart Orbiter" button
- [ ] **Data:** Export canvas (JSON download), import canvas (JSON upload), clear cache button, storage usage bar
- [ ] **About:** App version, licenses, "Replay Onboarding Tour" button
- [ ] Settings panel entrance: slides up from canvas (350ms spring)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-034: Onboarding Flow
**Description:** As a new user, I want a guided first-launch experience that teaches me how to use Flow.

**Acceptance Criteria:**
- [ ] Shows on first launch (tracked in persisted settings)
- [ ] **Welcome screen:** GlassPanel elevated card (520×400px) centered on canvas; "Welcome to Flow" heading (`--text-2xl`); "Your AI-native workspace" subtitle; animated illustration showing nodes appearing; "Get Started" button (accent-blue, full-width)
- [ ] **Step 1 — Workspace Setup:** Directory picker (default `~/Flow/`), optional "connect existing project directory" toggle; "Next" button
- [ ] **Step 2 — Agent Setup:** Model provider picker (OpenAI/Anthropic/Google/local); API key input with validation; creates default "assistant" agent; "Next" button
- [ ] **Step 3 — Quick Tour (interactive):** Spotlight highlights with focus + tooltip overlay: (a) "Press Super+Alt+Space to do anything" (b) "Type `a: terminal` and press Enter" (c) "Type `@assistant hello` to talk to your agent"; each step waits for user action before proceeding; "You're ready!" final step dismisses onboarding
- [ ] Progress dots below card show current step
- [ ] Onboarding can be skipped; "Replay Tour" in Settings → About
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-035: Smart Paste Routing
**Description:** As a user, I want `⌘V` with no focused node to intelligently create the right kind of node from clipboard content.

**Acceptance Criteria:**
- [ ] With no node focused: `⌘V` inspects clipboard:
  - Plain text → creates a Quick Note (sticky note) node at canvas center
  - Image → creates an image file node (saves to `~/Flow/clipboard/[timestamp].png`)
  - URL → creates a browser node with that URL loaded
  - File path → creates a file node for that file
- [ ] With a node focused: `⌘V` pastes directly into the node as normal (terminal, editor, etc.)
- [ ] Quick Note node type: sticky-note style node, 240×200px default, text editable inline, uses `StickyNote` icon in title bar, no file on disk (content stored in canvas state only)
- [ ] Drop Zone hints: during any drag operation (from file explorer, from OS, from another node), valid drop targets illuminate:
  - Agent panel input: faint blue border pulse
  - Terminal nodes: "Drop to paste path" tooltip appears
  - Canvas: "+" cursor
  - Invalid targets: no change
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-036: OS Integration & System Tray
**Description:** As a user, I want Flow to integrate with the OS (system tray, file associations, global shortcuts when backgrounded).

**Acceptance Criteria:**
- [ ] Flow lives in system tray (Windows/Linux) / menu bar (macOS) when main window is closed
- [ ] Tray icon click → shows mini menu: current canvas name, running agents with status, "Open Flow", "Quick Note" (creates note without opening full window)
- [ ] Global hotkey `Super+Alt+Space` opens Spotlight even when Flow is in the background (Electron global shortcut)
- [ ] File associations (off by default): when enabled in settings, double-clicking `.py`, `.md`, `.json` etc. in OS file manager opens it as a file node on the current canvas
- [ ] Files dragged from OS file manager onto Flow window create file nodes at drop position
- [ ] Deep links: `flow://canvas/[name]` and `flow://agent/[name]?prompt=[text]` handled by the app (register custom protocol in Electron)
- [ ] Typecheck/lint passes

---

### US-037: Token Awareness & Performance Indicator
**Description:** As a user, I want to see how many tokens my agents are consuming and how the app is performing.

**Acceptance Criteria:**
- [ ] Agent panel header shows token counter next to agent name: `research-agent · 2.4K tokens this session`
- [ ] Clicking counter expands to breakdown: tokens per conversation, per tool call, estimated cost (based on model pricing from settings)
- [ ] When conversation exceeds 50K tokens: amber indicator + hint "Long conversation — consider starting fresh for better results"
- [ ] Monthly usage summary in Settings → Data → "Usage"
- [ ] **Performance indicator:** Tiny colored dot in bottom-right corner (above notification area):
  - Green (no label): >50fps
  - Amber + "slow": 30–50fps
  - Red + "laggy": <30fps
- [ ] Clicking performance dot opens lightweight panel: node count, terminal sessions, browser nodes active, memory usage, Orbiter process status
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

---

### US-038: Accessibility & Reduced Motion
**Description:** As a user with accessibility needs, I want Flow to respect OS accessibility settings and be fully keyboard-operable.

**Acceptance Criteria:**
- [ ] All interactive elements have `aria-label` attributes
- [ ] Node types announced to screen readers: "Terminal window 1", "Image file, architecture.png, window 3"
- [ ] Tool call cards announce status changes (`aria-live="polite"`)
- [ ] `prefers-reduced-motion`: when active, all spring animations become instant (0ms), no bounces, no icon rotations, no materialization effects; panels still transition with simple 200ms ease
- [ ] High contrast mode (Settings → Appearance toggle): border opacity → 0.20, text opacity → 1.0, glass fill → 0.88, focus ring → 3px solid white
- [ ] All interactive elements ≥ 36×36px (exceeds WCAG 2.5.8 minimum of 24×24)
- [ ] Color independence: agent states use both color AND text labels; node badges use icons not just colors
- [ ] Focus trap in Spotlight, Settings, and Onboarding overlays (Tab cycles only within overlay)
- [ ] Typecheck/lint passes

---

## Functional Requirements

- **FR-1:** The application must run as a native desktop app on macOS, Windows, and Linux via Electron 33+
- **FR-2:** The canvas must support pan (middle-click drag, Space+drag, trackpad), zoom (Ctrl+scroll, pinch, ⌘+/-/0) and a zoom range of 25–200%
- **FR-3:** Four node types must be supported: file, terminal, browser, web app — each with distinct rendering and context menu
- **FR-4:** File nodes must render chromeless at rest; chrome (title bar, border, resize handles) appears only on hover
- **FR-5:** Terminal nodes must embed xterm.js with node-pty (real PTY, not fake); scrollback 10,000 lines
- **FR-6:** Browser nodes must embed Chromium via Electron WebContentsView with full CDP access per node
- **FR-7:** The Spotlight command palette must handle all navigation, creation, search, and agent invocation commands
- **FR-8:** Agent calls via Spotlight must run asynchronously (background) with a persistent notification tracking progress
- **FR-9:** Agent calls via the chat panel must stream responses and tool calls in real-time
- **FR-10:** The Orbiter IPC bridge must support `agent.run`, `agent.stream`, `agent.status`, `agent.stop`, and `canvas.context`
- **FR-11:** Canvas state must auto-save every 30s (configurable) and support manual named snapshots
- **FR-12:** Undo stack must track 100 canvas operations; `⌘Z`/`⌘⇧Z` must work from any focus layer
- **FR-13:** All UI chrome must use the Liquid Glass material system (frosted glass, progressive blur halos, monochromatic-by-default color system)
- **FR-14:** All animations must follow the spring-based motion spec; `prefers-reduced-motion` collapses animations to instant
- **FR-15:** Every feature must be accessible via keyboard; minimum 36×36px touch targets

---

## Non-Goals (Out of Scope)

- Mobile / tablet version
- Cloud sync or multi-user collaboration (single-user, local-first only)
- Built-in LLM inference (Orbiter handles all model calls — Flow is UI-only for agents)
- Custom scripting / macro system beyond workflow chains
- Plugin ecosystem / extension API
- Video/audio recording of the canvas
- Real-time collaborative editing of shared files
- Fine-tuning or model training of any kind
- External database — all state stored as local JSON files

---

## Design Considerations

- **Liquid Glass Material:** All chrome built on the `.glass` and `.glass-pill` CSS classes defined in §2. No shimmer, no specular — honest frosted glass via progressive blur layers.
- **Monochromatic by default:** The resting UI is grayscale. Color only appears on hover/active/running states. This creates a calm, focused workspace.
- **Existing component library reference:** See design spec §2 for complete CSS token values, §2.5 for full Lucide icon mapping, §2.4 for motion curve definitions.
- **Icon library:** Lucide React (primary, all UI chrome) + Phosphor Icons (secondary, decorative/file-type); 4 custom SVG icons for Flow-specific concepts (`flow-canvas`, `flow-agent-beam`, `flow-multi-select`, `flow-spotlight`)
- **Typography:** SF Pro (macOS) / Segoe UI (Windows) / system-ui (Linux) via CSS font stack
- **State management:** Zustand (no Redux/Context API for app state)
- **Canvas rendering:** Consider `@xyflow/react` (React Flow) for initial implementation; can be replaced with custom WebGL canvas if performance demands it

---

## Technical Considerations

- **Electron architecture:** Main process manages Orbiter subprocess, file watcher, auto-save, global shortcuts, CDP port assignment. Renderer process is a React SPA.
- **IPC:** Use `contextBridge` + `ipcRenderer`/`ipcMain` with typed channels; consider `electron-trpc` for type-safe IPC
- **Browser node implementation:** `WebContentsView` (Electron 28+) preferred over `BrowserView` (deprecated); each has a unique CDP debug port
- **xterm.js + node-pty:** node-pty must run in main process (native module); communicate with renderer via IPC
- **Monaco Editor:** Lazy-load per file node to avoid bundling the full editor upfront
- **pdf.js:** Use the pre-built minified worker; lazy-load
- **Canvas persistence:** JSON files in `~/Flow/canvases/[canvas-id]/`; use a debounced write to avoid excessive disk I/O during auto-save
- **Orbiter discovery:** Configurable Python path; fallback to `python3 -m orbiter` if no explicit path set
- **Performance:** Target 60fps canvas pan/zoom; virtualize node rendering for canvases with >50 nodes (only render nodes in viewport + margin)

---

## Success Metrics

- Open Spotlight, type `@assistant`, and send a message in under 5 keystrokes
- Pan and zoom the canvas with zero perceptible frame drops at typical node counts (10–20 nodes)
- Create a terminal node, run a command, pipe output to an agent — all within 30 seconds
- No canvas state lost across app restarts (auto-save persists correctly)
- All 38 user stories pass their acceptance criteria

---

## Open Questions

1. **Electron vs Tauri:** The design spec specifies Electron (for CDP/BrowserView, node-pty, global shortcuts). Confirm this is the target platform — Tauri has limitations with browser embedding and native terminal emulation that would require significant workarounds.
2. **Orbiter protocol details:** Is Orbiter communicating via stdio JSON-RPC, local HTTP/WebSocket, or Unix socket? This affects the IPC bridge implementation.
3. **Canvas library:** Start with `@xyflow/react` or build a custom infinite canvas? React Flow is faster to get started but may need replacing if the node volume grows.
4. **Multi-window:** Should each canvas open in a separate OS window, or is single-window multi-canvas (tab-like) the intended model?
5. **Agent corrections memory (§15.40) and conversation branching (§15.43):** Are these in scope for v1 or deferred?
6. **Node Thumbnail Strip (§15.49) and Canvas Comments (§15.46):** These are listed in the spec's "advanced" section — include in v1 or defer?
