exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, prompt, score } = JSON.parse(event.body);

    if (!email || email === 'guest' || !score) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, reason: 'no email or score' })
      };
    }

    const AIRTABLE_BASE_ID = 'appY0QrFxt71E2oqI';
    const AIRTABLE_TABLE   = 'tbl3eGN7tW1HKyyX4';
    const AIRTABLE_URL     = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const HEADERS = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
    };

    // Get latest 10 records sorted by date desc — no filter to avoid encoding issues
    const searchRes = await fetch(
      `${AIRTABLE_URL}?sort%5B0%5D%5Bfield%5D=Session+Date&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=10`,
      { headers: HEADERS }
    );
    const searchData = await searchRes.json();
    console.log('Records fetched:', searchData.records ? searchData.records.length : 0);

    if (!searchData.records || searchData.records.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, reason: 'no records' })
      };
    }

    // Find most recent pending record for this email
    const pending = searchData.records.find(r =>
      r.fields['User'] === email &&
      (r.fields['Resonance Score'] === 'pending' || !r.fields['Resonance Score'])
    );

    const target = pending || searchData.records.find(r => r.fields['User'] === email);

    if (!target) {
      console.log('No record found for email:', email);
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, reason: 'email not found' })
      };
    }

    console.log('Updating record:', target.id, 'with score:', score);

    const updateRes = await fetch(`${AIRTABLE_URL}/${target.id}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ fields: { 'Resonance Score': score } })
    });
    const updateData = await updateRes.json();
    console.log('Update result:', JSON.stringify(updateData));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, updated: target.id })
    };

  } catch (err) {
    console.error('Resonance error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
