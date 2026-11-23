"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { buildAdmissionsWorkbook } = require("../src/services/admissions-excel");

test("admission workbook includes all fields and preserves phone numbers as text", async () => {
    const buffer = await buildAdmissionsWorkbook([{
        id: 7,
        student_name: "রহিম",
        guardian_name: "করিম",
        birth_date: "2015-03-04",
        gender: "ছেলে",
        class_name: "Six",
        phone: "01700123456",
        email: "parent@example.com",
        address: "বিরল, দিনাজপুর",
        previous_school: "প্রাথমিক বিদ্যালয়",
        status: "Pending",
        created_at: "2026-11-23T04:00:00.000Z"
    }]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("ভর্তি আবেদন");

    assert.ok(sheet);
    assert.equal(sheet.getRow(1).getCell(1).value, "আবেদন নম্বর");
    assert.equal(sheet.getRow(2).getCell(2).value, "রহিম");
    assert.equal(sheet.getRow(2).getCell(7).value, "01700123456");
    assert.equal(sheet.rowCount, 2);
});

test("admission workbook has headers when there are no applications", async () => {
    const buffer = await buildAdmissionsWorkbook([]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("ভর্তি আবেদন");
    assert.equal(sheet.rowCount, 1);
    assert.equal(sheet.getRow(1).getCell(12).value, "আবেদনের সময়");
});
