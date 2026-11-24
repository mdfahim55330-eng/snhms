"use strict";
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let applications = [];
let schoolSettings = {};
async function call(url, options = {}) {
    const r = await App.api(url, options);
    if (!r.ok) throw new Error(r.data.message || "The request could not be completed.");
    return r.data;
}
function message(el, value, error = false) {
    el.textContent = value;
    el.className = "text-sm " + (error ? "text-red-600" : "text-emerald-700");
}
function renderSummary(s) {
    const items = [["Total Applications",s.total||0,"bg-brand-50 text-brand-700"],["Pending",s.pending||0,"bg-amber-50 text-amber-700"],["Reviewed",s.reviewed||0,"bg-violet-50 text-violet-700"],["Accepted",s.accepted||0,"bg-emerald-50 text-emerald-700"],["Rejected",s.rejected||0,"bg-red-50 text-red-700"]];
    $("#summary").innerHTML = items.map(([label,count,tone]) => '<article class="card flex items-center gap-3 !p-4"><div class="rounded-xl p-3 '+tone+'"><span class="text-xl font-bold">'+esc(count)+'</span></div><p class="text-sm font-semibold text-slate-600">'+label+'</p></article>').join("");
}
function renderRows() {
    const q = ($("#admissionSearch").value || "").trim().toLowerCase(), status = $("#statusFilter").value;
    const rows = applications.filter(a => (!q || [a.application_no,a.student_name,a.student_name_en,a.phone,a.class_name].join(" ").toLowerCase().includes(q)) && (!status || a.status === status));
    $("#admissionRows").innerHTML = rows.map(a => '<tr><td><b>'+esc(a.application_no)+'</b><span class="block text-xs text-slate-500">'+esc(a.student_name)+'</span></td><td>'+esc(a.class_name)+'<span class="block text-xs text-slate-500">'+esc(a.phone)+'</span></td><td><select class="input min-w-32" data-field="status">'+
    ["Pending","Reviewed","Accepted","Rejected","Waiting List"].map(s=>'<option value="'+s+'" '+(a.status===s?'selected':'')+'>'+({"Pending":"Pending","Reviewed":"Reviewed","Accepted":"Accepted","Rejected":"Rejected","Waiting List":"Waiting List"}[s])+'</option>').join("")+
    '</select></td><td><select class="input min-w-32" data-field="payment_status">'+
    ["Not Required","Pending","Verified","Rejected"].map(s=>'<option value="'+s+'" '+((a.payment_status||"Not Required")===s?'selected':'')+'>'+({"Not Required":"Not Required","Pending":"Pending","Verified":"Verified","Rejected":"Rejected"}[s])+'</option>').join("")+
    '</select></td><td><input class="input min-w-24" data-field="admit_roll" value="'+esc(a.admit_roll||"")+'" placeholder="Roll No."></td><td><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-field="admit_card_enabled" '+(a.admit_card_enabled?'checked':'')+'> Enabled</label></td><td><input class="input min-w-36" data-field="admin_note" value="'+esc(a.admin_note||"")+'" placeholder="Note"></td><td><button class="btn-primary btn-sm" data-save="'+esc(a.id)+'">Save</button></td><td><div class="flex flex-wrap gap-2"><button type="button" class="btn-secondary btn-sm" data-print-application="'+esc(a.id)+'">Application Form</button><button type="button" class="btn-secondary btn-sm" data-print-admit="'+esc(a.id)+'">Admit Card</button></div></td></tr>').join("") || '<tr><td colspan="9" class="py-10 text-center text-slate-400">No applications found.</td></tr>';
}

