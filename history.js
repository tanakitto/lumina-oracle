exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email || email === 'guest') {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ sessions: [], isReturning: false })
      };
    }

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const encodedEmail = encodeURIComponent(email);
    const formula = encodeURIComponent(`{User} = "${email}"`);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}?filterByFormula=${formula}&sort[0][field]=Session Date&sort[0][direction]=desc&maxRecords=5`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    const records = data.records || [];

    if (records.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ sessions: [], isReturning: false })
      };
    }

    // Return only privacy-safe metadata — theme, card, resonance, date
    // Never return raw prompt text or full reading
    const sessions = records.map(r => ({
      theme: r.fields['Entry Prompt Chosen'] || 'general reflection', // this is now abstract theme
      card: r.fields['Card Drawn'] || '',
      resonance: r.fields['Resonance Score'] !== 'pending' ? r.fields['Resonance Score'] : null,
      tag: r.fields['Themes Tagged'] || 'general',
      date: r.fields['Session Date'] || null,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        sessions,
        isReturning: sessions.length > 0
      })
    };

  } catch (err) {
    console.error('History error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ sessions: [], isReturning: false })
    };
  }
};
