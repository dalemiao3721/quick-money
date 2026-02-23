import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
    const session = await auth();
    if (session?.user) redirect("/");

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            padding: "2rem",
        }}>
            <div style={{
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(20px)",
                borderRadius: "32px",
                padding: "3rem 2.5rem",
                width: "100%",
                maxWidth: "380px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                textAlign: "center",
            }}>
                {/* App Icon */}
                <div style={{
                    width: "80px",
                    height: "80px",
                    background: "linear-gradient(135deg, #ff9500, #ff2d55)",
                    borderRadius: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2.2rem",
                    margin: "0 auto 1.5rem",
                    boxShadow: "0 8px 25px rgba(255,45,85,0.4)",
                }}>
                    💰
                </div>

                <h1 style={{
                    fontSize: "1.8rem",
                    fontWeight: "800",
                    color: "white",
                    marginBottom: "0.5rem",
                    letterSpacing: "-0.5px",
                }}>
                    極速記帳
                </h1>
                <p style={{
                    fontSize: "0.95rem",
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: "2.5rem",
                    lineHeight: "1.5",
                }}>
                    登入以同步您的財務資料<br />並保護帳戶安全
                </p>

                {/* Google Sign In Button */}
                <form action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/" });
                }}>
                    <button
                        type="submit"
                        style={{
                            width: "100%",
                            padding: "14px",
                            borderRadius: "16px",
                            border: "none",
                            background: "white",
                            color: "#1c1c1e",
                            fontSize: "1rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "12px",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                            transition: "transform 0.15s, box-shadow 0.15s",
                        }}
                    >
                        {/* Google Logo SVG */}
                        <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        使用 Google 帳號登入
                    </button>
                </form>

                <p style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.3)",
                    marginTop: "2rem",
                    lineHeight: "1.6",
                }}>
                    登入即表示您同意我們的服務條款<br />
                    您的資料僅用於個人記帳功能
                </p>
            </div>
        </div>
    );
}
