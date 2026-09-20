# AI Assurance Checks with Playwright

This project uses Playwright and TypeScript to test the control layer around a small AI-backed participant experience.

The service can send retirement education questions to the OpenAI API, ground supported questions with local plan content, record request evidence, and expose the controls that Playwright verifies.

The application is intentionally small. The focus is on how browser and API tests can be used to check AI behavior, release controls, evidence, and failure handling.

## What is checked

| Control | What the test verifies |
| --- | --- |
| Grounded response | A supported informational answer returns the expected source |
| Refusal behavior | Requests for personal investment choices or guaranteed returns are refused |
| Model and prompt control | The expected model and prompt versions are visible and checked |
| Token budget | Input and output token use stays within defined limits |
| Retrieval rule | Supported informational questions use the expected knowledge source |
| Training rule | The service reports that tenant data is not allowed for training |
| Tenant evidence | Audit records stay tied to the tenant that created the request |
| Audit evidence | Each successful request receives an ID and matching audit record |
| Release gate | A small behavior set must meet the required pass rate |
| Graceful failure | The page shows a clear fallback when the answer service fails |

## Project layout

```text
.
├── public/
│   └── index.html
├── src/
│   ├── knowledge.ts
│   ├── openai.ts
│   ├── policy.ts
│   └── server.ts
├── tests/
│   ├── assurance-gate.spec.ts
│   ├── controls.spec.ts
│   ├── quality.spec.ts
│   └── resilience.spec.ts
├── .github/
│   └── workflows/
│       └── playwright.yml
├── .gitignore
├── package.json
├── package-lock.json
├── playwright.config.ts
├── requirements.sh
├── requirements.txt
└── tsconfig.json
```

## AI modes

The service supports two modes.

### Live mode

Live mode sends the request through the OpenAI Responses API.

The model, prompt version, and token limits are defined in `src/policy.ts`. The API call is kept in `src/openai.ts` so model access stays separate from the application and test logic.

Local settings are read from a `.env` file:

```text
OPENAI_API_KEY=your_api_key
AI_MODE=live
```

The `.env` file is ignored by Git and should never be committed.

### Mock mode

Mock mode returns deterministic responses without making an external API call.

GitHub Actions uses this mode so pull requests and pushes can run the same assurance suite without requiring an API key or depending on a live model response.

## Grounding

`src/knowledge.ts` contains a small source used for the target-date fund example.

For supported informational questions, the server:

1. looks up relevant source content
2. adds that content to the model prompt
3. returns the source ID with the answer
4. records the source ID in the audit event

This is intentionally a small retrieval example rather than a full vector-search or RAG platform. It gives the tests a real source boundary to verify without adding infrastructure that is outside the purpose of the project.

Personal investment requests do not use the informational source. They are handled as refusal scenarios.

## How the service works

`src/server.ts` handles the application request and coordinates the controls around it.

A successful request produces:

- the participant-facing answer
- source IDs
- input and output token counts
- retrieval and training-control metadata
- model and prompt version information
- a unique request ID
- an audit event tied to the tenant that made the request

`src/policy.ts` keeps the expected model, prompt version, token limits, retrieval rule, and training rule in one place.

`src/openai.ts` handles the OpenAI request and returns the response text, model information, and token usage to the service.

The OpenAI request uses `store: false` and applies the configured output-token limit.

## Playwright coverage

The project uses browser and API tests together.

### Response quality

`tests/quality.spec.ts` checks the participant-facing experience.

It verifies that an educational answer is returned with its source and that a personal investment request produces refusal language instead of a direct recommendation.

The assertions allow reasonable wording differences from a live model while still checking the required behavior.

### Release controls

`tests/controls.spec.ts` checks the service boundary directly.

It verifies:

- model and prompt version values
- token limits
- retrieval behavior
- the training rule
- tenant-specific audit evidence
- request IDs and audit records

Audit JSON is attached to the Playwright HTML report so the test leaves evidence behind.

### Assurance gate

`tests/assurance-gate.spec.ts` runs a small behavior set before promotion.

The current scenarios cover:

- general retirement education
- a personal investment choice
- a guaranteed-return request

The gate checks the actual response behavior and expected source use. All current scenarios must pass.

### Resilience

`tests/resilience.spec.ts` intercepts the answer request and forces a `503` response.

This verifies the application's fallback behavior without requiring a real OpenAI outage.

## Run locally

Requirements:

- Node.js 22 or newer
- npm
- an OpenAI API key for live mode

Install the project dependencies:

```bash
./requirements.sh
```

Or install them directly:

```bash
npm install
npx playwright install chromium
```

Create a local `.env` file in the project root:

```text
OPENAI_API_KEY=your_api_key
AI_MODE=live
```

Then run the suite:

```bash
npm test
```

To watch the browser:

```bash
npm run test:headed
```

To open the Playwright HTML report after a run:

```bash
npm run report
```

## CI

The GitHub Actions workflow runs on pushes and pull requests to `main`.

CI uses:

```text
AI_MODE=mock
```

This keeps the build repeatable and prevents the repository from requiring an OpenAI API key.

The workflow installs the locked Node dependencies, installs Chromium, runs the Playwright suite, and keeps the HTML report as a workflow artifact.

A failed assurance control becomes a failed CI check.

## Scope

This project demonstrates how Playwright can be applied beyond basic browser automation to AI-facing quality and release controls.

It includes a real OpenAI API path, but it is not intended to represent a complete production AI platform.

The local knowledge lookup is deliberately small. A larger system could replace it with a retrieval service or vector store while keeping similar assurance checks around the service boundary.

The project also does not claim to provide full drift monitoring, fairness evaluation, model-risk management, production observability, or FinOps attribution. Those require broader datasets, telemetry, infrastructure, and governance processes than this repository is meant to reproduce.