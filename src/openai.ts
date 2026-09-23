import OpenAI from 'openai';
import { assurancePolicy } from './policy.js';

type ModelReply = Pick<OpenAI.Responses.Response, 'status' | 'output_text' | 'usage'>;

// An empty or cut-off reply is not an answer. Fail so the caller returns
// the service error instead of a blank response recorded as a success.
export function getUsableText(response: ModelReply) {
  if (response.status === 'incomplete' || !response.output_text.trim()) {
    throw new Error(
      `Model returned no usable answer (status: ${response.status}, ` +
        `output tokens: ${response.usage?.output_tokens}, ` +
        `reasoning tokens: ${response.usage?.output_tokens_details?.reasoning_tokens}, ` +
        `text length: ${response.output_text.length})`
    );
  }

  return response.output_text;
}

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

  return {
    text: getUsableText(response),
    model: response.model,
    usage: response.usage
  };
}