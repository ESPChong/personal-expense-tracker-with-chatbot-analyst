import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { chatbotRequestSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildChatbotContext } from '@/services/chatbotContextService';
import { generateChatbotReply } from '@/services/chatbotService';

// Optional env: CHATBOT_DAILY_LIMIT (default 50), CHATBOT_MODEL (default in service)
function dailyLimit(): number {
  const parsed = Number(process.env.CHATBOT_DAILY_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = chatbotRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.issues },
        { status: 400 },
      );
    }
    const { message, month, history } = result.data;

    // Rate limit BEFORE any expensive work (context build, later: LLM call)
    const limit = checkRateLimit(`chatbot:${user.id}`, dailyLimit());
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Daily message limit exceeded', resetAt: limit.resetAt },
        { status: 429 },
      );
    }

    // Resolve target month (default: current UTC month)
    let year: number;
    let monthNum: number;
    if (month) {
      [year, monthNum] = month.split('-').map(Number);
    } else {
      const now = new Date();
      year = now.getUTCFullYear();
      monthNum = now.getUTCMonth() + 1;
    }

    // Fresh context every request — data changes between turns, and a stale
    // snapshot produces confidently wrong answers.
    const context = await buildChatbotContext(user.id, year, monthNum);
    const { reply, payload } = await generateChatbotReply({ user, context, history, message });

    const responseBody: { reply: string; payload?: unknown } = { reply };
    // ?debug=1 exposes exactly what will be sent to the model
    if (new URL(request.url).searchParams.get('debug') === '1') {
      responseBody.payload = payload;
    }
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('Chatbot API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
