import { GoogleGenerativeAI } from '@google/generative-ai';

interface TeamData {
  teamName: string;
  ownerName: string;
  squad: Array<{
    playerName: string;
    role: string;
    country: string;
    isOverseas: boolean;
    basePrice: number;
    boughtPrice: number;
  }>;
  totalSpent: number;
  purseRemaining: number;
  totalPurse: number;
  metrics: {
    completeness: number;
    roleBalance: number;
    purseEfficiency: number;
    bidDiscipline: number;
    total: number;
  };
}

export interface GeminiAnalysis {
  winner: {
    teamName: string;
    ownerName: string;
    reasoning: string;
  };
  teamAnalyses: Array<{
    teamName: string;
    ownerName: string;
    rank: number;
    rating: string;        // e.g. "A+", "B", "C"
    strengths: string[];
    weaknesses: string[];
    bestBuy: string;
    commentary: string;    // fun, engaging analysis
  }>;
  overallSummary: string;  // entertaining wrap-up of the entire auction
}

export async function analyzeWithGemini(teams: TeamData[]): Promise<GeminiAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set — skipping AI analysis');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Many users get a "limit: 0" error on the free tier for 2.0-flash.
    // Switching to 1.5-flash usually has available free tier quota.
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

    const prompt = buildPrompt(teams);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const text = result.response.text();
    const analysis = JSON.parse(text) as GeminiAnalysis;
    return analysis;
  } catch (error: any) {
    console.error('Gemini analysis failed:', error);
    
    // Fall back to a mock analysis if the Free Tier quota is exceeded or rate limit is hit
    if (error?.status === 429) {
      console.warn('Falling back to mock analysis due to 429 Quota Exceeded / Rate Limit');
      return generateMockAnalysis(teams);
    }
    
    return null;
  }
}

function buildPrompt(teams: TeamData[]): string {
  let teamsDescription = '';

  for (const team of teams) {
    const squadByRole: Record<string, string[]> = {};
    for (const p of team.squad) {
      if (!squadByRole[p.role]) squadByRole[p.role] = [];
      const markup = p.basePrice > 0 ? `${(p.boughtPrice / p.basePrice).toFixed(1)}x` : '';
      squadByRole[p.role].push(
        `${p.playerName} (${p.country}${p.isOverseas ? ', overseas' : ''}) — base ₹${p.basePrice}Cr, bought ₹${p.boughtPrice}Cr ${markup}`
      );
    }

    teamsDescription += `
### ${team.teamName} (Owner: ${team.ownerName})
- Squad size: ${team.squad.length}
- Total spent: ₹${team.totalSpent.toFixed(2)}Cr / ₹${team.totalPurse}Cr purse (${((team.totalSpent / team.totalPurse) * 100).toFixed(0)}% used)
- Remaining purse: ₹${team.purseRemaining.toFixed(2)}Cr
- Score: ${team.metrics.total}/100 (Completeness: ${team.metrics.completeness}/30, Role Balance: ${team.metrics.roleBalance}/25, Purse Efficiency: ${team.metrics.purseEfficiency}/25, Bid Discipline: ${team.metrics.bidDiscipline}/20)

Squad by role:
${Object.entries(squadByRole).map(([role, players]) => `**${role}**: ${players.join('; ')}`).join('\n')}
`;
  }

  return `You are an expert IPL cricket auction analyst and commentator. Analyze the following mock IPL auction results and provide your expert analysis.

## Auction Data
${teamsDescription}

## Instructions
Analyze each team's auction strategy and provide your verdict. Be entertaining, insightful, and use cricket knowledge. Reference specific player purchases. Consider:
- Squad composition and balance (batting, bowling, all-rounders, wicketkeepers)
- Overseas player utilization
- Spending strategy (overpays vs bargains)
- Overall team strength for a T20 tournament

Respond in this exact JSON format:
{
  "winner": {
    "teamName": "<team abbreviation that won>",
    "ownerName": "<owner name>",
    "reasoning": "<2-3 sentences on why this team won the auction>"
  },
  "teamAnalyses": [
    {
      "teamName": "<team abbreviation>",
      "ownerName": "<owner name>",
      "rank": 1,
      "rating": "<A+/A/B+/B/C+/C>",
      "strengths": ["<strength 1>", "<strength 2>"],
      "weaknesses": ["<weakness 1>", "<weakness 2>"],
      "bestBuy": "<player name — brief reason>",
      "commentary": "<2-3 fun, engaging sentences about this team's auction>"
    }
  ],
  "overallSummary": "<3-4 entertaining sentences wrapping up the entire auction, mentioning highlights and surprises>"
}

Important: teamAnalyses should be ordered by rank (best team first). Use the owner names provided, not team abbreviations, when referring to who managed the team.`;
}

function generateMockAnalysis(teams: TeamData[]): GeminiAnalysis {
  const sorted = [...teams].sort((a, b) => b.metrics.total - a.metrics.total);
  const winner = sorted[0];

  return {
    winner: {
      teamName: winner?.teamName || 'N/A',
      ownerName: winner?.ownerName || 'N/A',
      reasoning: `(MOCK AI: Quota Exceeded) ${winner?.ownerName || 'The winner'} assembled a fantastic squad, showing great discipline and balance to edge out the competition.`,
    },
    teamAnalyses: sorted.map((t, idx) => ({
      teamName: t.teamName,
      ownerName: t.ownerName,
      rank: idx + 1,
      rating: idx === 0 ? 'A+' : idx < 3 ? 'A' : idx < 6 ? 'B+' : 'B',
      strengths: ['Solid core established early', 'Good balance of roles'],
      weaknesses: ['Missed out on some key targets', 'Slightly overpaid for backups'],
      bestBuy: t.squad.length > 0 ? t.squad[0].playerName : 'None',
      commentary: `(MOCK AI) Solid effort by ${t.ownerName}. The Gemini API Free Tier daily quota has been reached, so this is a placeholder analysis but their score of ${t.metrics.total} speaks for itself!`
    })),
    overallSummary: `(MOCK AI) The auction was intense! Since the Google Gemini Free Tier daily limit was reached (429 Too Many Requests), we couldn't run the real AI analysis, but the numbers show a fiercely competitive event!`
  };
}
