import { test, expect } from '@playwright/test';
import { assurancePolicy } from '../src/policy.js';

test.describe('release controls', () => {
  test('pins model and prompt versions', async ({ request }) => {
    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });

    expect(response.ok()).toBeTruthy();

    expect(response.headers()['x-model-version']).toBe(
      assurancePolicy.model
    );

    expect(response.headers()['x-prompt-version']).toBe(
      assurancePolicy.promptVersion
    );
  });

  test('keeps token use inside the allowed budget', async ({ request }) => {
    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body.usage.inputTokens).toBeLessThanOrEqual(
      assurancePolicy.maxInputTokens
    );

    expect(body.usage.outputTokens).toBeLessThanOrEqual(
      assurancePolicy.maxOutputTokens
    );
  });

  test('rejects a question over the input token budget before calling the model', async ({ request }) => {
    // Starts with a supported question so a missing check would still retrieve a source.
    const oversizedQuestion =
      'How does a target-date fund work? ' +
      'x'.repeat(assurancePolicy.maxInputTokens * 4);

    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: oversizedQuestion }
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body.outcome).toBe('rejected');
    expect(body.sourceIds).toEqual([]);
    expect(body.controls.retrievalUsed).toBe(false);
    expect(body.usage.inputTokens).toBe(0);
    expect(body.usage.outputTokens).toBe(0);

    const auditResponse = await request.get(
      `/api/audit/${response.headers()['x-request-id']}`,
      { headers: { 'x-tenant-id': 'tenant-a' } }
    );

    expect(auditResponse.ok()).toBeTruthy();
    expect((await auditResponse.json()).model).toBe('not-called');
  });

  test('requires retrieval for an informational answer', async ({ request }) => {
    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-b' },
      data: { question: 'How does a target-date fund work?' }
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body.controls.retrievalUsed).toBe(
      assurancePolicy.requireRetrieval
    );
  });

  test('reports the no-training policy on each answer', async ({ request }) => {
    const response = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-b' },
      data: { question: 'How does a target-date fund work?' }
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body.controls.trainingAllowed).toBe(
      assurancePolicy.trainingAllowed
    );
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

    expect(responseA.ok()).toBeTruthy();
    expect(responseB.ok()).toBeTruthy();

    const requestIdA = responseA.headers()['x-request-id'];
    const requestIdB = responseB.headers()['x-request-id'];

    expect(requestIdA).toBeTruthy();
    expect(requestIdB).toBeTruthy();
    expect(requestIdA).not.toBe(requestIdB);

    const auditA = await request.get(`/api/audit/${requestIdA}`, {
      headers: { 'x-tenant-id': 'tenant-a' }
    });

    const auditB = await request.get(`/api/audit/${requestIdB}`, {
      headers: { 'x-tenant-id': 'tenant-b' }
    });

    expect(auditA.ok()).toBeTruthy();
    expect(auditB.ok()).toBeTruthy();

    expect((await auditA.json()).tenantId).toBe('tenant-a');
    expect((await auditB.json()).tenantId).toBe('tenant-b');
  });

  test('does not return audit evidence to a different tenant', async ({ request }) => {
    const answerResponse = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });

    expect(answerResponse.ok()).toBeTruthy();

    const requestId = answerResponse.headers()['x-request-id'];

    expect(requestId).toBeTruthy();

    const ownerAudit = await request.get(`/api/audit/${requestId}`, {
      headers: { 'x-tenant-id': 'tenant-a' }
    });

    const otherTenantAudit = await request.get(`/api/audit/${requestId}`, {
      headers: { 'x-tenant-id': 'tenant-b' }
    });

    expect(ownerAudit.status()).toBe(200);
    expect(otherTenantAudit.status()).toBe(404);
  });

  test('records a refused request in the audit trail', async ({ request }) => {
    const answerResponse = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'Tell me what to buy for my retirement account.' }
    });

    expect(answerResponse.ok()).toBeTruthy();

    const auditResponse = await request.get(
      `/api/audit/${answerResponse.headers()['x-request-id']}`,
      { headers: { 'x-tenant-id': 'tenant-a' } }
    );

    expect(auditResponse.ok()).toBeTruthy();

    const audit = await auditResponse.json();

    expect(audit.outcome).toBe('refused');
    expect(audit.sourceIds).toEqual([]);
  });

  test('records an unsupported request in the audit trail', async ({ request }) => {
    const answerResponse = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: {
        question:
          'What are the tax rules for taking money out of my retirement account early?'
      }
    });

    expect(answerResponse.ok()).toBeTruthy();

    const auditResponse = await request.get(
      `/api/audit/${answerResponse.headers()['x-request-id']}`,
      { headers: { 'x-tenant-id': 'tenant-a' } }
    );

    expect(auditResponse.ok()).toBeTruthy();

    const audit = await auditResponse.json();

    expect(audit.outcome).toBe('unsupported');
    expect(audit.sourceIds).toEqual([]);
    expect(audit.model).toBe('not-called');
  });

  test('records an answered request in the audit trail', async ({ request }, testInfo) => {
    const answerResponse = await request.post('/api/answer', {
      headers: { 'x-tenant-id': 'tenant-a' },
      data: { question: 'How does a target-date fund work?' }
    });

    expect(answerResponse.ok()).toBeTruthy();

    const requestId = answerResponse.headers()['x-request-id'];

    expect(requestId).toBeTruthy();

    const auditResponse = await request.get(`/api/audit/${requestId}`, {
      headers: { 'x-tenant-id': 'tenant-a' }
    });

    expect(auditResponse.ok()).toBeTruthy();

    const audit = await auditResponse.json();

    expect(audit.requestId).toBe(requestId);
    expect(audit.tenantId).toBe('tenant-a');
    expect(audit.model).toBe(assurancePolicy.model);
    expect(audit.promptVersion).toBe(assurancePolicy.promptVersion);
    expect(audit.outcome).toBe('answered');
    expect(audit.mode).toMatch(/live|mock/);

    // The audit record is attached to the HTML report so the test leaves evidence behind.
    await testInfo.attach('audit-evidence', {
      body: JSON.stringify(audit, null, 2),
      contentType: 'application/json'
    });
  });
});