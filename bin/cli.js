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
  docker        Generates development Docker container setup for database (PostgreSQL/MySQL)
  seo           Generates dynamic Next.js sitemap.js and robots.js files in the app folder
  deploy        Generates Nginx server configuration and PM2 ecosystem config for VPS deployment
  help          Shows this help menu

Options:
  --force, -f             Forces overwriting existing files
  --dashboard, -d <path>  Customize dashboard route path (default: /dashboard)
  --login, -l <path>      Customize login route path (default: /login)
  --i18n                  Generates a combined Auth + i18n localization proxy & dictionaries
  --i18n-only             Generates only the i18n localization routing & dictionaries
  --db <type>             Database type for Docker: 'postgres' or 'mysql' (default: postgres)
  --domain <name>         Domain name for Nginx deploy (default: example.com)
  --port <number>         Proxy port for PM2/Nginx (default: 3000)
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
} else if (command === "docker") {
  const force = args.includes("--force") || args.includes("-f");

  const dbIndex = args.indexOf("--db");
  let dbType = "postgres";
  if (dbIndex !== -1 && args[dbIndex + 1]) {
    dbType = args[dbIndex + 1].toLowerCase();
  }

  if (dbType !== "postgres" && dbType !== "mysql") {
    console.error(`Error: Unsupported database type "${dbType}". Use "postgres" or "mysql".`);
    process.exit(1);
  }

  const dockerDir = path.join(process.cwd(), "docker");
  if (!fs.existsSync(dockerDir)) {
    fs.mkdirSync(dockerDir, { recursive: true });
  }

  const composePath = path.join(dockerDir, "docker-compose.yml");
  const startPath = path.join(dockerDir, "start.sh");
  const stopPath = path.join(dockerDir, "stop.sh");
  const cleanPath = path.join(dockerDir, "clean.sh");

  if (fs.existsSync(composePath) && !force) {
    console.log(" docker-compose.yml already exists. Use '--force' or '-f' to overwrite it.");
    process.exit(1);
  }

  let composeContent = "";
  if (dbType === "postgres") {
    composeContent = `version: "3.8"

services:
  db:
    image: postgres:15-alpine
    container_name: app-postgres
    restart: always
    environment:
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: devdb
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`;
  } else {
    composeContent = `version: "3.8"

services:
  db:
    image: mysql:8.0
    container_name: app-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: devdb
      MYSQL_USER: devuser
      MYSQL_PASSWORD: devpassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
`;
  }

  const startContent = `#!/bin/bash
docker compose -f docker/docker-compose.yml up -d
`;

  const stopContent = `#!/bin/bash
docker compose -f docker/docker-compose.yml down
`;

  const cleanContent = `#!/bin/bash
docker compose -f docker/docker-compose.yml down -v
`;

  fs.writeFileSync(composePath, composeContent, "utf8");
  fs.writeFileSync(startPath, startContent, "utf8");
  fs.writeFileSync(stopPath, stopContent, "utf8");
  fs.writeFileSync(cleanPath, cleanContent, "utf8");

  try {
    fs.chmodSync(startPath, 0o755);
    fs.chmodSync(stopPath, 0o755);
    fs.chmodSync(cleanPath, 0o755);
  } catch { }

  console.log(` Successfully generated Docker setup for ${dbType} in /docker folder!`);
  process.exit(0);
} else if (command === "seo") {
  const force = args.includes("--force") || args.includes("-f");

  const appDir = path.join(process.cwd(), "app");
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }

  const sitemapPath = path.join(appDir, "sitemap.js");
  const robotsPath = path.join(appDir, "robots.js");

  if ((fs.existsSync(sitemapPath) || fs.existsSync(robotsPath)) && !force) {
    console.log(" SEO templates already exist in /app. Use '--force' or '-f' to overwrite them.");
    process.exit(1);
  }

  const sitemapContent = `/**
 * Next.js Dynamic Sitemap Generator.
 * @returns {Promise<Array<Object>>} The sitemap entries.
 */
export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";
  const locales = ["en", "es"];
  const routes = ["", "/login", "/dashboard"];
  const sitemapEntries = [];

  for (const route of routes) {
    for (const locale of locales) {
      sitemapEntries.push({
        url: \`\${baseUrl}/\${locale}\${route}\`,
        lastModified: new Date().toISOString(),
        changeFrequency: "daily",
        priority: route === "" ? 1.0 : 0.8,
      });
    }
  }

  return sitemapEntries;
}
`;

  const robotsContent = `/**
 * Next.js Robots.txt Generator.
 * @returns {Object} The robots configuration.
 */
export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/_next/"],
    },
    sitemap: \`\${baseUrl}/sitemap.xml\`,
  };
}
`;

  fs.writeFileSync(sitemapPath, sitemapContent, "utf8");
  fs.writeFileSync(robotsPath, robotsContent, "utf8");

  console.log(" Successfully generated sitemap.js and robots.js in /app folder!");
  process.exit(0);
} else if (command === "deploy") {
  const force = args.includes("--force") || args.includes("-f");

  const domainIndex = args.indexOf("--domain");
  let domain = "example.com";
  if (domainIndex !== -1 && args[domainIndex + 1]) {
    domain = args[domainIndex + 1];
  }

  const portIndex = args.indexOf("--port");
  let port = "3000";
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = args[portIndex + 1];
  }

  let appName = "your-app";
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.name) {
        appName = pkg.name.split("/").pop();
      }
    }
  } catch { }

  const nginxPath = path.join(process.cwd(), "nginx.conf");
  const pm2Path = path.join(process.cwd(), "ecosystem.config.cjs");

  if ((fs.existsSync(nginxPath) || fs.existsSync(pm2Path)) && !force) {
    console.log(" nginx.conf or ecosystem.config.cjs already exist. Use '--force' or '-f' to overwrite.");
    process.exit(1);
  }

  const nginxContent = `server {
  listen 80;
  server_name ${domain} www.${domain};
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name ${domain} www.${domain};

  ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

  client_max_body_size 100M;

  gzip on;
  gzip_proxied any;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
  gzip_vary on;

  location / {
    proxy_pass http://127.0.0.1:${port};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`;

  const pm2Content = `module.exports = {
  apps: [
    {
      name: "${appName}",
      script: "node_modules/next/dist/bin/next",
      args: "start -p ${port}",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
`;

  fs.writeFileSync(nginxPath, nginxContent, "utf8");
  fs.writeFileSync(pm2Path, pm2Content, "utf8");

  console.log(" Successfully generated nginx.conf and ecosystem.config.cjs in your root directory!");
  process.exit(0);
} else {
  console.error(`Unknown command: "${command}". Run "npx seip-tools help" for usage.`);
  process.exit(1);
}
