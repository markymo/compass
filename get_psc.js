const https = require('https');
const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

const options = {
  hostname: 'api.company-information.service.gov.uk',
  path: '/company/07365611/persons-with-significant-control',
  method: 'GET',
  headers: {
    'Authorization': 'Basic ' + Buffer.from(API_KEY + ':').toString('base64')
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(data); });
});

req.on('error', (e) => { console.error(e); });
req.end();
