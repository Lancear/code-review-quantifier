export const config = {
  matcher: '/auth/authorize',
};

/**
 * 
 * @param {Request} request 
 * @param {import('@vercel/edge').RequestContext} context 
 */
export default async function middleware(request, context) {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/auth/authorize") {
      const { SCOPE } = process.env;
      const tokenInfo = await fetchAccessToken(url.searchParams.get('code'));
      if (tokenInfo.scope === SCOPE) return new Response("Unauthorized", { status: 401 });

      const headers = new Headers();
      url.pathname = '/';
      url.search = '';
      headers.set('Location', url.toString());
      headers.set('Set-Cookie', 'token=' + tokenInfo.access_token + '');
      return new Response(null, { headers, status: 302 });
    }
  }
  catch (err) {
    console.error(err);
    return new Response("Unauthorized", { status: 401 });
  }
};

async function fetchAccessToken(code) {
  const { CLIENT_ID, CLIENT_SECRET } = process.env;
  const res = await fetch(
    'https://github.com/login/oauth/access_token?client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&code=' + code, 
    { method: 'POST', headers: { 'Accept': 'application/json' }}
  );

  return res.json();
}
