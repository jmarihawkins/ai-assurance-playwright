import OpenAI from 'openai';
import { assurancePolicy } from './policy.js';

export async function getOpenAIResponse(prompt: string) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.responses.create({
    model: assurancePolicy.model,
    input: prompt,
    max_output_tokens: assurancePolicy.maxOutputTokens,
    // Reasoning tokens count against max_output_tokens, so keep them low
    // to leave room for the visible answer.
    reasoning: { effort: 'low' },
    store: false
  });

  // An empty or cut-off reply is not an answer. Fail so the caller returns
  // the service error instead of a blank response recorded as a success.
  if (response.status === 'incomplete' || !response.output_text.trim()) {
    throw new Error(
      `Model returned no usable answer (status: ${response.status}, ` +
        `output tokens: ${response.usage?.output_tokens}, ` +
        `reasoning tokens: ${response.usage?.output_tokens_details?.reasoning_tokens}, ` +
        `text length: ${response.output_text.length})`
    );
  }

  return {
    text: response.output_text,
    model: response.model,
    usage: response.usage
  };
}