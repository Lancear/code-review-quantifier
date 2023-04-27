export const config = {
  matcher: '/auth/:path*',
};

/**
 * 
 * @param {Request} request 
 * @param {import('@vercel/edge').RequestContext} context 
 */
export default function middleware(request, context) {
  const url = new URL(request.url);
  console.log(url.pathname);

  if (url.pathname === "/auth/login") {
    const randomNumbers = new Uint8Array({ length: 9 });
    crypto.getRandomValues(randomNumbers);

    let sum = 13;
    for (let idx = 0; idx < randomNumbers.length; idx++) {
      sum += randomNumbers[idx] * idx;
    }

    const state = btoa(randomNumbers.join('.') + '.' + sum);
    const { CLIENT_ID } = process.env;
    return Response.redirect('https://github.com/login/oauth/authorize?client_id=' + CLIENT_ID + "&state=" + state);
  }
  else if (url.pathname === "/auth/authorize") {
    console.log(url.searchParams.get('code'));
    console.log(url.searchParams.get('state'));

    const stateNumbers = atob(url.searchParams.get('state')).split('.');
    let sum = 13;
    for (let idx = 0; idx < stateNumbers.length - 1; idx++) {
      sum += parseInt(randomNumbers[idx]) * idx;
    }

    const validState = parseInt(stateNumbers[stateNumbers.length - 1]) === sum;
    console.log('Valid state:', validState);
    return validState ? new Response("oha vip guest") : new Response("simple middleware");
  }

  return new Response("simple middleware");
};
