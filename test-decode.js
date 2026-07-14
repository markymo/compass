const { handleUpload } = require('@vercel/blob/client');

async function main() {
  try {
    const res = await handleUpload({
      body: { 
        type: 'blob.generate-client-token',
        payload: { pathname: 'TEST_QUESTIONS.csv', clientPayload: '{}' }
      },
      request: { url: 'http://localhost/api/upload' },
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        tokenPayload: '{}',
        pathname: 'private-documents/uuid',
        allowedContentTypes: ['text/csv']
      })
    });
    console.log("Full Token Response:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
