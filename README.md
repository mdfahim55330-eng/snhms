# Shaheed Nur Hossain Memorial School — Institutional Website + Result Management

একটি পূর্ণাঙ্গ বাংলা শিক্ষাপ্রতিষ্ঠান ওয়েবসাইট ও রেজাল্ট ম্যানেজমেন্ট সিস্টেম। Tech stack: Node.js, Express, PostgreSQL, HTML/CSS/JavaScript.

## Included modules

### Public institutional website
- Responsive Bengali homepage with institution details, history, mission, vision and principal's message.
- Administration and teacher/staff profiles.
- Notice board with PDF/image attachments.
- Photo gallery, class routine, exam schedule, syllabus and learning resources.
- Online admission application form and contact-message form.
- Admin admission dashboard with application totals/statuses and a complete Excel export.
- Admin-editable logo, hero banner, contact details, social links and page content.

### Result Management System
The result portal is integrated from the `School-Result-System-New` project:
- Admin and Teacher login with role-based access.
- Classes, subjects, exams, students and individual marks entry.
- Bulk Excel import, template/download, validation and export.
- Draft/publish/unpublish workflow.
- Public result search protected by CAPTCHA.
- Individual PDF marksheet with Bengali fonts and QR verification.
- Merit list, tabulation sheet, statistics, activity log, backup and restore.
- GPA-5 grading and fourth-subject bonus logic.
- Ranking: GPA descending, then total marks descending; equal total marks share a position; failed students are unranked.

## Requirements
- Node.js 20 or newer (Node.js 22 LTS recommended).
- PostgreSQL 14 or newer.
- Git.

## Local installation (Windows PowerShell)

1. Clone the repository and install dependencies:

```powershell
git clone https://github.com/mdfahim55330-eng/snhms.git
cd snhms
npm install
```

2. Create a PostgreSQL database. For example, in pgAdmin create a database named `snhms`.

3. Copy environment template:

```powershell
Copy-Item .env.example .env
```

4. Open `.env` and set the PostgreSQL URL and secrets. Example:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/snhms
DATABASE_SSL=false
SESSION_SECRET=PASTE_A_LONG_RANDOM_SECRET
PUBLIC_BASE_URL=http://localhost:3000
SCHOOL_NAME=Shaheed Nur Hossain Memorial School
SCHOOL_ADDRESS=Biral, Dinajpur
SCHOOL_EIIN=140721
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SET_YOUR_OWN_STRONG_PASSWORD
UPLOAD_MAX_MB=8
```

Generate a secure session secret in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

5. Run syntax checks and start the server:

```powershell
npm run check
npm start
```

The first start creates/updates the database tables. If `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set and there is no admin account yet, the first admin is created automatically. Remove `ADMIN_PASSWORD` from `.env` after the first successful setup.

6. Open:
- Public website: http://localhost:3000
- Public result search: http://localhost:3000/pages/result-search.html
- Admin login: http://localhost:3000/pages/admin-login.html
- Admin dashboard: http://localhost:3000/pages/admin.html
- Website CMS: http://localhost:3000/pages/website.html (admin login required)

## First-use checklist
- Sign in and change the initial administrator password.
- Add classes, subjects and exams in the result dashboard.
- Add students and marks, import a spreadsheet if needed, then publish results.
- In Website Management, edit institution information and add teachers, notices, gallery photos, routines and downloads.
- Replace sample text/photos with the institution's approved information and images.

## Notes
- This repository is pushed to GitHub; it is not automatically connected to your local PostgreSQL database.
- No real school database credentials or student records are included.
- File uploads are stored under `public/uploads` on the local server. For production hosting, configure persistent storage or object storage because ephemeral hosting disks can be cleared during redeploys.
- Before public production use, test with a copy of the database and configure HTTPS, secure secrets, backups and persistent upload storage.
- The included GitHub Actions workflow checks JavaScript syntax. It does not replace local PostgreSQL integration testing.

## Source
The integrated result management module is based on the existing project:
https://github.com/mdfahim55330-eng/School-Result-System-New


## বাংলা ও English ভাষা

- পাবলিক ওয়েবসাইটের উপরের Language switch থেকে বাংলা বা English নির্বাচন করা যায়; পছন্দটি একই ব্রাউজারে সংরক্ষিত থাকে।
- ইংরেজি সংস্করণে প্রতিষ্ঠানের নাম, স্লোগান, পরিচিতি, অধ্যক্ষের বার্তা, লক্ষ্য ও ভিশনের English copy Website Management-এর প্রতিষ্ঠানের তথ্য ফর্মে লিখুন।
- পেজ, নোটিশ, শিক্ষক-কর্মচারী, গ্যালারি, রুটিন, ডাউনলোড ও তিন-ডট মেনুর জন্য English field-ও পূরণ করুন। পুরোনো তথ্যের পাশে থাকা “English সম্পাদনা” ব্যবহার করে ইংরেজি কপি যোগ বা সংশোধন করা যাবে।
- কোনো English copy ফাঁকা থাকলে সেই নির্দিষ্ট তথ্যটি বাংলা কপি থেকে fallback হতে পারে। সম্পূর্ণ ইংরেজি অভিজ্ঞতার জন্য প্রতিটি প্রকাশিত কনটেন্টের English copy পূরণ করুন।
