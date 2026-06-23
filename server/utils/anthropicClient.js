// Thin wrapper around the Anthropic Messages API used by aiController.js.
// Keeping this in one place means the API key, model name, and error
// handling only need to be right once instead of per-feature.
//
// Requires ANTHROPIC_API_KEY to be set in the server's environment
// (see .env.example). Never expose this key to the client — every AI
// feature in this app must be called through this server, not from
// client/src directly.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

class AIConfigError extends Error {}

function assertConfigured() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AIConfigError(
      'AI features are not configured on this server. Set ANTHROPIC_API_KEY in the server .env file to enable them.'
    );
  }
}

/**
 * Sends a single-turn request to Claude and returns the parsed JSON object
 * from its response. Assumes the prompt instructs Claude to reply with
 * JSON only — used for all structured-extraction style AI features here.
 *
 * @param {Object} opts
 * @param {string} opts.system - system prompt
 * @param {Array}  opts.content - the `content` array for the single user message
 *                                (string, or array of text/image blocks for vision)
 * @param {number} [opts.maxTokens]
 */
async function getStructuredCompletion({ system, content, maxTokens = 1500 }) {
  assertConfigured();

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('AI returned no text content.');

  // Strip ```json fences in case the model wraps its output despite instructions.
  const cleaned = textBlock.text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('AI response was not valid JSON. Try again.');
  }
}

module.exports = { getStructuredCompletion, AIConfigError };
