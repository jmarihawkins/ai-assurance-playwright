import { test, expect } from '@playwright/test';
import { assurancePolicy } from '../src/policy.js';

test.describe('release controls', () => {
  test('pins model and prompt versions', async ({ request }) => {
    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['x-model-version']).toBe(assurancePolicy.model);
    expect(response.headers()['x-prompt-version']).toBe(assurancePolicy.promptVersion);
  });

  test('keeps token use inside the allowed budget', async ({ request }) => {
    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });
    const body = await response.json();

    expect(body.usage.inputTokens).toBeLessThanOrEqual(assurancePolicy.maxInputTokens);
    expect(body.usage.outputTokens).toBeLessThanOrEqual(assurancePolicy.maxOutputTokens);
  });

  test('requires retrieval for an informational answer and blocks training', async ({ request }) => {
    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-b' },
      data: { question: 'How does a target-date fund work?' }
    });
    const body = await response.json();

    expect(body.controls.retrievalUsed).toBe(assurancePolicy.requireRetrieval);
    expect(body.controls.trainingAllowed).toBe(false);
  });

  test('keeps audit evidence tied to the correct tenant', async ({ request }) => {
    const responseA = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });
    const responseB = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-b' },
      data: { question: 'How does a target-date fund work?' }
    });

    const auditA = await request.get(`/api/audit/${responseA.headers()['x-request-id']}`);
    const auditB = await request.get(`/api/audit/${responseB.headers()['x-request-id']}`);

    expect((await auditA.json()).tenantId).toBe('tenant-a');
    expect((await auditB.json()).tenantId).toBe('tenant-b');
    expect(responseA.headers()['x-request-id']).not.toBe(responseB.headers()['x-request-id']);
  });

  test('creates audit evidence for each request', async ({ request }, testInfo) => {
    const answerResponse = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });

    const requestId = answerResponse.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const auditResponse = await request.get(`/api/audit/${requestId}`);
    const audit = await auditResponse.json();

    expect(audit.requestId).toBe(requestId);
    expect(audit.tenantId).toBe('tenant-a');
    expect(audit.model).toBe(assurancePolicy.model);
    expect(audit.promptVersion).toBe(assurancePolicy.promptVersion);
    expect(audit.outcome).toBe('answered');

    // The audit record is attached to the HTML report so the test leaves evidence behind.
    await testInfo.attach('audit-evidence', {
      body: JSON.stringify(audit, null, 2),
      contentType: 'application/json'
    });
  });
});
