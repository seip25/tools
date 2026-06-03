import Auth from "./auth.js";

/**
 * Common middleware helpers for Next.js App Router (Edge & Node runtime) and standard Node/Express.
 */
const Middleware = {
  /**
   * Next.js Route Handler / Middleware helper to apply CORS headers to a Response object.
   * @param {Response} response - The Next.js Response or NextResponse object.
   * @param {Object} [options={}] - CORS configuration options.
   * @param {string} [options.origin="*"] - Allowed origins.
   * @param {string} [options.methods="GET,POST,PUT,DELETE,OPTIONS"] - Allowed HTTP methods.
   * @param {string} [options.headers="Content-Type, Authorization"] - Allowed headers.
   * @param {string} [options.maxAge="86400"] - Access control max age.
   * @returns {Response} The Response object with CORS headers applied.
   */
  cors(response, options = {}) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": options.origin || "*",
      "Access-Control-Allow-Methods": options.methods || "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": options.headers || "Content-Type, Authorization",
      "Access-Control-Max-Age": options.maxAge || "86400",
    };

    if (response && response.headers && typeof response.headers.set === "function") {
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
    }

    return response;
  },

  /**
   * Edge-compatible Next.js Middleware helper to protect routes based on the presence of a cookie.
   * Redirects unauthorized requests to the specified login page.
   * @param {Request} request - The standard Next.js NextRequest object.
   * @param {string} [redirectUrl="/login"] - The path to redirect to if unauthorized.
   * @param {string} [cookieKey="auth"] - The name of the session cookie.
   * @returns {Promise<Response|null>} Resolves to a redirect Response if unauthorized, or null if authorized.
   */
  async authRedirect(request, redirectUrl = "/login", cookieKey = "auth") {
    let token = null;

    if (request.cookies) {
      if (typeof request.cookies.get === "function") {
        token = request.cookies.get(cookieKey)?.value;
      } else {
        token = request.cookies[cookieKey];
      }
    }

    if (!token && request.headers) {
      const cookieHeader = typeof request.headers.get === "function"
        ? request.headers.get("cookie")
        : request.headers.cookie;

      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieKey}=([^;]*)`));
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }
    }

    if (!token) {
      try {
        const { NextResponse } = await import("next/server");
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      } catch {
        // Fallback if next/server is not available in environment
      }
    }

    return null;
  },

  /**
   * Express/Pages Router authentication protection middleware.
   * @type {Function}
   */
  expressAuth: Auth.protect(),

  /**
   * Express/Pages Router web authentication protection middleware (redirects to "/" if unauthorized).
   * @type {Function}
   */
  expressWebAuth: Auth.protect({ redirect: "/" }),

  /**
   * Simple logging middleware compatible with Express/Pages Router.
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @param {Function} next - The next middleware function.
   */
  logger: (req, res, next) => {
    next();
  },
};

export default Middleware;
