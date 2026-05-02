export const colors = {
  appBackground: '#071527',
  appBackgroundAlt: '#081B2E',
  panel: '#101820',
  panelRaised: '#111D29',
  panelMuted: '#172332',
  panelDeep: '#091118',
  panelBorder: '#24364A',
  controlBorder: '#314256',
  divider: '#1B2A39',
  text: '#EEF4F8',
  textSoft: '#D5DDE8',
  textMuted: '#8EA1B5',
  textFaint: '#7F8B99',
  ink: '#071117',
  cream: '#F8F0DC',
  gold: '#F2A51A',
  goldSoft: '#F2B84B',
  yellow: '#FFD84D',
  orange: '#E66A2C',
  blue: '#1F6F9F',
  sky: '#7EE7FF',
  danger: '#FF6B9E',
  disabled: '#6F7D8C',
  black: '#111',
  white: '#fff',
  placeholder: '#6F7D8C',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radii = {
  sm: 5,
  md: 8,
  lg: 12,
  xl: 18,
  pill: 999,
};

export const fontSizes = {
  tiny: 9,
  compact: 10,
  label: 12,
  body: 14,
  button: 16,
  title: 32,
};

export const shadows = {
  hard: {
    shadowColor: colors.black,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  soft: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 0,
  },
};

export const theme = {
  colors,
  spacing,
  radii,
  fontSizes,
  shadows,
};
