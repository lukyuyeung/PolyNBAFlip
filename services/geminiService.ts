
import { GoogleGenAI, Type } from "@google/genai";
import { Match, GroundingSource, MatchScenario } from "../types";

export const fetchLiveNBAData = async (): Promise<{ matches: Match[], sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const searchPrompt = `Find all active and upcoming NBA games for today. For each game, retrieve:
  1. Current scores and status (LIVE/SCHEDULED/FINISHED).
  2. Team season records (W-L).
  3. Current Point Spread for both teams (e.g., Home -8.5, Away +8.5).`;
  
  try {
    const searchResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources: GroundingSource[] = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "NBA Data Source",
      uri: chunk.web?.uri || ""
    })).filter((s: any) => s.uri) || [];

    const rawData = searchResponse.text;
    if (!rawData) return { matches: [], sources };

    const formatPrompt = `
      Based on the raw NBA data, extract a JSON array. 
      Data: ${rawData}
      JSON keys: "homeTeamName", "awayTeamName", "homeTeamShort", "awayTeamShort", "homeScore", "awayScore", "status", "quarter", "homeRecord", "awayRecord", "homeSpread", "awaySpread".
      Ensure "homeSpread" and "awaySpread" are strings like "+1.5" or "-10.0".
    `;

    const formatResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: formatPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              homeTeamName: { type: Type.STRING },
              awayTeamName: { type: Type.STRING },
              homeTeamShort: { type: Type.STRING },
              awayTeamShort: { type: Type.STRING },
              homeScore: { type: Type.NUMBER },
              awayScore: { type: Type.NUMBER },
              status: { type: Type.STRING },
              quarter: { type: Type.NUMBER },
              homeRecord: { type: Type.STRING },
              awayRecord: { type: Type.STRING },
              homeSpread: { type: Type.STRING },
              awaySpread: { type: Type.STRING },
            },
            required: ["homeTeamName", "awayTeamName", "status"]
          }
        }
      }
    });

    const jsonStr = formatResponse.text || "[]";
    const data = JSON.parse(jsonStr);
    
    const matches: Match[] = data.map((item: any, index: number) => {
      const hSpreadStr = item.homeSpread || "0";
      const aSpreadStr = item.awaySpread || "0";
      const hSpreadNum = parseFloat(hSpreadStr);
      
      let scenario = MatchScenario.NONE;
      const absSpread = Math.abs(hSpreadNum);
      
      if (absSpread <= 2.5) {
        scenario = MatchScenario.SIMILAR_STRENGTH;
      } else if (absSpread >= 10) {
        scenario = MatchScenario.BIG_DIFFERENCE;
      }

      return {
        id: `real-${index}-${item.homeTeamShort || index}`,
        homeTeam: {
          id: `h-${index}`,
          name: item.homeTeamName,
          shortName: item.homeTeamShort || item.homeTeamName.substring(0, 3).toUpperCase(),
          logo: `https://avatar.vercel.sh/${item.homeTeamShort || item.homeTeamName}?size=100`,
          record: item.homeRecord
        },
        awayTeam: {
          id: `a-${index}`,
          name: item.awayTeamName,
          shortName: item.awayTeamShort || item.awayTeamName.substring(0, 3).toUpperCase(),
          logo: `https://avatar.vercel.sh/${item.awayTeamShort || item.awayTeamName}?size=100`,
          record: item.awayRecord
        },
        homeScore: item.homeScore || 0,
        awayScore: item.awayScore || 0,
        status: item.status?.toUpperCase().includes('LIVE') ? 'LIVE' : (item.status?.toUpperCase().includes('FINISH') ? 'FINISHED' : 'SCHEDULED'),
        homeOdds: hSpreadStr,
        awayOdds: aSpreadStr,
        spread: hSpreadNum,
        scenario: scenario,
        strongerTeamId: hSpreadNum < 0 ? `h-${index}` : (parseFloat(aSpreadStr) < 0 ? `a-${index}` : null),
        quarter: item.quarter || 1,
        notifiedBuckets: [],
        maxDeficitRecorded: 0,
        recoverySteps: [],
        boughtTeamId: null,
        plStatus: null,
        scoreHistory: [],
        startTime: Date.now(),
        sourceUrls: sources
      };
    });

    return { matches, sources };
  } catch (error) {
    console.error("Live Data Fetch Error:", error);
    return { matches: [], sources: [] };
  }
};

export const getAIBettingInsight = async (match: Match): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Analyze NBA Game: ${match.homeTeam.name} (${match.homeTeam.record}) vs ${match.awayTeam.name} (${match.awayTeam.record})
    Current Score: ${match.homeScore} - ${match.awayScore}
    Handicap/Spread: Home ${match.homeOdds}, Away ${match.awayOdds}
    
    If the favorite (negative spread) is down by 10+ in first half, suggest a Polymarket recovery bet.
    Answer in Traditional Chinese (max 120 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "正在分析盤口趨勢...";
  } catch (error) {
    return "分析生成失敗。";
  }
};
