# @seip/tools

A premium, production-ready utility suite specifically designed to boost productivity in **Next.js** (App Router & Pages Router) and standard Node.js/Express. It brings field validation, secure sessions, encrypted JWT authentication, native file uploads, and middleware helpers directly to your application without setup overhead.

---

## Features

- ⚡ **Next.js First** - Crafted with first-class support for Server Actions, Server Components (`layout.js`/`page.js`), Route Handlers (`route.js`), and Edge Middleware.
- ✅ **Universal Validation** - Validate plain objects, standard Web Requests (`Request`/`NextRequest`), `FormData`, and Express requests with ease.
- 🌍 **Internationalization (i18n)** - Automated language detection from query parameters (`?lang=`), request cookies, custom headers, or `Accept-Language` headers. Supports English, Spanish, Portuguese, and French.
- 🔐 **Encrypted JWT Sessions** - High-security token generation using signed JWTs containing AES-256-GCM encrypted payloads for robust user sessions.
- 📁 **Native File Uploads** - Native Next.js file upload handling that validates file sizes and MIME types, writing uploads directly to `public/uploads` for instant static hosting. Also includes Express/Multer disk-storage engines.
- 🔗 **Edge-Friendly Middlewares** - Simple CORS header configurations and token redirect guards compatible with Next.js Edge Middleware.

---

## Installation

```bash
npm install @seip/tools
```

Ensure you have the environment variable `JWT_SECRET` set in your `.env` file:
```env
JWT_SECRET=your_super_secure_secret_key_here
```

---

## 1. Validation (`Validator`)

`Validator` handles schema validation, XSS sanitization, and localization. It detects request shapes and extracts bodies automatically.

### Rules Schema Example
```javascript
const userSchema = {
  email: { required: true, email: true },
  password: { required: true, password: true, min: 6 },
  name: { required: true, min: 3, max: 50 },
  role: { in: ['admin', 'user', 'guest'] }
};
```

### Next.js App Router: Route Handlers (`route.js`)
```javascript
import { NextResponse } from "next/server";
import { Validator } from "@seip/tools";

const schema = {
  email: { required: true, email: true },
  password: { required: true, min: 6 }
};

export async function POST(request) {
  const validator = new Validator(schema);
  const result = await validator.validate(request); // Automatically parses JSON or FormData request body

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  // Proceed with validated logic
  return NextResponse.json({ message: "Success" });
}
```

### Next.js App Router: Server Actions & Form Actions
```javascript
"use server";

import { Validator } from "@seip/tools";

const contactSchema = {
  name: { required: true, min: 3 },
  message: { required: true, min: 10 }
};

export async function handleContactForm(formData) {
  const validator = new Validator(contactSchema);
  const result = await validator.validate(formData); // Handles FormData object directly

  if (!result.success) {
    return { error: result.message.join(", ") };
  }

  // Send message...
  return { success: true };
}
```

### Express / Next.js Pages Router
```javascript
import { Validator } from "@seip/tools";

const schema = {
  email: { required: true, email: true }
};

const validator = new Validator(schema);

// Use as middleware in Express
app.post("/api/register", validator.middleware(), (req, res) => {
  res.json({ success: true });
});
```

---

## 2. Authentication & Sessions (`Auth`)

`Auth` uses signed JSON Web Tokens containing AES-256-GCM encrypted user payloads. This ensures session tampering is cryptographically impossible.

It provides environment-aware cookie operations that dynamically import `next/headers` inside Server Components/Actions, or fall back to standard HTTP responses in Pages/Express.

### User Sessions in Server Actions & API Routes
```javascript
import { Auth } from "@seip/tools";

// 1. Create session (sets a secure, HTTP-only, SameSite=Strict cookie)
await Auth.createSession(null, { userId: 123, role: "admin" }, { expiresIn: "24h" });

// 2. Retrieve session (reads and decrypts cookie payload automatically)
const session = await Auth.getSession();
if (session) {
  console.log("Logged in as user:", session.userId);
}

// 3. Destroy session (deletes session cookie)
await Auth.destroySession();
```

