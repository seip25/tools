/**
 * Converts a base64 string to a Uint8Array.
 * @param {string} base64 - The base64 string.
 * @returns {Uint8Array} The byte array.
 */
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Webhook signature verification helper class compatible with Next.js Edge Runtime and standard Node.js.
 */
class Webhook {
  /**
   * Safely extracts the raw body from a web Request or Node.js request object.
   * @param {Request|Object} req - The incoming request object.
   * @returns {Promise<string>} The raw body string.
   */
  static async getRawBody(req) {
    if (typeof req.clone === "function") {
      try {
        return await req.clone().text();
      } catch {}
    }
    if (typeof req.text === "function") {
      try {
        return await req.text();
      } catch {}
    }
    if (req.rawBody) {
      return typeof req.rawBody === "string" ? req.rawBody : req.rawBody.toString("utf8");
    }
    if (req.body) {
      if (typeof req.body === "string") return req.body;
      if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
    }
    return "";
  }

  /**
   * Verifies the signature of an incoming webhook request.
   * Supports Stripe, Clerk (Svix), and generic HMAC-SHA256 signatures.
   * @param {Request|Object} req - The incoming request object.
   * @param {string} secret - The webhook signing secret.
   * @param {Object} options - Verification options.
   * @param {string} options.provider - The provider name ('stripe', 'clerk', or 'generic').
   * @param {string} [options.headerName] - Custom header name (only for 'generic').
   * @returns {Promise<boolean>} Resolves to true if the signature is valid, false otherwise.
   */
  static async verify(req, secret, options = {}) {
    const { provider = "generic", headerName = "x-signature" } = options;
    const rawBody = await Webhook.getRawBody(req);
    if (!rawBody || !secret) return false;

    const encoder = new TextEncoder();

    if (provider === "stripe") {
      let stripeHeader = null;
      if (req.headers && typeof req.headers.get === "function") {
        stripeHeader = req.headers.get("stripe-signature");
      } else if (req.headers) {
        stripeHeader = req.headers["stripe-signature"];
      }
      if (!stripeHeader) return false;

      const matchTimestamp = stripeHeader.match(/t=(\d+)/);
      const matchV1 = stripeHeader.match(/v1=([a-f0-9]+)/);
      if (!matchTimestamp || !matchV1) return false;

      const timestamp = matchTimestamp[1];
      const signatureHex = matchV1[1];
      const message = `${timestamp}.${rawBody}`;
      const messageBytes = encoder.encode(message);

      const signatureBytes = new Uint8Array(signatureHex.length / 2);
      for (let i = 0; i < signatureBytes.length; i++) {
        signatureBytes[i] = parseInt(signatureHex.substring(i * 2, i * 2 + 2), 16);
      }

      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["verify"]
      );

      return crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        messageBytes
      );
    }

    if (provider === "clerk") {
      let svixId = null;
      let svixTimestamp = null;
      let svixSignature = null;

      if (req.headers && typeof req.headers.get === "function") {
        svixId = req.headers.get("svix-id");
        svixTimestamp = req.headers.get("svix-timestamp");
        svixSignature = req.headers.get("svix-signature");
      } else if (req.headers) {
        svixId = req.headers["svix-id"];
        svixTimestamp = req.headers["svix-timestamp"];
        svixSignature = req.headers["svix-signature"];
      }

      if (!svixId || !svixTimestamp || !svixSignature) return false;

      const rawSecret = secret.startsWith("whsec_") ? secret.substring(6) : secret;
      const secretBytes = base64ToBytes(rawSecret);

      const message = `${svixId}.${svixTimestamp}.${rawBody}`;
      const messageBytes = encoder.encode(message);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        secretBytes,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["verify"]
      );

      const signatures = svixSignature.split(" ");
      for (const sig of signatures) {
        const parts = sig.split(",");
        if (parts.length !== 2 || parts[0] !== "v1") continue;
        const signatureBytes = base64ToBytes(parts[1]);

        const isValid = await crypto.subtle.verify(
          "HMAC",
          cryptoKey,
          signatureBytes,
          messageBytes
        );
        if (isValid) return true;
      }
      return false;
    }

    if (provider === "generic") {
      let signatureHeader = null;
      if (req.headers && typeof req.headers.get === "function") {
        signatureHeader = req.headers.get(headerName);
      } else if (req.headers) {
        signatureHeader = req.headers[headerName] || req.headers[headerName.toLowerCase()];
      }
      if (!signatureHeader) return false;

      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["verify"]
      );

      const messageBytes = encoder.encode(rawBody);
      const signatureBytes = new Uint8Array(signatureHeader.length / 2);
      for (let i = 0; i < signatureBytes.length; i++) {
        signatureBytes[i] = parseInt(signatureHeader.substring(i * 2, i * 2 + 2), 16);
      }

      return crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signatureBytes,
        messageBytes
      );
    }

    return false;
  }
}

export default Webhook;
