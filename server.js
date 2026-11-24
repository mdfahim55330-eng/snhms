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

    // Bind the Render web-service port immediately. Database migrations can take
    // time on a cold start, so do not make Render wait for them to open the port.
    let app = null;
    const server = http.createServer((req, res) => {
        if (!app) {
            res.writeHead(503, {
                "Content-Type": "text/plain; charset=utf-8",
                "Retry-After": "5",
                "Cache-Control": "no-store"
            });
            res.end("The school website is starting. Please try again shortly.");
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
