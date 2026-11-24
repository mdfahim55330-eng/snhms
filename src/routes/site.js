"use strict";

const express = require("express");
const db = require("../db");
const cache = require("../cache");
const { publicLimiter } = require("../middleware/security");

const router = express.Router();
const clean = (value, max = 3000) => String(value ?? "").trim().slice(0, max);

async function loadSiteData() {
    const [settings, pages, notices, staff, gallery, routines, downloads, classes, menuLinks, academicYears] =
        await Promise.all([
            db.all("SELECT key,value FROM site_settings"),
            db.all("SELECT * FROM site_pages WHERE active=TRUE ORDER BY sort_order,id"),
            db.all("SELECT * FROM site_notices WHERE published=TRUE ORDER BY created_at DESC LIMIT 30"),
            db.all("SELECT * FROM site_staff WHERE active=TRUE ORDER BY sort_order,id"),
            db.all("SELECT * FROM site_gallery ORDER BY sort_order,id DESC LIMIT 40"),
            db.all("SELECT * FROM site_routines ORDER BY id DESC LIMIT 50"),
            db.all("SELECT * FROM site_downloads ORDER BY id DESC LIMIT 50"),
            db.all("SELECT class_name FROM classes ORDER BY class_name"),
            db.all("SELECT * FROM site_menu_links WHERE active=TRUE ORDER BY sort_order,id"),
            db.all("SELECT year FROM site_academic_years WHERE active=TRUE ORDER BY year")
        ]);
    return {
        success: true,
        settings: Object.fromEntries(settings.map((item) => [item.key, item.value])),
        pages, notices, staff, gallery, routines, downloads,
        classes: classes.map((item) => item.class_name),
        menuLinks,
        academicYears
    };
}

router.get("/api/site", publicLimiter, async (req, res) => {
    const data = await cache.remember("public:site", loadSiteData);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(data);
});

router.get("/api/academic-years", publicLimiter, async (req, res) => {
    const years = await db.all("SELECT year FROM site_academic_years WHERE active=TRUE ORDER BY year");
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json({ success: true, years: years.map(row => row.year) });
});

