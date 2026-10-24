// Plain TS constants — no React, Tailwind, or Next.js dependency.
// Values verified against app/globals.css @theme block.
// Font family strings use plain font names (not var(--font-*) CSS variables,
// which are Next.js runtime-injected and unavailable outside the app).
// The extension declares matching @font-face rules in its Shadow DOM style block.

export const tokens = {
  color: {
    primary:                '#041627',
    primaryHover:           '#1a2b3c',
    onPrimary:              '#ffffff',
    secondary:              '#735c00',
    secondaryContainer:     '#fed65b',
    onSecondaryContainer:   '#735c00',
    surface:                '#f4f1ea',
    surfaceContainer:       '#f1eee7',
    surfaceContainerLow:    '#f6f3ec',
    surfaceContainerHigh:   '#ebe8e1',
    surfaceBright:          '#fcf9f2',
    surfaceCard:            '#ffffff',
    surfaceWarm:            '#fefaf0',
    border:                 '#c4c6cd',
    borderStrong:           '#74777d',
    textPrimary:            '#1c1c18',
    textSecondary:          '#44474c',
    textMuted:              '#74777d',
    textOnBrand:            '#ffffff',
    error:                  '#ba1a1a',
    errorContainer:         '#ffdad6',
    onErrorContainer:       '#93000a',
    success:                '#1a5c1a',
    successContainer:       '#d4f0d4',
    info:                   '#242d64',
    infoContainer:          '#fef5de',
    annotation:             'rgba(254, 214, 91, 0.45)',
    annotationActive:       'rgba(254, 214, 91, 0.75)',
    selected:               '#fefaf0',
  },
  rating: {
    // Resolved from var() references in globals.css
    exceedsBg:              '#fed65b',   // var(--color-secondary-container)
    exceedsText:            '#735c00',   // var(--color-on-secondary-container)
    exceedsBorder:          '#735c00',   // var(--color-secondary)
    exemplifiesBg:          '#041627',   // var(--color-primary)
    exemplifiesText:        '#ffffff',   // var(--color-on-primary)
    dnmBg:                  '#ffdad6',   // var(--color-error-container)
    dnmText:                '#93000a',   // var(--color-on-error-container)
    dnmBorder:              '#ba1a1a',   // var(--color-error)
  },
  font: {
    heading: "'Newsreader', Georgia, 'Iowan Old Style', serif",
    body:    "'Lato', system-ui, -apple-system, sans-serif",
    code:    "'JetBrains Mono', ui-monospace, monospace",
  },
} as const;
