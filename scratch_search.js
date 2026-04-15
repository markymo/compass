const https = require('https');
https.get('https://www.unternehmensregister.de/ureg/result.html?submitaction=show&werkzeug_param=HRB+130853', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('HTTP', res.statusCode, 'Data length:', data.length, data.substring(0, 500)));
});
