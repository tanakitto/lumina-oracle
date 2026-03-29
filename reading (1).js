exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, card, reversed, email, history, readingType, lang } = JSON.parse(event.body);

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const AIRTABLE_URL     = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const AIRTABLE_HEADERS = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
    };

    const language = lang || 'th';

    // ── Language instruction ───────────────────────────────────────────
    const langNote = language === 'en'
      ? 'Respond entirely in English. Tone: warm, thoughtful, like a wise counselor.'
      : language === 'jp'
      ? '日本語で返答してください。温かく、思慮深い口調で。'
      : 'ตอบเป็นภาษาไทยทั้งหมด ใช้ภาษาที่อบอุ่น สงบ ไม่เร่งรีบ';

    // ── Build history context (from summarized themes, not raw text) ──
    let historyContext = '';
    let sessionNumber = 1;
    if (history && history.length > 0) {
      sessionNumber = history.length + 1;
      const recent = history.slice(0, 3); // max 3 past sessions
      historyContext = `\nContext from past sessions (summarized themes only):
${recent.map((s, i) => `- Session ${history.length - i}: Theme "${s.theme}", Card: ${s.card}, Resonance: ${s.resonance || 'unknown'}`).join('\n')}
This is session ${sessionNumber} for this user.`;
    }

    // ── System prompt by reading type ─────────────────────────────────
    let systemPrompt = '';
    const reversedNote = reversed
      ? 'The symbol is reversed — read as blocked, delayed, or turned inward energy.'
      : 'The symbol is upright.';

    const baseRules = `
You are Lumina, a personal oracle. Philosophy: clarity over comfort.
${historyContext}
Rules:
- Connect the symbol directly to what the user expressed
- ${reversedNote}
- ${history.length > 0 ? 'Reference past themes naturally if relevant — show continuity' : 'This is their first session — no past reference needed'}
- Never say "you should" — use "perhaps..." or "this symbol invites..."
- End with exactly one question
- ${langNote}
Respond ONLY in JSON, no markdown:
{"reading": "3-4 sentences", "question": "one closing question"}`;

    if (readingType === 'rune') {
      systemPrompt = `You are Lumina, a rune reader. Philosophy: clarity over comfort.
${historyContext}
Rules:
- ${reversedNote}
- Connect the rune to what the user expressed
- ${history.length > 0 ? 'Reference past themes naturally' : 'First session'}
- End with one question
- ${langNote}
Respond ONLY in JSON, no markdown:
{"reading": "3-4 sentences", "question": "one closing question"}`;
    } else if (readingType === 'three') {
      systemPrompt = `You are Lumina, a tarot reader. Philosophy: clarity over comfort.
${historyContext}
Rules:
- Three cards represent Past · Present · Future — address all three
- Connect all cards to what the user expressed
- ${history.length > 0 ? 'Reference past themes naturally' : 'First session'}
- End with one question bridging past-present-future
- ${langNote}
Respond ONLY in JSON, no markdown:
{"reading": "5-6 sentences covering all 3 cards", "question": "one closing question"}`;
    } else {
      systemPrompt = baseRules;
    }

    // ── Call Claude for reading ───────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: `User expressed: "${prompt}"\nSymbol drawn: ${card}` }]
      })
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content[0].text;
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // ── Summarize prompt into abstract theme (privacy-safe) ───────────
    // We ask Claude to extract only an abstract theme — never store raw prompt
    const summaryRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        system: `Extract an abstract emotional theme from user input. 
Return ONLY a JSON object with two fields:
- "theme": 2-5 word abstract theme in English (e.g. "career uncertainty", "relationship tension", "identity shift", "fear of change", "creative block", "loneliness", "grief processing")
- "tag": single category word from: work, relationship, identity, fear, change, grief, creativity, health, spirituality, general

Never include any specific details, names, or identifying information from the input.
Respond ONLY with JSON, no markdown.`,
        messages: [{ role: 'user', content: `Input: "${prompt}"` }]
      })
    });

    const summaryData = await summaryRes.json();
    let theme = 'general reflection';
    let tag = 'general';
    try {
      const summaryText = summaryData.content[0].text.replace(/```json|```/g, '').trim();
      const summaryParsed = JSON.parse(summaryText);
      theme = summaryParsed.theme || 'general reflection';
      tag = summaryParsed.tag || 'general';
    } catch (e) {
      console.error('Summary parse error:', e.message);
    }

    // ── Save to Airtable — privacy-safe fields only ───────────────────
    // NEVER store: raw prompt text, full reading text, closing question
    // STORE: email, abstract theme, card drawn, tag, resonance (pending), date
    const airtableBody = {
      fields: {
        'User': email || 'guest',
        'Entry Prompt Chosen': theme,          // abstract theme, not raw prompt
        'Card Drawn': card,
        'Interpretation': `[${readingType || 'tarot-single'}] ${theme}`, // type + theme only
        'Closing Question': '[not stored]',    // never store the question
        'Resonance Score': 'pending',
        'Themes Tagged': tag,
        'Session Date': new Date().toISOString().split('T')[0]
      }
    };

    const airtableRes = await fetch(AIRTABLE_URL, {
      method: 'POST',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify(airtableBody)
    });
    const airtableData = await airtableRes.json();
    console.log('Airtable saved:', airtableData.id, '| Theme:', theme, '| Tag:', tag);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        reading: parsed.reading,
        question: parsed.question,
        sessionNumber
      })
    };

  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        reading: 'สัญลักษณ์กำลังพูดอะไรบางอย่าง แต่เสียงยังไม่ชัด ลองถามใหม่อีกครั้ง',
        question: 'มีอะไรที่คุณอยากถามอีกครั้งไหม?'
      })
    };
  }
};
