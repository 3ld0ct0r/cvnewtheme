---
name: CV Resume Theme
description: A precise technical dossier for senior hiring review on screen and A4.
colors:
  dossier-blue: "#0066ae"
  evidence-ink: "#1f2328"
  body-slate: "#47505c"
  muted-text: "#5b7186"
  muted-icon: "#6f8498"
  quiet-divider: "#eaeaea"
  resume-surface: "#ffffff"
  page-canvas: "#f8f9fa"
typography:
  name:
    fontFamily: "CV Resume Sans, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 800
    lineHeight: 1.03
    letterSpacing: "0.04em"
  section:
    fontFamily: "CV Resume Sans, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "0.045em"
  body:
    fontFamily: "CV Resume Sans, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.825rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  metadata:
    fontFamily: "CV Resume Sans, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.34
    letterSpacing: "normal"
rounded:
  focus: "0.15rem"
  tooltip: "0.25rem"
  action: "0.5rem"
spacing:
  xs: "0.25rem"
  action-gap: "0.375rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  screen-inset: "1.9rem"
components:
  resume-surface:
    backgroundColor: "{colors.resume-surface}"
    textColor: "{colors.body-slate}"
    padding: "{spacing.screen-inset}"
  resume-name:
    textColor: "{colors.dossier-blue}"
    typography: "{typography.name}"
  section-heading:
    textColor: "{colors.dossier-blue}"
    typography: "{typography.section}"
    padding: "0 0 0.12rem"
  contact-entry:
    textColor: "{colors.body-slate}"
    typography: "{typography.metadata}"
  action-target:
    textColor: "{colors.muted-icon}"
    rounded: "{rounded.action}"
    height: "2.5rem"
    width: "2.5rem"
  action-tooltip:
    backgroundColor: "{colors.evidence-ink}"
    textColor: "{colors.resume-surface}"
    typography: "{typography.metadata}"
    rounded: "{rounded.tooltip}"
    padding: "0.3rem 0.45rem"
  skill-group-label:
    textColor: "{colors.dossier-blue}"
    typography: "{typography.metadata}"
---

# Design System: CV Resume Theme

## Overview

**Creative North Star: "Technical Dossier"**

The interface behaves like a carefully prepared technical dossier: compact, evidence-led, and calm under scrutiny. Hierarchy comes from weight, spacing, and alignment rather than decorative surfaces. The desktop sheet uses a 54/46 identity header and a 60/40 evidence/sidebar body from 992px upward; smaller screens stack the same semantic reading order without changing the content model.

Screen and print are one system. Screen presentation adds one ambient outer-sheet shadow and generous framing; A4 removes that elevation, compacts spacing, and keeps the same 60/40 composition at legible 8.75pt and 8pt floors. The system rejects portfolio theatrics and anything that competes with the candidate's evidence.

**Key Characteristics:**

- Restrained blue emphasis on a neutral white sheet.
- Dense but readable typesetting with explicit weight roles from 400 through 800.
- Semantic contact and action navigation with monochrome inline geometry.
- Stable desktop composition, straightforward mobile stacking, and measured A4 output.
- No presentation dependency on network fonts, runtime icons, or decorative motion.

## Colors

The palette is a neutral dossier sheet with one disciplined blue signal and two separate muted roles for text and geometry.

### Primary

- **Dossier Blue** (`#0066ae`): Names, section headings, links, active icon states, and 2px focus outlines.

### Neutral

- **Evidence Ink** (`#1f2328`): Headings, strong text, tooltip surfaces, and primary evidence emphasis.
- **Body Slate** (`#47505c`): General prose and ordinary linked metadata.
- **Muted Text** (`#5b7186`): Dates, roles, and secondary text that must retain normal-text contrast.
- **Muted Icon** (`#6f8498`): Decorative icon geometry and bullet markers only, never small text.
- **Quiet Divider** (`#eaeaea`): One-pixel column and group boundaries.
- **Resume Surface** (`#ffffff`): The resume sheet and tooltip foreground.
- **Page Canvas** (`#f8f9fa`): The screen-only background around the sheet.

### Named Rules

**The One Signal Rule.** Dossier Blue is the only chromatic accent and should occupy less than 10% of the visible sheet.

**The Muted Roles Rule.** Use `#5b7186` for readable small text and reserve `#6f8498` for non-text graphical objects.

## Typography

**Display Font:** CV Resume Sans (with the system sans-serif fallback stack)

**Body Font:** CV Resume Sans (with the system sans-serif fallback stack)

**Character:** A single variable sans family provides the register of a technical document rather than a portfolio. Weight and modest width variation create hierarchy without a second display voice, synthetic styles, or forced smoothing.

### Hierarchy