function printWindow(kind, markup) {
    const win = window.open("", "_blank");
    if (!win) { message($("#pageMessage"), "Unable to open the print window. Please allow pop-ups in your browser.", true); return; }
    const containerId = kind === "application" ? "printSheet" : "admitPrint";
    const bodyClass = kind === "application" ? "printing-admission" : "printing-admit";
    win.document.open();
    win.document.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admission Print</title><link rel="stylesheet" href="/css/admission.css?v=signature-bottom-20261123"></head><body class="'+bodyClass+'"><div id="'+containerId+'">'+markup+'</div></body></html>');
    win.document.close();
    let started = false;
    const run = () => {
        if (started) return;
        started = true;
        setTimeout(() => { try { win.focus(); win.print(); win.onafterprint = () => win.close(); } catch (_) {} }, 600);
    };
    win.addEventListener("load", run, { once: true });
    setTimeout(() => { if (!win.closed && win.document.readyState === "complete") run(); }, 1000);
}
function pf(label, value, wide = false) {
    return '<div class="print-field'+(wide?' wide':'')+'"><b>'+esc(label)+':</b> '+esc(value||"—")+'</div>';
}
function printApplication(a) {
    const en = localStorage.getItem("snhms-language") === "en";
    const name = en ? (schoolSettings.school_name_en || "Shaheed Nur Hossain Memorial School") : (schoolSettings.school_name || "শহীদ নূর হোসেন মেমোরিয়াল স্কুল");
    const nameEn = schoolSettings.school_name_en || "Shaheed Nur Hossain Memorial School";
    const address = schoolSettings.address || "বিরল, দিনাজপুর";
    const L = (bn, english) => en ? english : bn;
    const fields = [
        pf(L("শিক্ষার্থীর নাম (বাংলা)","Student Name (Bangla)"),a.student_name,true),
        pf(L("শিক্ষার্থীর নাম (ইংরেজি)","Student Name (English)"),a.student_name_en,true),
        pf(L("জন্মতারিখ","Date of Birth"),a.birth_date),pf(L("Birth Registration No.","Birth Registration No."),a.birth_reg_no),
        pf(L("লিঙ্গ","Gender"),a.gender),pf(L("ধর্ম","Religion"),a.religion),
        pf(L("জাতীয়তা","Nationality"),a.nationality),pf(L("শাখা/বিভাগ","Section / Group"),a.group_name)
    ].join("");
    const markup = '<article class="print-page"><header class="print-head"><img class="print-logo" src="'+esc(schoolSettings.logo_url||"/6716-removebg-preview.png")+'" alt="School Logo"><div><h1>'+esc(name)+'</h1><p class="en">'+esc(nameEn)+'</p><p>'+esc(address)+(schoolSettings.phone?' · '+esc(schoolSettings.phone):'')+'</p><p>EIIN: '+esc(schoolSettings.eiin||"—")+'</p></div><div></div></header>'+
        '<div class="print-title">'+L("ভর্তি Application Form","ADMISSION APPLICATION FORM")+'</div>'+
        '<div class="print-meta"><span>'+L("ভর্তির শ্রেণি: ","Admission Class: ")+esc(a.class_name)+'</span><span>'+L("শিক্ষাবর্ষ: ","Academic Year: ")+esc(a.academic_year||"—")+'</span><span class="print-number">'+L("আবেদন নম্বর: ","Application No.: ")+esc(a.application_no)+'</span></div>'+
        '<div class="print-section">'+L("১. শিক্ষার্থীর তথ্য","1. STUDENT INFORMATION")+'</div><div class="print-grid"><div class="print-fields">'+fields+'</div><div class="photo-box">'+L("শিক্ষার্থীর পাসপোর্ট সাইজ ছবি","Student Passport Size Photo")+'</div></div>'+
        '<div class="print-section">'+L("২. পিতা-মাতা ও অভিভাবকের তথ্য","2. PARENTS’ & GUARDIAN INFORMATION")+'</div><div class="print-fields">'+
        pf(L("পিতার নাম","Father’s Name"),a.father_name)+pf(L("মাতার নাম","Mother’s Name"),a.mother_name)+pf(L("অভিভাবকের নাম","Guardian’s Name"),a.guardian_name)+pf(L("অভিভাবকের পেশা","Guardian’s Occupation"),a.guardian_occupation)+
        pf(L("মোবাইল নম্বর","Mobile Number"),a.phone)+pf(L("বিকল্প নম্বর","Alternative Number"),a.guardian_phone)+pf("Email",a.email,true)+'</div>'+
        '<div class="print-section">'+L("৩. ঠিকানা ও পূর্ববর্তী শিক্ষাপ্রতিষ্ঠান","3. ADDRESS & PREVIOUS INSTITUTION")+'</div><div class="print-fields">'+
        pf(L("বর্তমান ঠিকানা","Present Address"),a.present_address||a.address,true)+pf(L("স্থায়ী ঠিকানা","Permanent Address"),a.permanent_address,true)+pf(L("পূর্ববর্তী বিদ্যালয়","Previous School"),a.previous_school)+pf(L("সর্বশেষ শ্রেণি","Last Attended Class"),a.previous_class)+'</div>'+
        '<div class="print-declaration">'+L("আমি ঘোষণা করছি যে, এই ফরমে প্রদত্ত সকল তথ্য সঠিক। প্রয়োজনে তথ্য যাচাইয়ের জন্য প্রয়োজনীয় কাগজপত্র জমা দিতে সম্মত আছি।","I declare that all information provided in this application is correct. I agree to submit supporting documents for verification when required.")+'</div>'+
        '<div class="print-signatures"><div>'+L("শিক্ষার্থীর স্বাক্ষর","Student’s Signature")+'</div><div>'+L("অভিভাবকের স্বাক্ষর","Parent / Guardian’s Signature")+'</div><div>'+L("অফিস কর্তৃপক্ষের স্বাক্ষর ও সিল","Authorized Signature & Seal")+'</div></div>'+
        '<div class="print-foot">'+L("আবেদন নম্বর: ","Application No.: ")+esc(a.application_no)+' · '+L("তৈরির তারিখ: ","Generated: ")+esc(new Date(a.created_at||Date.now()).toLocaleDateString(en?"en-GB":"bn-BD"))+'</div></article>';
    printWindow("application",markup);
}
function printAdmitCard(a) {
    const schoolName = schoolSettings.school_name_en || "Shaheed Nur Hossain Memorial School";
    const address = schoolSettings.address_en || schoolSettings.address || "";
    const fields = [
        ["Student Name",a.student_name_en || a.student_name],
        ["Application No.",a.application_no],
        ["Admission Class",a.class_name],
        ["Exam Roll",a.admit_roll || a.application_no],
        ["Academic Year",a.academic_year],
        ["Exam Date",schoolSettings.admission_exam_date ? new Date(schoolSettings.admission_exam_date + "T00:00:00").toLocaleDateString("en-GB") : ""],
        ["Exam Time",schoolSettings.admission_exam_time],
        ["Exam Center",schoolSettings.admission_exam_center_en || schoolSettings.admission_exam_center]
    ];
    const fieldMarkup = fields.map((item,i)=>'<div class="admit-field '+(i===0?'admit-field-primary':'')+'"><span>'+esc(item[0])+'</span><b>'+esc(item[1]||"—")+'</b></div>').join("");
    const markup = '<article class="admit-card"><div class="admit-accent"></div><header class="admit-head"><div class="admit-logo-wrap"><img src="'+esc(schoolSettings.logo_url||"/6716-removebg-preview.png")+'" alt="School logo"></div>'+
        '<div class="admit-school"><p class="admit-kicker">ADMISSION EXAMINATION</p><h2>'+esc(schoolName)+'</h2>'+
        (address?'<p class="admit-address">'+esc(address)+'</p>':'')+
        '<p class="admit-eiin">EIIN: '+esc(schoolSettings.eiin||"—")+'</p><h3>ADMIT CARD</h3></div>'+
        '<div class="admit-year">'+esc(a.academic_year||"")+'</div></header><div class="admit-meta"><span>ADMIT CARD</span><b>'+esc(a.admit_roll||a.application_no)+'</b></div>'+
        '<section class="admit-grid">'+fieldMarkup+'</section>'+
        (schoolSettings.admission_exam_instructions_en || schoolSettings.admission_exam_instructions ? '<div class="admit-instructions"><strong>Exam Instructions</strong><p>'+esc(schoolSettings.admission_exam_instructions_en || schoolSettings.admission_exam_instructions)+'</p></div>':'')+
        '<footer class="admit-signatures"><div class="admit-note">Please bring this admit card to the examination hall.</div><div class="admit-signature"><span></span><b>Candidate’s Signature</b></div><div class="admit-signature"><span></span><b>Authorized Signature</b></div></footer></article>';
    printWindow("admit",markup);
}

