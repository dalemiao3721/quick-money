import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pass-through middleware（本地 Email 登入模式，不需要 NextAuth 路由保護）
export function middleware(request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|sw.js|workbox-.*).*)"],
};
