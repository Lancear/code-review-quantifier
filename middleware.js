export const config = {
  matcher: '/auth/:path*',
};

/**
 * 
 * @param {Request} request 
 * @param {import('@vercel/edge').RequestContext} context 
 */
export default function middleware(request, context) {
  console.log(request.url);
  return request;
};
