"use strict";
const $ = (s) => document.querySelector(s);
const form = $("#admissionForm");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let school = { school_name: "শহীদ নূর হোসেন মেমোরিয়াল স্কুল", school_name_en: "Shaheed Nur Hossain Memorial School" };
let language = localStorage.getItem("snhms-language") === "en" ? "en" : "bn";
let submittedApplication = null;
let admissionSettings = {};
const words = {
bn: {
home:"← হোমপেজে ফিরে যান",statusLink:"আবেদনের অবস্থা / এডমিট কার্ড দেখুন",statusHint:"আবেদনের অগ্রগতি জানুন এবং অনুমোদিত হলে এডমিট কার্ড প্রিন্ট করুন",topTitle:"অনলাইন ভর্তি আবেদন",results:"ফলাফল",formTitle:"ভর্তি আবেদন ফরম",
introText:"সঠিক তথ্য দিয়ে ফরমটি পূরণ করে আবেদন জমা দিন। আবেদন নম্বর স্বয়ংক্রিয়ভাবে তৈরি হবে।",chooseLanguage:"ভাষা নির্বাচন করুন",
studentSection:"শিক্ষার্থীর তথ্য",studentBn:"শিক্ষার্থীর নাম (বাংলা) *",studentEn:"শিক্ষার্থীর নাম (ইংরেজি)",
class:"ভর্তির শ্রেণি *",selectClass:"শ্রেণি নির্বাচন করুন",year:"শিক্ষাবর্ষ",select:"নির্বাচন করুন",group:"শাখা / বিভাগ",
birthDate:"জন্মতারিখ *",birthReg:"জন্ম নিবন্ধন নম্বর",gender:"লিঙ্গ *",boy:"ছেলে",girl:"মেয়ে",other:"অন্যান্য",
religion:"ধর্ম",nationality:"জাতীয়তা",parentSection:"পিতা-মাতা ও অভিভাবকের তথ্য",father:"পিতার নাম *",mother:"মাতার নাম *",
guardian:"অভিভাবকের নাম (পিতা/মাতা ছাড়া হলে)",occupation:"অভিভাবকের পেশা",phone:"অভিভাবকের মোবাইল নম্বর *",
altPhone:"বিকল্প মোবাইল নম্বর",email:"ইমেইল ঠিকানা",addressSection:"ঠিকানা ও পূর্ববর্তী শিক্ষাপ্রতিষ্ঠান",
presentAddress:"বর্তমান ঠিকানা *",permanentAddress:"স্থায়ী ঠিকানা",previousSchool:"পূর্ববর্তী বিদ্যালয়ের নাম",
previousClass:"সর্বশেষ অধ্যয়নকৃত শ্রেণি",declaration:"আমি ঘোষণা করছি যে, উপরে দেওয়া সকল তথ্য আমার জানা মতে সঠিক। ভুল তথ্য প্রদান করলে কর্তৃপক্ষ আবেদন বাতিল করতে পারবেন।",
submit:"আবেদন জমা দিন",reset:"ফরম মুছুন",successTitle:"আবেদন সফলভাবে জমা হয়েছে",
successText:"আপনার আবেদন নম্বর সংরক্ষণ করুন এবং A4 ফরমটি প্রিন্ট করুন।",print:"আবেদন ফরম প্রিন্ট করুন",
newApp:"নতুন আবেদন",schoolName:"শহীদ নূর হোসেন মেমোরিয়াল স্কুল",studentBnPh:"বাংলায় পূর্ণ নাম",
studentEnPh:"ইংরেজিতে পূর্ণ নাম",optional:"প্রযোজ্য হলে",religionPh:"ধর্ম",loading:"আবেদন জমা হচ্ছে…",
submitting:"Submitting application…",errorLoad:"প্রতিষ্ঠানের তথ্য লোড করা যায়নি।",requiredError:"শিক্ষার্থীর নাম, অভিভাবকের নাম, শ্রেণি ও মোবাইল নম্বর আবশ্যক।",
successMessage:"আপনার ভর্তি আবেদন সফলভাবে জমা হয়েছে।",submitError:"আবেদন জমা দেওয়া যায়নি।",generated:"তৈরির তারিখ",
applicationNo:"আবেদন নম্বর",admissionClass:"ভর্তির শ্রেণি",academicYear:"শিক্ষাবর্ষ",studentInfo:"শিক্ষার্থীর তথ্য",
parentsInfo:"পিতা-মাতা ও অভিভাবকের তথ্য",addressInfo:"ঠিকানা ও পূর্ববর্তী শিক্ষাপ্রতিষ্ঠান",studentPhoto:"শিক্ষার্থীর পাসপোর্ট সাইজ ছবি",
studentSignature:"শিক্ষার্থীর স্বাক্ষর",guardianSignature:"অভিভাবকের স্বাক্ষর",officeSignature:"অফিস কর্তৃপক্ষের স্বাক্ষর ও সিল",
printDeclaration:"আমি ঘোষণা করছি যে, এই ফরমে প্রদত্ত সকল তথ্য সঠিক। প্রয়োজনে তথ্য যাচাইয়ের জন্য প্রয়োজনীয় কাগজপত্র জমা দিতে সম্মত আছি।",
studentNameBangla:"শিক্ষার্থীর নাম (বাংলা)",studentNameEnglish:"শিক্ষার্থীর নাম (ইংরেজি)",dob:"জন্মতারিখ",birthRegNo:"জন্ম নিবন্ধন নং",
sex:"লিঙ্গ",branch:"শাখা/বিভাগ",guardianProfession:"অভিভাবকের পেশা",mobile:"মোবাইল নম্বর",alternativeMobile:"বিকল্প নম্বর",
currentAddress:"বর্তমান ঠিকানা",permanent:"স্থায়ী ঠিকানা",oldSchool:"পূর্ববর্তী বিদ্যালয়",lastClass:"সর্বশেষ শ্রেণি",
emailLabel:"ইমেইল",religionLabel:"ধর্ম",nationalityLabel:"জাতীয়তা"
},
en: {
home:"← Back to Home",statusLink:"Check Application Status / Admit Card",statusHint:"Track your application and print your admit card after approval.",topTitle:"Online Admission",results:"Results",formTitle:"Admission Application Form",
introText:"Complete the form accurately and submit your application. Your application number will be generated automatically.",
chooseLanguage:"Choose language",studentSection:"Student Information",studentBn:"Student Name (Bangla) *",
studentEn:"Student Name (English)",class:"Applying for Class *",selectClass:"Select class",year:"Academic Year",select:"Select",
group:"Section / Group",birthDate:"Date of Birth *",birthReg:"Birth Registration Number",gender:"Gender *",
boy:"Male",girl:"Female",other:"Other",religion:"Religion",nationality:"Nationality",parentSection:"Parents' & Guardian Information",
father:"Father's Name *",mother:"Mother's Name *",guardian:"Guardian's Name (if other than parents)",occupation:"Guardian's Occupation",
phone:"Guardian's Mobile Number *",altPhone:"Alternative Mobile Number",email:"Email Address",
addressSection:"Address & Previous Institution",presentAddress:"Present Address *",permanentAddress:"Permanent Address",
previousSchool:"Previous School Name",previousClass:"Last Attended Class",
declaration:"I declare that all information provided above is true to the best of my knowledge. The authority may reject this application if any information is found to be incorrect.",
submit:"Submit Application",reset:"Clear Form",successTitle:"Application Submitted Successfully",
successText:"Please save your application number and print the A4 application form.",print:"Print Application Form",newApp:"New Application",
schoolName:"Shaheed Nur Hossain Memorial School",studentBnPh:"Full name in Bangla",studentEnPh:"Full name in English",
optional:"If applicable",religionPh:"Religion",loading:"আবেদন জমা হচ্ছে…",submitting:"Submitting application…",
errorLoad:"Unable to load institution information.",requiredError:"Student name, guardian name, class and mobile number are required.",
successMessage:"Your admission application has been submitted successfully.",submitError:"Unable to submit application.",
generated:"Generated",applicationNo:"Application No.",admissionClass:"Class",academicYear:"Academic Year",
studentInfo:"STUDENT INFORMATION",parentsInfo:"PARENTS' & GUARDIAN INFORMATION",
addressInfo:"ADDRESS & PREVIOUS INSTITUTION",studentPhoto:"Student Passport Size Photo",
studentSignature:"Student's Signature",guardianSignature:"Parent / Guardian's Signature",
officeSignature:"Authorized Signature & Seal",
printDeclaration:"I declare that all information provided in this application is correct. I agree to submit supporting documents for verification when required.",
studentNameBangla:"Student Name (Bangla)",studentNameEnglish:"Student Name (English)",dob:"Date of Birth",
birthRegNo:"Birth Registration No.",sex:"Gender",branch:"Section / Group",guardianProfession:"Guardian's Occupation",
mobile:"Mobile Number",alternativeMobile:"Alternative Number",currentAddress:"Present Address",
permanent:"Permanent Address",oldSchool:"Previous School",lastClass:"Last Attended Class",emailLabel:"Email",
religionLabel:"Religion",nationalityLabel:"Nationality"
}
};
function t(key){return words[language][key] || words.bn[key] || key;}
function setLanguage(next) {
    language = next === "en" ? "en" : "bn";
    localStorage.setItem("snhms-language", language);
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach((el) => { const key=el.dataset.i18n; if(words[language][key]) el.textContent=words[language][key]; });
    document.querySelectorAll("[data-ph]").forEach((el) => { const key=el.dataset.ph; if(words[language][key]) el.placeholder=words[language][key]; });
    document.querySelectorAll(".language-btn").forEach((btn) => {
        const active=btn.dataset.lang===language; btn.classList.toggle("active",active); btn.setAttribute("aria-pressed",String(active));
    });
    const classOption=$("#className").options[0]; if(classOption) classOption.textContent=t("selectClass");
    const yearOption=$("#academicYear").options[0]; if(yearOption) yearOption.textContent=t("select");
    const genderSelect=form.elements.gender;
    if(genderSelect){genderSelect.options[0].textContent=t("select");genderSelect.options[1].textContent=t("boy");genderSelect.options[2].textContent=t("girl");genderSelect.options[3].textContent=t("other");}
    if(submittedApplication) makePrintSheet(submittedApplication);
}
document.querySelectorAll(".language-btn").forEach(btn=>btn.addEventListener("click",()=>setLanguage(btn.dataset.lang)));

