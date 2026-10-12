# BrandGuard — Brand Impersonation & Scam Defense Frontend

A demo-ready, explainable risk assessment frontend built for the **Kampus.VC challenge**. BrandGuard empowers registered brands to detect fake social-media profiles, lookalike websites, and counterfeit app listings impersonating their brand identity.

---

## 1. Setup & Running Locally

### Prerequisites
- Node.js >= 18
- npm

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
```bash
npm run build
npm run preview
```

---

## 2. React Bits Pro & Free Component Configuration

### `components.json` Registry Configuration
The React Bits Pro private registry configuration is located in `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {
    "@reactbits-pro": {
      "url": "https://pro.reactbits.dev/registry",
      "headers": {
        "Authorization": "Bearer ${REACTBITS_LICENSE_KEY}"
      }
    }
  }
}
```

### Install Commands for the Four Pro Blocks
Set your `REACTBITS_LICENSE_KEY` environment variable, then run:

```bash
npx shadcn@latest add @reactbits-pro/app-sidebar-2
npx shadcn@latest add @reactbits-pro/filtering-7
npx shadcn@latest add @reactbits-pro/authentication-12
npx shadcn@latest add @reactbits-pro/404-5
```

*Note: Custom adaptations conforming strictly to BrandGuard's design tokens and TypeScript models are pre-packaged directly in `src/components/pro/`.*

---

## 3. Where Each Animation Lives

| Purpose | Component | File Path | Animation Mechanics |
| :--- | :--- | :--- | :--- |
| **Platform Selector** | `GlideSelect` | `src/components/free/GlideSelect.tsx` | Spring pill layout animation (`stiffness: 380, damping: 32`), keyboard navigation (Arrow keys, Enter, Esc), tags. |
| **Analysis Header** | `LatticeLoader` | `src/components/free/LatticeLoader.tsx` | 3x3 orbit pulse pattern with real-time second timer; freezes and morphs into a green checkmark reading "Done in 1.8s". |
| **Analysis Steps** | `CallChip` | `src/components/free/CallChip.tsx` | 3 sequential chips (*Search ID*, *Compare brand names*, *Match credentials*); width fill bar with millisecond counters, washes green upon completion, error retry state. |
| **Watch Profile** | `BellToggle` | `src/components/free/BellToggle.tsx` | "Notify me" $\rightarrow$ "You'll be notified", swinging bell oscillation and ping sound wave ripples. |
| **Icon Rail** | `AppSidebar2` | `src/components/pro/AppSidebar2.tsx` | Spring rail marker sliding between items; hover/focus flyout tooltips; mobile bottom bar responsive transformation under 820px. |
| **Asset Gallery** | `Filtering7` | `src/components/pro/Filtering7.tsx` | Multi-select facet chips (OR within groups, AND between groups); entrance stagger fade and 12px slide up. |
| **Invitation Modal** | `Authentication12` | `src/components/pro/Authentication12.tsx` | Focus-trapped modal dialog; 4-bar password strength meter; animated SVG path-length checkmark upon success. |
| **404 Screen** | `NotFound5` | `src/components/pro/NotFound5.tsx` | Massive 404 with 5 scattered, tilted cards that drop in with spring bounce physics; Esc key triggers home navigation. |
| **Theme Toggle** | `toggleThemeWithReveal` | `src/lib/theme.ts` | Circular clip-path expansion originating from button click coordinates using the View Transitions API (700ms fallback). |
| **Smooth Scrolling** | `useLenisScroll` | `src/hooks/useLenisScroll.ts` | Lenis smooth scroll engine; automatically disabled when `prefers-reduced-motion` is active. |

---

## 4. Detection Logic & Scoring Engine (`src/data/detection.ts`)

- **Handle Normalization**: Converts handles to lowercase, strips URLs, swaps lookalikes (`rn` $\rightarrow$ `m`, `0` $\rightarrow$ `o`, `1` $\rightarrow$ `l`), and removes misleading suffixes (`official`, `support`, `help`, `care`, `team`, `desk`).
- **Levenshtein Distance & Substring Anchor**: Evaluates proximity to registered IDs and official brand name. A contained official name scores $\ge 0.90$.
- **Content Semantic Overlap**: Computes token overlap between submitted profile bio/display name and the registered brand scope.
- **Credential Validation**: Compares clean 10-digit phone number and verified domain/email.
- **Strict Cap Rule**: A name-only match is capped at **Medium Anomaly** to eliminate false-positive scam accusations.
- **Exact Official Records**: Exact matches against certified registered assets immediately return green **Official Identity** status.
- **Explainable Disclaimers**: Every result features the mandatory notice: *"Results are risk estimates with evidence, never accusations."*

---

## 5. Assumptions & Scope Boundaries

1. **Client-side Prototype Engine**: Analysis runs via a deterministic client-side engine in `src/data/detection.ts` mimicking server weights ($0.30$ name, $0.20$ link, $0.15$ bio, $0.15$ credentials, $0.20$ keywords). In production, logo computer vision and distributed search crawlers will run on the backend.
2. **Zero Platform Scraping**: The app adheres strictly to privacy rules—evaluating only user-submitted inputs (URL, display name, bio text, phone, email) without bypassing platform login walls.
3. **Phase 2 Monitoring**: As required, background persistent surveillance and push notifications are represented with an honest placeholder explaining upcoming webhooks and cron sweeps.
