const https = require('https');

const data = new URLSearchParams({
    'schlagwoerter': 'HRB 130853',
    'schlagwortTyp': 'EXAKT',
    'registerArt': 'HRB',
    'registerNummer': '130853',
    'registergericht': 'Frankfurt am Main'
}).toString();

const options = {
  hostname: 'www.handelsregister.de',
  port: 443,
  path: '/rp_web/search.do',
  method: 'POST',
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => console.log(responseData.substring(0, 1000)));
});
req.write(data);
req.end();
