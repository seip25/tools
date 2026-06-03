#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  console.log(`
@seip/tools CLI Helper

Usage:
  npx seip-tools <command> [options]

Commands:
  secret        Generates a secure 32-byte JWT secret and adds it to your .env file
  help          Shows this help menu

Options:
  --force, -f   Forces overwriting the JWT_SECRET if it already exists
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
} else {
  console.error(`Unknown command: "${command}". Run "npx seip-tools help" for usage.`);
  process.exit(1);
}
