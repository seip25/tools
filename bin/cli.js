#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h" || command === "help") {
  console.log(`
@seip/tools CLI Helper

Usage:
  npx seip-tools <command> [options]

Commands:
  secret        Generates a secure 32-byte JWT secret and adds it to your .env file
  proxy-auth    Generates a secure, Edge-compatible proxy.js file for Next.js routing
  help          Shows this help menu

Options:
  --force, -f             Forces overwriting existing files
  --dashboard, -d <path>  Customize dashboard route path (default: /dashboard)
  --login, -l <path>      Customize login route path (default: /login)
  --i18n                  Generates a combined Auth + i18n localization proxy & dictionaries
  --i18n-only             Generates only the i18n localization routing & dictionaries
  `);
  process.exit(0);
}

if (command === "secret") {
  const force = args.includes("--force") || args.includes("-f");
  const envPath = path.join(process.cwd(), ".env");
  const secretKey = crypto.randomBytes(32).toString("hex");

  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  const jwtSecretLine = `JWT_SECRET=${secretKey}`;

  if (envContent.includes("JWT_SECRET=")) {
    if (force) {
      const lines = envContent.split("\n");
      const updatedLines = lines.map(line => {
        if (line.trim().startsWith("JWT_SECRET=")) {
          return jwtSecretLine;
        }
        return line;
      });
      fs.writeFileSync(envPath, updatedLines.join("\n"), "utf8");
      console.log(" Successfully generated and replaced JWT_SECRET in your .env file!");
    } else {
      console.log(" JWT_SECRET already exists in your .env file. Use '--force' or '-f' to overwrite it.");
    }
  } else {
    const separator = envContent.length > 0 && !envContent.endsWith("\n") ? "\n" : "";
    fs.appendFileSync(envPath, `${separator}${jwtSecretLine}\n`, "utf8");
    console.log(" Successfully generated and added JWT_SECRET to your .env file!");
  }
  process.exit(0);
} else if (command === "proxy-auth") {
  const force = args.includes("--force") || args.includes("-f");
  const i18n = args.includes("--i18n");
  const i18nOnly = args.includes("--i18n-only");

  const dashboardIndex = args.indexOf("--dashboard");
  const dashboardIndexShort = args.indexOf("-d");
  let dashboardRoute = "/dashboard";
  if (dashboardIndex !== -1 && args[dashboardIndex + 1]) {
    dashboardRoute = args[dashboardIndex + 1];
  } else if (dashboardIndexShort !== -1 && args[dashboardIndexShort + 1]) {
    dashboardRoute = args[dashboardIndexShort + 1];
  }

  const loginIndex = args.indexOf("--login");
  const loginIndexShort = args.indexOf("-l");
  let loginRoute = "/login";
  if (loginIndex !== -1 && args[loginIndex + 1]) {
    loginRoute = args[loginIndex + 1];
  } else if (loginIndexShort !== -1 && args[loginIndexShort + 1]) {
    loginRoute = args[loginIndexShort + 1];
  }

  const proxyPath = path.join(process.cwd(), "proxy.js");

  if (fs.existsSync(proxyPath) && !force) {
    console.log(" proxy.js already exists. Use '--force' or '-f' to overwrite it.");
    process.exit(1);
  }

  if (i18n || i18nOnly) {
    const libDir = path.join(process.cwd(), "lib");
    const dictDir = path.join(process.cwd(), "dictionaries");

    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
    }
    if (!fs.existsSync(dictDir)) {
      fs.mkdirSync(dictDir, { recursive: true });
    }

    const dictJsPath = path.join(libDir, "dictionaries.js");
    const enJsonPath = path.join(dictDir, "en.json");
    const esJsonPath = path.join(dictDir, "es.json");

    const dictJsContent = `const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  es: () => import("@/dictionaries/es.json").then((module) => module.default),
};

/**
 * Retrieves the translation dictionary for the specified locale.
 * @param {string} locale - The request locale.
 * @returns {Promise<Object>} The translation dictionary object.
 */
export const getDictionary = async (locale) => {
  "use cache";
  return dictionaries[locale] ? dictionaries[locale]() : dictionaries.en();
};
`;

    const enJsonContent = `{
  "Home": "Home",
  "Dashboard": "Dashboard",
  "Login": "Login"
}
`;

    const esJsonContent = `{
  "Home": "Inicio",
  "Dashboard": "Panel de Control",
  "Login": "Iniciar Sesión"
}
`;

    if (force || !fs.existsSync(dictJsPath)) {
      fs.writeFileSync(dictJsPath, dictJsContent, "utf8");
    }
    if (force || !fs.existsSync(enJsonPath)) {
      fs.writeFileSync(enJsonPath, enJsonContent, "utf8");
    }
    if (force || !fs.existsSync(esJsonPath)) {
      fs.writeFileSync(esJsonPath, esJsonContent, "utf8");
    }

    console.log(" Successfully generated dictionaries inside /lib and /dictionaries folders!");
  }

  let proxyContent = "";

  if (i18nOnly) {
    proxyContent = `import { NextResponse } from "next/server";

const defaultLocale = "en";
const locales = ["en", "es"];

/**
 * Handles Edge-based URL redirect routing and internationalization.
 * @param {Request} req - The Next.js request object.
 * @returns {Promise<Response>} The Next.js response.
 */
export async function proxy(req) {
  const pathname = req.nextUrl.pathname;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(\`/\${locale}/\`) || pathname === \`/\${locale}\`
  );

  let lng = null;
  if (pathnameHasLocale) {
    lng = pathname.split("/")[1];
  } else {
    lng = req.cookies.get("lng")?.value || defaultLocale;
    req.nextUrl.pathname = \`/\${lng}\${pathname === "/" ? "" : pathname}\`;
    return NextResponse.redirect(req.nextUrl);
  }

  const response = NextResponse.next();
  response.cookies.set("lng", lng, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/"
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|.*\\\\..*).*)"
  ]
};
`;
  } else if (i18n) {
    proxyContent = `import { NextResponse } from "next/server";
import Auth from "@seip/tools/auth";

const defaultLocale = "en";
const locales = ["en", "es"];

/**
 * Handles Edge-based URL redirect routing, route authorization, and internationalization.
 * @param {Request} req - The Next.js request object.
 * @returns {Promise<Response>} The Next.js response.
 */
export async function proxy(req) {
  const pathname = req.nextUrl.pathname;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(\`/\${locale}/\`) || pathname === \`/\${locale}\`
  );

  let lng = null;
  if (pathnameHasLocale) {
    lng = pathname.split("/")[1];
  } else {
    lng = req.cookies.get("lng")?.value || defaultLocale;
    req.nextUrl.pathname = \`/\${lng}\${pathname === "/" ? "" : pathname}\`;
    return NextResponse.redirect(req.nextUrl);
  }

  const cleanPathname = pathname.replace(new RegExp(\`^/(\${locales.join("|")})\`), "") || "/";

  const isDashboardUrl = cleanPathname.startsWith("${dashboardRoute}");
  if (isDashboardUrl) {
    const session = await Auth.getSession(req);
    if (!session) {
      return NextResponse.redirect(new URL(\`/\${lng}${loginRoute}\`, req.url));
    }
  }

  const isLoginPageUrl = cleanPathname.startsWith("${loginRoute}");
  if (isLoginPageUrl) {
    const session = await Auth.getSession(req);
    if (session) {
      return NextResponse.redirect(new URL(\`/\${lng}${dashboardRoute}\`, req.url));
    }
  }

  const response = NextResponse.next();
  response.cookies.set("lng", lng, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/"
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|.*\\\\..*).*)"
  ]
};
`;
  } else {
    proxyContent = `import { NextResponse } from "next/server";
import Auth from "@seip/tools/auth";

/**
 * Handles Edge-based URL redirect routing and route authorization.
 * @param {Request} req - The Next.js request object.
 * @returns {Promise<Response>} The Next.js response.
 */
export async function proxy(req) {
  const pathname = req.nextUrl.pathname;

  const isDashboardUrl = pathname.startsWith("${dashboardRoute}");
  if (isDashboardUrl) {
    const session = await Auth.getSession(req);
    if (!session) {
      return NextResponse.redirect(new URL("${loginRoute}", req.url));
    }
  }

  const isLoginPageUrl = pathname.startsWith("${loginRoute}");
  if (isLoginPageUrl) {
    const session = await Auth.getSession(req);
    if (session) {
      return NextResponse.redirect(new URL("${dashboardRoute}", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["${dashboardRoute}/:path*", "${loginRoute}/:path*"]
};
`;
  }

  fs.writeFileSync(proxyPath, proxyContent, "utf8");
  console.log(" Successfully generated proxy.js in your root directory!");
  process.exit(0);
} else {
  console.error(`Unknown command: "${command}". Run "npx seip-tools help" for usage.`);
  process.exit(1);
}
