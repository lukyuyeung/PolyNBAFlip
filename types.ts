
export enum MatchScenario {
  SIMILAR_STRENGTH = 'SIMILAR_STRENGTH',
  BIG_DIFFERENCE = 'BIG_DIFFERENCE',
  NONE = 'NONE'
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  record?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  topicId: string;
  enabled: boolean;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface HistoricalSignal {
  date: string;
  match: string;
  condition: string;
  outcome: 'WIN' | 'LOSS';
  profit: string;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  homeOdds: string; // Now used for spread e.g. "+1.5"
  awayOdds: string; // Now used for spread e.g. "-1.5"
  spread: number;   // Numeric spread for logic
  scenario: MatchScenario;
  strongerTeamId: string | null;
  quarter: number;
  notifiedBuckets: string[]; 
  maxDeficitRecorded: number;
  recoverySteps: string[];
  boughtTeamId: string | null; 
  plStatus: 'WIN' | 'PENDING' | null; 
  scoreHistory: number[]; 
  startTime: number;
  sourceUrls?: GroundingSource[];
}

export interface Notification {
  id: string;
  matchId: string;
  timestamp: number;
  type: 'BUY_ALERT' | 'FLIP_ALERT' | 'INFO' | 'WARNING' | 'PROFIT_PULL' | 'DATA_UPDATE';
  message: string;
}

export interface TradeStats {
  totalBuyMatches: number;
  totalWinMatches: number;
  winRate: number;
  historicalLog: HistoricalSignal[];
}
