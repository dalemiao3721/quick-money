// Middleware 目前設為 pass-through，等 Google OAuth 設定完成後再啟用路由保護
// 啟用方式：取消註解下方 export，並移除最後一行的空 export

// import { auth } from "@/auth";
// export default auth;
// export const config = {
//   matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|sw.js|workbox-.*).*)", ],
// };

export { };
