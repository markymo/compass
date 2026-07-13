const { handleUpload } = require('@vercel/blob/client');

async function main() {
  try {
    const res = await handleUpload({
      body: { type: 'blob.multipartUpload' },
      request: { url: 'http://localhost/api/upload' },
      token: 'vercel_blob_rw_123',
      onBeforeGenerateToken: async () => ({
        tokenPayload: '{}',
        pathname: 'test',
        allowedContentTypes: ['*/*']
      })
    });
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
main();
