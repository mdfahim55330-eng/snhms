"use strict";

const express = require("express");
const db = require("../db");
const cache = require("../cache");
const { publicLimiter } = require("../middleware/security");

const router = express.Router();
const clean = (value, max = 3000) => String(value ?? "").trim().slice(0, max);

// Public institutional content changes infrequently. Cache the combined payload so a
// normal page reload does not issue nine separate PostgreSQL queries every time.
async function loadSiteData() {
    const [
        settings, pages, notices, staff, gallery,
        routines, downloads, classes, menuLinks
    ] = await Promise.all([
        db.all("SELECT key,value FROM site_settings"),
        db.all("SELECT * FROM site_pages WHERE active=TRUE ORDER BY sort_order,id"),
        db.all("SELECT * FROM site_notices WHERE published=TRUE ORDER BY created_at DESC LIMIT 30"),
        db.all("SELECT * FROM site_staff WHERE active=TRUE ORDER BY sort_order,id"),
        db.all("SELECT * FROM site_gallery ORDER BY sort_order,id DESC LIMIT 40"),
        db.all("SELECT * FROM site_routines ORDER BY id DESC LIMIT 50"),
        db.all("SELECT * FROM site_downloads ORDER BY id DESC LIMIT 50"),
        db.all("SELECT class_name FROM classes ORDER BY class_name"),
        db.all("SELECT * FROM site_menu_links WHERE active=TRUE ORDER BY sort_order,id")
    ]);

    return {
        success: true,
        settings: Object.fromEntries(settings.map((item) => [item.key, item.value])),
        pages,
        notices,
        staff,
        gallery,
        routines,
        downloads,
        classes: classes.map((item) => item.class_name),
        menuLinks
    };
}

router.get("/api/site", publicLimiter, async (req, res) => {
    const data = await cache.remember("public:site", loadSiteData);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(data);
});

router.post("/api/admission", publicLimiter, async (req, res) => {
    const body = req.body || {};
    for (const key of ["student_name", "guardian_name", "class_name", "phone"]) {
        if (!clean(body[key], 160)) {
            return res.status(400).json({ success: false, message: "সব আবশ্যক তথ্য পূরণ করুন।" });
        }
    }

    await db.query(
        "INSERT INTO site_admissions(student_name,guardian_name,birth_date,gender,class_name,phone,email,address,previous_school) VALUES(?,?,?,?,?,?,?,?,?)",
        [
            clean(body.student_name, 160),
            clean(body.guardian_name, 160),
            body.birth_date || null,
            clean(body.gender, 30),
            clean(body.class_name, 60),
            clean(body.phone, 40),
            clean(body.email, 160),
            clean(body.address, 1000),
            clean(body.previous_school, 180)
        ]
    );

    res.json({ success: true, message: "আপনার ভর্তি আবেদন জমা হয়েছে।" });
});

router.post("/api/contact", publicLimiter, async (req, res) => {
    const body = req.body || {};
    if (!clean(body.name, 120) || !clean(body.message, 3000)) {
        return res.status(400).json({ success: false, message: "নাম ও বার্তা লিখুন।" });
    }

    await db.query(
        "INSERT INTO site_messages(name,phone,email,subject,message) VALUES(?,?,?,?,?)",
        [
            clean(body.name, 120),
            clean(body.phone, 40),
            clean(body.email, 160),
            clean(body.subject, 180),
            clean(body.message, 3000)
        ]
    );

    res.json({ success: true, message: "আপনার বার্তা পাঠানো হয়েছে।" });
});

module.exports = router;
