
import { GoogleGenAI, Type } from "@google/genai";
import { Match, GroundingSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Using any[] for matches because the LLM returns strings for team names, 
 * which doesn't match the Team object structure in Partial<Match>.
 */
export const fetchLiveNBAData = async (): Promise<{ matches: any[], sources: GroundingSource[] }> => {
  const prompt = `
    Search for the latest NBA scores and betting odds for today's games (e.g., from ESPN, NBA.com, and Polymarket).
    Return the data for at least 3 active or upcoming games.
    Format the response as a JSON array of objects with: 
    - homeTeam (string), awayTeam (string), homeScore (number), awayScore (number), 
    - quarter (number), homeOdds (number), awayOdds (number).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              homeTeam: { type: Type.STRING },
              awayTeam: { type: Type.STRING },
              homeScore: { type: Type.NUMBER },
              awayScore: { type: Type.NUMBER },
              quarter: { type: Type.NUMBER },
              homeOdds: { type: Type.NUMBER },
              awayOdds: { type: Type.NUMBER },
            },
            required: ["homeTeam", "awayTeam", "homeScore", "awayScore"]
          }
        }
      },
    });

    // Extracting text output from GenerateContentResponse using the .text property
    const jsonStr = response.text || "[]";
    const data = JSON.parse(jsonStr);
    const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "NBA Data Source",
      uri: chunk.web?.uri || ""
    })).filter((s: any) => s.uri) || [];

    return { matches: data, sources };
  } catch (error) {
    console.error("Live Data Fetch Error:", error);
    return { matches: [], sources: [] };
  }
};

export const getAIBettingInsight = async (match: Match, isRepeatLosing: boolean = false): Promise<string> => {
  const deficit = Math.abs(match.homeScore - match.awayScore);
  
  const prompt = `
    As an NBA betting expert, analyze:
    Match: ${match.homeTeam.name} vs ${match.awayTeam.name}
    Score: ${match.homeScore} - ${match.awayScore} (Diff: ${deficit})
    Quarter: ${match.quarter}
    Scenario: ${match.scenario}
    
    Provide a strategy (Buy/Flip/Wait) for Polymarket investors in 100 words (Traditional Chinese).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // The response.text property directly returns the string output.
    return response.text || "分析中...";
  } catch (error) {
    return "分析生成失敗。";
  }
};