async function refresh() {
    const [data, summary] = await Promise.all([call("/api/admin/website/admissions"),call("/api/admin/website/admissions/summary")]);
    applications = data.items || [];
    renderSummary(summary.summary || {});
    renderRows();
}
async function loadSettings() {
    const response = await call("/api/admin/website/data");
    const settings = Object.fromEntries((response.data.site_settings || []).map(x => [x.key,x.value]));
    schoolSettings = settings;
    const form = $("#admissionSettings");
    for (const field of form.elements) if (field.name && settings[field.name] !== undefined) field.value = settings[field.name];
    if (settings.admission_fee === undefined) form.elements.admission_fee.value = "0";
}
$("#admissionSettings").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget, data = Object.fromEntries(new FormData(form));
    try {
        if (!Number.isFinite(Number(data.admission_fee)) || Number(data.admission_fee) < 0) throw new Error("Please enter a valid application fee.");
        const result = await call("/api/admin/website/settings",{method:"PUT",json:data});
        message($("#settingsMessage"),result.message || "Settings saved successfully.");
    } catch(err) { message($("#settingsMessage"),err.message,true); }
});
$("#admissionRows").addEventListener("click", async e => {
    const applicationPrint = e.target.closest("[data-print-application]");
    if (applicationPrint) {
        const a = applications.find(item => String(item.id) === applicationPrint.dataset.printApplication);
        if (a) printApplication(a);
        return;
    }
    const admitPrint = e.target.closest("[data-print-admit]");
    if (admitPrint) {
        const a = applications.find(item => String(item.id) === admitPrint.dataset.printAdmit);
        if (a) printAdmitCard(a);
        return;
    }
    const btn = e.target.closest("[data-save]");
    if (!btn) return;
    const row = btn.closest("tr"), data = {};
    row.querySelectorAll("[data-field]").forEach(el => { data[el.dataset.field] = el.type === "checkbox" ? el.checked : el.value; });
    btn.disabled = true; btn.textContent = "Saving...";
    try {
        await call("/api/admin/website/admissions/"+btn.dataset.save,{method:"PUT",json:data});
        message($("#pageMessage"),"আবেদন ও Admit Cardের Settings saved successfully.");
        await refresh();
    } catch(err) { message($("#pageMessage"),err.message,true); }
    finally { btn.disabled = false; btn.textContent = "Save"; }
});
async function bulkAdmit(enabled) {
    const targets = applications.filter(a => a.status === "Accepted");
    if (!targets.length) { message($("#pageMessage"),"There are no accepted applications yet.",true); return; }
    if (!confirm(targets.length+" accepted students’ admit cards "+(enabled?"Enabled":"Disabled")+" ?")) return;
    try {
        for (const a of targets) await call("/api/admin/website/admissions/"+a.id,{method:"PUT",json:{admit_card_enabled:enabled}});
        message($("#pageMessage"),"Accepted students’ admit cards "+(enabled?"Enabled":"Disabled")+" successfully updated.");
        await refresh();
    } catch(err) { message($("#pageMessage"),err.message,true); }
}
$("#enableAll").addEventListener("click",()=>bulkAdmit(true));
$("#disableAll").addEventListener("click",()=>bulkAdmit(false));
$("#refreshAdmissions").addEventListener("click",()=>refresh().catch(e=>message($("#pageMessage"),e.message,true)));
$("#admissionSearch").addEventListener("input",renderRows);
$("#statusFilter").addEventListener("change",renderRows);

