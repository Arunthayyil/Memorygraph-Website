module.exports = (req, res) => {
  const redirectUri = `https://memorygraphweddings.com/api/callback`;
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(githubUrl);
};
