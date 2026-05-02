import { ImageSourcePropType } from 'react-native';

export type CardIconKind = 'rarity' | 'color';

export type CardIconConfig = {
  key: string;
  label: string;
  fallback: string;
  color: string;
  source?: ImageSourcePropType;
};

const RARITY_ICONS: Record<string, CardIconConfig> = {
  common: {
    key: 'common',
    label: 'Common',
    fallback: '●',
    color: '#DDEDEC',
    source: require('../../../assets/card-icons/rarity/Common.png'),
  },
  uncommon: {
    key: 'uncommon',
    label: 'Uncommon',
    fallback: '▲',
    color: '#54D6D5',
    source: require('../../../assets/card-icons/rarity/Uncommon.png'),
  },
  rare: {
    key: 'rare',
    label: 'Rare',
    fallback: '◆',
    color: '#E64CA9',
    source: require('../../../assets/card-icons/rarity/Rare.png'),
  },
  epic: {
    key: 'epic',
    label: 'Epic',
    fallback: '⬟',
    color: '#F39A2E',
    source: require('../../../assets/card-icons/rarity/Epic.png'),
  },
  showcase: {
    key: 'showcase',
    label: 'Showcase',
    fallback: '⬢',
    color: '#F2C94C',
    source: require('../../../assets/card-icons/rarity/OverNumbered.png'),
  },
};

const COLOR_ICONS: Record<string, CardIconConfig> = {
  fury: {
    key: 'fury',
    label: 'Fury',
    fallback: '△',
    color: '#CB3637',
    source: require('../../../assets/card-icons/color/Fury.png'),
  },
  body: {
    key: 'body',
    label: 'Body',
    fallback: '◈',
    color: '#DD8B3D',
    source: require('../../../assets/card-icons/color/Body.png'),
  },
  mind: {
    key: 'mind',
    label: 'Mind',
    fallback: '◔',
    color: '#507FB8',
    source: require('../../../assets/card-icons/color/Mind.png'),
  },
  calm: {
    key: 'calm',
    label: 'Calm',
    fallback: '◉',
    color: '#5FB767',
    source: require('../../../assets/card-icons/color/Calm.png'),
  },
  chaos: {
    key: 'chaos',
    label: 'Chaos',
    fallback: '◇',
    color: '#A44CB0',
    source: require('../../../assets/card-icons/color/Chaos.png'),
  },
  order: {
    key: 'order',
    label: 'Order',
    fallback: '⬡',
    color: '#D8C157',
    source: require('../../../assets/card-icons/color/Order.png'),
  },
};

const FALLBACK_ICON: CardIconConfig = {
  key: 'unknown',
  label: 'Unknown',
  fallback: '•',
  color: '#8291A1',
  source: require('../../../assets/card-icons/color/neutral.png'),
};

function normalizeIconKey(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getRarityIcon(value?: string) {
  const normalized = normalizeIconKey(value);

  if (normalized.includes('overnumbered') || normalized.includes('alternate') || normalized.includes('showcase')) {
    return RARITY_ICONS.showcase;
  }

  if (normalized.includes('epic')) {
    return RARITY_ICONS.epic;
  }

  if (normalized.includes('rare')) {
    return RARITY_ICONS.rare;
  }

  if (normalized.includes('uncommon')) {
    return RARITY_ICONS.uncommon;
  }

  if (normalized.includes('common')) {
    return RARITY_ICONS.common;
  }

  return FALLBACK_ICON;
}

export function getColorIcon(value?: string) {
  const normalized = normalizeIconKey(value);

  if (normalized.includes('fury')) {
    return COLOR_ICONS.fury;
  }

  if (normalized.includes('body')) {
    return COLOR_ICONS.body;
  }

  if (normalized.includes('mind')) {
    return COLOR_ICONS.mind;
  }

  if (normalized.includes('calm')) {
    return COLOR_ICONS.calm;
  }

  if (normalized.includes('chaos')) {
    return COLOR_ICONS.chaos;
  }

  if (normalized.includes('order')) {
    return COLOR_ICONS.order;
  }

  return FALLBACK_ICON;
}
