import type { ChatbotContext } from './chatbotContextService';
import { chatbotToolManifest } from './chatbotToolsService';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotModelPayload {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  tools: typeof chatbotToolManifest;
}

function buildSystemPrompt(context: ChatbotContext): string {
  return `You are the analyst assistant inside a personal expense-tracker app. Answer the user's questions about their own financial data.

RULES:
- All amounts in the data are INTEGER CENTS. Always convert to dollars when speaking to the user (4999 cents = $49.99). Never state raw cent values.
- "Today" is ${context.asOf} (UTC). Use it for any reasoning about the current month or the future.
- Only use numbers present in the data below or returned by tools. Never invent, estimate, or guess figures. If the data cannot answer a question, say so plainly.
- When quoting projection numbers, mention the confidence level.
- Be concise. Use markdown tables for category breakdowns. Do not pad answers with generic advice unless asked.
- This is informational, not financial advice.

USER FINANCIAL DATA (JSON):
 ${JSON.stringify(context, null, 2)}`;
}

// The exact JSON that will be handed to the model. Returned by the route when
// ?debug=1 so you can eyeball what the LLM will actually receive.
export function buildModelPayload(args: {
  context: ChatbotContext;
  history: ChatTurn[];
  message: string;
  model?: string;
}): ChatbotModelPayload {
  return {
    model: args.model ?? process.env.CHATBOT_MODEL ?? 'qwen2.5:7b-instruct',
    messages: [
      { role: 'system', content: buildSystemPrompt(args.context) },
      ...args.history.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user', content: args.message },
    ],
    tools: chatbotToolManifest,
  };
}

// ── Offline mode ────────────────────────────────────────────────────────────
// Until an LLM is wired, the endpoint returns this deterministic summary built
// from the context — the endpoint is fully demoable and testable without a
// provider, and the number formatting the real model should use is right here.

export const OFFLINE_MODE_PREFIX = '(offline mode — no LLM connected yet)';

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function offlineSummary(context: ChatbotContext): string {
  const { currentMonth: m } = context;
  const lines = [
    OFFLINE_MODE_PREFIX,
    `Summary for ${m.period}: income ${formatCents(m.income)}, expenses ${formatCents(m.expenses)}, net ${formatCents(m.net)} across ${m.expenseCount} transactions.`,
  ];
  if (m.topCategories.length > 0) {
    lines.push(
      'Top categories: ' +
        m.topCategories
          .slice(0, 3)
          .map((c) => `${c.name} ${formatCents(c.amount)} (${c.percentage}%)`)
          .join(', ') +
        '.',
    );
  }
  if (context.projection) {
    lines.push(
      `Projected month-end: expenses ${formatCents(context.projection.projectedMonthExpenses)}, net ${formatCents(context.projection.projectedNet)} (confidence: ${context.projection.confidence}).`,
    );
  }
  lines.push('Connect an LLM provider in generateChatbotReply() to enable free-form Q&A.');
  return lines.join('\n');
}

// ── The single place an LLM gets invoked ────────────────────────────────────
// Later this becomes roughly:
//   const model = new ChatOllama({ model: payload.model, numCtx: 8192 });
//   const agent = createReactAgent({ llm: model.bindTools(zodTools), tools, maxIterations: 4 });
//   const reply = await agent.invoke({ messages: payload.messages });
// Route, tests, and API contract stay unchanged.
export async function generateChatbotReply(args: {
  user: { id: string; name: string };
  context: ChatbotContext;
  history: ChatTurn[];
  message: string;
}): Promise<{ reply: string; payload: ChatbotModelPayload }> {
  const payload = buildModelPayload(args);
  return { reply: offlineSummary(args.context), payload };
}
