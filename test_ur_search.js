const https = require('https');

// Unternehmensregister accepts GET requests for searches sometimes.
// Typically: https://www.unternehmensregister.de/ureg/result.html?submitaction=show&werkzeug_param=HRB+130853

const options = {
  hostname: 'www.unternehmensregister.de',
  port: 443,
  path: '/ureg/result.html?submitaction=show&werkzeug_param=HRB+130853',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  }
};

const req = https.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Data length:', data.length, '\n', data.substring(0, 500)));
});
req.on('error', e => console.error(e));
req.end();
