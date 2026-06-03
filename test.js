import assert from "node:assert";
import { Validator, Auth, Upload, Middleware } from "./index.js";

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
  const token = Auth.generateToken(userPayload);
  assert.ok(token);

  const decoded = Auth.verifyToken(token);
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

  console.log("==================================================");
  console.log("ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
