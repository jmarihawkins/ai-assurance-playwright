import { test, expect } from '@playwright/test';
import { judgeAnswer, judgePromptVersion } from './judge.js';
import { judgeCases } from './judge-cases.js';

// Grading each case more than once shows whether the judge is consistent, not just right once.
const gradesPerCase = 3;

test.describe('answer judge', () => {
  // The judge calls the real model, so these checks only run in live mode.
  test.skip(process.env.AI_MODE !== 'live', 'the judge needs the live model');

  for (const judgeCase of judgeCases) {
    test(`grades "${judgeCase.name}" as ${judgeCase.expected} on every run`, async ({}, testInfo) => {
      const results = await Promise.all(
        Array.from({ length: gradesPerCase }, () =>
          judgeAnswer(judgeCase.check, judgeCase)
        )
      );

      await testInfo.attach('judge-verdicts', {
        body: JSON.stringify(
          {
            judgePromptVersion,
            expected: judgeCase.expected,
            why: judgeCase.why,
            results
          },
          null,
          2
        ),
        contentType: 'application/json'
      });

      expect(
        results.map(result => result.verdict),
        JSON.stringify(results, null, 2)
      ).toEqual(Array(gradesPerCase).fill(judgeCase.expected));
    });
  }
});
