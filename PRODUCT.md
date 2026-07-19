# Product

## Register

brand

## Users

Senior technical hiring teams reviewing a candidate's scope, evidence, and fit on screen or as an A4 PDF. Candidates and maintainers use the theme to publish a concise resume without taking on presentation logic in each consuming site.

## Product Purpose

`cvnewtheme` turns structured Hugo resume content into a fast, accessible, responsive, and printable professional profile. Success means that the same content remains easy to scan on a phone, credible on a desktop, and complete in the supported one-page A4 fixture without external font or icon runtimes.

## Brand Personality

Precise, assured, restrained. The surface should feel like a carefully typeset technical dossier: dense enough to reward scrutiny, calm enough to scan quickly, and explicit about every interaction.

## Anti-references

- Generic portfolio theatrics, decorative gradients, glass effects, platform-brand colors, and oversized pill controls.
- Tiny low-contrast copy, synthetic small caps, excessive tracking, or arbitrary shrinking to force unlimited content onto one page.
- Runtime icon libraries, external font CDNs, decorative motion, and interactions whose meaning depends on color or tooltip text.
- Repeated colored side-stripe accents, nested cards, or other template decoration that competes with resume evidence.

## Design Principles

- Let evidence lead: typography and spacing clarify the candidate's work instead of becoming the subject.
- Keep ownership explicit: the theme owns presentation and validation; consumers own semantic content and order.
- Make every byte accountable: self-host a measured font subset and render only the icon geometry the page uses.
- Design screen and print together: responsive improvements must preserve a stable, readable A4 composition.
- Fail early and specifically: invalid configuration and stale generated assets stop the build with actionable errors.

## Accessibility & Inclusion

Meet WCAG 2.2 AA for text, focus, semantics, and interaction. Preserve visible keyboard focus, 40-pixel screen action targets, reduced-motion and forced-colors behavior, meaningful link text, and a logical reading order. Do not use synthetic font styles or color alone to communicate meaning.
