import NextAuth from "next-auth"
import authConfig from "./auth.config"

const { auth } = NextAuth(authConfig)

export const proxy = auth((req) => {
    if (!req.auth && req.nextUrl.pathname !== "/login") {
        const newUrl = new URL("/login", req.nextUrl.origin)
        return Response.redirect(newUrl)
    }
})

export default proxy

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|invite|how-it-works|partner|about|privacy|terms|contact|$).*)"],
}
