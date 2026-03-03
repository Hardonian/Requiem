# Accessibility Statement: ReadyLayer UI / Zeo

## ♿ Commitment to Accessibility

Zeo is committed to ensuring that the **ReadyLayer UI** and **Microfracture Suite** dashboard are accessible to all users, regardless of ability.

## Core Accessibility Standards

**Designed to Support**:

- **WCAG 2.1 Level AA**: All UI components are verified for AA compliance using automated and manual testing.
- **Section 508**: US government accessibility standards.
- **EN 301 549**: European digital accessibility standards.

## Accessibility Features

### 1. Keyboard Navigable

- All interactive elements are reachable via the `TAB` key.
- A visible focus ring (`ring-2 ring-primary`) is mandatory for all active states.
- No `div` is used as a button without a corresponding `role="button"` and `onKeyDown` handler.

### 2. High Contrast Mode

- Color palettes are derived from **HSL tokens** designed for WCAG-AA contrast ratios.
- Support for system-level "Prefer Reduced Motion" and "Prefer High Contrast" settings.

### 3. Screen Reader Support

- Semantic HTML (`<main>`, `<nav>`, `<article>`, `<aside>`) is used for all layout structures.
- `aria-label` and `aria-describedby` are used for complex data tables and execution fingerprint cards.

## Reach Verification Script

The `pnpm run verify:ui` script includes a check for:

- Missing Alternative Text.
- Non-semantic Interactive Elements.
- Poor Color Contrast ratios on primary buttons.

## Continuous Improvement

Accessibility is a first-class citizen in the **Microfracture Suite**. If a regression is detected, the `verify:ui` gate will fail in CI.
