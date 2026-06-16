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

  const proxyContent = `import { NextResponse } from "next/server";
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

  fs.writeFileSync(proxyPath, proxyContent, "utf8");
  console.log(" Successfully generated proxy.js in your root directory!");
  process.exit(0);
} else {
  console.error(`Unknown command: "${command}". Run "npx seip-tools help" for usage.`);
  process.exit(1);
}
