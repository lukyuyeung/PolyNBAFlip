
export enum MatchScenario {
  SIMILAR_STRENGTH = 'SIMILAR_STRENGTH',
  BIG_DIFFERENCE = 'BIG_DIFFERENCE',
  NORMAL = 'NORMAL'
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
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

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  homeOdds: number;
  awayOdds: number;
  spread: number;
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
}
