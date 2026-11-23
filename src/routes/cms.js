"use strict";
const express=require("express");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const multer=require("multer");
const db=require("../db");
const config=require("../config");
const {requireAdminRole}=require("../middleware/auth");
const audit=require("../services/audit");
const {buildAdmissionsWorkbook}=require("../services/admissions-excel");
const router=express.Router();
const uploadDir=path.join(__dirname,"..","..","public","uploads");
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({
 destination:(req,file,cb)=>cb(null,uploadDir),
 filename:(req,file,cb)=>cb(null,Date.now()+"-"+crypto.randomBytes(8).toString("hex")+path.extname(file.originalname).toLowerCase())
});
const upload=multer({storage,limits:{fileSize:config.upload.maxBytes},fileFilter:(req,file,cb)=>{
 const allowed=/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)||file.mimetype==="application/pdf";
 cb(allowed?null:new Error("শুধু JPG, PNG, WEBP, GIF অথবা PDF ফাইল আপলোড করা যাবে।"),allowed);
}});
const clean=(v,n=12000)=>String(v??"").trim().slice(0,n);
router.use(requireAdminRole);
router.get("/website/data",async(req,res)=>{
 const tables=["site_settings","site_pages","site_notices","site_staff","site_gallery","site_routines","site_downloads","site_menu_links","site_messages"];
 const data={};
 for(const t of tables)data[t]=await db.all("SELECT * FROM "+t+(t==="site_settings"?" ORDER BY key":" ORDER BY id DESC")+" LIMIT 500");
 res.json({success:true,data});
});
router.put("/website/settings",async(req,res)=>{
 const allowed=new Set(["school_name","school_name_en","tagline","tagline_en","address","phone","email","eiin","logo_url","hero_image_url","about","about_en","principal_name","principal_name_en","principal_message","principal_message_en","history","history_en","mission","mission_en","vision","vision_en","facilities","facilities_en","achievements","achievements_en","facebook_url","youtube_url"]);
 for(const [k,v] of Object.entries(req.body||{}))if(allowed.has(k))await db.query("INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[k,clean(v,12000)]);
 await audit.log(req,"website_settings_updated","website",null,"Updated institutional website settings");
 res.json({success:true,message:"প্রতিষ্ঠানের তথ্য সংরক্ষণ হয়েছে।"});
});
router.post("/website/upload",upload.single("file"),async(req,res)=>{
 if(!req.file)return res.status(400).json({success:false,message:"ফাইল নির্বাচন করুন।"});
 res.json({success:true,url:"/uploads/"+req.file.filename,filename:req.file.originalname});
});
const configs={
 pages:{table:"site_pages",fields:["slug","title","title_en","content","content_en","active","sort_order"],required:["slug","title"]},
 notices:{table:"site_notices",fields:["title","title_en","category","category_en","body","body_en","attachment_url","published"],required:["title"]},
 staff:{table:"site_staff",fields:["name","name_en","designation","designation_en","department","department_en","photo_url","phone","sort_order","active"],required:["name","designation"]},
 gallery:{table:"site_gallery",fields:["title","title_en","image_url","category","category_en","sort_order"],required:["title","image_url"]},
 routines:{table:"site_routines",fields:["title","title_en","class_name","class_name_en","file_url"],required:["title","file_url"]},
 downloads:{table:"site_downloads",fields:["title","title_en","category","category_en","file_url"],required:["title","file_url"]},
 menu:{table:"site_menu_links",fields:["label","label_en","url","sort_order","open_new_tab","active"],required:["label","url"]}
};
for(const [key,c] of Object.entries(configs)){
 router.get("/website/"+key,async(req,res)=>res.json({success:true,items:await db.all("SELECT * FROM "+c.table+" ORDER BY id DESC")}));
 router.post("/website/"+key,async(req,res)=>{
  const b=req.body||{};
  for(const k of c.required)if(!clean(b[k],500))return res.status(400).json({success:false,message:k+" আবশ্যক"});
  const fields=c.fields.filter(k=>b[k]!==undefined),values=fields.map(k=>b[k]);
  const sql="INSERT INTO "+c.table+"("+fields.join(",")+") VALUES("+fields.map(()=>"?").join(",")+") RETURNING *";
  const result=await db.query(sql,values);
  await audit.log(req,"website_"+key+"_created",key,result.rows[0].id,"Created "+key+" item");
  res.json({success:true,item:result.rows[0]});
 });
 router.put("/website/"+key+"/:id",async(req,res)=>{
  const fields=c.fields.filter(k=>req.body&&req.body[k]!==undefined);
  if(!fields.length)return res.status(400).json({success:false,message:"পরিবর্তনের তথ্য দিন"});
  const values=fields.map(k=>req.body[k]);values.push(req.params.id);
  const sql="UPDATE "+c.table+" SET "+fields.map(k=>k+"=?").join(",")+" WHERE id=? RETURNING *";
  const result=await db.query(sql,values);
  if(!result.rowCount)return res.status(404).json({success:false,message:"তথ্য পাওয়া যায়নি"});
  await audit.log(req,"website_"+key+"_updated",key,req.params.id,"Updated "+key+" item");
  res.json({success:true,item:result.rows[0]});
 });
 router.delete("/website/"+key+"/:id",async(req,res)=>{
  await db.query("DELETE FROM "+c.table+" WHERE id=?",[req.params.id]);
  await audit.log(req,"website_"+key+"_deleted",key,req.params.id,"Deleted "+key+" item");
  res.json({success:true});
 });
}
router.get("/website/admissions",async(req,res)=>res.json({success:true,items:await db.all("SELECT * FROM site_admissions ORDER BY id DESC")}));
router.get("/website/admissions/summary",async(req,res)=>{
 const row=await db.one(`SELECT COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status='Pending') AS pending,
  COUNT(*) FILTER (WHERE status='Reviewed') AS reviewed,
  COUNT(*) FILTER (WHERE status='Accepted') AS accepted,
  COUNT(*) FILTER (WHERE status='Rejected') AS rejected
  FROM site_admissions`);
 res.json({success:true,summary:Object.fromEntries(["total","pending","reviewed","accepted","rejected"].map(key=>[key,Number(row[key])||0]))});
});
router.get("/website/admissions/export.xlsx",async(req,res)=>{
 const applications=await db.all(`SELECT id,application_no,student_name,student_name_en,father_name,mother_name,guardian_name,birth_date,
  birth_reg_no,gender,religion,nationality,class_name,group_name,academic_year,phone,guardian_phone,
  guardian_occupation,email,address,present_address,permanent_address,previous_school,previous_class,
  status,created_at FROM site_admissions ORDER BY created_at DESC,id DESC`);
 const buffer=await buildAdmissionsWorkbook(applications);
 await audit.log(req,"website_admissions_exported","site_admissions",null,
  "Exported "+applications.length+" admission applications",{count:applications.length});
 res.setHeader("Cache-Control","no-store");
 res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
 res.setHeader("Content-Disposition",`attachment; filename="admission-applications-${new Date().toISOString().slice(0,10)}.xlsx"`);
 res.send(buffer);
});
router.put("/website/admissions/:id",async(req,res)=>{
 const status=String(req.body.status||"Pending");
 if(!["Pending","Reviewed","Accepted","Rejected"].includes(status))return res.status(400).json({success:false,message:"অবৈধ অবস্থা"});
 const result=await db.query("UPDATE site_admissions SET status=? WHERE id=? RETURNING *",[status,req.params.id]);
 res.json({success:true,item:result.rows[0]||null});
});
router.get("/website/messages",async(req,res)=>res.json({success:true,items:await db.all("SELECT * FROM site_messages ORDER BY id DESC")}));
router.put("/website/messages/:id/read",async(req,res)=>{
 await db.query("UPDATE site_messages SET read_at=now() WHERE id=?",[req.params.id]);
 res.json({success:true});
});
module.exports=router;