### Protecting Next.js Server Components (`page.js` / `layout.js`)
```javascript
import { redirect } from "next/navigation";
import { Auth } from "@seip/tools";

export default async function DashboardLayout({ children }) {
  const session = await Auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1>Welcome, {session.userId}</h1>
      <main>{children}</main>
    </div>
  );
}
```

### Cryptographic Helpers
```javascript
import { Auth } from "@seip/tools";

// Generate standalone JWT token
const token = Auth.generateToken({ id: 1 }, "optional_custom_secret", "7d");

// Verify and decrypt token
const payload = Auth.verifyToken(token, "optional_custom_secret");
```

---

## 3. File Uploads (`Upload`)

`Upload` provides native file parsing for Next.js App Router requests, plus standard Multer options for Express and Pages Router.

### Native Next.js App Router Route Handlers (`route.js`)
Files are parsed, validated, and stored inside the `public/` directory (defaults to `public/uploads`). This makes uploaded files instantly hosted and publicly accessible at `/uploads/filename`.

```javascript
import { NextResponse } from "next/server";
import { Upload } from "@seip/tools";

export async function POST(request) {
  const result = await Upload.handleNextUpload(request, {
    folder: "avatars",                // saved under public/avatars/
    fieldName: "image",               // form-data file key
    fileSize: 3 * 1024 * 1024,        // 3MB max size
    allowedTypes: ["image/png", "image/jpeg"]
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Returns upload metadata
  // result.url: "/avatars/1726038491823-938210398.png"
  return NextResponse.json({ url: result.url });
}
```

### Express & Pages Router Uploads (Multer)
```javascript
import { Upload } from "@seip/tools";

const uploader = Upload.disk({
  folder: "uploads",
  fileSize: 5000000,
  allowedTypes: ["image/png", "image/jpeg"]
});

// Use as Express middleware
app.post("/api/upload", uploader.single("file"), (req, res) => {
  res.json({ success: true, file: req.file });
});
```

---

## 4. Middleware Helpers (`Middleware`)

Utilities to streamline cross-origin settings and Edge Middleware validation.

### Next.js Edge Middleware (`middleware.js`)
Next.js Edge Middleware runs in a V8 Edge Runtime. Use the lightweight check helper to inspect cookie existence and redirect.

```javascript
import { NextResponse } from "next/server";
import { Middleware } from "@seip/tools";

export async function middleware(request) {
  // If the 'auth' cookie does not exist, redirect to '/login'
  const redirectResponse = await Middleware.authRedirect(request, "/login", "auth");
  if (redirectResponse) {
    return redirectResponse;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
};
```

### CORS Helper inside Route Handlers
```javascript
import { NextResponse } from "next/server";
import { Middleware } from "@seip/tools";

export async function GET(request) {
  const response = NextResponse.json({ data: "Hello World" });
  
  // Appends Access-Control-Allow-Origin: * and standard headers
  return Middleware.cors(response, {
    origin: "https://trusted-domain.com",
    methods: "GET,POST"
  });
}
```

---

## Validation Schema Reference

| Rule | Description | Example |
|------|-------------|---------|
| `required` | Field must not be undefined, null, or empty string. | `{ required: true }` |
| `min` | Minimum character length. | `{ min: 6 }` |
| `max` | Maximum character length. | `{ max: 50 }` |
| `email` | Valid email regex check. | `{ email: true }` |
| `number` | Numeric value. | `{ number: true }` |
| `alpha` | Only letters (`a-z`, `A-Z`). | `{ alpha: true }` |
| `alphanumeric` | Letters and numbers only. | `{ alphanumeric: true }` |
| `boolean` | Checks for `true`, `false`, `"true"`, or `"false"`. | `{ boolean: true }` |
| `date` | Valid ISO 8601 date parse. | `{ date: true }` |
| `url` | Valid URL format. | `{ url: true }` |
| `in` | Value must be inside specified array. | `{ in: ['admin', 'user'] }` |
| `equals` | Strict equivalence check. | `{ equals: "confirm" }` |
| `password` | Requires uppercase, lowercase, numbers, and minimum 6 characters. | `{ password: true }` |
| `pattern` | Custom RegExp pattern match. | `{ pattern: /^[A-Z]{3}-\d{3}$/ }` |

---

## Run Unit Tests

Ensure dependencies are installed and run the test script:
```bash
npm install
npm test
```

## License

MIT
