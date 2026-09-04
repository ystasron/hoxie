---
name: Hoxie
description: Dark adaptation of the Claude.ai visual identity — warm charcoal surfaces, serif display, coral accent.
colors:
  claude-bg: "#262624"
  surface: "#2E2D2B"
  surface-inset: "#363532"
  border: "#43413C"
  text-primary: "#F4F3EE"
  text-muted: "#A8A5A0"
  coral: "#D97757"
  coral-hover: "#E08B6D"
  coral-ink: "#1F1E1C"
  google-white: "#ffffff"
  correct: "#74BE92"
  wrong: "#E07B74"
typography:
  display:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "clamp(2.5rem, 10vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  input:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 500
  stat:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "1.1rem"
    fontWeight: 600
  body:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  tab:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
  small:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 500
  meta:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
  caption:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
  micro:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  label:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 500
    letterSpacing: "0.06em"
rounded:
  card: "16px"
  control: "12px"
  small: "8px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "28px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.coral-ink}"
    rounded: "{rounded.control}"
    padding: "13px 22px"
  button-primary-hover:
    backgroundColor: "{colors.coral-hover}"
  input:
    backgroundColor: "{colors.surface-inset}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "13px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---
# Design System: Hoxie

## Overview

**Creative North Star: "The Coral Ledger"**

Hoxie is a dark adaptation of Claude.ai's visual identity: warm charcoal surfaces that never go pure black, a serif voice for the arithmetic itself, and a single coral accent reserved for action and earning. The interface reads like a quiet desk lamp over paper — every surface is a warm neutral, borders are hairline, and the only saturated thing in the room is the coral that marks what you can do and what you have earned. Motion is restrained: entrances fade up gently, the question slides in as if turned over, and a correct answer gives a single quiet pulse rather than a celebration.

The product is a daily drill, so the mode is **Operate**: scanability and calm win over expression. Depth comes from layered warm-black shadows and hairline borders, never gradients or glow. The math problem is the hero — big, serif, centered — because it is the entire product at the moment of use.

