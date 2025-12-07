import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const getGoogleAI = () => new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

async function evaluateWithModel(
  evaluatorProvider: string,
  evaluatorModelId: string,
  originalPrompt: string,
  responseToEvaluate: string,
  responseModelName: string
) {
  const evaluationPrompt = `You are evaluating an AI model's response to a prompt. Rate the response on a scale of 1-10 based on quality, clarity, relevance, and accuracy.

Original Prompt: "${originalPrompt}"

Response from ${responseModelName}:
"${responseToEvaluate}"

Provide your evaluation in the following format:
Score: [number from 1-10]
Reasoning: [brief explanation of your score]`;

  try {
    let result = '';

    switch (evaluatorProvider) {
      case 'openai': {
        const openai = getOpenAI();
        const response = await openai.chat.completions.create({
          model: evaluatorModelId,
          messages: [{ role: 'user', content: evaluationPrompt }],
          max_tokens: 300,
        });
        result = response.choices[0].message.content || '';
        break;
      }
      case 'anthropic': {
        const anthropic = getAnthropic();
        const modelName = evaluatorModelId === 'claude-3-opus' ? 'claude-3-opus-20240229' :
                          evaluatorModelId === 'claude-3-sonnet' ? 'claude-3-5-sonnet-20241022' :
                          'claude-3-5-haiku-20241022';
        const response = await anthropic.messages.create({
          model: modelName,
          max_tokens: 300,
          messages: [{ role: 'user', content: evaluationPrompt }],
        });
        result = response.content[0].type === 'text' ? response.content[0].text : '';
        break;
      }
      case 'google': {
        const googleAI = getGoogleAI();
        const model = googleAI.getGenerativeModel({ model: evaluatorModelId });
        const response = await model.generateContent(evaluationPrompt);
        result = response.response.text();
        break;
      }
    }

    // Parse score from result
    const scoreMatch = result.match(/Score:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;

    return { score, reasoning: result };
  } catch (error) {
    console.error('Evaluation error:', error);
    return { score: 5, reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { evaluatorProvider, evaluatorModelId, originalPrompt, responseToEvaluate, responseModelName } = await req.json();

    const evaluation = await evaluateWithModel(
      evaluatorProvider,
      evaluatorModelId,
      originalPrompt,
      responseToEvaluate,
      responseModelName
    );

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('Evaluate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
