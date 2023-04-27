export const config = {
  matcher: ['/auth/:path*', '/api/:path*'],
};

async function fetchAccessToken(code, tokenInfo) {
  const { CLIENT_ID, CLIENT_SECRET } = process.env;
  const res = await fetch(
    'https://github.com/login/oauth/access_token?client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&code=' + code, 
    { method: 'POST', headers: { 'Accept': 'application/json' }}
  );

  Object.assign(tokenInfo, await res.json());
}

const STATE_LENGTH = 7;
const CHECK_SUM_INDEX = 3;
const CHECK_SUM_INIT = 13;

/**
 * 
 * @param {Request} request 
 * @param {import('@vercel/edge').RequestContext} context 
 */
export default function middleware(request, context) {
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
      return Response.redirect('https://github.com/login/oauth/authorize?client_id=' + CLIENT_ID + "&state=" + state);
    }
    else if (url.pathname === "/auth/authorize") {
      const stateNumbers = atob(url.searchParams.get('state')).split('.');
      if (stateNumbers.length > 2 * STATE_LENGTH) return new Response("Unauthorized", { status: 401 });
  
      let checkSum = CHECK_SUM_INIT;
      for (let idx = 0; idx < stateNumbers.length - 1; idx++) {
        if (idx === CHECK_SUM_INDEX) continue;
        checkSum += parseInt(stateNumbers[idx]) * idx;
      }
      
      checkSum %= 256;
      console.log(checkSum);
      console.log(stateNumbers.join());
      const validState = stateNumbers.length === STATE_LENGTH && parseInt(stateNumbers[CHECK_SUM_INDEX]) === checkSum;
      if (!validState) return new Response("Unauthorized", { status: 401 });
  
      const tokenInfo = {};
      context.waitUntil(fetchAccessToken(url.searchParams.get('code'), tokenInfo));
      console.log(JSON.stringify(tokenInfo, null, 2));
      return new Response("simple middleware");
    }
  }
  catch (err) {
    console.log(err);
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response("simple middleware");
};
