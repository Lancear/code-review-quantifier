export const config = {
  matcher: ['/auth/:path*', '/api/:path*'],
};

async function fetchAccessToken(code) {
  const { CLIENT_ID, CLIENT_SECRET } = process.env;
  const res = await fetch(
    'https://github.com/login/oauth/access_token?client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&code=' + code, 
    { method: 'POST', headers: { 'Accept': 'application/json' }}
  );

  return res.json();
}

const STATE_LENGTH = 7;
const CHECK_SUM_INDEX = 3;
const CHECK_SUM_INIT = 13;

/**
 * 
 * @param {Request} request 
 * @param {import('@vercel/edge').RequestContext} context 
 */
export default async function middleware(request, context) {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/auth/login") {
      const randomNumbers = new Uint8Array({ length: STATE_LENGTH });
      crypto.getRandomValues(randomNumbers);
  
      randomNumbers[CHECK_SUM_INDEX] = CHECK_SUM_INIT;
      for (let idx = 0; idx < randomNumbers.length; idx++) {
        if (idx === CHECK_SUM_INDEX) continue;
        randomNumbers[CHECK_SUM_INDEX] += randomNumbers[idx] * idx;
      }

      const state = btoa(randomNumbers.join('.'));
      const { CLIENT_ID } = process.env;
      return Response.redirect('https://github.com/login/oauth/authorize?scope=repo&client_id=' + CLIENT_ID + '&state=' + state);
    }
    else if (url.pathname === "/auth/authorize") {
      const stateNumbers = atob(url.searchParams.get('state')).split('.');
      if (stateNumbers.length > 2 * STATE_LENGTH) return new Response("Unauthorized", { status: 401 });
  
      let checkSum = CHECK_SUM_INIT;
      for (let idx = 0; idx < stateNumbers.length; idx++) {
        if (idx === CHECK_SUM_INDEX) continue;
        checkSum += parseInt(stateNumbers[idx]) * idx;
      }
      
      checkSum %= 256;
      const validState = stateNumbers.length === STATE_LENGTH && parseInt(stateNumbers[CHECK_SUM_INDEX]) === checkSum;
      if (!validState) return new Response("Unauthorized", { status: 401 });
  
      const tokenInfo = await fetchAccessToken(url.searchParams.get('code'));
      console.log(JSON.stringify(tokenInfo, null, 2));
      if (tokenInfo.scope !== "repo") return new Response("Unauthorized", { status: 401 });

      url.pathname = '/';
      const res = Response.redirect(url);
      res.headers.set('Set-Cookie', 'token=' + tokenInfo.access_token + '; SameSite=Strict; Path=/api; Secure; HttpOnly');
      return res;
    }
  }
  catch (err) {
    console.log(err);
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response("simple middleware");
};