// Public application form. A separate atomic sequence is shared across all classes within each academic year.
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

    const feeRow = await db.one("SELECT value FROM site_settings WHERE key='admission_fee'");
    const fee = Math.max(0, Number(feeRow?.value || 0) || 0);
    const paymentMethod = clean(body.payment_method, 30);
    const paymentTransaction = clean(body.payment_transaction, 120);
    if (fee > 0 && !["online", "school", "cash"].includes(paymentMethod)) {
        return res.status(400).json({ success:false, message:"পেমেন্ট পদ্ধতি নির্বাচন করুন।" });
    }
    if (fee > 0 && paymentMethod === "online" && !paymentTransaction) {
        return res.status(400).json({ success:false, message:"Transaction ID লিখুন।" });
    }
    const application = await db.tx(async (client) => {
        const applicationYear = clean(body.academic_year, 4);
        if (!/^\d{4}$/.test(applicationYear)) {
            const error = new Error("একটি বৈধ শিক্ষাবর্ষ নির্বাচন করুন।");
            error.status = 400;
            throw error;
        }
        const yearRow = await client.query(
            "SELECT year FROM site_academic_years WHERE year=$1 AND active=TRUE FOR SHARE",
            [applicationYear]
        );
        if (!yearRow.rowCount) {
            const error = new Error("নির্বাচিত শিক্ষাবর্ষে আবেদন গ্রহণ বন্ধ রয়েছে।");
            error.status = 400;
            throw error;
        }
        const counterKey = "__GLOBAL__:" + applicationYear;
        const counter = await client.query(
            `INSERT INTO site_admission_counters(class_name, last_number)
             VALUES ($1, COALESCE((
                 SELECT MAX(substring(application_no from 10)::integer)
                 FROM site_admissions
                 WHERE academic_year=$2
                   AND application_no ~ ('^SNHMS' || $2 || '[0-9]+$')
             ), 0) + 1)
             ON CONFLICT (class_name)
             DO UPDATE SET last_number = site_admission_counters.last_number + 1
             WHERE site_admission_counters.last_number < 999999
             RETURNING last_number`,
            [counterKey, applicationYear]
        );
        if (!counter.rowCount) {
            const error = new Error("এই শিক্ষাবর্ষের আবেদন নম্বর শেষ হয়ে গেছে।");
            error.status = 409;
            throw error;
        }
        const applicationNo = `SNHMS${applicationYear}${String(counter.rows[0].last_number).padStart(2, "0")}`;
        const result = await client.query(
            `INSERT INTO site_admissions
             (application_no, student_name, student_name_en, father_name, mother_name, guardian_name,
              birth_date, birth_reg_no, gender, religion, nationality, class_name, group_name,
              academic_year, phone, guardian_phone, guardian_occupation, email, address, present_address,
              permanent_address, previous_school, previous_class)
             VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
             RETURNING id, application_no, student_name, student_name_en, father_name, mother_name,
                       guardian_name, guardian_occupation, birth_date, birth_reg_no, gender, religion, nationality,
                       class_name, group_name, academic_year, phone, guardian_phone, email,
                       address, present_address, permanent_address, previous_school, previous_class,
                       status, created_at`,
            [
                applicationNo, studentName, clean(body.student_name_en, 160),
                fatherName, motherName, guardianName, body.birth_date || null,
                clean(body.birth_reg_no, 40), clean(body.gender, 30), clean(body.religion, 40),
                clean(body.nationality || "বাংলাদেশী", 60), className, clean(body.group_name, 60),
                applicationYear, phone, clean(body.guardian_phone || phone, 40),
                clean(body.guardian_occupation, 100), clean(body.email, 160), clean(body.present_address || body.address, 1000),
                clean(body.present_address || body.address, 1000), clean(body.permanent_address, 1000),
                clean(body.previous_school, 180), clean(body.previous_class, 60)
            ]
        );
        return result.rows[0];
    });

    res.status(200).json({
        success: true,
        message: "আপনার ভর্তি আবেদন সফলভাবে জমা হয়েছে।",
        application
    });
});


router.get("/api/admission/status", publicLimiter, async (req,res) => {
    const applicationNo=clean(req.query.application_no,20), phone=clean(req.query.phone,40);
    if(!applicationNo||!phone) return res.status(400).json({success:false,message:"আবেদন নম্বর ও মোবাইল নম্বর দিন।"});
    const row=await db.one(`SELECT application_no,student_name,student_name_en,class_name,academic_year,phone,status,payment_status,admit_roll,admit_card_enabled
        FROM site_admissions WHERE application_no=? AND phone=?`,[applicationNo,phone]);
    if(!row) return res.status(404).json({success:false,message:"আবেদন পাওয়া যায়নি। তথ্য যাচাই করুন।"});
    const settings=Object.fromEntries((await db.all("SELECT key,value FROM site_settings WHERE key LIKE 'admission_%'")).map(x=>[x.key,x.value]));
    const fee=Number(settings.admission_fee||0)||0;
    const canPrint=row.status==="Accepted"&&(fee===0||row.payment_status==="Verified")&&row.admit_card_enabled;
    res.setHeader("Cache-Control","no-store");
    res.json({success:true,application:{application_no:row.application_no,student_name:row.student_name,student_name_en:row.student_name_en||"",class_name:row.class_name,
        academic_year:row.academic_year,status:row.status,payment_status:row.payment_status,admit_roll:row.admit_roll,
        can_print_admit_card:canPrint},exam:{school_name:settings.school_name||"শহীদ নূর হোসেন মেমোরিয়াল স্কুল",
        exam_date:settings.admission_exam_date||"",exam_time:settings.admission_exam_time||"",
        center:settings.admission_exam_center||"",subjects:settings.admission_exam_subjects||"",instructions:settings.admission_exam_instructions||""}});
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
