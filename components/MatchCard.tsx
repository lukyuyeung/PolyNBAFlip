
import React, { useState } from 'react';
import { Match, MatchScenario } from '../types';
import { getAIBettingInsight } from '../services/geminiService';

interface MatchCardProps {
  match: Match;
  onUpdateScore: (id: string, home: number, away: number) => void;
  onUpdateQuarter: (id: string, q: number) => void;
}

const PointTrendChart: React.FC<{ history: number[] }> = ({ history }) => {
  if (!history || history.length < 2) return <div className="h-16 flex items-center justify-center text-[8px] text-slate-600 font-bold uppercase tracking-widest bg-slate-900/20 rounded-lg">待數據同步...</div>;
  const width = 300;
  const height = 60;
  const barWidth = Math.max(2, (width - 20) / history.length);
  const maxDiff = Math.max(...history.map(Math.abs), 15); 
  const centerY = height / 2;
  return (
    <div className="relative w-full h-16 bg-slate-900/30 rounded-lg overflow-hidden border border-slate-700/50 mt-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {history.map((val, i) => {
          const x = (i / history.length) * (width - 10) + 5;
          const barHeight = (Math.abs(val) / maxDiff) * (height / 2 - 5);
          const y = val >= 0 ? centerY - barHeight : centerY;
          const color = val >= 0 ? '#818cf8' : '#fb923c';
          return <rect key={i} x={x} y={y} width={barWidth * 0.8} height={barHeight} fill={color} rx={1} />;
        })}
      </svg>
    </div>
  );
};

const MatchCard: React.FC<MatchCardProps> = ({ match, onUpdateScore, onUpdateQuarter }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const getScenarioLabel = (scenario: MatchScenario) => {
    switch (scenario) {
      case MatchScenario.SIMILAR_STRENGTH: return { text: '勢均力敵', color: 'bg-indigo-600' };
      case MatchScenario.BIG_DIFFERENCE: return { text: '強弱懸殊', color: 'bg-orange-600' };
      default: return null;
    }
  };

  const scenarioInfo = getScenarioLabel(match.scenario);
  const isLive = match.status === 'LIVE';
  const isBigDiff = match.scenario === MatchScenario.BIG_DIFFERENCE;

  const handleGetInsight = async () => {
    setLoadingInsight(true);
    const result = await getAIBettingInsight(match);
    setInsight(result);
    setLoadingInsight(false);
  };

  const TeamSection = ({ team, odds, isStronger }: { team: any, odds: string, isStronger: boolean }) => (
    <div className={`flex flex-col items-center w-1/3 p-4 rounded-3xl transition-all duration-500 ${isStronger && isBigDiff ? 'bg-indigo-500/10 border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)] scale-110 z-10' : 'border border-transparent'}`}>
      <img src={team.logo} alt={team.name} className="w-16 h-16 rounded-full border-2 border-slate-700 mb-2 shadow-xl" />
      <h3 className="text-sm font-black text-center leading-tight mb-1">{team.shortName}</h3>
      <p className="text-[10px] font-bold text-indigo-400 uppercase">{team.record || '載入中'}</p>
      <div className="mt-3 px-3 py-1 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-[11px] font-black text-white">{odds.startsWith('-') || odds.startsWith('+') ? odds : `+${odds}`}</p>
      </div>
      {isStronger && isBigDiff && <span className="mt-2 text-[8px] font-black text-indigo-400 uppercase tracking-widest">強隊標記</span>}
    </div>
  );

  return (
    <div className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-slate-800 relative overflow-hidden transition-all duration-500">
      <div className="flex justify-between items-start mb-10">
        <div className="flex gap-2">
          {scenarioInfo && (
            <span className={`${scenarioInfo.color} text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg`}>
              {scenarioInfo.text}
            </span>
          )}
          <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider ${isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
            {isLive ? 'LIVE' : match.status}
          </span>
        </div>
        {match.sourceUrls && match.sourceUrls.length > 0 && (
          <div className="flex items-center gap-1 group relative">
            <span className="text-[10px] text-slate-500 font-bold uppercase cursor-help">Verified Sources ⓘ</span>
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-3 rounded-xl z-50 shadow-2xl min-w-[220px]">
              {match.sourceUrls.map((s, i) => (
                <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-indigo-400 hover:text-white py-1.5 border-t border-slate-800 first:border-0 truncate">{s.title}</a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-8 gap-4">
        <TeamSection 
          team={match.homeTeam} 
          odds={match.homeOdds} 
          isStronger={match.strongerTeamId === match.homeTeam.id} 
        />
        
        <div className="flex flex-col items-center w-1/4">
          <div className="text-4xl font-black text-white italic tracking-tighter tabular-nums">
            {match.homeScore} : {match.awayScore}
          </div>
          {isLive && <div className="text-[9px] text-indigo-400 font-black mt-4 bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-widest">Quarter {match.quarter}</div>}
        </div>

        <TeamSection 
          team={match.awayTeam} 
          odds={match.awayOdds} 
          isStronger={match.strongerTeamId === match.awayTeam.id} 
        />
      </div>

      <PointTrendChart history={match.scoreHistory} />

      <div className="mt-10">
        {insight ? (
          <div className="p-6 rounded-[2rem] border bg-indigo-500/5 border-indigo-500/20 animate-slide-in">
            <p className="text-[9px] font-black mb-3 text-indigo-400 uppercase tracking-widest">Poly-Insight Strategy Engine</p>
            <p className="text-[13px] text-slate-200 leading-relaxed font-medium">{insight}</p>
          </div>
        ) : (
          <button 
            onClick={handleGetInsight}
            disabled={loadingInsight}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black rounded-[1.5rem] uppercase tracking-widest transition-all shadow-xl active:scale-95"
          >
            {loadingInsight ? '正在深度分析數據...' : '生成 Polymarket 對沖策略'}
          </button>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
