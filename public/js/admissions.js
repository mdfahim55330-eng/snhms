"use strict";
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let applications = [];
let schoolSettings = {};
async function call(url, options = {}) {
    const r = await App.api(url, options);
    if (!r.ok) throw new Error(r.data.message || "অনুরোধটি সম্পন্ন হয়নি।");
    return r.data;
}
function message(el, value, error = false) {
    el.textContent = value;
    el.className = "text-sm " + (error ? "text-red-600" : "text-emerald-700");
}
function renderSummary(s) {
    const items = [["মোট আবেদন",s.total||0,"bg-brand-50 text-brand-700"],["অপেক্ষমাণ",s.pending||0,"bg-amber-50 text-amber-700"],["পর্যালোচিত",s.reviewed||0,"bg-violet-50 text-violet-700"],["গৃহীত",s.accepted||0,"bg-emerald-50 text-emerald-700"],["বাতিল",s.rejected||0,"bg-red-50 text-red-700"]];
    $("#summary").innerHTML = items.map(([label,count,tone]) => '<article class="card flex items-center gap-3 !p-4"><div class="rounded-xl p-3 '+tone+'"><span class="text-xl font-bold">'+esc(count)+'</span></div><p class="text-sm font-semibold text-slate-600">'+label+'</p></article>').join("");
}
function renderRows() {
    const q = ($("#admissionSearch").value || "").trim().toLowerCase(), status = $("#statusFilter").value;
    const rows = applications.filter(a => (!q || [a.application_no,a.student_name,a.student_name_en,a.phone,a.class_name].join(" ").toLowerCase().includes(q)) && (!status || a.status === status));
    $("#admissionRows").innerHTML = rows.map(a => '<tr><td><b>'+esc(a.application_no)+'</b><span class="block text-xs text-slate-500">'+esc(a.student_name)+'</span></td><td>'+esc(a.class_name)+'<span class="block text-xs text-slate-500">'+esc(a.phone)+'</span></td><td><select class="input min-w-32" data-field="status">'+
    ["Pending","Reviewed","Accepted","Rejected","Waiting List"].map(s=>'<option value="'+s+'" '+(a.status===s?'selected':'')+'>'+({"Pending":"অপেক্ষমাণ","Reviewed":"পর্যালোচিত","Accepted":"অনুমোদিত","Rejected":"বাতিল","Waiting List":"অপেক্ষমাণ তালিকা"}[s])+'</option>').join("")+
    '</select></td><td><select class="input min-w-32" data-field="payment_status">'+
    ["Not Required","Pending","Verified","Rejected"].map(s=>'<option value="'+s+'" '+((a.payment_status||"Not Required")===s?'selected':'')+'>'+({"Not Required":"প্রযোজ্য নয়","Pending":"অপেক্ষমাণ","Verified":"যাচাইকৃত","Rejected":"বাতিল"}[s])+'</option>').join("")+
    '</select></td><td><input class="input min-w-24" data-field="admit_roll" value="'+esc(a.admit_roll||"")+'" placeholder="রোল"></td><td><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-field="admit_card_enabled" '+(a.admit_card_enabled?'checked':'')+'> চালু</label></td><td><input class="input min-w-36" data-field="admin_note" value="'+esc(a.admin_note||"")+'" placeholder="নোট"></td><td><button class="btn-primary btn-sm" data-save="'+esc(a.id)+'">সংরক্ষণ</button></td><td><div class="flex flex-wrap gap-2"><button type="button" class="btn-secondary btn-sm" data-print-application="'+esc(a.id)+'">আবেদন ফরম</button><button type="button" class="btn-secondary btn-sm" data-print-admit="'+esc(a.id)+'">এডমিট কার্ড</button></div></td></tr>').join("") || '<tr><td colspan="9" class="py-10 text-center text-slate-400">কোনো আবেদন পাওয়া যায়নি।</td></tr>';
}

