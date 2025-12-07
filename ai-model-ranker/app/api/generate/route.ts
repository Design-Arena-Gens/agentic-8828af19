import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const getGoogleAI = () => new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

async function generateOpenAI(modelId: string, prompt: string, images?: string[]) {
  try {
    const openai = getOpenAI();
    const messages: any[] = [];

    if (images && images.length > 0) {
      const content: any[] = [{ type: 'text', text: prompt }];
      images.forEach(img => {
        content.push({
          type: 'image_url',
          image_url: { url: img }
        });
      });
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const response = await openai.chat.completions.create({
      model: modelId,
      messages,
      max_tokens: 1000,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI error:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function generateAnthropic(modelId: string, prompt: string, images?: string[]) {
  try {
    const anthropic = getAnthropic();
    const content: any[] = [];

    if (images && images.length > 0) {
      content.push({ type: 'text', text: prompt });
      images.forEach(img => {
        const base64Data = img.split(',')[1] || img;
        const mediaType = img.includes('image/png') ? 'image/png' : 'image/jpeg';
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        });
      });
    } else {
      content.push({ type: 'text', text: prompt });
    }

    const response = await anthropic.messages.create({
      model: modelId === 'claude-3-opus' ? 'claude-3-opus-20240229' :
             modelId === 'claude-3-sonnet' ? 'claude-3-5-sonnet-20241022' :
             'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content }],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('Anthropic error:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function generateGoogle(modelId: string, prompt: string, images?: string[]) {
  try {
    const googleAI = getGoogleAI();
    const model = googleAI.getGenerativeModel({ model: modelId });

    if (images && images.length > 0) {
      const imageParts = images.map(img => {
        const base64Data = img.split(',')[1] || img;
        const mimeType = img.includes('image/png') ? 'image/png' : 'image/jpeg';
        return {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        };
      });

      const result = await model.generateContent([prompt, ...imageParts]);
      return result.response.text();
    } else {
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
  } catch (error) {
    console.error('Google error:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { modelId, provider, prompt, images } = await req.json();

    let response = '';

    switch (provider) {
      case 'openai':
        response = await generateOpenAI(modelId, prompt, images);
        break;
      case 'anthropic':
        response = await generateAnthropic(modelId, prompt, images);
        break;
      case 'google':
        response = await generateGoogle(modelId, prompt, images);
        break;
      default:
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
