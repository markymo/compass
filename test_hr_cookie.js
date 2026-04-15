const https = require('https');

async function doHRSearch() {
  console.log("Fetching GET /rp_web/mask.do?Typ=e");
  return new Promise((resolve) => {
    https.get({
      hostname: 'www.handelsregister.de',
      path: '/rp_web/mask.do?Typ=e',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, res => {
      console.log('GET STATUS:', res.statusCode);
      const cookies = res.headers['set-cookie'] || [];
      console.log('Cookies:', cookies);
      const jsessionid = cookies.map(c => c.split(';')[0]).join('; ');
      
      let html = '';
      res.on('data', c => html+=c);
      res.on('end', () => {
        resolve({ jsessionid, html });
      });
    });
  });
}
doHRSearch();
