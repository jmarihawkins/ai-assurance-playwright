import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { assurancePolicy } from './policy.js';
import { getOpenAIResponse } from './openai.js';
import { findKnowledge } from './knowledge.js';

const app = express();
const port = 4173;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type AuditEvent = {
  requestId: string;
  tenantId: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  retrievalUsed: boolean;
  sourceIds: string[];
  trainingAllowed: boolean;
  outcome: 'answered' | 'refused' | 'unsupported' | 'rejected';
  mode: 'live' | 'mock';
};

const auditEvents: AuditEvent[] = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.AI_MODE === 'live' ? 'live' : 'mock'
  });
});

app.post('/api/answer', async (req, res) => {
  const tenantId = String(req.header('x-tenant-id') || 'demo-tenant');
  const question = String(req.body?.question || '').trim();
  const requestId = randomUUID();

  const mode: AuditEvent['mode'] =
    process.env.AI_MODE === 'live' ? 'live' : 'mock';

  if (!question) {
    return res.status(400).json({
      error: 'Question is required'
    });
  }

  const asksForPersonalAdvice =
    /what should i invest|tell me what to buy|guarantee (which|what|me)\b/i.test(question);

  // Rough estimate of about 4 characters per token. The full prompt is larger,
  // so this only blocks questions that are already over budget on their own.
  const estimatedQuestionTokens = Math.max(1, Math.ceil(question.length / 4));
  const exceedsInputBudget =
    estimatedQuestionTokens > assurancePolicy.maxInputTokens;

  // Personal advice and oversized requests are handled without looking up plan content.
  const knowledge = asksForPersonalAdvice || exceedsInputBudget
    ? []
    : findKnowledge(question);

  const sourceIds = knowledge.map(source => source.id);
  const retrievalUsed = knowledge.length > 0;

  try {
    let answer: string;
    let model: string;
    let inputTokens: number;
    let outputTokens: number;
    let outcome: AuditEvent['outcome'];

    if (exceedsInputBudget) {
      answer =
        'That question is too long to process. Please shorten it and try again.';
      model = 'not-called';
      inputTokens = 0;
      outputTokens = 0;
      outcome = 'rejected';
    } else if (
      !asksForPersonalAdvice &&
      assurancePolicy.requireRetrieval &&
      !retrievalUsed
    ) {
      // Do not call the model for informational questions when no approved source was found.
      answer =
        'I do not have enough supporting source information to answer that question.';
      model = 'not-called';
      inputTokens = 0;
      outputTokens = 0;
      outcome = 'unsupported';
    } else if (mode === 'live') {
      const sourceContext = knowledge
        .map(
          source =>
            `[${source.id}] ${source.title}\n${source.content}`
        )
        .join('\n\n');

      const prompt = `
You are an educational assistant for a retirement plan.

Give clear general information only.
Keep the answer under 80 words.
Do not recommend a specific investment or guarantee returns.

If the user asks for personal investment advice, explain that you can provide general education but cannot choose an investment for them.

For informational questions, use only the source content provided.

Source content:
${sourceContext || 'No source content required for this refusal.'}

User question:
${question}
      `.trim();

      const aiResponse = await getOpenAIResponse(prompt);

      answer = aiResponse.text;
      model = aiResponse.model;
      inputTokens = aiResponse.usage?.input_tokens ?? 0;
      outputTokens = aiResponse.usage?.output_tokens ?? 0;
      outcome = asksForPersonalAdvice ? 'refused' : 'answered';
    } else {
      if (asksForPersonalAdvice) {
        answer =
          'I can explain general plan concepts, but I cannot choose an investment for you. Review your plan materials or speak with a qualified professional for personal advice.';
        outcome = 'refused';
      } else {
        // Answer from the retrieved source so CI still exercises the grounding path.
        answer = knowledge.map(source => source.content).join(' ');
        outcome = 'answered';
      }

      model = assurancePolicy.model;
      inputTokens = estimatedQuestionTokens;
      outputTokens = Math.max(1, Math.ceil(answer.length / 4));
    }

    // Keep the evidence used by the assurance checks with each request.
    const event: AuditEvent = {
      requestId,
      tenantId,
      model,
      promptVersion: assurancePolicy.promptVersion,
      inputTokens,
      outputTokens,
      retrievalUsed,
      sourceIds,
      trainingAllowed: assurancePolicy.trainingAllowed,
      outcome,
      mode
    };

    auditEvents.push(event);

    res.setHeader('x-model-version', model);
    res.setHeader(
      'x-prompt-version',
      assurancePolicy.promptVersion
    );
    res.setHeader('x-request-id', requestId);

    res.json({
      answer,
      sourceIds,
      usage: {
        inputTokens,
        outputTokens
      },
      controls: {
        retrievalUsed: event.retrievalUsed,
        trainingAllowed: event.trainingAllowed
      },
      outcome,
      mode
    });
  } catch (error) {
    console.error('AI request failed:', error);

    res.status(503).json({
      error: 'AI service is temporarily unavailable',
      requestId
    });
  }
});

app.get('/api/audit/:requestId', (req, res) => {
  const tenantId = String(req.header('x-tenant-id') || 'demo-tenant');

  // Only return evidence to the tenant that created the request.
  const event = auditEvents.find(
    item =>
      item.requestId === req.params.requestId &&
      item.tenantId === tenantId
  );

  if (!event) {
    return res.status(404).json({
      error: 'Audit event not found'
    });
  }

  res.json(event);
});

app.listen(port, '127.0.0.1', () => {
  console.log(
    `Assurance demo running on http://127.0.0.1:${port}`
  );
});