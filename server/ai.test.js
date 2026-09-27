import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueSuggestion } from './ai.js';

test('catalogue uses local rules when no provider is configured', async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try { const result = await catalogueSuggestion('ही पैठणी साडी हाताने विणलेली आहे'); assert.equal(result.source, 'local_rules'); }
  finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});

test('configured provider receives image and returns reviewable structured fields', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  const priorFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.input[1].content[1].type, 'input_image');
    const fields = Object.fromEntries(['title','description','category','craft','material','colors','technique','region','care','story'].map((key) => [key, key === 'title' ? 'Model title' : '']));
    return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(fields) }] }] }) };
  };
  try {
    const result = await catalogueSuggestion('Handmade bag', 'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(result.title, 'Model title');
    assert.equal(result.source, 'openai_vision_text');
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorKey;
  }
});