**Key Characteristics:**
- Warm charcoal neutrals with a faint brown undertone; no pure black, no cool grays
- Serif display (Source Serif 4) for the question; Schibsted Grotesk for every label and control
- One coral accent (Claude's `#D97757`) used only for primary action and the points that earn
- Hairline borders + soft warm shadows for depth; flat surfaces at rest
- Gentle authored motion: fade-up entrances, question turn-in, a single pulse on earnings

## Colors

A warm dark neutral ground with one coral accent, adapted from Claude.ai's dark theme.

### Primary
- **Claude Coral** (#D97757): The only saturated color. Primary buttons, the points values that increase, focus rings, progress fill, active tab. Hover lightens to `#E08B6D`. Text on coral is near-black **Coral Ink** (#1F1E1C).

### Neutral
- **Charcoal Ground** (#262624): Page background. Warm, never pure black.
- **Surface** (#2E2D2B): Cards, stats, panels — one step off the ground.
- **Inset** (#363532): Inputs and recessed controls.
- **Hairline** (#43413C): Borders and dividers.
- **Warm Paper** (#F4F3EE): Primary text.
- **Faded Paper** (#A8A5A0): Secondary text, labels, placeholders.

### Semantic
- **Sage** (#74BE92): Correct-answer feedback text on a faint sage tint.
- **Rust Red** (#E07B74): Wrong-answer and limit feedback text on a faint red tint.

**The One Coral Rule.** Coral covers less than 5% of any screen at rest. Its rarity is what makes earning read as an event.

## Typography

**Display Font:** Source Serif 4 (with Georgia, serif fallback)
**Body Font:** Schibsted Grotesk (with system-ui fallback)

**Character:** A literary serif for the arithmetic — the math problem is typeset like a line of prose — against a neutral, confident sans for the interface around it. The pairing gives the numbers warmth and the controls quiet authority. The brand is the rectangular Hoxie logo alone; no wordmark is typeset.

### Hierarchy
- **Display** (600, clamp(2.5rem, 10vw, 3.5rem), 1.1): The math question. Centered, tabular numerals.
- **Input** (500, 1.15rem, 1.4): Answer field text.
- **Stat** (600, 1.1rem, 1.2): Stat values, serif numerals.
- **Body** (400, 1rem, 1.5): Interface copy, buttons, inputs.
- **Tab** (600, 0.95rem, 1.2): Segmented control labels.
- **Small** (500, 0.9rem, 1.4): Auth subtitle, auth messages.
- **Meta** (500, 0.85rem, 1.3): User bar, logout.
- **Caption** (400, 0.8rem, 1.4): Footnote.
- **Micro** (500, 0.75rem, 1.4): Progress note, question label.
- **Label** (500, 0.72rem, tracked 0.06em, uppercase): Stat labels.

## Layout

One centered column, max-width 560px, generous vertical rhythm. The question card is the visual center: above it a slim progress bar and three compact stat chips (Total Earnings, Today, Questions); below it the answer form. Auth screen mirrors the same card language at 420px. Spacing rhythm: tight inside groups (12px), generous between groups (20–28px), always more space above a heading than below it.

## Elevation & Depth

Hybrid: flat surfaces defined by hairline borders, with soft warm shadows for lift. Cards sit one step above the ground via background tone plus a soft shadow; interactive elements never glow at rest.

### Shadow Vocabulary
- **Card lift** (`0 1px 2px rgba(0,0,0,.18), 0 12px 32px rgba(0,0,0,.22)`): Main card and auth card.
- **Control lift** (`0 2px 6px rgba(0,0,0,.2)`): Buttons and the Google button at rest.
- **Hover lift** (`0 4px 14px rgba(0,0,0,.35)`): Buttons on hover.

**The Flat-By-Default Rule.** Surfaces are flat at rest; the only response to state is a border-color shift, a 1px translate on press, or a soft hover shadow on primary actions.

## Shapes

Gently curved throughout: cards at 16px, controls and inputs at 12px, small chips and progress at full-round. Pill shapes are reserved for small controls only — never for cards. Inputs sit inset (darker than their surface) with a hairline border that warms to coral on focus, plus a 2px offset focus ring.

## Components

### Buttons
- **Shape:** Rounded (12px), comfortable height (46px).
- **Primary:** Coral background, Coral Ink text, semibold. Hover lightens to `#E08B6D` with a soft shadow; press translates down 1px.
- **Google:** White background, near-black text, 1px border; the one intentionally bright element, kept pristine.
- **Ghost:** Transparent, hairline border, muted text that warms to primary on hover.

### Tabs (auth)
- **Style:** Segmented control on an inset surface; the active tab is coral with Coral Ink text; inactive tabs are muted and warm on hover.

### Cards / Containers
- **Corner Style:** Rounded (16px)
- **Background:** Surface (#2E2D2B)
- **Border:** 1px Hairline (#43413C)
- **Shadow:** Card lift
- **Internal Padding:** 28–32px horizontal, 28–36px vertical

### Inputs / Fields
- **Style:** Inset background (#363532), 1px Hairline border, rounded (12px)
- **Focus:** Border warms to coral + 2px offset coral focus ring
- **Feedback:** Error text in Rust Red naming the problem and the fix

### Stat Chips
- **Style:** Surface background, hairline border, rounded (12px); label in Label style, value in serif semibold. The Total Earnings value pulses once when it increases.

### Progress Bar
- **Style:** 6px track in inset tone, full-round; coral fill with a 0.3s width transition.

### Feedback Line
- **Style:** Full-width message inside the question card; fades up on state change. Correct = Sage text on faint sage tint; wrong = Rust Red on faint red tint.

## Do's and Don'ts

### Do:
- **Do** set the question in the serif display face — it is the product's voice.
- **Do** reserve coral for action and earnings; muted warm neutrals carry everything else.
- **Do** keep motion gentle: fade-ups under 0.5s, a single pulse on earning, nothing that bounces or spins.
- **Do** use hairline borders plus a soft warm shadow for card depth.

### Don't:
- **Don't** use pure black, cool grays, or blue-tinted darks — the palette is warm charcoal.
- **Don't** add gradient text, glassmorphism, or glowing accents.
- **Don't** animate the question continuously; it enters once and rests.
- **Don't** let coral cover more than ~5% of any screen at rest.