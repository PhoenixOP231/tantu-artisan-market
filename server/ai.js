import { suggestCatalogue } from './core.js';

const fields = ['title','description','category','craft','material','colors','technique','region','care','story'];
const schema = {
  type: 'object', additionalProperties: false,
  properties: Object.fromEntries(fields.map((field) => [field, { type: 'string' }])),
  required: fields,
};

export async function catalogueSuggestion(notes, image) {
  const fallback = suggestCatalogue(notes);
  if (!process.env.OPENAI_API_KEY) return fallback;
  const content = [{ type: 'input_text', text: `Artisan description: ${String(notes).slice(0, 1200)}` }];
  if (typeof image === 'string' && /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(image) && image.length < 4_000_000) {
    content.push({ type: 'input_image', image_url: image, detail: 'low' });
  }
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini', store: false,
        input: [
          { role: 'system', content: 'Create a product listing from the artisan’s words and optional photo. Preserve handmade appearance and the artisan’s stated facts. Do not invent origin, materials, certifications or dimensions. Use empty strings when uncertain. Keep the description in the artisan’s language and write a concise story. The artisan will review all fields.' },
          { role: 'user', content },
        ],
        text: { format: { type: 'json_schema', name: 'artisan_catalogue', strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const result = await response.json();
    const output = result.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
    if (!output) throw new Error('Provider returned no catalogue text');
    const parsed = JSON.parse(output);
    const cleaned = Object.fromEntries(fields.map((field) => [field, String(parsed[field] || '').slice(0, field === 'description' || field === 'story' ? 1200 : 200)]));
    return { ...fallback, ...cleaned, language: fallback.language, source: 'openai_vision_text', reviewNote: 'AI-generated suggestions. Verify materials, origin and craft details before publishing.' };
  } catch (error) {
    console.warn('Catalogue AI unavailable; local rules used:', error.message);
    return { ...fallback, reviewNote: 'AI provider unavailable. Local rules were used; review all suggested fields.' };
  }
}
