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
    store: false
  });

  return {
    text: response.output_text,
    model: response.model,
    usage: response.usage
  };
}