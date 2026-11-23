"use strict";
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let applications = [];
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
    '</select></td><td><input class="input min-w-24" data-field="admit_roll" value="'+esc(a.admit_roll||"")+'" placeholder="রোল"></td><td><label class="flex items-center gap-2 text-sm"><input type="checkbox" data-field="admit_card_enabled" '+(a.admit_card_enabled?'checked':'')+'> চালু</label></td><td><input class="input min-w-36" data-field="admin_note" value="'+esc(a.admin_note||"")+'" placeholder="নোট"></td><td><button class="btn-primary btn-sm" data-save="'+esc(a.id)+'">সংরক্ষণ</button></td></tr>').join("") || '<tr><td colspan="8" class="py-10 text-center text-slate-400">কোনো আবেদন পাওয়া যায়নি।</td></tr>';
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