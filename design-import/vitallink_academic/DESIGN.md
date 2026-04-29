---
name: VitalLink Academic
colors:
  surface: '#f4fcf2'
  surface-dim: '#d4dcd3'
  surface-bright: '#f4fcf2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef6ec'
  surface-container: '#e8f0e6'
  surface-container-high: '#e2eae1'
  surface-container-highest: '#dde5db'
  on-surface: '#161d18'
  on-surface-variant: '#3d4a3f'
  inverse-surface: '#2b322c'
  inverse-on-surface: '#ebf3e9'
  outline: '#6d7b6e'
  outline-variant: '#bccabc'
  surface-tint: '#006d3c'
  primary: '#006d3c'
  on-primary: '#ffffff'
  primary-container: '#12b76a'
  on-primary-container: '#004021'
  inverse-primary: '#51df8e'
  secondary: '#006d3d'
  on-secondary: '#ffffff'
  secondary-container: '#85f6ae'
  on-secondary-container: '#007240'
  tertiary: '#426651'
  on-tertiary: '#ffffff'
  tertiary-container: '#82a991'
  on-tertiary-container: '#1a3e2b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#70fda7'
  primary-fixed-dim: '#51df8e'
  on-primary-fixed: '#00210e'
  on-primary-fixed-variant: '#00522c'
  secondary-fixed: '#88f9b0'
  secondary-fixed-dim: '#6bdc96'
  on-secondary-fixed: '#00210f'
  on-secondary-fixed-variant: '#00522c'
  tertiary-fixed: '#c3ecd2'
  tertiary-fixed-dim: '#a8d0b6'
  on-tertiary-fixed: '#002112'
  on-tertiary-fixed-variant: '#2a4e3a'
  background: '#f4fcf2'
  on-background: '#161d18'
  surface-variant: '#dde5db'
typography:
  h1:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 32px
  gutter: 24px
  card-padding: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The brand personality of this design system is **Reliable**, **Approachable**, and **Orderly**. It is tailored for the student body of Gordon College, aiming to transform the often-stressful clinical experience into a streamlined, digital-first interaction. 

The design follows a **Corporate / Modern** style with a focus on high-clarity information architecture. It leverages a clean, card-based layout that prioritizes content legibility. By using generous whitespace and a "soft-professional" aesthetic, the interface reduces cognitive load, making medical administrative tasks feel effortless and secure. The visual language balances the institutional authority of a college with the modern, efficient feel of a SaaS health platform.

## Colors

The color palette is anchored by a **Vibrant Green** (#12B76A), derived from the institution's heritage but refined for digital accessibility. 

- **Primary:** The vibrant green is used for key actions, progress indicators, and active states.
- **Secondary:** A deeper forest green is utilized for hover states and sidebar backgrounds to ensure high contrast against light text.
- **Tertiary/Accents:** Light mint washes are used for "Success" backgrounds and subtle card highlighting.
- **Neutrals:** A sophisticated range of cool greys (Zinc/Slate) provides the foundation. Backgrounds use a very light off-white to reduce screen glare, while surfaces (cards) remain pure white to "pop" against the background.
- **Status:** Standardized semantic colors for status include Amber for "Pending Review" and Crimson for "Action Required."

## Typography

This design system utilizes **Inter** for all text elements. Inter’s tall x-height and exceptional legibility at small sizes make it the ideal choice for a data-heavy student portal.

The hierarchy is strictly enforced:
- **Headings:** Use Semi-Bold and Bold weights with tight letter-spacing to command attention for page titles and section headers.
- **Body Text:** Uses a Regular weight with generous line height (150%) to ensure medical instructions and record details are easily readable.
- **Labels:** Small, medium-weight caps are used for metadata (e.g., file types like PDF, PNG) to differentiate them from interactive text.

## Layout & Spacing

The layout utilizes a **Fixed Grid** philosophy for the main content area to maintain focus, while the sidebar remains fixed to the left. 

A 12-column grid is employed with 24px gutters. Content is housed within a central container that has a maximum width of 1280px. Spacing follows a strict 4px / 8px incremental scale. Generous vertical rhythm is prioritized—sections are separated by 32px or 48px to allow the "cards" to breathe, ensuring the user does not feel overwhelmed by the density of medical data.

## Elevation & Depth

Visual depth in this design system is achieved through **Tonal Layering** and **Ambient Shadows**. 

The background layer is the lowest (`#F9FAFB`). Cards and interactive elements sit on the surface layer (`#FFFFFF`). To indicate elevation, cards use a very soft, diffused shadow (0px 4px 6px -2px rgba(16, 24, 40, 0.03)) rather than harsh borders. 

When a user interacts with a card (hover), the shadow increases slightly in spread and opacity to provide tactile feedback. This "Low-Elevation" approach maintains a clean, modern look while clearly defining separate pieces of information.

## Shapes

The shape language is defined by **Medium Roundedness**. This choice avoids the clinical coldness of sharp corners while maintaining more professionalism than full-pill shapes.

- **Standard Radius:** 8px (0.5rem) for primary cards and input fields.
- **Large Radius:** 16px (1rem) for large dashboard containers.
- **Small Radius:** 4px (0.25rem) for small chips, badges, and status indicators.

Consistency in corner radii across icons, buttons, and card containers creates a unified, polished aesthetic.

## Components

### Buttons
Primary buttons use the Brand Green with white text and 8px rounded corners. Secondary buttons use a white background with a light grey border.

### Sidebar Navigation
The navigation bar uses a dark-themed version of the primary color (Secondary Green). Active links are indicated by a high-contrast pill-shaped background and a vertical indicator line. Icons should be "Outline" style for a modern, lightweight look.

### Cards
Cards are the primary container. They must have a white background, 8px radius, and a subtle shadow. Internal padding should be a minimum of 24px.

### Input Fields
Inputs feature a 1px border (`#D0D5DD`) and 8px radius. On focus, the border transitions to the Primary Green with a soft outer glow.

### Status Chips
Small, low-profile badges used for "Approved," "Pending," or "File Type." These should use a subtle background tint (e.g., light green background with dark green text for "Approved").

### List Items
Record history should be presented in "Row Cards"—slim, horizontal containers that allow for quick scanning of submission dates and status.