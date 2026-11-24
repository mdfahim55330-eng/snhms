"use strict";

const http = require("http");
const config = require("./src/config");
const db = require("./src/db");
const { migrate } = require("./src/migrate");
const { createApp } = require("./src/app");

async function start() {
    if (!config.databaseUrl) {
        console.error("DATABASE_URL is not set. Please add it to your environment (.env file or hosting settings).");
        process.exit(1);
    }

    // Bind the Render web-service port immediately so the platform can detect
    // the service while database migrations run. If a visitor arrives before
    // initialization finishes, show a short retry page instead of a dead-end
    // plain-text response.
    let app = null;
    const server = http.createServer((req, res) => {
        if (!app) {
            res.writeHead(503, {
                "Content-Type": "text/html; charset=utf-8",
                "Retry-After": "3",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            });
            res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="3">
<title>Starting school website</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7fb;color:#172033;font:16px/1.6 Arial,sans-serif}
main{width:min(100%,440px);padding:32px 24px;text-align:center;background:#fff;border:1px solid #e5eaf2;border-radius:18px;box-shadow:0 12px 36px rgba(20,35,60,.08)}
.spinner{width:38px;height:38px;margin:0 auto 18px;border:4px solid #e6edf7;border-top-color:#1769aa;border-radius:50%;animation:spin .8s linear infinite}
h1{margin:0 0 8px;font-size:22px}p{margin:8px 0;color:#596579}.bn{font-size:14px}
a{display:inline-block;margin-top:16px;padding:10px 18px;border-radius:8px;background:#1769aa;color:#fff;text-decoration:none}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
</style>
</head>
<body>
<main>
<div class="spinner" aria-hidden="true"></div>
<h1>School website is starting</h1>
<p>Please wait a moment. This page will refresh automatically.</p>
<p class="bn" lang="bn">ওয়েবসাইট চালু হচ্ছে। অনুগ্রহ করে একটু অপেক্ষা করুন। পেজটি নিজে থেকেই আবার লোড হবে।</p>
<a href="/">Try again now</a>
</main>
</body>
</html>`);
            return;
        }
        app(req, res);
    });

    server.listen(config.port, "0.0.0.0", () => {
        console.log(`Web server is listening on port ${config.port}; preparing the database...`);
    });

    try {
        console.log("[startup] Database migration started.");
        await migrate();
        console.log("[startup] Database migration completed.");

        app = createApp();
        console.log("=================================");
        console.log(` ${config.school.name}`);
        console.log(" Result Management System");
        console.log("=================================");
        console.log("Application is ready to receive requests.");
    } catch (error) {
        console.error("[startup] Database migration or application initialization failed:", error);
        server.close(async () => {
            await db.close().catch(() => {});
            process.exit(1);
        });
    }

    const shutdown = (signal) => {
        console.log(`${signal} received, shutting down...`);
        server.close(async () => {
            await db.close().catch(() => {});
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
});

start().catch((error) => {
    console.error("Could not start the server:", error);
    process.exit(1);
});
