import type { CardScanInput, RiftboundCard } from '../cards/cards.types';

export type ScanStatus =
  | 'idle'
  | 'capturing'
  | 'scanning'
  | 'found'
  | 'not-found';

export type ScanConfidence = 'exact' | 'likely' | 'uncertain' | 'failed';

export type ScanAnalysisStep =
  | 'reading-text'
  | 'matching-card'
  | 'checking-variants'
  | 'validating-image';

export type ScanAnalysisSuccess = {
  status: 'success';
  confidence: Exclude<ScanConfidence, 'failed'>;
  card: RiftboundCard;
  candidates: RiftboundCard[];
  input: CardScanInput;
  reason: string;
  isExactCardCandidate: boolean;
};

export type ScanAnalysisFailed = {
  status: 'failed';
  confidence: 'failed';
  reason: string;
  candidates: RiftboundCard[];
  input?: CardScanInput;
};

export type ScanAnalysisResult = ScanAnalysisSuccess | ScanAnalysisFailed;

