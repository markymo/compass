const https = require('https');

// We can search UR via GET param. E.g. https://www.unternehmensregister.de/ureg/result.html?submitaction=show&werkzeug_param=HRB+130853
// But since the direct fetch returned 404, let's see what happens if we just hit the homepage /ureg/
https.get({
  hostname: 'www.unternehmensregister.de',
  path: '/ureg/',
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115' }
}, res => {
  console.log('Homepage STATUS:', res.statusCode);
});
