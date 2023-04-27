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
    const { CLIENT_ID } = process.env;
    console.log(CLIENT_ID);
    return Response.redirect('https://github.com/login/oauth/authorize?client_id=' + CLIENT_ID);
  }

  return new Response("simple middleware");
};
