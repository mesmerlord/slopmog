# SlopMog Design System

Reference design: `variations/variation-final-b.html`

---

## Brand Identity

**Personality:** Fun, irreverent, self-aware. We know the name is ridiculous — that's the point. The copy leans into humor and honesty rather than corporate polish. Think "friend who's really good at marketing" not "agency pitch deck."

**Tagline:** "The name is ridiculous. The results aren't."

**Mascot:** A coral-colored blob character with antenna (yellow tip), expressive eyes, a smile, and stubby arms. Appears at multiple sizes throughout the site — hero (large), demo section (small), pricing (tiny peeking), CTA (medium). Always animated with a gentle bounce.

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#FFF8F0` | Page background (warm cream) |
| `--teal` | `#2EC4B6` | Primary brand color, CTAs, links, accents |
| `--teal-dark` | `#25a89c` | Teal hover states |
| `--teal-light` | `#e8f8f6` | Teal badges, soft backgrounds |
| `--teal-bg` | `#f0faf9` | Section alternate backgrounds |
| `--coral` | `#FF6B6B` | Secondary/action color, primary buttons, mascot body |
| `--coral-dark` | `#e55a5a` | Coral hover states, mascot arms/antenna |
| `--yellow` | `#FFD93D` | Accent highlights, sparkles, stars, antenna tip |
| `--lavender` | `#B197FC` | Decorative accent, avatar backgrounds, doodles |
| `--charcoal` | `#2D3047` | Primary text, dark backgrounds (CTA section) |
| `--charcoal-light` | `#4a4d63` | Secondary text, descriptions |
| `--white` | `#ffffff` | Card backgrounds, button text |

**Color usage rules:**
- Coral for primary action buttons (Get Started, Start Campaign)
- Teal for secondary actions, links, section labels, feature check icons
- Background alternates between `--bg` (cream) and `--teal-bg` (light teal) for section rhythm
- Dark sections use `--charcoal` background (CTA) or `--teal` background (stats)

---

## Typography

| Role | Font | Weight | Usage |
|---|---|---|---|
| Headings | Quicksand | 700 | All h1-h6, pricing names/prices, FAQ questions, nav logo |
| Body | Nunito | 400-700 | Body text, descriptions, buttons, nav links |

**Key sizes:**
- Hero h1: `clamp(2.2rem, 4.5vw, 3.2rem)`
- Section titles: `clamp(1.8rem, 4vw, 2.6rem)`
- Body text: `1rem - 1.15rem`
- Small text/labels: `0.75rem - 0.88rem`
- Section labels: `0.78rem` uppercase, `letter-spacing: 1.5px`

---

## Spacing & Layout

- **Max width:** 1140px container
- **Section padding:** 100px vertical (80px for stats)
- **Card border radius:** 16px (`--radius`), 24px (`--radius-lg`) for larger cards
- **Button border radius:** 50px (pill shape)
- **Grid gaps:** 24-48px between columns, 32-40px between rows

**Shadows:**
- `--shadow-sm`: `0 2px 8px rgba(45,48,71,0.06)` — nav, subtle cards
- `--shadow-md`: `0 4px 20px rgba(45,48,71,0.08)` — cards, pipeline
- `--shadow-lg`: `0 8px 40px rgba(45,48,71,0.12)` — comic strip, hover states

---

## Components

### Buttons
- **Primary (coral):** Pill shape, coral bg, white text, coral shadow. Hover: darker coral + lift + stronger shadow.
- **Secondary (outline):** Pill shape, white bg, charcoal text, subtle border. Hover: teal border + teal text + lift.
- **Pricing outline:** Pill, teal border + text. Hover: fills teal.
- **Pricing filled:** Pill, coral bg. Hover: darker coral + lift.
- **Nav CTA:** Smaller coral pill in the navbar.

### Cards
- White background, `--radius` or `--radius-lg` border radius
- Subtle border: `2px solid rgba(45,48,71,0.06)`
- Shadow on hover, slight translateY(-2px to -4px) lift

### Section Pattern
Each section follows: `section-label` (teal uppercase) → `section-title` (large heading) → `section-sub` (muted description) → content

### Testimonials
Speech bubble style with:
- Decorative opening quote mark (coral, 25% opacity)
- Triangle tail pointing down-left
- Author row below the bubble with colored avatar circle

### Pricing Cards
- 3-tier grid, middle card slightly scaled up (1.04) with teal border and "Most Popular" badge
- Small mascot peeking from bottom-right of popular card

### FAQ
- Accordion with plus icon that rotates 45° to become X when open
- Icon background transitions from light teal to solid teal when open

---

## Animations

| Animation | Duration | Easing | Usage |
|---|---|---|---|
| `mascotBounce` | 3s | ease-in-out | Mascot body morph + subtle bounce |
| `eyeLook` | 5s | ease-in-out | Pupils shifting left/right |
| `antennaWiggle` | 2s | ease-in-out | Antenna sway |
| `armWaveLeft/Right` | 2s | ease-in-out | Arms waving |
| `floatChat` | 4s | ease-in-out | Chat bubbles floating up/down |
| `upvoteRise` | 4s | ease-in-out | Upvote arrows floating + rotating |
| `sparkleRotate` | 3s | linear | Sparkles rotating + scaling |
| `heroMascotIn` | 1.2s | cubic-bezier(0.16,1,0.3,1) | Hero entrance (fade + slide up) |
| `tickerScroll` | 30s | linear | Infinite horizontal ticker scroll |
| Scroll reveal | 0.7s | ease | Elements fade up on scroll into view |
| Stat counters | 2s | cubic ease-out | Numbers counting up on scroll |
| Demo auto-toggle | 4s interval | — | Before/After cards auto-switch |

---

## Mascot Sizes Reference

| Context | Body size | Used in |
|---|---|---|
| Hero | 200×180px | Main mascot scene with chat bubbles, sparkles, upvotes |
| Demo | 60×54px | Small blob peeking beside demo card |
| Pricing | 46×42px | Tiny blob peeking from popular pricing card |
| CTA | 110×100px | Medium blob next to CTA text |

Each size overrides the default `.mascot-blob` dimensions via a parent context class (`.demo-mascot`, `.pricing-mascot`, `.cta-mascot`).

---

## Page Sections (in order)

1. **Nav** — Fixed, blurred glass background, logo + links + coral CTA pill
2. **Hero** — Two-column: headline + buttons left, mascot scene + pipeline cards right
3. **Ticker** — Infinite scrolling pill stats on light teal background
4. **How It Works** — 3-panel comic strip with numbered steps and connecting arrows
5. **Demo** — Before/After toggle showing AI search results (auto-toggles every 4s)
6. **Stats** — 4 animated counters on teal background
7. **Testimonials** — 3 speech-bubble testimonials with Reddit-style formatting
8. **Pricing** — 3-tier cards, middle one highlighted
9. **FAQ** — Accordion on light teal background
10. **CTA** — Dark charcoal section with mascot + closing pitch
11. **Footer** — Logo, nav links, copyright

---

## Copy Voice Guidelines

- Self-deprecating about the name ("The name is ridiculous. The results aren't.")
- Direct and honest ("It's not manipulation. It's just really, really good marketing.")
- Conversational, not corporate ("Three steps. No magic.")
- Light urgency without being pushy ("Your competitors figured this out last quarter.")
- Reddit-native tone in examples ("Changed my life tbh", "10/10 recommend")
