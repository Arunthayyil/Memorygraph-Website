const https = require('https');

module.exports = async (req, res) => {
  const { code } = req.query;

  const data = JSON.stringify({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code,
  });

  const token = await new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(body).access_token);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    request.on('error', reject);
    request.write(data);
    request.end();
  });

  res.send(`
    <script>
      window.opener.postMessage(
        'authorization:github:success:{"token":"${token}","provider":"github"}',
        '*'
      );
    </script>
  `);
};
