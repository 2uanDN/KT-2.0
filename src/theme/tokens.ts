/**
 * Design Tokens Configuration — Bản Hoàn Chỉnh
 * Hệ thống Neo-Brutalist (Blueprint Ink)
 * 
 * 0. Metadata
 * · Phạm vi: token thị giác cho hệ thống neo-brutalist (blueprint ink).
 * · Đơn vị: px, em, hex, rgba, ms.
 * · Grid cơ sở: 4px.
 * · Nguyên tắc: viền rõ, bóng cứng không blur, tương phản cao, chữ mono cho metadata.
 */

export const tokens = {
  colors: {
    // 1.1 Canvas & Surface
    canvas: '#FFFFFF',
    background: '#F3F3F3',
    surfaceWarm: '#FAF9F7',
    surfaceElevated: '#FFFFFF',

    // 1.2 Brand / Blueprint
    blueprint: '#3D4A5C',
    onBlueprint: '#FFFFFF',
    blueprintHairline: 'rgba(61, 74, 92, 0.20)',
    blueprintSoft: 'rgba(61, 74, 92, 0.15)',

    // 1.3 Text
    textDark: '#1B1B1B',
    textMuted: '#44474C',
    textOnDark: '#FFFFFF',
    textDisabled: '#75777D',

    // 1.4 Border / Outline
    borderDefault: '#3D4A5C',
    borderHairline: 'rgba(61, 74, 92, 0.20)',
    borderActive: '#1B1B1B',
    borderDisabled: '#75777D',

    // 1.5 Shadow
    shadowHard: '#000000',
    shadowSoft: 'rgba(61, 74, 92, 0.15)',
    shadowSm: 'rgba(0, 0, 0, 0.05)',

    // 1.6 Accent Categories
    accentPdf: '#D4A5A5',
    accentMedia: '#A8C5B8',
    accentNote: '#E8D4B8',
    accentCode: '#B9B08A',

    // 1.7 Semantic States
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#93000A',
    success: '#2E6B48',
    onSuccess: '#FFFFFF',
    successContainer: '#CDE8D6',
    warning: '#8A5A00',
    onWarning: '#FFFFFF',
    warningContainer: '#FBE3B3',
    info: '#3D4A5C',
    onInfo: '#FFFFFF',
    infoContainer: '#D6E3FA',

    // 1.8 Disabled
    disabledSurface: '#E2E2E2',
    disabledBorder: '#75777D',
  },

  typography: {
    fontFamily: {
      body: '"Inter", sans-serif',
      mono: '"JetBrains Mono", monospace',
      icon: '"Material Symbols Outlined"',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    // 2.3 Display & Headline
    display: {
      fontFamily: 'Inter',
      fontSize: '32px',
      fontWeight: '700',
      lineHeight: '40px',
      letterSpacing: '-0.02em',
    },
    headlineLg: {
      fontFamily: 'Inter',
      fontSize: '24px',
      fontWeight: '600',
      lineHeight: '32px',
      letterSpacing: '-0.01em',
    },
    headlineMd: {
      fontFamily: 'Inter',
      fontSize: '18px',
      fontWeight: '700',
      lineHeight: '24px',
      letterSpacing: '-0.01em',
    },
    headlineSm: {
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: '700',
      lineHeight: '22px',
      letterSpacing: '-0.005em',
    },
    headlineXs: {
      fontFamily: 'Inter',
      fontSize: '15px',
      fontWeight: '700',
      lineHeight: '20px',
      letterSpacing: '0',
    },
    // 2.4 Body
    bodyLg: {
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: '400',
      lineHeight: '24px',
      letterSpacing: '0',
    },
    bodyMd: {
      fontFamily: 'Inter',
      fontSize: '14px',
      fontWeight: '400',
      lineHeight: '20px',
      letterSpacing: '0',
    },
    bodySm: {
      fontFamily: 'Inter',
      fontSize: '13px',
      fontWeight: '400',
      lineHeight: '18px',
      letterSpacing: '0',
    },
    bodyXs: {
      fontFamily: 'Inter',
      fontSize: '12px',
      fontWeight: '400',
      lineHeight: '16px',
      letterSpacing: '0',
    },
    // 2.5 Code / Mono
    codeMd: {
      fontFamily: 'JetBrains Mono',
      fontSize: '14px',
      fontWeight: '500',
      lineHeight: '20px',
      letterSpacing: '0',
    },
    codeSm: {
      fontFamily: 'JetBrains Mono',
      fontSize: '12px',
      fontWeight: '500',
      lineHeight: '16px',
      letterSpacing: '0',
    },
    labelCode: {
      fontFamily: 'JetBrains Mono',
      fontSize: '11px',
      fontWeight: '600',
      lineHeight: '14px',
      letterSpacing: '0.04em',
    },
    labelCodeBold: {
      fontFamily: 'JetBrains Mono',
      fontSize: '11px',
      fontWeight: '700',
      lineHeight: '14px',
      letterSpacing: '0.08em',
    },
    microCode: {
      fontFamily: 'JetBrains Mono',
      fontSize: '10px',
      fontWeight: '600',
      lineHeight: '12px',
      letterSpacing: '0.08em',
    },
    nanoCode: {
      fontFamily: 'JetBrains Mono',
      fontSize: '8px',
      fontWeight: '700',
      lineHeight: '10px',
      letterSpacing: '0.06em',
    },
  },

  spacing: {
    // 3.1 4px Grid
    'space-0': '0px',
    'space-3xs': '2px',
    'space-2xs': '4px',
    'space-xs': '6px',
    'space-sm': '8px',
    'space-md': '12px',
    'space-lg': '16px',
    'space-xl': '24px',
    'space-2xl': '32px',
    'space-3xl': '40px',
    'space-4xl': '48px',
    'space-5xl': '56px',
    'space-6xl': '64px',

    // 3.2 Kích thước khối điều khiển
    controlXs: '16px',
    controlSm: '32px',
    controlMd: '36px',
    controlLg: '44px',
    controlXl: '48px',
    controlNav: '56px',

    // 3.3 Kích thước phần tử
    accentStrip: '6px',
    accentDot: '10px',
    iconBadge: '48px',
    minWidthPill: '16px',
  },

  rounded: {
    // 4. Rounded
    xs: '2px',
    sm: '4px',
    DEFAULT: '8px',
    md: '12px',
    lg: '16px',
    full: '9999px',
  },

  borders: {
    // 5. Border
    widthHairline: '1px',
    widthStrong: '2px',
    widthActiveIndicator: '4px',
    styleDefault: 'solid',
    colorDefault: '#3D4A5C',
    colorFaint: 'rgba(61, 74, 92, 0.20)',
    colorActive: '#1B1B1B',
    colorDisabled: '#75777D',
  },

  shadows: {
    // 6. Shadow (Neo-brutalist — không blur, lệch góc)
    hardXs: '1px 1px 0 #000000',
    hardSm: '2px 2px 0 #000000',
    hardMd: '2px 2px 0 rgba(61, 74, 92, 0.15)',
    hardLg: '4px 4px 0 #000000',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    none: 'none',
  },

  motion: {
    // 7. Motion & Press Physics
    durationInstant: '50ms',
    durationFast: '100ms',
    durationBase: '150ms',
    durationSlow: '250ms',

    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingSnap: 'cubic-bezier(0.3, 0, 0, 1)',

    pressTranslateXs: '1px',
    pressTranslateSm: '2px',
    pressScale: '0.95',
  },

  accessibility: {
    // 8. Focus & Accessibility
    focusRingColor: '#3D4A5C',
    focusRingWidth: '2px',
    touchTargetMin: '44px',
  },

  layout: {
    // 12. Layout
    shellMaxWidth: '480px',
    shellBorderX: '1px solid #3D4A5C',
    shellBackground: '#FFFFFF',
    shellMinHeight: '100vh',

    headerHeight: '48px',
    headerPaddingX: '16px',
    headerBackground: '#FAF9F7',
    headerBorderBottom: '1px solid #3D4A5C',

    mainPaddingTop: '48px',
    mainPaddingBottom: '64px',
    mainPaddingX: '16px',
    mainBackground: '#FFFFFF',

    bottomNavHeight: '56px',
    bottomNavColumns: 4,
    bottomNavBackground: '#FAF9F7',
    bottomNavBorderTop: '1px solid #3D4A5C',
    bottomNavActiveIndicator: '4px solid #3D4A5C',

    fabHeight: '44px',
    fabPaddingX: '16px',
    fabBottomOffset: '16px',

    cardPadding: '12px',
    cardGap: '8px',
    cardTopStrip: '6px',
    cardAccentDot: '10px',
    cardRadius: '8px',
    cardBorder: '1px solid #3D4A5C',
    cardShadow: '2px 2px 0 rgba(61, 74, 92, 0.15)',

    gutter: '16px',
    margin: '24px',
  },
} as const;

export type DesignTokens = typeof tokens;
