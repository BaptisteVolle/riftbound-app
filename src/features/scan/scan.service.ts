import { findCardFromScan } from '../cards/cards.service';

export function simulateScan() {
  return findCardFromScan({
    name: 'Jinx, Loose Cannon',
    setCode: 'OGN',
    number: '004',
  });
}
