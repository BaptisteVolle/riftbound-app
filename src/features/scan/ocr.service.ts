import { CardScanInput } from '../cards/cards.types';

export function parseCardText(text: string): CardScanInput {
  const setMatch = text.match(/\b(OGN|OGNX|OGS|SFD|SFDX|UNL|PROK)\b/i);
  const numberMatch = text.match(/\b\d{1,3}\b/);
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return {
    name: firstLine,
    setCode: setMatch?.[1].toUpperCase(),
    number: numberMatch?.[0].padStart(3, '0'),
  };
}
