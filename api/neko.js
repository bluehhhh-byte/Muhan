'use strict';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (error) {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const { apiKey, model, input, systemInstruction, previousInteractionId } = body;
  const requestApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!requestApiKey || !input) {
    res.status(400).json({ error: 'missing_api_key_or_input', message: 'Gemini API key is missing. Enter it in settings or set GEMINI_API_KEY in Vercel.' });
    return;
  }

  const payload = {
    model: model || 'gemini-3.1-flash-lite',
    input,
    system_instruction: systemInstruction || 'You are Neko, a guide cat in MUHAN Daejeon.',
    generation_config: {
      temperature: 0.9
    }
  };

  if (previousInteractionId) payload.previous_interaction_id = previousInteractionId;

  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': requestApiKey
      },
      body: JSON.stringify(payload)
    });
    const raw = await upstream.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = {};
    }

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: 'gemini_error',
        message: data.error && data.error.message ? data.error.message : raw || 'Gemini request failed',
        status: data.error && data.error.status ? data.error.status : null
      });
      return;
    }

    res.setHeader('cache-control', 'no-store');
    res.status(200).json({
      id: data.id || null,
      text: data.output_text || ''
    });
  } catch (error) {
    res.status(502).json({
      error: 'gemini_unreachable',
      message: error && error.message ? error.message : 'Gemini request failed'
    });
  }
};
