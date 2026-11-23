"use strict";

const ExcelJS = require("exceljs");

async function buildAdmissionsWorkbook(admissions) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "School Result System";

    const sheet = workbook.addWorksheet("ভর্তি আবেদন");
    sheet.columns = [
        { header: "আবেদন নম্বর", key: "application_no", width: 14 },
        { header: "শিক্ষার্থীর নাম", key: "student_name", width: 28 },
        { header: "অভিভাবকের নাম", key: "guardian_name", width: 28 },
        { header: "জন্মতারিখ", key: "birth_date", width: 16 },
        { header: "লিঙ্গ", key: "gender", width: 14 },
        { header: "ভর্তির শ্রেণি", key: "class_name", width: 18 },
        { header: "ফোন", key: "phone", width: 18 },
        { header: "ইমেইল", key: "email", width: 30 },
        { header: "ঠিকানা", key: "address", width: 36 },
        { header: "পূর্ববর্তী বিদ্যালয়", key: "previous_school", width: 28 },
        { header: "আবেদনের অবস্থা", key: "status", width: 18 },
        { header: "আবেদনের সময়", key: "created_at", width: 22 },
        { header: "শিক্ষার্থীর নাম (English)", key: "student_name_en", width: 28 },
        { header: "পিতার নাম", key: "father_name", width: 24 },
        { header: "মাতার নাম", key: "mother_name", width: 24 },
        { header: "জন্ম নিবন্ধন", key: "birth_reg_no", width: 20 },
        { header: "ধর্ম", key: "religion", width: 14 },
        { header: "জাতীয়তা", key: "nationality", width: 16 },
        { header: "শাখা/বিভাগ", key: "group_name", width: 16 },
        { header: "শিক্ষাবর্ষ", key: "academic_year", width: 14 },
        { header: "অভিভাবকের পেশা", key: "guardian_occupation", width: 20 },
        { header: "বিকল্প ফোন", key: "guardian_phone", width: 18 },
        { header: "বর্তমান ঠিকানা", key: "present_address", width: 36 },
        { header: "স্থায়ী ঠিকানা", key: "permanent_address", width: 36 },
        { header: "পূর্ববর্তী শ্রেণি", key: "previous_class", width: 18 }
    ];

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    header.alignment = { vertical: "middle" };
    header.height = 24;
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "Y1" };

    for (const application of admissions) {
        sheet.addRow({
            application_no: application.application_no || String(application.id).padStart(6, "0"),
            student_name: application.student_name,
            guardian_name: application.guardian_name,
            birth_date: application.birth_date ? new Date(application.birth_date) : null,
            gender: application.gender,
            class_name: application.class_name,
            phone: String(application.phone || ""),
            email: application.email,
            address: application.address,
            previous_school: application.previous_school,
            status: application.status,
            created_at: application.created_at ? new Date(application.created_at) : null,
            student_name_en: application.student_name_en,
            father_name: application.father_name,
            mother_name: application.mother_name,
            birth_reg_no: application.birth_reg_no,
            religion: application.religion,
            nationality: application.nationality,
            group_name: application.group_name,
            academic_year: application.academic_year,
            guardian_occupation: application.guardian_occupation,
            guardian_phone: application.guardian_phone,
            present_address: application.present_address,
            permanent_address: application.permanent_address,
            previous_class: application.previous_class
        });
    }

    sheet.getColumn("birth_date").numFmt = "dd mmm yyyy";
    sheet.getColumn("created_at").numFmt = "dd mmm yyyy hh:mm";
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { buildAdmissionsWorkbook };
