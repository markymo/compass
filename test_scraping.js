const https = require('https');

// The German register allows fetching via firm name or HRB.
// The easiest is actually to do a basic query to the search page.
// Let's try "handelsregister.de" basic search or duckduckgo search for exact text to see if we can just grab the snippets.

const options = {
  hostname: 'www.handelsregister.de',
  port: 443,
  path: '/rp_web/search.do',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
};

const req = https.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('handelsregister.de length:', data.length));
});
req.on('error', e => console.error(e));
req.end();
