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

    const state = btoa(randomNumbers.join('') + sum);
    const { CLIENT_ID } = process.env;
    return Response.redirect('https://github.com/login/oauth/authorize?client_id=' + CLIENT_ID + "&state=" + state);
  }

  return new Response("simple middleware");
};
