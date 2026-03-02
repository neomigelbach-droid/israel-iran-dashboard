export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120');

  const RSS_FEEDS = [
    'https://www.timesofisrael.com/feed/',
    'https://www.jpost.com/rss/rssfeedsfrontpage.aspx',
    'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
    'https://rss.cnn.com/rss/edition_meast.rss',
  ];

  async function fetchRSS(url) {
    const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=15`;
    const r = await fetch(api, { signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    if (d.status !== 'ok') throw new Error('rss error');
    return (d.items || []).map(i => ({
      title: i.title,
      url: i.link,
      source: d.feed?.title || '',
      date: i.pubDate,
    }));
  }

  const results = await Promise.allSettled(RSS_FEEDS.map(fetchRSS));
  const articles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  res.json({ articles, count: articles.length, timestamp: new Date().toISOString() });
}
