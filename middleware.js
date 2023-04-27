export const config = {
  matcher: ['/auth/:path*', '/api/:path*'],
};

/**
 * 
 * @param {Request} request 
 * @param {import('@vercel/edge').RequestContext} context 
 */
export default function middleware(request, context) {
  const url = new URL(request.url);

  if (url.pathname === "/auth/login") {
    const randomNumbers = new Uint8Array({ length: 10 });
    crypto.getRandomValues(randomNumbers);

    randomNumbers[9] = 13;
    for (let idx = 0; idx < randomNumbers.length - 1; idx++) {
      randomNumbers[9] += randomNumbers[idx] * idx;
    }

    const state = btoa(new TextDecoder().decode(randomNumbers));
    const { CLIENT_ID } = process.env;
    return Response.redirect('https://github.com/login/oauth/authorize?client_id=' + CLIENT_ID + "&state=" + state);
  }
  else if (url.pathname === "/auth/authorize") {
    const stateNumbers = new TextEncoder().encode(atob(url.searchParams.get('state')));

    let checkSum = 13;
    for (let idx = 0; idx < stateNumbers.length - 1; idx++) {
      checkSum += parseInt(stateNumbers[idx]) * idx;
    }

    const validState = parseInt(stateNumbers[9]) === checkSum;
    return validState ? new Response("oha vip guest") : new Response("simple middleware");
  }

  return new Response("simple middleware");
};
