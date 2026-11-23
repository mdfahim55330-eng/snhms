"use strict";

const express = require("express");
const db = require("../db");
const config = require("../config");
const { getExamReport, buildStatistics } = require("../services/reports");
const { buildResultData } = require("../services/results");
const pdf = require("../services/pdf");
const verify = require("../services/verify");
const { httpError } = require("../utils");

const router = express.Router();

function readScope(query) {
    const class_name = String(query.class_name || "").trim();
    const exam_name = String(query.exam_name || "").trim();
    const exam_year = Number(query.exam_year);
    if (!class_name || !exam_name || !query.exam_year ||
        !Number.isInteger(exam_year) || exam_year < 2000 || exam_year > 2100) {
        throw httpError(400, "Class, Exam Name and a valid Exam Year are required.");
    }
    return { class_name, exam_name, exam_year };
}

// Available class / exam / year combinations for the report selector.
router.get("/reports/options", async (req, res) => {
    const options = await db.all(
        `SELECT
            class_name,
            exam_name,
            exam_year,
            COUNT(*)::int AS students,
            COUNT(*) FILTER (WHERE status = 'published')::int AS published
         FROM students
         GROUP BY class_name, exam_name, exam_year
         ORDER BY exam_year DESC, class_name ASC, exam_name ASC`
    );
    res.json({ success: true, options });
});

// Merit list uses the same GPA-first, then total-marks ranking as every other report.
router.get("/reports/merit", async (req, res) => {
    const report = await getExamReport(readScope(req.query));
    res.json({ success: true, meta: report.meta, subjects: report.subjects, students: report.students });
});

// Complete tabulation data, including school heading and each subject's marks.
router.get("/reports/tabulation", async (req, res) => {
    const report = await getExamReport(readScope(req.query));
    res.json({
        success: true,
        school: config.school,
        meta: report.meta,
        subjects: report.subjects,
        students: report.students
    });
});

// Download one combined PDF containing a separate A4 marksheet for every student
// in the selected class, exam and year. This route is mounted under /api/admin,
// so the existing staff login middleware protects the document.
router.get("/reports/marksheets.pdf", async (req, res) => {
    const scope = readScope(req.query);
    const students = await db.all(
        `SELECT id, name, roll, registration, class_name, group_name, exam_name,
                exam_year, institute_name, eiin, status
         FROM students
         WHERE class_name = ? AND exam_name = ? AND exam_year = ?
         ORDER BY roll ASC, id ASC`,
        [scope.class_name, scope.exam_name, scope.exam_year]
    );

    if (students.length === 0) {
        throw httpError(404, "No students were found for the selected class, exam and year.");
    }

    const safePart = (value) => String(value || "")
        .normalize("NFKD")
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "report";
    const filename = `all-marksheets-${safePart(scope.class_name)}-${safePart(scope.exam_name)}-${scope.exam_year}.pdf`;

    const doc = pdf.createDocument(`All Marksheets - ${scope.class_name} - ${scope.exam_name} ${scope.exam_year}`);
    doc.on("error", (error) => {
        console.error("All-marksheets PDF stream error:", error);
        if (!res.headersSent) res.status(500).end("Could not generate the PDF.");
        else res.destroy(error);
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    doc.pipe(res);

    try {
        for (const student of students) {
            const data = await buildResultData(student);
            const qrBuffer = await verify.qrBuffer(verify.verifyUrl(req, student.id));
            pdf.drawMarksheet(doc, data, {
                qrBuffer,
                draft: student.status !== "published"
            });
        }
        doc.end();
    } catch (error) {
        console.error("Could not build all-marksheets PDF:", error);
        if (!res.headersSent) {
            doc.destroy();
            throw error;
        }
        doc.destroy(error);
    }
});

// Summary, grade distribution, group performance and subject-wise statistics.
router.get("/reports/statistics", async (req, res) => {
    const report = await getExamReport(readScope(req.query));
    res.json({ success: true, ...buildStatistics(report) });
});

module.exports = router;
