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

  const { model, input, systemInstruction } = body;
  const keyOptions = [
    ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
    ['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY]
  ].map(([source, value]) => [source, String(value || '').trim()]);
  const [keySource, requestApiKey] = keyOptions.find(([, value]) => value) || ['none', ''];
  if (!requestApiKey || !input) {
    res.status(400).json({
      error: 'missing_api_key_or_input',
      message: 'Gemini API key is missing. Set GEMINI_API_KEY or GOOGLE_API_KEY in Vercel.',
      keySource,
      env: {
        GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
        GOOGLE_API_KEY: Boolean(process.env.GOOGLE_API_KEY)
      }
    });
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

  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(payload.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': requestApiKey
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: payload.system_instruction }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: payload.input }]
          }
        ],
        generationConfig: payload.generation_config
      })
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
        status: data.error && data.error.status ? data.error.status : null,
        keySource
      });
      return;
    }

    res.setHeader('cache-control', 'no-store');
    res.status(200).json({
      id: null,
      text: ((data.candidates || [])[0]?.content?.parts || []).map((part) => part.text || '').join(''),
      keySource
    });
  } catch (error) {
    res.status(502).json({
      error: 'gemini_unreachable',
      message: error && error.message ? error.message : 'Gemini request failed',
      keySource
    });
  }
};