function printWindow(kind, markup) {
    const win = window.open("", "_blank");
    if (!win) { message($("#pageMessage"), "প্রিন্ট উইন্ডো খুলতে পারেনি। ব্রাউজারের pop-up অনুমতি দিন।", true); return; }
    const containerId = kind === "application" ? "printSheet" : "admitPrint";
    const bodyClass = kind === "application" ? "printing-admission" : "printing-admit";
    win.document.open();
    win.document.write('<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admission Print</title><link rel="stylesheet" href="/css/admission.css?v=admin-print-20261123"></head><body class="'+bodyClass+'"><div id="'+containerId+'">'+markup+'</div></body></html>');
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
    const name = schoolSettings.school_name || "শহীদ নূর হোসেন মেমোরিয়াল স্কুল";
    const nameEn = schoolSettings.school_name_en || "Shaheed Nur Hossain Memorial School";
    const address = schoolSettings.address || "বিরল, দিনাজপুর";
    const fields = [
        pf("শিক্ষার্থীর নাম (বাংলা)",a.student_name,true),pf("শিক্ষার্থীর নাম (ইংরেজি)",a.student_name_en,true),
        pf("জন্মতারিখ",a.birth_date),pf("জন্ম নিবন্ধন নং",a.birth_reg_no),pf("লিঙ্গ",a.gender),
        pf("ধর্ম",a.religion),pf("জাতীয়তা",a.nationality),pf("শাখা/বিভাগ",a.group_name)
    ].join("");
    const markup = '<article class="print-page"><header class="print-head"><img class="print-logo" src="'+esc(schoolSettings.logo_url||"/6716-removebg-preview.png")+'" alt="School Logo"><div><h1>'+esc(name)+'</h1><p class="en">'+esc(nameEn)+'</p><p>'+esc(address)+(schoolSettings.phone?' · '+esc(schoolSettings.phone):'')+'</p><p>EIIN: '+esc(schoolSettings.eiin||"—")+'</p></div><div></div></header>'+
        '<div class="print-title">ভর্তি আবেদন ফরম / ADMISSION APPLICATION FORM</div>'+
        '<div class="print-meta"><span>ভর্তির শ্রেণি: '+esc(a.class_name)+'</span><span>শিক্ষাবর্ষ: '+esc(a.academic_year||"—")+'</span><span class="print-number">আবেদন নম্বর: '+esc(a.application_no)+'</span></div>'+
        '<div class="print-section">১. শিক্ষার্থীর তথ্য</div><div class="print-grid"><div class="print-fields">'+fields+'</div><div class="photo-box">শিক্ষার্থীর পাসপোর্ট সাইজ ছবি</div></div>'+
        '<div class="print-section">২. পিতা-মাতা ও অভিভাবকের তথ্য</div><div class="print-fields">'+
        pf("পিতার নাম",a.father_name)+pf("মাতার নাম",a.mother_name)+pf("অভিভাবকের নাম",a.guardian_name)+pf("অভিভাবকের পেশা",a.guardian_occupation)+
        pf("মোবাইল নম্বর",a.phone)+pf("বিকল্প নম্বর",a.guardian_phone)+pf("ইমেইল",a.email,true)+'</div>'+
        '<div class="print-section">৩. ঠিকানা ও পূর্ববর্তী শিক্ষাপ্রতিষ্ঠান</div><div class="print-fields">'+
        pf("বর্তমান ঠিকানা",a.present_address||a.address,true)+pf("স্থায়ী ঠিকানা",a.permanent_address,true)+pf("পূর্ববর্তী বিদ্যালয়",a.previous_school)+pf("সর্বশেষ শ্রেণি",a.previous_class)+'</div>'+
        '<div class="print-declaration">আমি ঘোষণা করছি যে, এই ফরমে প্রদত্ত সকল তথ্য সঠিক। প্রয়োজনে তথ্য যাচাইয়ের জন্য প্রয়োজনীয় কাগজপত্র জমা দিতে সম্মত আছি।</div>'+
        '<div class="print-signatures"><div>শিক্ষার্থীর স্বাক্ষর</div><div>অভিভাবকের স্বাক্ষর</div><div>অফিস কর্তৃপক্ষের স্বাক্ষর ও সিল</div></div>'+
        '<div class="print-foot">আবেদন নম্বর: '+esc(a.application_no)+' · তৈরির তারিখ: '+esc(new Date(a.created_at||Date.now()).toLocaleDateString("bn-BD"))+'</div></article>';
    printWindow("application",markup);
}
function printAdmitCard(a) {
    const schoolName = schoolSettings.school_name || "শহীদ নূর হোসেন মেমোরিয়াল স্কুল";
    const fields = [
        ["শিক্ষার্থীর নাম",a.student_name],["আবেদন নম্বর",a.application_no],["ভর্তির শ্রেণি",a.class_name],
        ["পরীক্ষার রোল",a.admit_roll||a.application_no],["শিক্ষাবর্ষ",a.academic_year],
        ["পরীক্ষার তারিখ",schoolSettings.admission_exam_date],["সময়",schoolSettings.admission_exam_time],
        ["পরীক্ষার কেন্দ্র",schoolSettings.admission_exam_center]
    ];
    const fieldMarkup = fields.map((item,i)=>'<div class="admit-field '+(i===0?'admit-field-primary':'')+'"><span>'+esc(item[0])+'</span><b>'+esc(item[1]||"—")+'</b></div>').join("");
    const markup = '<article class="admit-card"><div class="admit-accent"></div><header class="admit-head"><div class="admit-logo-wrap"><img src="'+esc(schoolSettings.logo_url||"/6716-removebg-preview.png")+'" alt="School logo"></div>'+
        '<div class="admit-school"><p class="admit-kicker">ভর্তি পরীক্ষার প্রবেশপত্র</p><h2>'+esc(schoolName)+'</h2>'+
        (schoolSettings.address?'<p class="admit-address">'+esc(schoolSettings.address)+'</p>':'')+
        '<p class="admit-eiin">EIIN: '+esc(schoolSettings.eiin||"—")+'</p><h3>প্রবেশপত্র</h3></div>'+
        '<div class="admit-year">'+esc(a.academic_year||"")+'</div></header><div class="admit-meta"><span>ADMIT CARD</span><b>'+esc(a.admit_roll||a.application_no)+'</b></div>'+
        '<section class="admit-grid">'+fieldMarkup+'</section>'+
        (schoolSettings.admission_exam_instructions?'<div class="admit-instructions"><strong>পরীক্ষার নির্দেশনা</strong><p>'+esc(schoolSettings.admission_exam_instructions)+'</p></div>':'')+
        '<footer class="admit-signatures"><div class="admit-note">পরীক্ষার হলে এই প্রবেশপত্রটি সঙ্গে আনতে হবে।</div><div class="admit-signature"><span></span><b>পরীক্ষার্থীর স্বাক্ষর</b></div><div class="admit-signature"><span></span><b>কর্তৃপক্ষের স্বাক্ষর</b></div></footer></article>';
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
        if (!Number.isFinite(Number(data.admission_fee)) || Number(data.admission_fee) < 0) throw new Error("সঠিক আবেদন ফি লিখুন।");
        const result = await call("/api/admin/website/settings",{method:"PUT",json:data});
        message($("#settingsMessage"),result.message || "সেটিংস সংরক্ষণ হয়েছে।");
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
    btn.disabled = true; btn.textContent = "সংরক্ষণ হচ্ছে...";
    try {
        await call("/api/admin/website/admissions/"+btn.dataset.save,{method:"PUT",json:data});
        message($("#pageMessage"),"আবেদন ও এডমিট কার্ডের সেটিংস সংরক্ষণ হয়েছে।");
        await refresh();
    } catch(err) { message($("#pageMessage"),err.message,true); }
    finally { btn.disabled = false; btn.textContent = "সংরক্ষণ"; }
});
async function bulkAdmit(enabled) {
    const targets = applications.filter(a => a.status === "Accepted");
    if (!targets.length) { message($("#pageMessage"),"এখনো কোনো অনুমোদিত আবেদন নেই।",true); return; }
    if (!confirm(targets.length+" জন অনুমোদিত শিক্ষার্থীর এডমিট কার্ড "+(enabled?"চালু":"বন্ধ")+" করবেন?")) return;
    try {
        for (const a of targets) await call("/api/admin/website/admissions/"+a.id,{method:"PUT",json:{admit_card_enabled:enabled}});
        message($("#pageMessage"),"অনুমোদিত শিক্ষার্থীদের এডমিট কার্ড "+(enabled?"চালু":"বন্ধ")+" করা হয়েছে।");
        await refresh();
    } catch(err) { message($("#pageMessage"),err.message,true); }
}
$("#enableAll").addEventListener("click",()=>bulkAdmit(true));
$("#disableAll").addEventListener("click",()=>bulkAdmit(false));
$("#refreshAdmissions").addEventListener("click",()=>refresh().catch(e=>message($("#pageMessage"),e.message,true)));
$("#admissionSearch").addEventListener("input",renderRows);
$("#statusFilter").addEventListener("change",renderRows);
App.shell("admissions").then(async user => {
    if (!user) return;
    try { await Promise.all([loadSettings(),refresh()]); }
    catch(err) { message($("#pageMessage"),err.message,true); }
});