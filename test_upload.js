require('dotenv').config({ path: '.env.local' });
const client = require('@vercel/blob/client');
const undici = require('undici');

global.location = { href: 'https://dev.onpro.tech/app/le/123/master' };

const originalFetch = undici.fetch;
undici.fetch = async (url, options) => {
  console.log('FETCH CALLED:', url, options?.method);
  if (url.toString().includes('/api/documents/upload')) {
    return {
      ok: true,
      json: async () => ({
        type: 'blob',
        token: 'vercel_blob_client_GBftHYdhiojUuA0A_fake_token',
      })
    };
  }
  return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'Not Found' };
};

global.fetch = undici.fetch;

async function run() {
  try {
    const file = new Blob(['hello world'.repeat(1000)], { type: 'text/plain' });
    file.name = 'test.txt';
    
    process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL = 'https://vercel.com/api/blob';
    
    await client.upload('test.txt', file, {
      access: 'private',
      handleUploadUrl: '/api/documents/upload',
    });
  } catch (err) {
    console.log('Error:', err.message);
  }
}
run();
