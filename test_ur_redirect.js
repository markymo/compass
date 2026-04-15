const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) loc = 'https://www.unternehmensregister.de' + loc;
        resolve(fetch(loc));
      } else {
        let d = '';
        res.on('data', c => d+=c);
        res.on('end', () => resolve({ status: res.statusCode, data: d.substring(0, 1000) }));
      }
    });
  });
}
fetch('https://www.unternehmensregister.de/ureg/').then(console.log);
