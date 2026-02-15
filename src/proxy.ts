import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export function proxy(request: NextRequest) {
  return auth(request as unknown as Parameters<typeof auth>[0]);
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
