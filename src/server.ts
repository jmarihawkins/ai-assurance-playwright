import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { assurancePolicy } from './policy.js';

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
  trainingAllowed: boolean;
  outcome: 'answered' | 'refused';
};

const auditEvents: AuditEvent[] = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/answer', (req, res) => {
  const tenantId = String(req.header('x-tenant-id') || 'demo-tenant');
  const question = String(req.body?.question || '').trim();
  const requestId = randomUUID();

  // The demo uses a simple estimate so token budgets can be tested without a paid model call.
  const inputTokens = Math.max(1, Math.ceil(question.length / 4));
  const asksForPersonalAdvice = /what should i invest|tell me what to buy|guarantee/i.test(question);

  const answer = asksForPersonalAdvice
    ? 'I can explain general plan concepts, but I cannot choose an investment for you. Review your plan materials or speak with a qualified professional for personal advice.'
    : 'A target-date fund usually holds a mix of investments and changes that mix over time as its target year gets closer.';

  const sourceIds = asksForPersonalAdvice ? [] : ['plan-guide-12'];
  const outputTokens = Math.max(1, Math.ceil(answer.length / 4));
  const outcome: AuditEvent['outcome'] = asksForPersonalAdvice ? 'refused' : 'answered';

  // This audit record stands in for evidence a real service would send to durable storage.
  const event: AuditEvent = {
    requestId,
    tenantId,
    model: assurancePolicy.model,
    promptVersion: assurancePolicy.promptVersion,
    inputTokens,
    outputTokens,
    retrievalUsed: sourceIds.length > 0,
    trainingAllowed: assurancePolicy.trainingAllowed,
    outcome
  };

  auditEvents.push(event);

  res.setHeader('x-model-version', assurancePolicy.model);
  res.setHeader('x-prompt-version', assurancePolicy.promptVersion);
  res.setHeader('x-request-id', requestId);
  res.json({
    answer,
    sourceIds,
    usage: { inputTokens, outputTokens },
    controls: {
      retrievalUsed: event.retrievalUsed,
      trainingAllowed: event.trainingAllowed
    }
  });
});

app.get('/api/audit/:requestId', (req, res) => {
  const event = auditEvents.find(item => item.requestId === req.params.requestId);

  if (!event) {
    return res.status(404).json({ error: 'Audit event not found' });
  }

  res.json(event);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Assurance demo running on http://127.0.0.1:${port}`);
});
