"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

test("website management shows admission totals and submitted applications", async () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "public", "pages", "website.html"), "utf8");
    const appScript = fs.readFileSync(path.join(__dirname, "..", "public", "js", "app.js"), "utf8");
    const script = fs.readFileSync(path.join(__dirname, "..", "public", "js", "website.js"), "utf8");
    const dom = new JSDOM(html, {
        url: "http://localhost/pages/website.html",
        runScripts: "outside-only"
    });
    const { window } = dom;
    const siteData = {
        site_pages: [],
        site_notices: [],
        site_staff: [],
        site_gallery: [],
        site_routines: [],
        site_downloads: [],
        site_menu_links: [],
        site_messages: [],
        site_settings: []
    };

    window.fetch = async (url) => {
        const responses = {
            "/api/admin/me": { success: true, loggedIn: true, role: "admin", username: "admin" },
            "/api/admin/website/data": { data: siteData },
            "/api/admin/website/admissions": {
                items: [{
                    id: 17,
                    student_name: "রহিম",
                    guardian_name: "করিম",
                    class_name: "Six",
                    phone: "01700123456",
                    status: "Pending",
                    created_at: "2026-11-23T00:00:00.000Z"
                }]
            },
            "/api/admin/website/admissions/summary": {
                summary: { total: 1, pending: 1, reviewed: 0, accepted: 0, rejected: 0 }
            }
        };
        assert.ok(responses[url], "unexpected API request: " + url);
        return { ok: true, json: async () => responses[url] };
    };

    window.eval(appScript);
    window.eval(script);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    assert.ok(window.document.querySelector("#main").classList.contains("hidden") === false);
    assert.ok(window.document.querySelector("#sidebar"));
    assert.match(window.document.querySelector("#admission-summary").textContent, /মোট আবেদন\s*1/);
    assert.match(window.document.querySelector("#list-admissions").textContent, /রহিম/);
    assert.equal(window.document.querySelector('[data-admission="17"]').value, "Pending");
    dom.window.close();
});
