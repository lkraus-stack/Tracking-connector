import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const user = process.env.ADMIN_BASIC_AUTH_USER;
  const password = process.env.ADMIN_BASIC_AUTH_PASSWORD;

  if (!user || !password || request.nextUrl.pathname.startsWith("/api/health")) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  const expected = `Basic ${btoa(`${user}:${password}`)}`;

  if (authorization === expected) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="Tracking Connector Admin"'
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
