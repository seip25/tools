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
   * Helper to perform a NextResponse redirect using a relative or absolute path.
   * @param {Request} request - The NextRequest object.
   * @param {string} destination - Relative path (e.g. '/login') or absolute URL.
   * @param {number} [status=307] - Redirect status code.
   * @returns {Promise<Response>} The NextResponse redirect object.
   */
  async redirect(request, destination, status = 307) {
    const url = new URL(destination, request.url);
    try {
      const { NextResponse } = await import("next/server");
      return NextResponse.redirect(url, status);
    } catch {
      return new Response(null, {
        status,
        headers: { Location: url.toString() },
      });
    }
  },

  /**
   * Helper to perform a NextResponse rewrite using a relative or absolute path.
   * @param {Request} request - The NextRequest object.
   * @param {string} destination - Relative path (e.g. '/login') or absolute URL.
   * @returns {Promise<Response>} The NextResponse rewrite object.
   */
  async rewrite(request, destination) {
    const url = new URL(destination, request.url);
    try {
      const { NextResponse } = await import("next/server");
      return NextResponse.rewrite(url);
    } catch {
      return new Response(null, {
        status: 200,
        headers: { "x-middleware-rewrite": url.toString() },
      });
    }
  },

  /**
   * Extracts the subdomain from the request host.
   * Ignores 'www' and local hosts (localhost, 127.0.0.1).
   * @param {Request} request - The NextRequest object.
   * @returns {string|null} The extracted subdomain, or null if none.
   */
  getSubdomain(request) {
    if (!request) return null;
    let host = "";
    if (typeof request.headers.get === "function") {
      host = request.headers.get("host") || "";
    } else if (request.headers) {
      host = request.headers.host || request.headers.Host || "";
    }

    const parts = host.split(".");
    if (parts.length <= 1) return null;

    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return null;
    }

    const subdomain = parts[0];
    if (subdomain === "www") {
      return parts[1] && parts.length > 2 ? parts[1] : null;
    }
    return subdomain;
  },

  /**
   * Retrieves geographic information from request headers (supports Vercel and Cloudflare headers).
   * @param {Request} request - The NextRequest object.
   * @returns {Object} Geolocation data (country, region, city, timezone, latitude, longitude).
   */
  geolocation(request) {
    if (!request || !request.headers) {
      return { country: null, region: null, city: null, timezone: null, latitude: null, longitude: null };
    }

    const getHeader = (name) => {
      if (typeof request.headers.get === "function") {
        return request.headers.get(name);
      }
      return request.headers[name] || request.headers[name.toLowerCase()];
    };

    return {
      country: getHeader("x-vercel-ip-country") || getHeader("cf-ipcountry") || null,
      region: getHeader("x-vercel-ip-country-region") || null,
      city: getHeader("x-vercel-ip-city") || null,
      timezone: getHeader("x-vercel-ip-timezone") || null,
      latitude: getHeader("x-vercel-ip-latitude") || null,
      longitude: getHeader("x-vercel-ip-longitude") || null,
    };
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