async function loadFormData() {
    const response=await fetch("/api/site");
    if(!response.ok) throw new Error(t("errorLoad"));
    const data=await response.json(); school=data.settings||school; admissionSettings=school;
    if(school.admission_open==="false"){
      const formArea=$("#admissionForm"); if(formArea)formArea.hidden=true;
      document.querySelectorAll(".form-status-card,.language-row").forEach(el=>el.hidden=true);
      const error=$("#formError"); error.textContent=language==="en"?"Online admission is currently closed. Please check again when applications reopen.":"বর্তমানে অনলাইন ভর্তি আবেদন গ্রহণ বন্ধ রয়েছে। ভর্তি কার্যক্রম চালু হলে আবার আবেদন করতে পারবেন।"; error.hidden=false;
      $("#admissionFeeInfo").hidden=true; return;
    }
    const fee=Math.max(0,Number(school.admission_fee||0)||0);
    $("#admissionFeeInfo").hidden=false;
    $("#admissionFeeInfo").textContent=fee===0?"আবেদন ফি: সম্পূর্ণ ফ্রি":"আবেদন ফি: "+fee+" টাকা";
    if(fee>0){
      $("#paymentSection").hidden=false;
      const method=$("#paymentMethod");method.innerHTML="";
      if(school.admission_online_payment!=="false")method.add(new Option("অনলাইনে (বিকাশ/নগদ/রকেট)","online"));
      if(school.admission_school_payment!=="false")method.add(new Option("স্কুলে সরাসরি জমা","school"));
      method.add(new Option("স্কুল অফিসে নগদ টাকা","cash"));
      $("#paymentInstructions").textContent=[school.admission_bkash&&"বিকাশ: "+school.admission_bkash,school.admission_nagad&&"নগদ: "+school.admission_nagad,school.admission_rocket&&"রকেট: "+school.admission_rocket,school.admission_payment_note].filter(Boolean).join(" | ");
      method.addEventListener("change",()=>{const online=method.value==="online";$("#transactionField").hidden=!online;form.elements.payment_transaction.required=online;});
      method.dispatchEvent(new Event("change"));
    }
    const classSelect=$("#className");
    (data.classes||[]).forEach(name=>{const option=document.createElement("option");option.value=name;option.textContent=name;classSelect.append(option);});
    const year=$("#academicYear");year.innerHTML="";
    const placeholder=new Option(t("select"),"");year.add(placeholder);
    const activeYears=(data.academicYears||[]).map(item=>String(item.year)).filter(value=>/^\d{4}$/.test(value));
    const current=String(new Date().getFullYear());
    activeYears.forEach(value=>{const option=new Option(value,value);year.add(option);});
    if(activeYears.includes(current))year.value=current;
    else if(activeYears.length)year.value=activeYears[0];
    year.required=true;
    if(!activeYears.length){year.disabled=true;$("#formError").textContent=language==="en"?"No active admission academic year is available.":"বর্তমানে কোনো সক্রিয় শিক্ষাবর্ষে আবেদন গ্রহণ করা হচ্ছে না।";$("#formError").hidden=false;}
    $("#footerYear").textContent=current;setLanguage(language);
}
function printField(label,val,wide=false){return '<div class="print-field'+(wide?' wide':'')+'"><b>'+esc(label)+':</b> '+esc(val||"—")+'</div>';}
function makePrintSheet(data) {
    const en=language==="en";
    const schoolName=en?(school.school_name_en||"Shaheed Nur Hossain Memorial School"):(school.school_name||"শহীদ নূর হোসেন মেমোরিয়াল স্কুল");
    const address=school.address||"বিরল, দিনাজপুর";
    const fields=[
      printField(t("studentNameBangla"),data.student_name,true),printField(t("studentNameEnglish"),data.student_name_en,true),
      printField(t("dob"),data.birth_date),printField(t("birthRegNo"),data.birth_reg_no),printField(t("sex"),data.gender),
      printField(t("religionLabel"),data.religion),printField(t("nationalityLabel"),data.nationality),printField(t("branch"),data.group_name)
    ].join("");
    $("#printSheet").innerHTML='<article class="print-page '+(en?'print-en':'')+'"><header class="print-head"><img class="print-logo" src="'+"/6716-removebg-preview.png?v=logo-fix-20261123"+'" alt="School Logo"><div><h1>'+esc(schoolName)+'</h1><p class="en">'+esc(en?(school.school_name||"শহীদ নূর হোসেন মেমোরিয়াল স্কুল"):(school.school_name_en||"Shaheed Nur Hossain Memorial School"))+'</p><p>'+esc(address)+(school.phone?' · '+esc(school.phone):'')+'</p><p>EIIN: '+esc(school.eiin||"—")+'</p></div><div></div></header>'+
    '<div class="print-title">'+(en?'ADMISSION APPLICATION FORM':'ভর্তি আবেদন ফরম / ADMISSION APPLICATION FORM')+'</div>'+
    '<div class="print-meta"><span>'+t("admissionClass")+': '+esc(data.class_name)+'</span><span>'+t("academicYear")+': '+esc(data.academic_year||new Date().getFullYear())+'</span><span class="print-number">'+t("applicationNo")+': '+esc(data.application_no)+'</span></div>'+
    '<div class="print-section">'+(en?'1. ':'১. ')+t("studentInfo")+'</div><div class="print-grid"><div class="print-fields">'+fields+'</div><div class="photo-box">'+t("studentPhoto")+'</div></div>'+
    '<div class="print-section">'+(en?'2. ':'২. ')+t("parentsInfo")+'</div><div class="print-fields">'+
    printField(t("father"),data.father_name)+printField(t("mother"),data.mother_name)+printField(t("guardian"),data.guardian_name)+
    printField(t("guardianProfession"),data.guardian_occupation)+printField(t("mobile"),data.phone)+printField(t("alternativeMobile"),data.guardian_phone)+printField(t("emailLabel"),data.email,true)+'</div>'+
    '<div class="print-section">'+(en?'3. ':'৩. ')+t("addressInfo")+'</div><div class="print-fields">'+
    printField(t("currentAddress"),data.present_address,true)+printField(t("permanent"),data.permanent_address,true)+
    printField(t("oldSchool"),data.previous_school)+printField(t("lastClass"),data.previous_class)+'</div>'+
    '<div class="print-declaration">'+t("printDeclaration")+'</div><div class="print-signatures"><div>'+t("studentSignature")+'</div><div>'+t("guardianSignature")+'</div><div>'+t("officeSignature")+'</div></div>'+
    '<div class="print-foot">'+t("applicationNo")+': '+esc(data.application_no)+' · '+t("generated")+': '+esc(new Date().toLocaleDateString(en?"en-GB":"bn-BD"))+'</div></article>';
}
form.addEventListener("submit",async event=>{
    event.preventDefault();$("#formError").hidden=true;const button=$("#submitButton");button.disabled=true;$("#submitStatus").textContent=t("submitting");
    const payload=Object.fromEntries(new FormData(form));delete payload.declaration;if(Number(admissionSettings.admission_fee||0)<=0){delete payload.payment_method;delete payload.payment_transaction;}
    payload.guardian_name=payload.guardian_name||payload.father_name||payload.mother_name;
    try{
      const response=await fetch("/api/admission",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json();if(!response.ok)throw new Error(result.message||t("submitError"));
      submittedApplication={...payload,...result.application};makePrintSheet(submittedApplication);
      $("#applicationNumber").textContent=result.application.application_no;$("#successPanel").hidden=false;
      $("#successPanel").scrollIntoView({behavior:"smooth",block:"center"});$("#submitStatus").textContent=t("successMessage");form.hidden=true;
    }catch(error){$("#formError").textContent=error.message;$("#formError").hidden=false;$("#submitStatus").textContent="";}
    finally{button.disabled=false;}
});
$("#printButton").addEventListener("click",printAdmissionForm);

async function printAdmissionForm(){
    if(!submittedApplication) return;
    makePrintSheet(submittedApplication);
    document.body.classList.add("printing-admission");
    const logo=document.querySelector("#printSheet .print-logo");
    if(logo){
      logo.src="/6716-removebg-preview.png?v=logo-fix-20261123";
      logo.loading="eager"; logo.decoding="sync";
      if(!logo.complete) await new Promise(resolve=>{logo.onload=resolve;logo.onerror=resolve;});
    }
    try { if(document.fonts && document.fonts.ready) await document.fonts.ready; } catch(_) {}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    window.addEventListener("afterprint",()=>document.body.classList.remove("printing-admission"),{once:true});
    window.print();
    setTimeout(()=>document.body.classList.remove("printing-admission"),60000);
}
$("#newApplication").addEventListener("click",()=>{form.reset();form.hidden=false;$("#successPanel").hidden=true;$("#submitStatus").textContent="";$("#formError").hidden=true;submittedApplication=null;window.scrollTo({top:0,behavior:"smooth"});});
loadFormData().catch(error=>{$("#formError").textContent=error.message;$("#formError").hidden=false;});


// Add a consistent developer credit at the bottom of public pages.
document.addEventListener("DOMContentLoaded",()=>{if(!document.querySelector(".developer-credit")){const f=document.createElement("footer");f.className="developer-credit";f.textContent="Developed by Mohammad Fahim";f.style.cssText="text-align:center;padding:14px 12px;background:#061f33;color:#dbe6eb;font:13px Arial,sans-serif";document.body.appendChild(f);}});