- **Name** (800, `0.98rem`, `1.03`): Compact identity anchor in Dossier Blue with restrained `0.04em` tracking.
- **Section** (700, `1rem`, `1.14`): Short uppercase labels with `0.045em` tracking and balanced wrapping.
- **Role and skill group** (600, `0.75rem` to `0.82rem`): Local structure inside entries and the sidebar.
- **Body** (400, `0.825rem`, `1.45`): Summaries and outcomes, capped at 70 characters in the main evidence column.
- **Metadata** (500, `0.75rem`, `1.34`): Contact details, dates with tabular lining numerals, and compact sidebar facts.
- **Strong evidence** (700 to 800): Section titles, measurable emphasis, names, and primary companies.

### Named Rules

**The One Family Rule.** CV Resume Sans is the sole authored family; only the system sans-serif stack may follow it as a fallback.

**The Legibility Floor Rule.** Main copy stays at or above `0.825rem` on screen and `8.75pt` in print; secondary copy stays at or above `0.75rem` and `8pt`.

## Elevation

The system is flat inside the document. Screen depth comes from a single ambient outer-sheet shadow (`0 1rem 3rem rgba(0, 0, 0, 0.175)`) on the borderless resume surface against the Page Canvas. Dividers and whitespace organize all internal content. Print removes every shadow and screen-only decoration.

### Shadow Vocabulary

- **Outer sheet** (`box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.175)`): Screen framing only; never apply it to sections, entries, tooltips, or nested containers.

### Named Rules

**The Single Plane Rule.** Only the complete resume sheet may appear elevated; everything inside it remains on one visual plane.

## Components

### Resume Surface

- **Shape:** Square, borderless white sheet with `1.9rem` desktop inset and `1rem` mobile inset.
- **Composition:** 54/46 header, 60/40 desktop and print body, full-width stacked body below 992px.
- **State:** Ambient shadow on screen, completely flat in print.

### Contact Navigation

- **Structure:** An `address` with an ordered list. The shipped header orders PDF, email, and location; the PDF link contains its decorative inline SVG, email is text-only, and location retains its decorative SVG.
- **Typography:** Weight 500, `0.75rem`, and 96% width; location is plain text while link kinds remain same-tab links.
- **Layout:** One row where space allows, then a readable wrapped sequence on narrower screens.
- **PDF state:** The icon and “Download PDF” label share a 40px-high, 8px-corner target with the restrained blue hover tint and the standard 2px focus-visible outline.

### Resume Actions

- **Shape:** Transparent 40 by 40px targets, 8px corners, 6px gaps, and `1.1rem` monochrome SVGs.
- **Hover:** An 8% Dossier Blue tint with icon color changing to Dossier Blue.
- **Focus:** A 2px Dossier Blue outline with a 2px offset.
- **Tooltip:** Evidence Ink surface, white text, bounded width, and visual-only `aria-hidden` copy; the hidden label remains the accessible name.
- **Print:** Compact linked icons, no tooltip or hover chrome, with the PDF self-download action omitted.

### Section Headings

- **Style:** Dossier Blue, weight 700, normal uppercase transformation, restrained tracking, and a one-pixel blue underline at 38% opacity.
- **Behavior:** Balanced wrapping and a heading-follow rule in print.

### Evidence Entries

- **Hierarchy:** Weight 800 company, weight 600 role, weight 500 date, then weight 400 prose and bullets.
- **Rhythm:** Clear separation between roles without cards; compact entries avoid page breaks when they fit.
- **Copy measure:** Main outcomes remain at or below 70 characters per line where the layout allows.

### Skill Groups

- **Style:** Weight 600 Dossier Blue group labels followed by compact inline skills at the secondary type floor.
- **Separation:** A one-pixel Quiet Divider between groups; no pills or badges.

## Do's and Don'ts

### Do:

- **Do** let evidence lead through weight, alignment, and measured spacing.
- **Do** use `#0066ae` for semantic emphasis and the focus outline, `#5b7186` for small muted text, and `#6f8498` only for non-text icons.
- **Do** keep action targets at 40 by 40px with 6px gaps and a 2px focus-visible outline.
- **Do** preserve the 54/46 header and 60/40 body at 992px and above, then stack in source order below it.
- **Do** keep screen and A4 print behavior in the same component and verify both after typography or spacing changes.
- **Do** render monochrome SVG geometry inline while visible text and hidden labels carry meaning.

### Don't:

- **Don't** use generic portfolio theatrics, decorative gradients, glass effects, platform-brand colors, or oversized pill controls.
- **Don't** use tiny low-contrast copy, synthetic small caps, excessive tracking, or arbitrary shrinking to force unlimited content onto one page.
- **Don't** add runtime icon libraries, external font CDNs, decorative motion, or interactions whose meaning depends on color or tooltip text.
- **Don't** use repeated colored side-stripe accents, nested cards, or template decoration that competes with resume evidence.
- **Don't** add a second display typeface, gradient text, forced font smoothing, or synthesized font styles.
- **Don't** use `#6f8498` for text or introduce a colored side border wider than 1px.
