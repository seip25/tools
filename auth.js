/**
 * Converts a Uint8Array to a base64url string.
 * @param {Uint8Array} bytes - The byte array.
 * @returns {string} The base64url string.
 */
function bytesToBase64url(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Converts a base64url string to a Uint8Array.
 * @param {string} base64url - The base64url string.
 * @returns {Uint8Array} The byte array.
 */
function base64urlToBytes(base64url) {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Authentication and session management helper class utilizing JWT and AES-256-GCM encryption.
 */
class Auth {
  /**
   * Encrypts a payload using AES-256-GCM.
   * @param {Object} payload - The data to encrypt.
   * @param {string} secret - The secret key for encryption.
   * @returns {Promise<string>} The encrypted string in format iv:tag:encrypted.
   */
  static async encrypt(payload, secret) {
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);
    const keyHash = await crypto.subtle.digest("SHA-256", secretBytes);

    const aesKey = await crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dataBytes = encoder.encode(JSON.stringify(payload));

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128
      },
      aesKey,
      dataBytes
    );

    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const ciphertext = encryptedBytes.slice(0, -16);
    const tag = encryptedBytes.slice(-16);

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
    const tagHex = Array.from(tag).map(b => b.toString(16).padStart(2, "0")).join("");
    const ciphertextHex = Array.from(ciphertext).map(b => b.toString(16).padStart(2, "0")).join("");

    return `${ivHex}:${tagHex}:${ciphertextHex}`;
  }

  /**
   * Decrypts a payload using AES-256-GCM.
   * @param {string} data - The encrypted string in format iv:tag:encrypted.
   * @param {string} secret - The secret key for decryption.
   * @returns {Promise<Object|null>} The decrypted object or null if failed.
   */
  static async decrypt(data, secret) {
    try {
      const [ivHex, tagHex, encryptedHex] = data.split(":");
      if (!ivHex || !tagHex || !encryptedHex) return null;

      const hexToBytes = (hex) => {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return bytes;
      };

      const iv = hexToBytes(ivHex);
      const tag = hexToBytes(tagHex);
      const encrypted = hexToBytes(encryptedHex);

      const ciphertextWithTag = new Uint8Array(encrypted.length + tag.length);
      ciphertextWithTag.set(encrypted);
      ciphertextWithTag.set(tag, encrypted.length);

      const encoder = new TextEncoder();
      const secretBytes = encoder.encode(secret);
      const keyHash = await crypto.subtle.digest("SHA-256", secretBytes);

      const aesKey = await crypto.subtle.importKey(
        "raw",
        keyHash,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
          tagLength: 128
        },
        aesKey,
        ciphertextWithTag
      );

      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedText);
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
   * @param {string|number} [expiresIn="24h"] - Token expiration time.
   * @returns {Promise<string>} The generated token.
   */
  static async generateToken(payload, secret = null, expiresIn = "24h") {
    const resolvedSecret = Auth._resolveSecret(secret);
    const encrypted = await Auth.encrypt(payload, resolvedSecret);

    let seconds = 24 * 60 * 60;
    if (typeof expiresIn === "number") {
      seconds = expiresIn;
    } else if (typeof expiresIn === "string") {
      if (expiresIn.endsWith("h")) {
        seconds = parseInt(expiresIn) * 60 * 60;
      } else if (expiresIn.endsWith("d")) {
        seconds = parseInt(expiresIn) * 24 * 60 * 60;
      } else if (expiresIn.endsWith("m")) {
        seconds = parseInt(expiresIn) * 60;
      } else if (expiresIn.endsWith("s")) {
        seconds = parseInt(expiresIn);
      }
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + seconds;

    const jwtPayload = {
      data: encrypted,
      iat,
      exp
    };

    const header = { alg: "HS256", typ: "JWT" };
    const encoder = new TextEncoder();
    
    const headerB64 = bytesToBase64url(encoder.encode(JSON.stringify(header)));
    const payloadB64 = bytesToBase64url(encoder.encode(JSON.stringify(jwtPayload)));
    const messageBytes = encoder.encode(`${headerB64}.${payloadB64}`);

    const keyData = encoder.encode(resolvedSecret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageBytes
    );
    const signatureB64 = bytesToBase64url(new Uint8Array(signatureBuffer));

    return `${headerB64}.${payloadB64}.${signatureB64}`;
  }

  /**
   * Verifies and decrypts a JWT token.
   * @param {string} token - The token to verify.
   * @param {string} [secret] - The secret key.
   * @returns {Promise<Object|null>} The decoded and decrypted payload or null if invalid.
   */
  static async verifyToken(token, secret = null) {
    if (!token || typeof token !== "string") return null;
    const resolvedSecret = Auth._resolveSecret(secret);
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(resolvedSecret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["verify"]
      );

      const signatureBytes = base64urlToBytes(signatureB64);
      const messageBytes = encoder.encode(`${headerB64}.${payloadB64}`);
      const isValid = await crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        messageBytes
      );

      if (!isValid) return null;

      const payloadText = new TextDecoder().decode(base64urlToBytes(payloadB64));
      const decoded = JSON.parse(payloadText);

      if (decoded.exp && Date.now() / 1000 > decoded.exp) {
        return null;
      }

      if (!decoded.data) return null;
      return await Auth.decrypt(decoded.data, resolvedSecret);
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
        if (nextOptions.maxAge !== undefined) {
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
      if (nextOptions.maxAge !== undefined) {
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
    const token = await Auth.generateToken(payload, null, expiresIn);
    
    let maxAge = 24 * 60 * 60 * 1000;
    if (typeof expiresIn === "number") {
      maxAge = expiresIn * 1000;
    } else if (typeof expiresIn === "string") {
      if (expiresIn.endsWith("h")) {
        maxAge = parseInt(expiresIn) * 60 * 60 * 1000;
      } else if (expiresIn.endsWith("d")) {
        maxAge = parseInt(expiresIn) * 24 * 60 * 60 * 1000;
      } else if (expiresIn.endsWith("m")) {
        maxAge = parseInt(expiresIn) * 60 * 1000;
      } else if (expiresIn.endsWith("s")) {
        maxAge = parseInt(expiresIn) * 1000;
      }
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
    return await Auth.verifyToken(token);
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
      let token = await Auth.getCookie(req, cookieKey);
      if (!token && req.headers) {
        const authHeader = typeof req.headers.get === "function"
          ? req.headers.get("authorization")
          : req.headers.authorization || req.headers.Authorization;
        if (authHeader) {
          token = authHeader.split(" ")[1];
        }
      }

      const isJson =
        req.headers?.["content-type"] === "application/json" ||
        (req.headers?.get && req.headers.get("content-type") === "application/json");

      if (!token) {
        if (redirect && !isJson) return res.redirect(redirect);
        return isJson ? res.status(401).json({ message: "Unauthorized" }) : res.status(401).end();
      }

      const decoded = await Auth.verifyToken(token);
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
