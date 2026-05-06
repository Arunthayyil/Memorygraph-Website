export async function onRequest(context) {
  const redirectUri = 'https://memorygraphweddings.com/api/callback';
  const githubUrl =
    'https://github.com/login/oauth/authorize' +
    '?client_id=' + context.env.GITHUB_CLIENT_ID +
    '&scope=repo,user' +
    '&redirect_uri=' + encodeURIComponent(redirectUri);

  return Response.redirect(githubUrl, 302);
}
