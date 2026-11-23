"use strict";

const express = require("express");
const db = require("../db");
const cache = require("../cache");
const { publicLimiter } = require("../middleware/security");

const router = express.Router();
const clean = (value, max = 3000) => String(value ?? "").trim().slice(0, max);

async function loadSiteData() {
    const [settings, pages, notices, staff, gallery, routines, downloads, classes, menuLinks] =
        await Promise.all([
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
        pages, notices, staff, gallery, routines, downloads,
        classes: classes.map((item) => item.class_name),
        menuLinks
    };
}

router.get("/api/site", publicLimiter, async (req, res) => {
    const data = await cache.remember("public:site", loadSiteData);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(data);
});

// Public application form. The sequence is allocated atomically per class so simultaneous
// applications cannot receive the same six-digit number.
router.post("/api/admission", publicLimiter, async (req, res) => {
    const body = req.body || {};
    const studentName = clean(body.student_name, 160);
    const className = clean(body.class_name, 60);
    const phone = clean(body.phone, 40);
    const fatherName = clean(body.father_name, 160);
    const motherName = clean(body.mother_name, 160);
    const guardianName = clean(body.guardian_name || fatherName || motherName, 160);

    if (!studentName || !className || !phone || !guardianName) {
        return res.status(400).json({
            success: false,
            message: "শিক্ষার্থীর নাম, অভিভাবকের নাম, শ্রেণি ও মোবাইল নম্বর আবশ্যক।"
        });
    }

    const application = await db.tx(async (client) => {
        const counter = await client.query(
            `INSERT INTO site_admission_counters(class_name, last_number)
             VALUES ($1, 1)
             ON CONFLICT (class_name)
             DO UPDATE SET last_number = site_admission_counters.last_number + 1
             WHERE site_admission_counters.last_number < 999999
             RETURNING last_number`,
            [className]
        );
        if (!counter.rowCount) {
            const error = new Error("এই শ্রেণির জন্য ছয় সংখ্যার আবেদন নম্বর শেষ হয়ে গেছে।");
            error.status = 409;
            throw error;
        }
        const applicationNo = String(counter.rows[0].last_number).padStart(6, "0");
        const result = await client.query(
            `INSERT INTO site_admissions
             (application_no, student_name, student_name_en, father_name, mother_name, guardian_name,
              birth_date, birth_reg_no, gender, religion, nationality, class_name, group_name,
              academic_year, phone, guardian_phone, guardian_occupation, email, address, present_address,
              permanent_address, previous_school, previous_class)
             VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
             RETURNING id, application_no, student_name, student_name_en, father_name, mother_name,
                       guardian_name, birth_date, birth_reg_no, gender, religion, nationality,
                       class_name, group_name, academic_year, phone, guardian_phone, email,
                       address, present_address, permanent_address, previous_school, previous_class,
                       status, created_at`,
            [
                applicationNo, studentName, clean(body.student_name_en, 160),
                fatherName, motherName, guardianName, body.birth_date || null,
                clean(body.birth_reg_no, 40), clean(body.gender, 30), clean(body.religion, 40),
                clean(body.nationality || "বাংলাদেশী", 60), className, clean(body.group_name, 60),
                clean(body.academic_year, 12), phone, clean(body.guardian_phone || phone, 40),
                clean(body.guardian_occupation, 100), clean(body.email, 160), clean(body.present_address || body.address, 1000),
                clean(body.present_address || body.address, 1000), clean(body.permanent_address, 1000),
                clean(body.previous_school, 180), clean(body.previous_class, 60)
            ]
        );
        return result.rows[0];
    });

    res.status(201).json({
        success: true,
        message: "আপনার ভর্তি আবেদন সফলভাবে জমা হয়েছে।",
        application
    });
});

router.post("/api/contact", publicLimiter, async (req, res) => {
    const body = req.body || {};
    if (!clean(body.name, 120) || !clean(body.message, 3000)) {
        return res.status(400).json({ success: false, message: "নাম ও বার্তা লিখুন।" });
    }
    await db.query(
        "INSERT INTO site_messages(name,phone,email,subject,message) VALUES(?,?,?,?,?)",
        [clean(body.name, 120), clean(body.phone, 40), clean(body.email, 160),
            clean(body.subject, 180), clean(body.message, 3000)]
    );
    res.json({ success: true, message: "আপনার বার্তা পাঠানো হয়েছে।" });
});

module.exports = router;
