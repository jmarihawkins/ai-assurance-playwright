# AI Assurance Checks with Playwright

This project uses Playwright to test the control layer around a small AI-backed participant experience. It checks what a user sees, what the service returns, whether release rules stay in place, and whether each request leaves usable evidence behind.

The demo app is intentionally small. The focus is the assurance work around it.

## What is checked

| Control | What the test proves |
| --- | --- |
| Grounded response | Informational answers show the source used for the response |
| Refusal behavior | Personal investment-choice requests are refused |
| Version control | Model and prompt versions are pinned and visible in response headers |
| Token budget | Input and output token counts stay inside defined limits |
| Retrieval and training rules | Informational answers use retrieval and tenant data is not marked for training |
| Tenant evidence | Audit records stay tied to the tenant that created the request |
| Audit evidence | Each answer gets a request ID and a matching audit record attached to the test report |
| Release gate | A small assurance set must meet the required pass rate |
| Graceful failure | The page gives a clear fallback when the answer service is unavailable |

## Project layout

```text
.
├── public/
│   └── index.html
├── src/
│   ├── policy.ts
│   └── server.ts
├── tests/
│   ├── assurance-gate.spec.ts
│   ├── controls.spec.ts
│   ├── quality.spec.ts
│   └── resilience.spec.ts
├── .github/workflows/playwright.yml
├── playwright.config.ts
├── requirements.sh
├── requirements.txt
└── package.json
```

## Run it

Requirements: Node.js 22 or newer and npm.

```bash
./requirements.sh
npm test
```

`requirements.sh` installs the Node packages and the Chromium browser used by the suite. `requirements.txt` is included as a quick requirements reference, but npm still uses `package.json` as the real Node dependency file.

To watch the browser:

```bash
npm run test:headed
```

To open the HTML report after a run:

```bash
npm run report
```

## How it works

`src/server.ts` stands in for a small AI service. It returns an answer, source IDs, token counts, control metadata, and a request ID. It also records an audit event that can be retrieved later.

`src/policy.ts` keeps the expected model version, prompt version, token limits, retrieval rule, and training rule in one place. The tests compare live behavior against those values instead of repeating them throughout the suite.

The Playwright suite uses browser and API coverage together:

- Browser tests verify the participant-facing answer and source display.
- API tests check version pinning, token limits, retrieval rules, tenant evidence, and audit records.
- Route mocking forces a service failure so the fallback path is tested without changing the app.
- The assurance gate runs a small behavior set and fails when the expected pass rate is not met.
- Audit JSON is attached to the Playwright report so a passing control has evidence, not just a green check.

The GitHub Actions workflow runs the same suite on pushes and pull requests. A failed control becomes a failed CI check before a change is merged.

## Scope

This repository does not call a paid model API. The responses are deterministic so anyone can clone the project and get repeatable CI results.

It also does not claim to be a full model-risk, drift-monitoring, fairness, or FinOps platform. In a live system, this same test structure could point at a real service while larger evaluation sets, calibrated model-scored checks, drift trends, spend attribution, and production telemetry live in the systems built for those jobs.
