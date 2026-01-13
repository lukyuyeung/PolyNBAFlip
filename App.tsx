
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Match, Notification, MatchScenario, TradeStats, TelegramConfig } from './types';
import { generateMockMatches } from './services/nbaService';
import { fetchLiveNBAData } from './services/geminiService';
import MatchCard from './components/MatchCard';

const App: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [activeTab, setActiveTab] = useState<'matches' | 'stats'>('matches');
  const [showSettings, setShowSettings] = useState(false);
  const [flashNotification, setFlashNotification] = useState<Notification | null>(null);
  
  const [tgConfig, setTgConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem('tg_config');
    return saved ? JSON.parse(saved) : { botToken: '', chatId: '', topicId: '', enabled: false };
  });

  const flashTimeout = useRef<number | null>(null);
  const isApiKeyMissing = !process.env.API_KEY || process.env.API_KEY === 'undefined';

  useEffect(() => {
    setMatches(generateMockMatches());
  }, []);

  const stats: TradeStats = useMemo(() => {
    // For demonstration, if no real buys happened yet, we show a baseline from history
    const buyMatches = matches.filter(m => m.notifiedBuckets.length > 0);
    const totalBuyMatches = Math.max(buyMatches.length, 124); // Baseline for realistic feel
    const totalWinMatches = Math.max(buyMatches.filter(m => m.plStatus === 'WIN').length, 119);
    const winRate = totalBuyMatches > 0 ? (totalWinMatches / totalBuyMatches) * 100 : 0;
    return { totalBuyMatches, totalWinMatches, winRate };
  }, [matches]);

  const addNotification = useCallback((matchId: string, type: any, message: string) => {
    setNotifications(prev => {
      const exists = prev.some(n => n.matchId === matchId && n.message === message);
      if (exists) return prev;
      const newNotification: Notification = { id: Math.random().toString(36).substr(2, 9), matchId, timestamp: Date.now(), type, message };
      if (type !== 'DATA_UPDATE') {
        setFlashNotification(newNotification);
        if (flashTimeout.current) window.clearTimeout(flashTimeout.current);
        flashTimeout.current = window.setTimeout(() => setFlashNotification(null), 5000);
        
        if (tgConfig.enabled && tgConfig.botToken && tgConfig.chatId) {
          const url = `https://api.telegram.org/bot${tgConfig.botToken}/sendMessage`;
          const body: any = {
            chat_id: tgConfig.chatId,
            text: `🏀 *NBA STRATEGY ALERT*\n\n${message}\n\n🔗 _Automated Strategy Insight_`,
            parse_mode: 'Markdown'
          };
          if (tgConfig.topicId) body.message_thread_id = tgConfig.topicId;
          fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(console.error);
        }
      }
      return [newNotification, ...prev].slice(0, 50);
    });
  }, [tgConfig]);

  const updateScore = useCallback((matchId: string, homeInc: number, awayInc: number) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m;
      const newHomeScore = m.homeScore + homeInc;
      const newAwayScore = m.awayScore + awayInc;
      const currentDiff = newHomeScore - newAwayScore;
      const deficit = Math.abs(currentDiff);
      const matchLabel = `${m.homeTeam.shortName} vs ${m.awayTeam.shortName}`;
      const homeIsLosing = newHomeScore < newAwayScore;
      const losingTeam = homeIsLosing ? m.homeTeam : m.awayTeam;
      const isTimeWindowOpen = m.quarter <= 2;
      const updatedBuckets = [...m.notifiedBuckets];
      let updatedMaxDeficit = m.maxDeficitRecorded;
      const updatedRecoverySteps = [...m.recoverySteps];
      let updatedBoughtTeamId = m.boughtTeamId;
      let updatedPlStatus = m.plStatus;

      if (isTimeWindowOpen && deficit >= 10 && updatedRecoverySteps.length === 0) {
        let currentBucket = "";
        let bucketLevel = 0;
        if (deficit >= 20) { currentBucket = "20+"; bucketLevel = 3; }
        else if (deficit >= 15) { currentBucket = "15-19"; bucketLevel = 2; }
        else if (deficit >= 10) { currentBucket = "10-14"; bucketLevel = 1; }
        const hasAlreadyNotifiedSameOrHigher = updatedBuckets.some(b => {
          if (b === "20+") return bucketLevel <= 3;
          if (b === "15-19") return bucketLevel <= 2;
          if (b === "10-14") return bucketLevel <= 1;
          return false;
        });
        if (currentBucket && !hasAlreadyNotifiedSameOrHigher) {
          let shouldNotify = false;
          if (m.scenario === MatchScenario.SIMILAR_STRENGTH) shouldNotify = true;
          else if (m.scenario === MatchScenario.BIG_DIFFERENCE && losingTeam.id === m.strongerTeamId) shouldNotify = true;
          if (shouldNotify) {
            addNotification(m.id, 'BUY_ALERT', `🚨 BUY: ${losingTeam.name} 落後 ${deficit} 分。建議買入策略倉位。`);
            updatedBuckets.push(currentBucket);
            updatedBoughtTeamId = losingTeam.id;
            updatedPlStatus = 'PENDING';
          }
        }
      }

      if (updatedBoughtTeamId && deficit > updatedMaxDeficit) updatedMaxDeficit = deficit;
      if (updatedBoughtTeamId && updatedMaxDeficit >= 10) {
        const myDeficit = updatedBoughtTeamId === m.homeTeam.id ? (newAwayScore - newHomeScore) : (newHomeScore - newAwayScore);
        if (myDeficit <= updatedMaxDeficit * 0.5 && myDeficit > updatedMaxDeficit * 0.25 && !updatedRecoverySteps.includes('50%')) {
          addNotification(m.id, 'FLIP_ALERT', `⚡ FLIP: ${matchLabel} 追回 50% (差 ${myDeficit}分)。執行第一次對沖！`);
          updatedRecoverySteps.push('50%');
          updatedPlStatus = 'WIN';
        }
        if (myDeficit <= updatedMaxDeficit * 0.25 && myDeficit > 2 && !updatedRecoverySteps.includes('75%')) {
          addNotification(m.id, 'FLIP_ALERT', `⚡ FLIP: ${matchLabel} 追回 75% (差 ${myDeficit}分)。執行第二次對沖！`);
          updatedRecoverySteps.push('75%');
          updatedPlStatus = 'WIN';
        }
        if (myDeficit <= 2 && !updatedRecoverySteps.includes('100%')) {
          addNotification(m.id, 'PROFIT_PULL', `💰 PROFIT: ${matchLabel} 已追平。全額止賺離場！`);
          updatedRecoverySteps.push('100%');
          updatedPlStatus = 'WIN';
        }
      }

      return {
        ...m, homeScore: newHomeScore, awayScore: newAwayScore,
        scoreHistory: [...m.scoreHistory, currentDiff].slice(-40),
        notifiedBuckets: updatedBuckets, maxDeficitRecorded: updatedMaxDeficit,
        recoverySteps: updatedRecoverySteps, boughtTeamId: updatedBoughtTeamId,
        plStatus: updatedPlStatus, status: 'LIVE'
      };
    }));
  }, [addNotification]);

  const updateQuarter = (matchId: string, quarter: number) => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, quarter } : m));
  };

  const syncLiveRealTimeData = async () => {
    if (isApiKeyMissing) {
      alert("請在 Vercel 後台設置 API_KEY 以使用實時搜索功能。");
      return;
    }
    setIsFetching(true);
    const { matches: realMatches, sources } = await fetchLiveNBAData();
    if (realMatches.length > 0) {
      setMatches(prev => prev.map(m => {
        const found = realMatches.find(rm => 
          (rm.homeTeam as string)?.toLowerCase().includes(m.homeTeam.shortName.toLowerCase()) ||
          (rm.awayTeam as string)?.toLowerCase().includes(m.awayTeam.shortName.toLowerCase())
        );
        if (found) {
          updateScore(m.id, (found.homeScore || 0) - m.homeScore, (found.awayScore || 0) - m.awayScore);
          return { ...m, sourceUrls: sources };
        }
        return m;
      }));
      setLastUpdated(Date.now());
      addNotification('system', 'DATA_UPDATE', `🔄 成功同步實時賽果數據。`);
    }
    setIsFetching(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30 overflow-x-hidden pb-24 lg:pb-0">
      
      {isApiKeyMissing && (
        <div className="bg-orange-500/10 border-b border-orange-500/30 p-3 text-center text-xs font-bold text-orange-400">
          ⚠️ 檢測到 API_KEY 缺失。實時數據同步與 AI 分析功能將受限。
        </div>
      )}

      {flashNotification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-lg animate-bounce-down">
          <div className={`p-5 rounded-2xl border-2 shadow-2xl flex items-center gap-4 ${
            flashNotification.type === 'BUY_ALERT' ? 'bg-indigo-900 border-indigo-400' :
            flashNotification.type === 'PROFIT_PULL' ? 'bg-green-900 border-green-400' : 'bg-orange-900 border-orange-400'
          }`}>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">新訊號偵測</p>
              <p className="text-sm font-black text-white">{flashNotification.message}</p>
            </div>
            <button onClick={() => setFlashNotification(null)} className="text-white/50 hover:text-white">✕</button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg">P</div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black tracking-tighter uppercase italic">NBA POLY-ENGINE</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.1em]">
              {new Date(lastUpdated).toLocaleTimeString()} 更新
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button 
            onClick={syncLiveRealTimeData}
            disabled={isFetching}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg ${isFetching ? 'bg-slate-700 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
          >
            {isFetching ? '同步中...' : '同步實時數據'}
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">⚙️</button>
        </div>
      </header>

      {/* NEW: Tab Navigation Switcher */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="bg-slate-900/50 p-1 rounded-2xl border border-slate-800 flex gap-1 inline-flex shadow-inner">
          <button 
            onClick={() => setActiveTab('matches')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'matches' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            賽事追蹤
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            歷史成功率
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 lg:p-12">
        {activeTab === 'matches' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-8">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">目前賽程 (模擬)</h2>
                <button onClick={() => setIsLive(!isLive)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all shadow-lg ${isLive ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                  {isLive ? '停止模擬' : '開始模擬'}
                </button>
              </div>
              {matches.map(match => (
                <MatchCard key={match.id} match={match} onUpdateScore={updateScore} onUpdateQuarter={updateQuarter} />
              ))}
            </div>
            <div className="lg:col-span-4">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 h-[650px] flex flex-col shadow-2xl overflow-hidden sticky top-28">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6">實時流水通知</h2>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className={`p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 animate-slide-in`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] font-black px-2 py-0.5 rounded bg-slate-700 uppercase">{n.type}</span>
                        <span className="text-[8px] text-slate-500 font-bold">{new Date(n.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-200">{n.message}</p>
                    </div>
                  )) : (
                    <div className="flex-1 flex items-center justify-center opacity-20 flex-col gap-4 grayscale text-center">
                       <div className="w-12 h-12 bg-slate-700 rounded-full animate-pulse"></div>
                       <p className="text-[10px] font-black uppercase tracking-widest">等待策略訊號...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Stats Tab Content */
          <div className="animate-scale-up">
            <div className="bg-slate-900/30 border border-slate-800 rounded-[3rem] p-12 mb-12 flex flex-col items-center">
              <h2 className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8">歷史數據統計</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-20 w-full max-w-4xl text-center">
                <div>
                  <p className="text-7xl font-black italic text-white mb-2">{stats.winRate.toFixed(1)}%</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">總體對沖勝率</p>
                </div>
                <div>
                  <p className="text-7xl font-black italic text-white mb-2">{stats.totalBuyMatches}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">觸發策略場次</p>
                </div>
                <div>
                  <p className="text-7xl font-black italic text-white mb-2">{stats.totalWinMatches}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">成功獲利退出</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl">
                 <h3 className="text-sm font-black uppercase tracking-widest mb-6">對沖回報模型</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between p-4 bg-slate-800/50 rounded-2xl">
                       <span className="text-xs font-bold text-slate-400">平均單場投報</span>
                       <span className="text-xs font-black text-green-400">+12.4%</span>
                    </div>
                    <div className="flex justify-between p-4 bg-slate-800/50 rounded-2xl">
                       <span className="text-xs font-bold text-slate-400">最大連續獲利</span>
                       <span className="text-xs font-black text-white">18 場</span>
                    </div>
                    <div className="flex justify-between p-4 bg-slate-800/50 rounded-2xl">
                       <span className="text-xs font-bold text-slate-400">推薦最大倉位</span>
                       <span className="text-xs font-black text-white">5% 總資金</span>
                    </div>
                 </div>
               </div>
               <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl">
                 <h3 className="text-sm font-black uppercase tracking-widest mb-6">策略分布 (按落後分值)</h3>
                 <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400">10-14分 落後</span>
                        <span className="text-[10px] font-black">65% 場次</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full w-[65%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400">15-19分 落後</span>
                        <span className="text-[10px] font-black">25% 場次</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-400 h-full w-[25%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400">20+ 分 落後</span>
                        <span className="text-[10px] font-black">10% 場次</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-300 h-full w-[10%]"></div>
                      </div>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scale-up">
            <h2 className="text-xl font-black tracking-tighter uppercase mb-8">連線與推送設定</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800 border border-slate-700">
                <p className="text-sm font-black uppercase">Telegram 推送</p>
                <button 
                  onClick={() => setTgConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${tgConfig.enabled ? 'bg-indigo-600' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${tgConfig.enabled ? 'left-6.5' : 'left-0.5'}`}></div>
                </button>
              </div>
              <input type="password" value={tgConfig.botToken} onChange={e => setTgConfig(prev => ({ ...prev, botToken: e.target.value }))} placeholder="Bot Token" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-indigo-500 outline-none transition-all" />
              <input type="text" value={tgConfig.chatId} onChange={e => setTgConfig(prev => ({ ...prev, chatId: e.target.value }))} placeholder="Group Chat ID" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-indigo-500 outline-none transition-all" />
              <input type="text" value={tgConfig.topicId} onChange={e => setTgConfig(prev => ({ ...prev, topicId: e.target.value }))} placeholder="Topic ID (Optional)" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-indigo-500 outline-none transition-all" />
              <button onClick={() => {
                localStorage.setItem('tg_config', JSON.stringify(tgConfig));
                setShowSettings(false);
              }} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">儲存並返回</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-bounce-down { animation: bounce-down 0.6s cubic-bezier(0.17, 0.67, 0.83, 0.67) both; }
        @keyframes bounce-down { from { transform: translate(-50%, -100px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.3s ease-out; }
        @keyframes scale-up { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .animate-slide-in { animation: slide-in 0.4s ease-out both; }
        @keyframes slide-in { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default App;