let academicYears = [];
async function refreshAcademicYears() {
    const data = await call("/api/admin/website/academic-years");
    academicYears = data.items || [];
    $("#academicYearRows").innerHTML = academicYears.map(item =>
        '<tr><td class="font-semibold">'+esc(item.year)+'</td><td>'+(item.active?'<span class="badge-green">Active</span>':'<span class="badge-amber">Inactive</span>')+
        '</td><td>'+(item.active?'Visible':'Hidden')+'</td><td class="flex flex-wrap gap-2"><button type="button" class="btn-secondary btn-sm" data-year-toggle="'+esc(item.year)+'" data-active="'+String(!item.active)+'">'+(item.active?'Deactivate':'Activate')+'</button>'+
        '<button type="button" class="btn-secondary btn-sm" data-year-delete="'+esc(item.year)+'">Delete</button></td></tr>'
    ).join("") || '<tr><td colspan="4" class="py-6 text-center text-slate-400">No academic years added.</td></tr>';
}
$("#academicYearForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const form=e.currentTarget,year=String(new FormData(form).get("year")||"").trim();
    const status=$("#academicYearMessage");
    try{
        if(!/^\d{4}$/.test(year))throw new Error("Enter a valid four-digit year.");
        await call("/api/admin/website/academic-years",{method:"POST",json:{year}});
        form.reset();message(status,"Academic year added successfully.");await refreshAcademicYears();
    }catch(err){message(status,err.message,true);}
});
$("#academicYearRows").addEventListener("click",async e=>{
    const toggle=e.target.closest("[data-year-toggle]");
    const del=e.target.closest("[data-year-delete]");
    try{
        if(toggle){
            await call("/api/admin/website/academic-years/"+encodeURIComponent(toggle.dataset.year),{method:"PUT",json:{active:toggle.dataset.active==="true"}});
            message($("#academicYearMessage"),"Academic year status updated.");await refreshAcademicYears();
        }else if(del){
            if(!confirm("Delete academic year "+del.dataset.year+"?"))return;
            await call("/api/admin/website/academic-years/"+encodeURIComponent(del.dataset.year),{method:"DELETE"});
            message($("#academicYearMessage"),"Academic year deleted.");await refreshAcademicYears();
        }
    }catch(err){message($("#academicYearMessage"),err.message,true);}
});
App.shell("admissions").then(async user => {
    if (!user) return;
    try { await Promise.all([loadSettings(),refresh(),refreshAcademicYears()]); }
    catch(err) { message($("#pageMessage"),err.message,true); }
});