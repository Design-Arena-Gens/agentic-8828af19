import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getGoogleAI = () => new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { originalPrompt, topThreeResponses } = await req.json();

    const rankingPrompt = `You are tasked with ranking the top 3 AI model responses to a given prompt. Analyze each response carefully and rank them from best to worst (1st, 2nd, 3rd) based on quality, clarity, relevance, and accuracy.

Original Prompt: "${originalPrompt}"

Response A (${topThreeResponses[0].modelName}):
"${topThreeResponses[0].response}"

Response B (${topThreeResponses[1].modelName}):
"${topThreeResponses[1].response}"

Response C (${topThreeResponses[2].modelName}):
"${topThreeResponses[2].response}"

Provide your ranking in the following format:
First Place: [A, B, or C]
Second Place: [A, B, or C]
Third Place: [A, B, or C]
Reasoning: [brief explanation of your ranking]`;

    const googleAI = getGoogleAI();
    const model = googleAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent(rankingPrompt);
    const responseText = result.response.text();

    // Parse the ranking
    const firstMatch = responseText.match(/First Place:\s*([ABC])/i);
    const secondMatch = responseText.match(/Second Place:\s*([ABC])/i);
    const thirdMatch = responseText.match(/Third Place:\s*([ABC])/i);

    const indexMap: Record<string, number> = { A: 0, B: 1, C: 2 };

    const first = firstMatch ? topThreeResponses[indexMap[firstMatch[1].toUpperCase()]].modelId : topThreeResponses[0].modelId;
    const second = secondMatch ? topThreeResponses[indexMap[secondMatch[1].toUpperCase()]].modelId : topThreeResponses[1].modelId;
    const third = thirdMatch ? topThreeResponses[indexMap[thirdMatch[1].toUpperCase()]].modelId : topThreeResponses[2].modelId;

    return NextResponse.json({
      first,
      second,
      third,
      reasoning: responseText,
    });
  } catch (error) {
    console.error('Final ranking error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
