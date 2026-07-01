import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

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
        // Neutral background (brand guidelines, p.11).
        eggshell: { value: '#FEFFF7' },
      },
      fonts: {
        // Ivy Presto Headline is Adobe-licensed; Playfair Display is the free stand-in.
        body: { value: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif' },
        heading: { value: '"Ivy Presto Headline", "Playfair Display", Georgia, serif' },
      },
      animations: {
        'button-transition': { value: 'all 0.2s ease-in-out' },
        'card-transition': { value: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' },
      },
    },
    semanticTokens: {
      colors: {
        primary: { value: '{colors.brand.500}' },
        'primary.solid': { value: '{colors.brand.500}' },
        'primary.contrast': { value: 'white' },
      },
    },
  },
  globalCss: {
    'html, body': {
      background: '#ffffff',
      color: '#041634',
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

    /* FullCalendar Custom Styles */
    '.fc': {
      fontFamily: 'inherit',
      fontVariantNumeric: 'tabular-nums',
    },

    /* Toolbar buttons */
    '.fc .fc-button': {
      background: 'white !important',
      borderColor: 'rgba(12, 67, 160, 0.35) !important',
      textTransform: 'uppercase',
      fontWeight: '600',
      letterSpacing: '0.16em',
      fontSize: '0.7rem',
      padding: '0.4rem 0.85rem',
      borderRadius: '2px',
      color: '{colors.brand.500} !important',
      outline: 'none !important',
      boxShadow: 'none !important',
      transition: 'all 0.18s ease',
    },

    '.fc .fc-button:hover': {
      background: '{colors.brand.50} !important',
      borderColor: '{colors.brand.500} !important',
      color: '{colors.brand.500} !important',
      transform: 'none !important',
      boxShadow: 'none !important',
    },

    '.fc .fc-button:active': {
      background: '{colors.brand.50} !important',
      transform: 'none !important',
      boxShadow: 'none !important',
    },

    '.fc .fc-button:focus, .fc .fc-button:focus-visible': {
      outline: 'none !important',
      boxShadow: 'none !important',
    },

    '.fc .fc-button-active': {
      background: '{colors.brand.500} !important',
      borderColor: '{colors.brand.500} !important',
      color: 'white !important',
      boxShadow: 'none !important',
    },

    '.fc .fc-button-active:hover': {
      background: '{colors.brand.700} !important',
      borderColor: '{colors.brand.700} !important',
      color: 'white !important',
    },

    '.fc .fc-button-active:focus, .fc .fc-button-active:focus-visible': {
      outline: 'none !important',
      boxShadow: 'none !important',
      background: '{colors.brand.500} !important',
      borderColor: '{colors.brand.500} !important',
    },

    '.fc .fc-button:disabled': {
      opacity: '0.35',
      cursor: 'not-allowed',
    },

    /* Title */
    '.fc .fc-toolbar-title': {
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '{colors.brand.500}',
      letterSpacing: '-0.015em',
    },

    /* Grid borders */
    '.fc-theme-standard td, .fc-theme-standard th': {
      borderColor: 'rgba(12, 67, 160, 0.14)',
    },

    '.fc-theme-standard .fc-scrollgrid': {
      borderColor: 'rgba(12, 67, 160, 0.22)',
    },

    /* Day numbers */
    '.fc .fc-daygrid-day-number': {
      color: '{colors.brand.400}',
      padding: '0.5rem',
      fontSize: '0.8rem',
      fontWeight: '600',
      fontVariantNumeric: 'tabular-nums',
    },

    '.fc .fc-day-today .fc-daygrid-day-number': {
      background: '{colors.brand.500}',
      color: 'white',
      borderRadius: '2px',
      minWidth: '1.6rem',
      height: '1.6rem',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 0.4rem',
    },

    /* Column headers */
    '.fc .fc-col-header-cell-cushion': {
      color: '{colors.brand.500}',
      fontWeight: '700',
      fontSize: '0.7rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      padding: '0.7rem 0.5rem',
    },

    '.fc .fc-col-header-cell': {
      background: 'white',
      borderColor: 'rgba(12, 67, 160, 0.22)',
      borderBottomWidth: '2px',
    },

    /* Today background */
    '.fc .fc-day-today': {
      background: 'rgba(12, 67, 160, 0.04) !important',
    },

    /* Events */
    '.fc .fc-event': {
      cursor: 'pointer',
      borderRadius: '2px',
      padding: '2px 6px',
      fontSize: '0.78rem',
      fontWeight: '500',
      border: '1px solid transparent',
      transition: 'opacity 0.18s ease',
    },

    '.fc .fc-event:hover': {
      transform: 'none',
      opacity: '0.85',
      boxShadow: 'none',
    },

    '.fc .fc-event-time': {
      display: 'none !important',
    },

    '.fc-timegrid-event .fc-event-time': {
      display: 'block !important',
      fontWeight: '600',
      fontVariantNumeric: 'tabular-nums',
    },

    /* List view */
    '.fc-list-day-cushion, .fc-list-day-cushion.fc-cell-shaded': {
      background: 'white !important',
      borderTop: '1px solid rgba(12, 67, 160, 0.22)',
      borderBottom: '1px solid rgba(12, 67, 160, 0.14)',
    },

    '.fc-list-day-text, .fc-list-day-side-text': {
      color: '{colors.brand.500}',
      fontWeight: '700',
      fontSize: '0.7rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      textDecoration: 'none !important',
    },

    '.fc-list-event:hover td': {
      background: 'rgba(12, 67, 160, 0.04) !important',
    },

    '.fc-list-event-time, .fc-list-event-title': {
      fontVariantNumeric: 'tabular-nums',
    },

    /* Mobile responsive */
    '@media screen and (max-width: 768px)': {
      '.fc .fc-toolbar': {
        flexDirection: 'column',
        gap: '0.75rem',
        alignItems: 'stretch',
      },

      '.fc .fc-toolbar-chunk': {
        display: 'flex',
        justifyContent: 'center',
      },

      '.fc .fc-toolbar-title': {
        fontSize: '1.25rem',
      },

      '.fc .fc-button': {
        padding: '0.375rem 0.75rem',
        fontSize: '0.875rem',
      },
    } as any,
  },
}))

// Plain-value tokens for inline usage (e.g. inside SVG icon props
// or style strings that can't reference Chakra tokens).

export const COLORS = {
  brand: {
    50: '#eef4fc',
    100: '#d9e7f7',
    500: '#0c43a0',
  },
} as const;

export const SHADOWS = {
  md: '0 2px 8px rgba(12, 67, 160, 0.08)',
} as const;

export const TRANSITIONS = {
  normal: 'all 0.2s ease-in-out',
} as const;

export const brandAlpha = (_shade: 500, alpha: number) =>
  `rgba(12, 67, 160, ${alpha})`;

