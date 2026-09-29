import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

/**
 * Single source of truth for the brand colors.
 * Change BRAND_RGB and every border, tint, shadow, and derived export below
 * updates with it. Values match LiGHT Brand Guidelines (April 2026, p.11):
 *   Dark Blue (base)    #0C43A0  rgb(12, 67, 160)   -> brand.500 anchor
 *   Light Blue (accent) #68AFE7  rgb(104, 175, 231) -> brand.300
 */
const BRAND_RGB = '12, 67, 160'   // #0C43A0, official Dark Blue
const NAVY_RGB = '10, 26, 61'     // non-brand dark scrim for overlays only
const alpha = (rgb: string, a: number) => `rgba(${rgb}, ${a})`
const brand = (a: number) => alpha(BRAND_RGB, a)

export const system = createSystem(defaultConfig, defineConfig({
  theme: {
    tokens: {
      colors: {
        // Brand blue ramp anchored on the official palette (brand guidelines, p.11):
        // 300 = Light Blue (#68AFE7, accent), 500 = Dark Blue (#0C43A0, base).
        brand: {
          50: { value: '#eef4fc' },
          100: { value: '#d9e7f7' },
          200: { value: '#b4ccec' },
          300: { value: '#68afe7' },
          400: { value: '#3d84d4' },
          500: { value: '#0c43a0' },
          600: { value: '#0a3a8a' },
          700: { value: '#082f6f' },
          800: { value: '#062350' },
          900: { value: '#041634' },
        },
      },
      fonts: {
        // Ivy Presto Headline is Adobe-licensed; Playfair Display is the free stand-in.
        body: { value: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif' },
        heading: { value: '"Ivy Presto Headline", "Playfair Display", Georgia, serif' },
        mono: { value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      },
      // Corner-radius scale, by role. Custom names (not Chakra's xs/sm/md) so
      // existing default-token usage is untouched. Change a shape in one place.
      radii: {
        badge: { value: '2px' },
        control: { value: '3px' },
        card: { value: '4px' },
        hero: { value: '20px' },
      },
    },
    // Shared uppercase label typography. Callers set `color`, which varies by context.
    textStyles: {
      eyebrow: {
        value: {
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
        },
      },
      badgeLabel: {
        value: {
          fontSize: '10px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
        },
      },
      fieldLabel: {
        value: {
          fontSize: '10px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
        },
      },
      // Secondary meta text: page numbers, counts, dates, quiet captions.
      // The 600-weight sibling of `eyebrow`.
      metaLabel: {
        value: {
          fontSize: '11px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
        },
      },
      // Status captions: "Passed", "No deadlines on record".
      caption: {
        value: {
          fontSize: 'xs',
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
        },
      },
      // Small uppercase headings and back links on long-form pages.
      subhead: {
        value: {
          fontSize: 'xs',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        },
      },
    },
    semanticTokens: {
      colors: {
        // Brand-tinted hairline borders, by emphasis. Custom namespace to avoid
        // colliding with Chakra's gray-based `border.*` defaults. Nested (not
        // dotted keys) so Chakra emits proper `--chakra-colors-line-*` vars.
        line: {
          subtle: { value: brand(0.14) },
          default: { value: brand(0.22) },
          strong: { value: brand(0.3) },
          hover: { value: brand(0.55) },
        },
        // Dark scrim behind modals.
        overlay: {
          scrim: { value: alpha(NAVY_RGB, 0.45) },
        },
      },
    },
  },
  globalCss: {
    'html, body': {
      background: '#ffffff',
      color: '{colors.brand.900}',
    },
    '.tabular': {
      fontVariantNumeric: 'tabular-nums',
      fontFeatureSettings: '"tnum"',
    },
    'button, a': {
      transition: 'all 0.2s ease-in-out',
    },
    'button:active': {
      transform: 'scale(0.98)',
    },

    /* FullCalendar v7 (classic theme). Classes are attached through the *Class
       props in src/app/calendar/page.tsx. The theme stylesheet is unlayered and
       beats Chakra's layered globalCss, so contested properties need !important. */
    '.cal': {
      fontFamily: 'inherit',
      fontVariantNumeric: 'tabular-nums',
      '--fc-classic-primary': brand(1),
      '--fc-classic-today': brand(0.04),
      '--fc-classic-foreground': '{colors.brand.900}',
      '--fc-classic-border': brand(0.14),
      '--fc-classic-strong-border': brand(0.22),
    },

    /* Toolbar buttons */
    '.cal .cal-button': {
      background: 'white !important',
      border: `1px solid ${brand(0.35)} !important`,
      color: '{colors.brand.500} !important',
      fontSize: '1rem !important',
      lineHeight: '1.5 !important',
      letterSpacing: '0.16em !important',
      textTransform: 'lowercase',
      padding: '0.4em 0.65em !important',
      outline: 'none !important',
      boxShadow: 'none !important',
      transition: 'all 0.18s ease',
    },

    '.cal .cal-button:hover': {
      background: '{colors.brand.50} !important',
      borderColor: '{colors.brand.500} !important',
      color: '{colors.brand.500} !important',
      transform: 'none !important',
      boxShadow: 'none !important',
    },

    '.cal .cal-button:active': {
      background: '{colors.brand.50} !important',
      transform: 'none !important',
      boxShadow: 'none !important',
    },

    '.cal .cal-button:focus, .cal .cal-button:focus-visible': {
      outline: 'none !important',
      boxShadow: 'none !important',
    },

    '.cal .cal-button-active': {
      background: '{colors.brand.500} !important',
      borderColor: '{colors.brand.500} !important',
      color: 'white !important',
      boxShadow: 'none !important',
    },

    '.cal .cal-button-active:hover': {
      background: '{colors.brand.700} !important',
      borderColor: '{colors.brand.700} !important',
      color: 'white !important',
    },

    '.cal .cal-button-active:focus, .cal .cal-button-active:focus-visible': {
      outline: 'none !important',
      boxShadow: 'none !important',
      background: '{colors.brand.500} !important',
      borderColor: '{colors.brand.500} !important',
    },

    /* Title */
    '.cal .cal-title': {
      fontSize: '1.75rem !important',
      fontWeight: '600 !important',
      lineHeight: '1.5 !important',
      color: '{colors.brand.500}',
      letterSpacing: '-0.015em',
    },

    /* Column headers */
    '.cal .cal-day-header': {
      background: 'white',
    },

    '.cal .cal-day-header-text': {
      color: '{colors.brand.500}',
      fontWeight: '700',
      fontSize: '0.7rem !important',
      lineHeight: '1.5 !important',
      letterSpacing: '0.18em !important',
      textTransform: 'uppercase',
      padding: '2px 4px !important',
      margin: '0 !important',
    },

    /* Day numbers */
    '.cal .cal-day-number': {
      color: '{colors.brand.400}',
      fontSize: '0.8rem !important',
      lineHeight: '1.5 !important',
      fontWeight: '600',
      fontVariantNumeric: 'tabular-nums',
    },

    '.cal .cal-day-number-today': {
      background: '{colors.brand.500}',
      color: 'white !important',
      borderRadius: '2px',
      minWidth: '1.6rem',
      height: '1.6rem',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px !important',
    },

    /* Events */
    '.cal .cal-event': {
      cursor: 'pointer',
      fontWeight: '500',
      transition: 'opacity 0.18s ease',
    },

    '.cal .cal-event:hover': {
      opacity: '0.85',
    },

    /* Month bars, all-day bars and week-view blocks (not list rows). Borders
       come from the theme, which leaves the edges of week-split events open. */
    '.cal .cal-block-event': {
      fontSize: '0.85rem !important',
      lineHeight: '1.5 !important',
      padding: '2px 6px !important',
      marginBottom: '4px !important',
    },

    '.cal .cal-event-inner': {
      fontSize: 'inherit !important',
      lineHeight: '1.5 !important',
    },

    '.cal .cal-column-event-text': {
      fontSize: '0.85em !important',
      lineHeight: '1.5 !important',
    },

    '.cal .cal-column-event-time': {
      fontWeight: '600',
      fontVariantNumeric: 'tabular-nums',
    },

    /* List view */
    '.cal .cal-list-day': {
      background: 'white !important',
      borderTop: `1px solid ${brand(0.22)} !important`,
      borderBottom: `1px solid ${brand(0.14)} !important`,
    },

    '.cal .cal-list-day-text': {
      color: '{colors.brand.500}',
      fontWeight: '700',
      fontSize: '0.7rem !important',
      lineHeight: '1.5 !important',
      letterSpacing: '0.18em !important',
      textTransform: 'uppercase',
      textDecoration: 'none !important',
      padding: '8px 14px !important',
    },

    '.cal .cal-list-event': {
      fontSize: '0.78rem !important',
      padding: '8px 14px !important',
      borderRadius: '0 !important',
    },

    '.cal .cal-list-event:hover': {
      background: `${brand(0.04)} !important`,
    },

    '.cal .cal-list-event-text': {
      fontSize: 'inherit !important',
      lineHeight: '1.5 !important',
      fontVariantNumeric: 'tabular-nums',
    },

    '.cal .cal-list-event-time': {
      width: '7em !important',
    },

    /* Mobile responsive */
    '@media screen and (max-width: 768px)': {
      '.cal .cal-toolbar': {
        flexDirection: 'column !important',
        gap: '0.75rem !important',
        alignItems: 'stretch !important',
      },

      '.cal .cal-toolbar-section': {
        display: 'flex !important',
        justifyContent: 'center !important',
      },

      '.cal .cal-title': {
        fontSize: '1.25rem !important',
      },

      '.cal .cal-button': {
        fontSize: '0.875rem !important',
        padding: '0.375rem 0.75rem !important',
      },
    } as any,
  },
}))

/** Brand color at the given alpha, for raw strings where tokens do not resolve (shadows, motion props). */
export const brandAlpha = (a: number) => brand(a);

