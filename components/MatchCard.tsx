
import React, { useState } from 'react';
import { Match, MatchScenario } from '../types';
import { getAIBettingInsight } from '../services/geminiService';

interface MatchCardProps {
  match: Match;
  onUpdateScore: (id: string, home: number, away: number) => void;
  onUpdateQuarter: (id: string, q: number) => void;
}

const PointTrendChart: React.FC<{ history: number[] }> = ({ history }) => {
  if (history.length < 2) return <div className="h-16 flex items-center justify-center text-[8px] text-slate-600 font-bold uppercase tracking-widest">數據採集中...</div>;
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
      case MatchScenario.SIMILAR_STRENGTH: return { text: '勢均力敵', color: 'bg-blue-600', border: 'border-blue-400' };
      case MatchScenario.BIG_DIFFERENCE: return { text: '實力懸殊', color: 'bg-purple-600', border: 'border-purple-400' };
      default: return { text: '普通賽事', color: 'bg-gray-600', border: 'border-gray-400' };
    }
  };

  const scenarioInfo = getScenarioLabel(match.scenario);
  const deficit = Math.abs(match.homeScore - match.awayScore);
  const timeWindowOpen = match.quarter <= 2;

  const handleGetInsight = async () => {
    setLoadingInsight(true);
    const result = await getAIBettingInsight(match);
    setInsight(result);
    setLoadingInsight(false);
  };

  return (
    <div className={`bg-slate-900/40 rounded-3xl p-8 border border-slate-800 relative overflow-hidden transition-all duration-500`}>
      <div className="flex justify-between items-start mb-8">
        <div className="flex gap-2">
          <span className={`${scenarioInfo.color} text-white text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-wider shadow-lg`}>
            {scenarioInfo.text}
          </span>
          <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-wider ${timeWindowOpen ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {timeWindowOpen ? '策略窗口開啟' : '窗口已關閉'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {match.sourceUrls && match.sourceUrls.length > 0 && (
            <div className="flex items-center gap-1 group relative">
              <span className="text-[10px] text-indigo-400 font-bold uppercase cursor-help">🔗 實時驗證</span>
              <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-3 rounded-xl z-50 shadow-2xl min-w-[200px]">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">數據來源 (Google Search)</p>
                {match.sourceUrls.map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" className="block text-[10px] text-white hover:text-indigo-400 py-1 border-t border-slate-800 first:border-0 truncate">{s.title}</a>
                ))}
              </div>
            </div>
          )}
          <select 
            value={match.quarter} 
            onChange={(e) => onUpdateQuarter(match.id, parseInt(e.target.value))}
            className="bg-slate-800 text-[10px] border border-slate-700 rounded-lg px-2 py-1 focus:outline-none text-slate-300 font-black uppercase"
          >
            {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col items-center w-1/3">
          <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-16 h-16 rounded-full border-2 border-slate-700 mb-2 shadow-xl" />
          <h3 className="text-sm font-black text-center h-8 leading-tight">{match.homeTeam.shortName}</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Spread {match.spread > 0 ? `+${match.spread}` : match.spread}</p>
        </div>
        <div className="flex flex-col items-center w-1/3">
          <div className={`text-5xl font-black text-white italic tracking-tighter drop-shadow-2xl ${deficit >= 10 ? 'text-indigo-400' : ''}`}>
            {match.homeScore} : {match.awayScore}
          </div>
          <div className="text-[10px] text-indigo-400 font-black mt-3 bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-widest">Q{match.quarter}</div>
        </div>
        <div className="flex flex-col items-center w-1/3">
          <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-16 h-16 rounded-full border-2 border-slate-700 mb-2 shadow-xl" />
          <h3 className="text-sm font-black text-center h-8 leading-tight">{match.awayTeam.shortName}</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Spread {match.spread > 0 ? `${-match.spread}` : `+${Math.abs(match.spread)}`}</p>
        </div>
      </div>

      <div className="mb-8">
        <PointTrendChart history={match.scoreHistory} />
      </div>

      <div className="space-y-4">
        {insight ? (
          <div className="p-5 rounded-2xl border bg-indigo-500/5 border-indigo-500/20 animate-slide-in">
            <p className="text-[9px] font-black mb-3 text-indigo-400 uppercase tracking-widest">AI POLYMARKET STRATEGY</p>
            <p className="text-[13px] text-slate-200 leading-relaxed font-medium">{insight}</p>
          </div>
        ) : (
          <button 
            onClick={handleGetInsight}
            disabled={loadingInsight}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black rounded-2xl uppercase tracking-widest transition-all shadow-lg"
          >
            {loadingInsight ? '分析中...' : '獲取 POLYMARKET 洞察'}
          </button>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
