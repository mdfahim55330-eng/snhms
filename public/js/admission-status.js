"use strict";
const $=s=>document.querySelector(s);
const form=$("#statusForm"),err=$("#statusError"),result=$("#statusResult"),print=$("#admitPrint");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let language=localStorage.getItem("snhms-language")==="en"?"en":"bn";
let school={school_name:"শহীদ নূর হোসেন মেমোরিয়াল স্কুল",school_name_en:"Shaheed Nur Hossain Memorial School",logo_url:"/6716-removebg-preview.png"};
let lastApplication=null,lastExam=null;
const words={
bn:{home:"← হোমপেজ",schoolShort:"শহীদ নূর হোসেন মেমোরিয়াল স্কুল",pageTitle:"আবেদনের অবস্থা / Application Status",apply:"ভর্তি আবেদন",heading:"আবেদনের অবস্থা দেখুন",intro:"আবেদন নম্বর ও অভিভাবকের মোবাইল নম্বর দিয়ে আবেদনের সর্বশেষ অবস্থা জানুন।",language:"ভাষা নির্বাচন করুন",applicationId:"আবেদন নম্বর",mobile:"অভিভাবকের মোবাইল নম্বর",check:"আবেদনের অবস্থা দেখুন",privacy:"আপনার আবেদন নম্বর ও আবেদনের সময় দেওয়া মোবাইল নম্বর ব্যবহার করুন।",loading:"তথ্য খোঁজা হচ্ছে…",details:"আবেদনের তথ্য",student:"শিক্ষার্থীর নাম",class:"ভর্তির শ্রেণি",status:"আবেদনের অবস্থা",payment:"পেমেন্টের অবস্থা",roll:"ভর্তি পরীক্ষার রোল",year:"শিক্ষাবর্ষ",accepted:"অনুমোদিত",pending:"আবেদন জমা হয়েছে",reviewed:"যাচাই চলছে",rejected:"বাতিল",waiting:"অপেক্ষমাণ তালিকা",print:"এডমিট কার্ড প্রিন্ট করুন",notReady:"এডমিট কার্ড এখনো প্রকাশ করা হয়নি। অনুমোদনের পর এডমিট কার্ড পাওয়া যাবে।",examTitle:"প্রবেশপত্র",admit:"ADMIT CARD",application:"আবেদন নম্বর",date:"পরীক্ষার তারিখ",time:"সময়",center:"পরীক্ষার কেন্দ্র",instructions:"পরীক্ষার নির্দেশনা",signature:"পরীক্ষার্থীর স্বাক্ষর",school:"প্রতিষ্ঠান",error:"আবেদনের তথ্য পাওয়া যায়নি। আবেদন নম্বর ও মোবাইল নম্বর যাচাই করুন।",examRoll:"পরীক্ষার রোল"},
en:{home:"← Home",schoolShort:"Shaheed Nur Hossain Memorial School",pageTitle:"Application Status",apply:"Apply for Admission",heading:"Check Application Status",intro:"Enter your application number and guardian's mobile number to view the latest status.",language:"Choose language",applicationId:"Application Number",mobile:"Guardian's Mobile Number",check:"Check Application Status",privacy:"Use the application number and the same mobile number provided with your application.",loading:"Checking application…",details:"Application Details",student:"Student Name",class:"Admission Class",status:"Application Status",payment:"Payment Status",roll:"Admission Test Roll",year:"Academic Year",accepted:"Accepted",pending:"Application Submitted",reviewed:"Under Review",rejected:"Rejected",waiting:"Waiting List",print:"Print Admit Card",notReady:"Your admit card has not been published yet. It will be available after approval.",examTitle:"ADMIT CARD",admit:"ADMIT CARD",application:"Application No.",date:"Exam Date",time:"Time",center:"Exam Center",instructions:"Instructions",signature:"Candidate's Signature",school:"Institution",error:"Application not found. Please check the application number and mobile number.",examRoll:"Exam Roll"}
};
function t(k){return words[language][k]||words.bn[k]||k;}
function statusLabel(s){return ({Pending:t("pending"),Reviewed:t("reviewed"),Accepted:t("accepted"),Rejected:t("rejected"),"Waiting List":t("waiting")})[s]||s||"—";}
function setLanguage(next){
 language=next==="en"?"en":"bn";localStorage.setItem("snhms-language",language);document.documentElement.lang=language;
 document.querySelectorAll("[data-i18n]").forEach(el=>{const k=el.dataset.i18n;el.textContent=t(k);});
 document.querySelectorAll(".language-btn").forEach(b=>{const active=b.dataset.lang===language;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
 if(lastApplication)renderResult(lastApplication,lastExam);
}
document.querySelectorAll(".language-btn").forEach(b=>b.addEventListener("click",()=>setLanguage(b.dataset.lang)));
async function loadSchool(){
 try{const r=await fetch("/api/site");if(r.ok){const d=await r.json();school={...school,...(d.settings||{})};}}
 catch(_){}
 $("#footerSchoolName").textContent=language==="en"?(school.school_name_en||school.school_name):school.school_name;const logo=$("#statusLogo");if(logo)logo.src=school.logo_url||"/6716-removebg-preview.png";
}
function renderResult(a,x){
 const status=statusLabel(a.status);
 result.innerHTML='<div class="status-result-head"><span class="status-result-icon">✓</span><div><h2>'+t("details")+'</h2><p>'+t("application")+': <b>'+esc(a.application_no)+'</b></p></div></div>'+
 '<div class="status-detail-grid"><div><small>'+t("student")+'</small><b>'+esc(a.student_name)+'</b></div><div><small>'+t("class")+'</small><b>'+esc(a.class_name)+'</b></div><div><small>'+t("status")+'</small><b class="status-value">'+esc(status)+'</b></div><div><small>'+t("payment")+'</small><b>'+esc(a.payment_status||"—")+'</b></div></div>'+
 (a.can_print_admit_card?'<button id="printAdmit" class="admit-print-btn" type="button"><span class="admit-btn-symbol">▤</span><span>'+t("print")+'</span><span class="admit-btn-arrow">→</span></button>':'<p class="admit-not-ready">'+t("notReady")+'</p>');
 result.hidden=false;
 const btn=$("#printAdmit");if(btn)btn.addEventListener("click",()=>printCard(a,x));
}
form.addEventListener("submit",async e=>{
 e.preventDefault();err.hidden=true;result.hidden=true;
 const btn=form.querySelector(".status-submit");btn.disabled=true;btn.querySelector("[data-i18n]").textContent=t("loading");
 const data=Object.fromEntries(new FormData(form));
 try{
  const r=await fetch("/api/admission/status?"+new URLSearchParams(data));const d=await r.json();
  if(!r.ok)throw new Error(d.message||t("error"));
  lastApplication=d.application;lastExam=d.exam||{};renderResult(lastApplication,lastExam);
 }catch(ex){err.textContent=ex.message||t("error");err.hidden=false;}
 finally{btn.disabled=false;btn.querySelector("[data-i18n]").textContent=t("check");}
});
async function printCard(a,x){
 const en=language==="en",schoolName=en?(school.school_name_en||"Shaheed Nur Hossain Memorial School"):(school.school_name||"শহীদ নূর হোসেন মেমোরিয়াল স্কুল");
 const logo=school.logo_url||"/6716-removebg-preview.png";
 const fields=[[t("student"),a.student_name],[t("application"),a.application_no],[t("class"),a.class_name],[t("examRoll"),a.admit_roll||a.application_no],[t("year"),a.academic_year],[t("date"),x.exam_date],[t("time"),x.exam_time],[t("center"),x.center]];
 print.innerHTML='<article class="admit-card '+(en?'admit-en':'')+'"><header class="admit-head"><img src="'+esc(logo)+'" alt="Logo" onerror="this.src=\'/6716-removebg-preview.png\'"><div><h2>'+esc(schoolName)+'</h2><p>'+esc(school.address||"")+'</p><h3>'+t("examTitle")+'</h3></div></header><div class="admit-grid">'+fields.map(([k,v])=>'<div class="admit-field"><span>'+esc(k)+'</span><b>'+esc(v||"—")+'</b></div>').join("")+'</div>'+(x.instructions?'<div class="admit-instructions"><b>'+t("instructions")+':</b> '+esc(x.instructions)+'</div>':'')+'<footer>'+t("signature")+': __________________________</footer></article>';
 print.hidden=false;
 document.body.classList.add("printing-admit");
 try { if(document.fonts && document.fonts.ready) await document.fonts.ready; } catch(_) {}
 const images=Array.from(print.querySelectorAll("img"));
 await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 window.addEventListener("afterprint",()=>document.body.classList.remove("printing-admit"),{once:true});
 window.print();
 setTimeout(()=>document.body.classList.remove("printing-admit"),60000);
}
loadSchool().then(()=>setLanguage(language));


// Add a consistent developer credit at the bottom of public pages.
document.addEventListener("DOMContentLoaded",()=>{if(!document.querySelector(".developer-credit")){const f=document.createElement("footer");f.className="developer-credit";f.textContent="Developed by Mohammad Fahim";f.style.cssText="text-align:center;padding:14px 12px;background:#061f33;color:#dbe6eb;font:13px Arial,sans-serif";document.body.appendChild(f);}});
