export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');

  // Credentials from environment variables
  const ACLED_EMAIL = process.env.ACLED_EMAIL;
  const ACLED_PASSWORD = process.env.ACLED_PASSWORD;

  if (!ACLED_EMAIL || !ACLED_PASSWORD) {
    return res.status(500).json({
      status: 'error',
      message: 'ACLED credentials not configured',
      events: []
    });
  }

  try {
    // Step 1: Get OAuth token from ACLED
    const tokenResponse = await fetch('https://acleddata.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: ACLED_EMAIL,
        password: ACLED_PASSWORD,
        grant_type: 'password',
        client_id: 'acled'
      }).toString(),
      signal: AbortSignal.timeout(10000)
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Fetch Israel/Iran conflict events from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    // Query for Israel and Iran related conflicts
    const apiUrl = new URL('https://acleddata.com/api/acled/read');
    apiUrl.searchParams.set('_format', 'json');
    apiUrl.searchParams.set('country', 'Israel:OR:country=Iran');
    apiUrl.searchParams.set('event_date', `${startDate}|${new Date().toISOString().split('T')[0]}`);
    apiUrl.searchParams.set('event_date_where', 'BETWEEN');
    apiUrl.searchParams.set('fields', 'event_id_cnty|event_date|event_type|country|admin1|latitude|longitude|fatalities|notes|source');
    apiUrl.searchParams.set('limit', '100');

    const dataResponse = await fetch(apiUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!dataResponse.ok) {
      throw new Error(`Data request failed: ${dataResponse.status}`);
    }

    const data = await dataResponse.json();

    // Step 3: Transform data for dashboard
    let events = [];
    if (data.data && Array.isArray(data.data)) {
      events = data.data.map(event => ({
        id: event.event_id_cnty,
        date: event.event_date,
        type: event.event_type,
        country: event.country,
        region: event.admin1,
        lat: parseFloat(event.latitude),
        lng: parseFloat(event.longitude),
        fatalities: parseInt(event.fatalities) || 0,
        notes: event.notes,
        source: event.source
      })).filter(e => e.lat && e.lng); // Only include events with valid coordinates
    }

    return res.json({
      status: 'success',
      count: events.length,
      events: events,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('ACLED API Error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      events: []
    });
  }
}
