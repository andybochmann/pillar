import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextRequest, NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Security headers to apply to all responses
const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export async function proxy(request: NextRequest) {
  // Get the auth response
  const authResponse = await auth(request as unknown as Parameters<typeof auth>[0]);

  // If auth returns a response (redirect, etc.), add headers to it
  if (authResponse) {
    Object.entries(securityHeaders).forEach(([key, value]) => {
      authResponse.headers.set(key, value);
    });
    return authResponse;
  }

  // Otherwise, create a next response with headers
  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (Auth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    "/((?!api/auth|api/mcp|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)",
  ],
};
