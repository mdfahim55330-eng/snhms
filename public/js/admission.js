"use strict";
const $ = (s) => document.querySelector(s);
const form = $("#admissionForm");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let school = { school_name: "শহীদ নূর হোসেন মেমোরিয়াল স্কুল", school_name_en: "Shaheed Nur Hossain Memorial School" };

async function loadFormData() {
    const response = await fetch("/api/site");
    if (!response.ok) throw new Error("প্রতিষ্ঠানের তথ্য লোড করা যায়নি।");
    const data = await response.json();
    school = data.settings || school;
    const classSelect = $("#className");
    (data.classes || []).forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        classSelect.append(option);
    });
    const year = $("#academicYear");
    const current = new Date().getFullYear();
    for (let y = current; y <= current + 1; y++) {
        const option = document.createElement("option");
        option.value = String(y);
        option.textContent = String(y);
        if (y === current) option.selected = true;
        year.append(option);
    }
    $("#footerYear").textContent = current;
}

function value(name) {
    const field = form.elements.namedItem(name);
    return field ? String(field.value || "").trim() : "";
}
function printField(label, val, wide = false) {
    return '<div class="print-field' + (wide ? ' wide' : '') + '"><b>' + esc(label) + ':</b> ' + esc(val || "—") + '</div>';
}
function makePrintSheet(application) {
    const data = application;
    const schoolName = school.school_name || "শহীদ নূর হোসেন মেমোরিয়াল স্কুল";
    const schoolNameEn = school.school_name_en || "Shaheed Nur Hossain Memorial School";
    const address = school.address || "বিরল, দিনাজপুর";
    $("#printSheet").innerHTML =
      '<article class="print-page">' +
      '<header class="print-head"><img class="print-logo" src="' + esc(school.logo_url || "/6716-removebg-preview.png") + '" alt="Logo">' +
      '<div><h1>' + esc(schoolName) + '</h1><p class="en">' + esc(schoolNameEn) + '</p><p>' + esc(address) +
      (school.phone ? ' · ' + esc(school.phone) : '') + '</p><p>EIIN: ' + esc(school.eiin || "—") + '</p></div><div></div></header>' +
      '<div class="print-title">ভর্তি আবেদন ফরম / ADMISSION FORM</div>' +
      '<div class="print-meta"><span>ভর্তির শ্রেণি: ' + esc(data.class_name) + '</span><span>শিক্ষাবর্ষ: ' + esc(data.academic_year || new Date().getFullYear()) +
      '</span><span class="print-number">আবেদন নং: ' + esc(data.application_no) + '</span></div>' +
      '<div class="print-section">১. শিক্ষার্থীর তথ্য / STUDENT INFORMATION</div><div class="print-grid"><div class="print-fields">' +
      printField("শিক্ষার্থীর নাম (বাংলা)",data.student_name,true)+printField("Student Name (English)",data.student_name_en,true)+
      printField("জন্মতারিখ",data.birth_date)+printField("জন্ম নিবন্ধন নং",data.birth_reg_no)+
      printField("লিঙ্গ",data.gender)+printField("ধর্ম",data.religion)+printField("জাতীয়তা",data.nationality)+
      printField("শাখা/বিভাগ",data.group_name)+
      '</div><div class="photo-box">শিক্ষার্থীর<br>পাসপোর্ট সাইজ<br>ছবি</div></div>' +
      '<div class="print-section">২. পিতা-মাতা ও অভিভাবকের তথ্য / PARENTS & GUARDIAN</div><div class="print-fields">' +
      printField("পিতার নাম",data.father_name)+printField("মাতার নাম",data.mother_name)+
      printField("অভিভাবকের নাম",data.guardian_name)+printField("অভিভাবকের পেশা",data.guardian_occupation)+
      printField("মোবাইল নম্বর",data.phone)+printField("বিকল্প নম্বর",data.guardian_phone)+
      printField("ইমেইল",data.email,true)+'</div>' +
      '<div class="print-section">৩. ঠিকানা ও পূর্ববর্তী শিক্ষাপ্রতিষ্ঠান / ADDRESS & PREVIOUS SCHOOL</div><div class="print-fields">' +
      printField("বর্তমান ঠিকানা",data.present_address,true)+printField("স্থায়ী ঠিকানা",data.permanent_address,true)+
      printField("পূর্ববর্তী বিদ্যালয়",data.previous_school)+printField("সর্বশেষ শ্রেণি",data.previous_class)+'</div>' +
      '<div class="print-declaration">আমি ঘোষণা করছি যে, এই ফরমে প্রদত্ত সকল তথ্য সঠিক। প্রয়োজনে তথ্য যাচাইয়ের জন্য প্রয়োজনীয় কাগজপত্র জমা দিতে সম্মত আছি।</div>' +
      '<div class="print-signatures"><div>শিক্ষার্থীর স্বাক্ষর</div><div>অভিভাবকের স্বাক্ষর</div><div>অফিস কর্তৃপক্ষের স্বাক্ষর ও সিল</div></div>' +
      '<div class="print-foot">আবেদন নম্বরটি সংরক্ষণ করুন। ভর্তি সংক্রান্ত প্রয়োজনে বিদ্যালয় অফিসে যোগাযোগ করুন। · Generated: ' +
      esc(new Date().toLocaleDateString("bn-BD")) + '</div></article>';
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#formError").hidden = true;
    const button = $("#submitButton");
    button.disabled = true;
    $("#submitStatus").textContent = "আবেদন জমা হচ্ছে…";
    const payload = Object.fromEntries(new FormData(form));
    delete payload.declaration;
    payload.guardian_name = payload.guardian_name || payload.father_name || payload.mother_name;
    try {
        const response = await fetch("/api/admission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "আবেদন জমা দেওয়া যায়নি।");
        makePrintSheet({ ...payload, ...result.application });
        $("#applicationNumber").textContent = result.application.application_no;
        $("#successPanel").hidden = false;
        $("#successPanel").scrollIntoView({ behavior: "smooth", block: "center" });
        $("#submitStatus").textContent = result.message;
        form.hidden = true;
    } catch (error) {
        $("#formError").textContent = error.message;
        $("#formError").hidden = false;
        $("#submitStatus").textContent = "";
    } finally {
        button.disabled = false;
    }
});
$("#printButton").addEventListener("click", () => window.print());
$("#newApplication").addEventListener("click", () => {
    form.reset();
    form.hidden = false;
    $("#successPanel").hidden = true;
    $("#submitStatus").textContent = "";
    $("#formError").hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
});
loadFormData().catch((error) => {
    $("#formError").textContent = error.message;
    $("#formError").hidden = false;
});