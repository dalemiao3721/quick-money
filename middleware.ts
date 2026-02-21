export { auth as middleware } from "@/auth";

export const config = {
    matcher: [
        /*
         * 保護所有路由，排除：
         * - /login (登入頁)
         * - /api/auth (NextAuth 本身)
         * - 靜態資源、圖片等
         */
        "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|sw.js|workbox-.*).*)",
    ],
};
