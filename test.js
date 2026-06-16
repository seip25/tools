import assert from "node:assert";
import { Validator, Auth, Upload, Middleware, Webhook, JsonLd } from "./index.js";

// Helper to mock Web Request object (like NextRequest)
class MockRequest {
  constructor(url, body, contentType, headers = {}, cookies = {}) {
    this.url = url;
    this._body = body;
    this._contentType = contentType;
    this.headers = new Map(Object.entries(headers));
    if (contentType) {
      this.headers.set("content-type", contentType);
    }
    this.cookies = {
      get: (name) => {
        const val = cookies[name];
        return val !== undefined ? { value: val } : null;
      },
      ...cookies
    };
  }

  clone() {
    return new MockRequest(
      this.url,
      this._body,
      this._contentType,
      Object.fromEntries(this.headers.entries()),
      this.cookies
    );
  }

  async json() {
    if (typeof this._body === "string") {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async formData() {
    const data = new Map();
    if (this._body && typeof this._body === "object") {
      for (const [k, v] of Object.entries(this._body)) {
        data.set(k, v);
      }
    }
    return {
      entries: () => data.entries(),
      get: (key) => data.get(key)
    };
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING @seip/tools TEST SUITE");
  console.log("==================================================");

  const schema = {
    email: { required: true, email: true },
    password: { required: true, password: true, min: 6 },
    name: { required: true, min: 3 },
    age: { number: true }
  };

  const validator = new Validator(schema);

  // ----------------------------------------------------
  // TEST 1: Validation of Plain Object
  // ----------------------------------------------------
  console.log("Test 1: Validating plain object...");
  const validData = {
    email: "test@example.com",
    password: "Password123",
    name: "John Doe",
    age: "30"
  };
  const result1 = await validator.validate(validData);
  assert.strictEqual(result1.success, true);
  assert.strictEqual(result1.error, false);
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 2: Validation of Web Request (JSON) & Lang detection (Query param)
  // ----------------------------------------------------
  console.log("Test 2: Validating Web Request (JSON) and translation...");
  const invalidJsonReq = new MockRequest(
    "https://example.com/api?lang=en",
    JSON.stringify({
      email: "invalid-email",
      password: "123",
      name: "Jo"
    }),
    "application/json"
  );
  const result2 = await validator.validate(invalidJsonReq);
  assert.strictEqual(result2.success, false);
  assert.strictEqual(result2.error, true);
  // Verify English messages are returned
  assert.ok(result2.message.some(m => m.includes("is required") || m.includes("must be")));
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 3: Validation of Web Request (FormData) & Lang detection (Cookie)
  // ----------------------------------------------------
  console.log("Test 3: Validating Web Request (FormData) and language cookie...");
  const invalidFormDataReq = new MockRequest(
    "https://example.com/api",
    {
      email: "invalid-email"
    },
    "multipart/form-data",
    {
      cookie: "lang=pt"
    }
  );
  const result3 = await validator.validate(invalidFormDataReq);
  assert.strictEqual(result3.success, false);
  // Verify Portuguese messages are returned
  assert.ok(result3.message.some(m => m.includes("é obrigatório") || m.includes("deve")));
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 4: JWT Encryption & Decryption
  // ----------------------------------------------------
  console.log("Test 4: JWT & AES-256-GCM Encryption/Decryption...");
  process.env.JWT_SECRET = "super_secret_key_for_testing";
  const userPayload = { userId: 42, role: "admin" };
  const token = await Auth.generateToken(userPayload);
  assert.ok(token);

  const decoded = await Auth.verifyToken(token);
  assert.deepStrictEqual(decoded, userPayload);
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 5: Cookies and Session Helpers (Next.js context)
  // ----------------------------------------------------
  console.log("Test 5: Auth.createSession, getSession, and destroySession...");
  const mockCookieStore = {
    _cookies: {},
    get(name) {
      return this._cookies[name] ? { value: this._cookies[name] } : null;
    },
    set(name, value, options) {
      this._cookies[name] = value;
    },
    delete(name) {
      delete this._cookies[name];
    }
  };

  const sessionToken = await Auth.createSession(mockCookieStore, userPayload, { expiresIn: "1h" });
  assert.ok(sessionToken);
  assert.strictEqual(mockCookieStore._cookies.auth, sessionToken);

  const sessionData = await Auth.getSession(mockCookieStore);
  assert.deepStrictEqual(sessionData, userPayload);

  await Auth.destroySession(mockCookieStore);
  assert.strictEqual(mockCookieStore._cookies.auth, undefined);
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 6: CORS Middleware Helper
  // ----------------------------------------------------
  console.log("Test 6: Middleware.cors...");
  const mockHeaders = new Map();
  const mockRes = {
    headers: mockHeaders
  };

  
  Middleware.cors(mockRes, { origin: "https://trusted.com" });
  assert.strictEqual(mockHeaders.get("Access-Control-Allow-Origin"), "https://trusted.com");
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 7: Auth Redirect Middleware Helper (Next.js)
  // ----------------------------------------------------
  console.log("Test 7: Middleware.authRedirect...");
  const mockReqNoAuth = {
    cookies: {
      get: (name) => null
    },
    headers: {
      get: (name) => null
    },
    url: "https://example.com/dashboard"
  };

  const redirectResult = await Middleware.authRedirect(mockReqNoAuth, "/login");
  assert.strictEqual(redirectResult, null); 
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 8: Middleware.redirect & Middleware.rewrite (relative routing)
  // ----------------------------------------------------
  console.log("Test 8: Middleware.redirect and Middleware.rewrite...");
  const mockRouteReq = {
    url: "https://my-app.com/old-path"
  };

  const redirectResponse = await Middleware.redirect(mockRouteReq, "/new-path", 301);
  assert.strictEqual(redirectResponse.status, 301);
  assert.strictEqual(redirectResponse.headers.get("Location"), "https://my-app.com/new-path");

  const rewriteResponse = await Middleware.rewrite(mockRouteReq, "/rewrite-path");
  assert.strictEqual(rewriteResponse.status, 200);
  assert.strictEqual(rewriteResponse.headers.get("x-middleware-rewrite"), "https://my-app.com/rewrite-path");
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 9: Middleware.getSubdomain (SaaS/multi-tenant subdomain helper)
  // ----------------------------------------------------
  console.log("Test 9: Middleware.getSubdomain...");
  const mockTenantReq = {
    headers: {
      get: (name) => name === "host" ? "acme.my-platform.com" : null
    }
  };
  const subdomain = Middleware.getSubdomain(mockTenantReq);
  assert.strictEqual(subdomain, "acme");

  const mockWwwReq = {
    headers: {
      get: (name) => name === "host" ? "www.acme.my-platform.com" : null
    }
  };
  const wwwSubdomain = Middleware.getSubdomain(mockWwwReq);
  assert.strictEqual(wwwSubdomain, "acme");

  const mockLocalReq = {
    headers: {
      get: (name) => name === "host" ? "localhost:3000" : null
    }
  };
  assert.strictEqual(Middleware.getSubdomain(mockLocalReq), null);
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 10: Middleware.geolocation (Geo IP location headers)
  // ----------------------------------------------------
  console.log("Test 10: Middleware.geolocation...");
  const mockGeoReq = {
    headers: {
      get: (name) => {
        if (name === "x-vercel-ip-country") return "ES";
        if (name === "x-vercel-ip-city") return "Madrid";
        return null;
      }
    }
  };
  const geoData = Middleware.geolocation(mockGeoReq);
  assert.strictEqual(geoData.country, "ES");
  assert.strictEqual(geoData.city, "Madrid");
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 11: Validator output data & XSS sanitization & mass assignment filter
  // ----------------------------------------------------
  console.log("Test 11: Validator data output, XSS sanitization, and mass-assignment filtering...");
  const dirtyData = {
    email: "clean@example.com",
    password: "Password123",
    name: "John <script>alert('xss')</script> Doe",
    age: "25",
    isAdmin: true // extra field not in schema
  };
  const result11 = await validator.validate(dirtyData);
  assert.strictEqual(result11.success, true);
  assert.ok(result11.data);
  // Must sanitize XSS
  assert.strictEqual(result11.data.name, "John &lt;script&gt;alert('xss')&lt;/script&gt; Doe");
  // Must filter out unvalidated fields
  assert.strictEqual(result11.data.isAdmin, undefined);
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 12: Validator type casting
  // ----------------------------------------------------
  console.log("Test 12: Validator automatic type-casting (numbers & booleans)...");
  const castSchema = {
    isActive: { required: true, boolean: true },
    score: { required: true, number: true },
    name: { required: true }
  };
  const castValidator = new Validator(castSchema);
  const rawInput = {
    isActive: "true",
    score: "99.5",
    name: "Alex"
  };
  const result12 = await castValidator.validate(rawInput);
  assert.strictEqual(result12.success, true);
  assert.strictEqual(result12.data.isActive, true);
  assert.strictEqual(result12.data.score, 99.5);
  assert.strictEqual(result12.data.name, "Alex");
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 13: Subdomain edge-cases
  // ----------------------------------------------------
  console.log("Test 13: Middleware.getSubdomain edge cases (IPs, root domains, multi-part TLDs)...");
  
  const testSubdomain = (hostHeader) => {
    return Middleware.getSubdomain({
      headers: { get: (name) => name === "host" ? hostHeader : null }
    });
  };

  assert.strictEqual(testSubdomain("my-platform.com"), null);
  assert.strictEqual(testSubdomain("www.my-platform.com"), null);
  assert.strictEqual(testSubdomain("acme.my-platform.com"), "acme");
  assert.strictEqual(testSubdomain("www.acme.my-platform.com"), "acme");
  assert.strictEqual(testSubdomain("192.168.1.1:3000"), null);
  assert.strictEqual(testSubdomain("acme.my-platform.co.uk"), "acme");
  assert.strictEqual(testSubdomain("my-platform.co.uk"), null);
  assert.strictEqual(testSubdomain("www.acme.my-platform.co.uk"), "acme");
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 14: Auth createSession with numeric expiresIn
  // ----------------------------------------------------
  console.log("Test 14: Auth session creation with numeric expiresIn & maxAge conversion...");
  const mockCookieStore14 = {
    _cookies: {},
    _options: {},
    get(name) {
      return this._cookies[name] ? { value: this._cookies[name] } : null;
    },
    set(name, value, options) {
      this._cookies[name] = value;
      this._options[name] = options;
    }
  };
  // 3600 seconds as numeric expiresIn
  await Auth.createSession(mockCookieStore14, { id: 1 }, { expiresIn: 3600 });
  assert.ok(mockCookieStore14._cookies.auth);
  // Next.js cookie stores should have maxAge scaled to seconds (3600 instead of 3600000)
  assert.strictEqual(mockCookieStore14._options.auth.maxAge, 3600);
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 15: Validator.createSafeAction
  // ----------------------------------------------------
  console.log("Test 15: Validator.createSafeAction...");
  const actionSchema = {
    title: { required: true, min: 3 },
    count: { required: true, number: true }
  };
  const safeAction = Validator.createSafeAction(actionSchema, async (data) => {
    return { id: "new-item-123", ...data };
  });

  const failResult = await safeAction({ title: "Hi", count: "ten" });
  assert.strictEqual(failResult.success, false);
  assert.ok(failResult.error);
  assert.ok(failResult.errors.length > 0);

  const successResult = await safeAction({ title: "New Item", count: "42" });
  assert.strictEqual(successResult.success, true);
  assert.strictEqual(successResult.data.id, "new-item-123");
  assert.strictEqual(successResult.data.title, "New Item");
  assert.strictEqual(successResult.data.count, 42); // should be casted to number
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 16: Webhook verification
  // ----------------------------------------------------
  console.log("Test 16: Webhook verification...");
  // Test Stripe signature
  const stripeSecret = "whsec_stripe_test";
  const stripeTimestamp = "1234567890";
  const stripeRawBody = JSON.stringify({ event: "charge.succeeded" });
  const encoder = new TextEncoder();
  const stripeKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(stripeSecret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  const stripeMessage = encoder.encode(`${stripeTimestamp}.${stripeRawBody}`);
  const stripeSigBuffer = await crypto.subtle.sign("HMAC", stripeKey, stripeMessage);
  const stripeSigHex = Array.from(new Uint8Array(stripeSigBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  
  const mockStripeReq = {
    headers: {
      get: (name) => name === "stripe-signature" ? `t=${stripeTimestamp},v1=${stripeSigHex}` : null
    },
    text: async () => stripeRawBody
  };

  const isStripeValid = await Webhook.verify(mockStripeReq, stripeSecret, { provider: "stripe" });
  assert.strictEqual(isStripeValid, true);
  console.log("✅ Passed");

  // ----------------------------------------------------
  // TEST 17: JsonLd Schema Builder
  // ----------------------------------------------------
  console.log("Test 17: JsonLd schema builder...");
  const productLd = JsonLd.product({
    name: "Smartphone X",
    image: "https://example.com/phone.jpg",
    description: "Premium phone",
    sku: "phone-x-123",
    price: 999.99,
    currency: "EUR",
    inStock: true
  });
  assert.strictEqual(productLd["@type"], "Product");
  assert.strictEqual(productLd.name, "Smartphone X");
  assert.strictEqual(productLd.offers.price, 999.99);
  assert.strictEqual(productLd.offers.priceCurrency, "EUR");
  console.log("✅ Passed");

  console.log("==================================================");
  console.log("ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
