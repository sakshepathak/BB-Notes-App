const OpenAI = require('openai');

/**
 * AI Service — Summarizes note content using Groq's API.
 *
 * Requires a valid GROQ_API_KEY in the .env file.
 * If the key is missing or set to the default placeholder,
 * the service gracefully skips summarization.
 */

const PLACEHOLDER_KEY = 'your_groq_api_key_here';

/** Check whether a real API key has been configured. */
function hasValidKey() {
  const key = process.env.GROQ_API_KEY;
  return key && key !== PLACEHOLDER_KEY && key.trim().length > 10;
}

/** Create the Groq client lazily (only when actually needed). */
let _client = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _client;
}

const aiService = {
  /**
   * Generate a concise 3–5 sentence summary of the given text.
   * Returns the summary string, or null if summarization is unavailable.
   */
  async summarizeText(text) {
    if (!hasValidKey()) {
      console.warn(
        '[AI] GROQ_API_KEY is not configured. ' +
        'Set a valid key in .env to enable AI summaries.'
      );
      return null;
    }

    if (!text || text.trim().length < 10) {
      console.warn('[AI] Content too short to summarize:', text?.length);
      return null;
    }

    try {
      const client = getClient();
      console.log('[AI] Sending summarization request for content length:', text.length);
      const response = await client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that provides a very short, to-the-point summary ' +
              'of personal notes. Cut to the chase and only provide the overall gist in ' +
              '1 to 2 clear sentences. Be extremely concise. No emojis.',
          },
          {
            role: 'user',
            content: `Please summarize the following note:\n\n${text}`,
          },
        ],
        model: 'llama-3.1-8b-instant',
      });

      const summary = response.choices[0].message.content.trim();
      console.log('[AI] Summary generated successfully.');
      return summary;
    } catch (error) {
      console.error('[AI] Summarization failed:', error.message);
      if (error.response) {
        console.error('[AI] API Response Data:', error.response.data);
      }
      return null;
    }
  },
  /**
   * Rewrite the given text to fix spelling, smooth tone,
   * enhance voice, and improve structure while maintaining context.
   */
  async rewriteText(text) {
    if (!hasValidKey()) {
      console.warn(
        '[AI] GROQ_API_KEY is not configured. ' +
        'Set a valid key in .env to enable AI rewriting.'
      );
      return null;
    }

    if (!text || text.trim().length < 5) {
      console.warn('[AI] Content too short to rewrite:', text?.length);
      return null;
    }

    try {
      const client = getClient();
      console.log('[AI] Sending rewrite request for content length:', text.length);
      const response = await client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'You are a direct, concise editor. Your task is to rewrite the provided content into a short, to-the-point summary. ' +
              'Cut to the chase and only talk about the overall gist. Be brief but clear. ' +
              'Maintain the same point of view (voice) as the original content. ' +
              'IMPORTANT: The input content may contain HTML tags (like <b>, <i>, <h1>, <p>, etc.). ' +
              'Your response MUST maintain the HTML structure where appropriate, or group it into clear <p> or <li> tags. ' +
              'Return only the summarized content in HTML form. Do not add quotes.'
          },
          {
            role: 'user',
            content: text,
          },
        ],
        model: 'llama-3.1-8b-instant',
      });

      const rewrittenText = response.choices[0].message.content.trim();
      console.log('[AI] Rewrite generated successfully.');
      return rewrittenText;
    } catch (error) {
      console.error('[AI] Rewriting failed:', error.message);
      return null;
    }
  },
};

module.exports = aiService;
