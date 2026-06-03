import jwt from "jsonwebtoken";
import crypto from "node:crypto";

/**
 * Authentication and session management helper class utilizing JWT and AES-256-GCM encryption.
 */
class Auth {
  /**
   * Encrypts a payload using AES-256-GCM.
   * @param {Object} payload - The data to encrypt.
   * @param {string} secret - The secret key for encryption.
   * @returns {string} The encrypted string in format iv:tag:encrypted.
   */
  static encrypt(payload, secret) {
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash("sha256").update(secret).digest();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${tag}:${encrypted}`;
  }

  /**
   * Decrypts a payload using AES-256-GCM.
   * @param {string} data - The encrypted string in format iv:tag:encrypted.
   * @param {string} secret - The secret key for decryption.
   * @returns {Object|null} The decrypted object or null if failed.
   */
  static decrypt(data, secret) {
    try {
      const [ivHex, tagHex, encryptedHex] = data.split(":");
      if (!ivHex || !tagHex || !encryptedHex) return null;

      const iv = Buffer.from(ivHex, "hex");
      const tag = Buffer.from(tagHex, "hex");
      const key = crypto.createHash("sha256").update(secret).digest();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  /**
   * Helper to resolve the JWT secret key.
   * @param {string} [secret] - Optional secret key.
   * @returns {string} The resolved secret key.
   * @private
   */
  static _resolveSecret(secret) {
    const finalSecret = secret || process.env.JWT_SECRET;
    if (!finalSecret) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("FATAL: JWT_SECRET environment variable is not defined.");
      }
      return "dev_jwt_secret_please_change_in_production";
    }
    return finalSecret;
  }

  /**
   * Generates an encrypted JWT token.
   * @param {Object} payload - The data to store in the token.
   * @param {string} [secret] - The secret key for JWT signing.
   * @param {string} [expiresIn="24h"] - Token expiration time.
   * @returns {string} The generated token.
   */
  static generateToken(payload, secret = null, expiresIn = "24h") {
    const resolvedSecret = Auth._resolveSecret(secret);
    const encrypted = Auth.encrypt(payload, resolvedSecret);
    return jwt.sign({ data: encrypted }, resolvedSecret, { expiresIn });
  }

  /**
   * Verifies and decrypts a JWT token.
   * @param {string} token - The token to verify.
   * @param {string} [secret] - The secret key.
   * @returns {Object|null} The decoded and decrypted payload or null if invalid.
   */
  static verifyToken(token, secret = null) {
    const resolvedSecret = Auth._resolveSecret(secret);
    try {
      const decoded = jwt.verify(token, resolvedSecret);
      if (!decoded || !decoded.data) return null;
      return Auth.decrypt(decoded.data, resolvedSecret);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves a cookie value from Next.js request, context, headers, or client store.
   * Supports Next.js App Router (next/headers), NextRequest cookies, and Express/Pages Router requests.
   * @param {Object|string|null} [reqOrCookies=null] - The request object or cookie store.
   * @param {string} [name="auth"] - The name of the cookie to retrieve.
   * @returns {Promise<string|null>} The cookie value or null if not found.
   */
  static async getCookie(reqOrCookies = null, name = "auth") {
    if (reqOrCookies) {
      if (typeof reqOrCookies.get === "function") {
        const val = reqOrCookies.get(name);
        return val && typeof val === "object" ? val.value : val;
      }
      if (reqOrCookies.cookies && typeof reqOrCookies.cookies === "object") {
        if (typeof reqOrCookies.cookies.get === "function") {
          const val = reqOrCookies.cookies.get(name);
          return val && typeof val === "object" ? val.value : val;
        }
        const val = reqOrCookies.cookies[name];
        if (val !== undefined) return val;
      }
      if (reqOrCookies.headers) {
        let cookieHeader = null;
        if (typeof reqOrCookies.headers.get === "function") {
          cookieHeader = reqOrCookies.headers.get("cookie");
        } else if (reqOrCookies.headers.cookie) {
          cookieHeader = reqOrCookies.headers.cookie;
        }
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
          if (match) return decodeURIComponent(match[1]);
        }
      }
    }

    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      return cookieStore.get(name)?.value || null;
    } catch {}

    return null;
  }

  /**
   * Sets a cookie in Next.js response, context, or headers.
   * Handles milliseconds to seconds conversion automatically for Next.js stores.
   * @param {Object|null} [resOrCookies=null] - The response object or cookie store.
   * @param {string} name - The name of the cookie.
   * @param {string} value - The value of the cookie.
   * @param {Object} [options={}] - Cookie options.
   * @returns {Promise<boolean>} True if set successfully, false otherwise.
   */
  static async setCookie(resOrCookies = null, name, value, options = {}) {
    const defaultOptions = {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };

    const finalOptions = { ...defaultOptions, ...options };

    if (resOrCookies) {
      if (typeof resOrCookies.set === "function") {
        const nextOptions = { ...finalOptions };
        if (nextOptions.maxAge && nextOptions.maxAge > 100000) {
          nextOptions.maxAge = Math.floor(nextOptions.maxAge / 1000);
        }
        resOrCookies.set(name, value, nextOptions);
        return true;
      }
      if (typeof resOrCookies.cookie === "function") {
        resOrCookies.cookie(name, value, finalOptions);
        return true;
      }
    }

    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const nextOptions = { ...finalOptions };
      if (nextOptions.maxAge && nextOptions.maxAge > 100000) {
        nextOptions.maxAge = Math.floor(nextOptions.maxAge / 1000);
      }
      cookieStore.set(name, value, nextOptions);
      return true;
    } catch {}

    return false;
  }

  /**
   * Clears/deletes a cookie.
   * @param {Object|null} [resOrCookies=null] - The response object or cookie store.
   * @param {string} [name="auth"] - The name of the cookie.
   * @param {Object} [options={}] - Cookie options.
   * @returns {Promise<boolean>} True if deleted successfully, false otherwise.
   */
  static async clearCookie(resOrCookies = null, name = "auth", options = {}) {
    const finalOptions = { path: "/", ...options };

    if (resOrCookies) {
      if (typeof resOrCookies.delete === "function") {
        resOrCookies.delete(name);
        return true;
      }
      if (typeof resOrCookies.clearCookie === "function") {
        resOrCookies.clearCookie(name, finalOptions);
        return true;
      }
      if (typeof resOrCookies.set === "function") {
        resOrCookies.set(name, "", { ...finalOptions, maxAge: 0 });
        return true;
      }
    }

    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      cookieStore.delete(name);
      return true;
    } catch {}

    return false;
  }

  /**
   * Generates a token and creates a secure session cookie.
   * @param {Object|null} resOrCookies - The response or cookie store.
   * @param {Object} payload - The data to store.
   * @param {Object} [options={}] - Options for token and cookie.
   * @param {string} [options.key="auth"] - Cookie key name.
   * @param {string} [options.expiresIn="24h"] - JWT expiration.
   * @param {Object} [options.cookie={}] - Additional cookie options.
   * @returns {Promise<string>} The generated token.
   */
  static async createSession(resOrCookies = null, payload, options = {}) {
    const { key = "auth", expiresIn = "24h", cookie = {} } = options;
    const token = Auth.generateToken(payload, null, expiresIn);
    
    let maxAge = 24 * 60 * 60 * 1000;
    if (expiresIn.endsWith("h")) {
      maxAge = parseInt(expiresIn) * 60 * 60 * 1000;
    } else if (expiresIn.endsWith("d")) {
      maxAge = parseInt(expiresIn) * 24 * 60 * 60 * 1000;
    } else if (expiresIn.endsWith("m")) {
      maxAge = parseInt(expiresIn) * 60 * 1000;
    } else if (expiresIn.endsWith("s")) {
      maxAge = parseInt(expiresIn) * 1000;
    }

    await Auth.setCookie(resOrCookies, key, token, { maxAge, ...cookie });
    return token;
  }

  /**
   * Retrieves the current secure session payload if authenticated.
   * @param {Object|null} [reqOrCookies=null] - The request or cookie store.
   * @param {string} [key="auth"] - Cookie key name.
   * @returns {Promise<Object|null>} The decrypted session data, or null.
   */
  static async getSession(reqOrCookies = null, key = "auth") {
    const token = await Auth.getCookie(reqOrCookies, key);
    if (!token) return null;
    return Auth.verifyToken(token);
  }

  /**
   * Destroys the secure session cookie.
   * @param {Object|null} [resOrCookies=null] - The response or cookie store.
   * @param {string} [key="auth"] - Cookie key name.
   * @returns {Promise<boolean>} True if destroyed successfully.
   */
  static async destroySession(resOrCookies = null, key = "auth") {
    return Auth.clearCookie(resOrCookies, key);
  }

  /**
   * Express/Pages Router middleware to protect routes.
   * @param {Object} [options={}] - Protection options.
   * @param {string} [options.redirect=null] - URL to redirect if unauthorized.
   * @param {string} [options.key="user"] - Property key to append user data to request.
   * @param {string} [options.cookieKey="auth"] - Cookie key.
   * @returns {Function} Express middleware.
   */
  static protect(options = {}) {
    const { redirect = null, key = "user", cookieKey = "auth" } = options;

    return async (req, res, next) => {
      const token = (await Auth.getCookie(req, cookieKey)) || req.headers?.authorization?.split(" ")[1];
      const isJson =
        req.headers?.["content-type"] === "application/json" ||
        (req.headers?.get && req.headers.get("content-type") === "application/json");

      if (!token) {
        if (redirect && !isJson) return res.redirect(redirect);
        return isJson ? res.status(401).json({ message: "Unauthorized" }) : res.status(401).end();
      }

      const decoded = Auth.verifyToken(token);
      if (!decoded) {
        if (redirect && !isJson) return res.redirect(redirect);
        return isJson ? res.status(401).json({ message: "Unauthorized" }) : res.status(401).end();
      }

      req[key] = decoded;
      next();
    };
  }

  /**
   * Express login helper for backward compatibility.
   * @param {Object} res - Express response object.
   * @param {Object} data - Payload data.
   * @param {string} [key="auth"] - Cookie key name.
   * @param {Object} [options={}] - Options.
   * @returns {Promise<string>} The generated token.
   */
  static async login(res, data, key = "auth", options = {}) {
    return Auth.createSession(res, data, { key, ...options });
  }

  /**
   * Express logout helper for backward compatibility.
   * @param {Object} res - Express response object.
   * @param {string} [key="auth"] - Cookie key.
   * @param {Object} [options={}] - Options.
   * @returns {Promise<boolean>} True if logged out.
   */
  static async logout(res, key = "auth", options = {}) {
    return Auth.destroySession(res, key);
  }
}

export default Auth;
