"use strict";

const express = require("express");
const db = require("../db");
const config = require("../config");
const { getExamReport, buildStatistics } = require("../services/reports");
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
        `SELECT class_name, exam_name, exam_year
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

// Summary, grade distribution, group performance and subject-wise statistics.
router.get("/reports/statistics", async (req, res) => {
    const report = await getExamReport(readScope(req.query));
    res.json({ success: true, ...buildStatistics(report) });
});

module.exports = router;
