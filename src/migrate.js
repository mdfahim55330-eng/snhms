"use strict";

const bcrypt = require("bcrypt");
const db = require("./db");
const config = require("./config");

const LOCK_KEY = 5533011; // arbitrary number, just so two servers never migrate at once

async function columnExists(table, column) {
    const row = await db.one(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
        [table, column]
    );
    return !!row;
}

// Create a UNIQUE index. If the existing data already has duplicates the index cannot be
// created: we DON'T crash and we DON'T delete anything, we just warn (the application also
// checks for duplicates itself before every insert).
async function tryUniqueIndex(name, sql, hint) {
    try {
        await db.query(sql);
        return true;
    } catch (error) {
        if (error.code === "23505") {
            console.warn(
                `[migrate] WARNING: could not create unique index "${name}" because duplicate rows already exist.\n` +
                `          ${hint}\n` +
                `          Run "npm run find-duplicates" to list them, fix them, then restart the server.`
            );
            return false;
        }
        throw error;
    }
}

async function migrate() {
    const client = await db.pool.connect();
    try {
        await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);

        // ------------------------------------------------------------------
        // 1. Base tables (unchanged structure from the original system)
        // ------------------------------------------------------------------
        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                roll TEXT NOT NULL,
                registration TEXT,
                class_name TEXT NOT NULL,
                group_name TEXT,
                exam_name TEXT NOT NULL,
                exam_year INTEGER NOT NULL,
                institute_name TEXT,
                eiin TEXT,
                status TEXT DEFAULT 'draft',
                final_gpa REAL DEFAULT 0,
                final_grade TEXT DEFAULT 'F',
                result_status TEXT DEFAULT 'Fail',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                subject_name TEXT NOT NULL,
                subject_code TEXT NOT NULL,
                full_marks INTEGER NOT NULL,
                subject_type TEXT DEFAULT 'main',
                class_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS exams (
                id SERIAL PRIMARY KEY,
                exam_name TEXT NOT NULL,
                exam_year INTEGER NOT NULL,
                class_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS classes (
                id SERIAL PRIMARY KEY,
                class_name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        await client.query(`
            INSERT INTO classes (class_name)
            SELECT DISTINCT TRIM(class_name)
            FROM (
                SELECT class_name FROM students
                UNION
                SELECT class_name FROM exams
                UNION
                SELECT class_name FROM subjects
            ) AS existing_classes
            WHERE class_name IS NOT NULL
              AND TRIM(class_name) <> ''
            ON CONFLICT (class_name) DO NOTHING
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS results (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                marks REAL DEFAULT 0,
                grade TEXT,
                grade_point REAL DEFAULT 0,
                is_fourth_subject INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            )`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

        // ------------------------------------------------------------------
        // 2. Upgrades for databases created by the old version
        // ------------------------------------------------------------------
        const hadMustChange = await columnExists("admins", "must_change_password");

        await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'`);
        await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
        await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`);
        await client.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ`);

        if (!hadMustChange) {
            // First time this upgrade runs: the old system created a default admin whose
            // password was written in the (public) source code. Force every existing admin
            // to choose a new password at the next login.
            const changed = await client.query(`UPDATE admins SET must_change_password = TRUE`);
            if (changed.rowCount > 0) {
                console.warn(
                    `[migrate] ${changed.rowCount} existing admin account(s) must set a new password at next login.`
                );
            }
        }

        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);

        // ------------------------------------------------------------------
        // 3. New tables
        // ------------------------------------------------------------------
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id BIGSERIAL PRIMARY KEY,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                admin_id INTEGER,
                username TEXT,
                role TEXT,
                action TEXT NOT NULL,
                entity TEXT,
                entity_id TEXT,
                summary TEXT,
                details JSONB,
                ip TEXT
            )`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS session (
                sid VARCHAR NOT NULL PRIMARY KEY,
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            )`);

        // ------------------------------------------------------------------
        // 3b. Institutional website CMS
        // ------------------------------------------------------------------
        await client.query(`
            CREATE TABLE IF NOT EXISTS site_settings (
                key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS site_menu_links (
                id BIGSERIAL PRIMARY KEY, label TEXT NOT NULL, url TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0, open_new_tab BOOLEAN NOT NULL DEFAULT FALSE,
                active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );\n            CREATE TABLE IF NOT EXISTS site_pages (
                id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE,
                sort_order INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS site_notices (
                id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'সাধারণ',
                body TEXT NOT NULL DEFAULT '', attachment_url TEXT, published BOOLEAN NOT NULL DEFAULT TRUE,
                published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS site_staff (
                id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, designation TEXT NOT NULL,
                department TEXT NOT NULL DEFAULT '', photo_url TEXT, phone TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE
            );
            CREATE TABLE IF NOT EXISTS site_gallery (
                id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, image_url TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS site_routines (
                id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, class_name TEXT NOT NULL DEFAULT '',
                file_url TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS site_downloads (
                id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
                file_url TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE TABLE IF NOT EXISTS site_admissions (
                id BIGSERIAL PRIMARY KEY, student_name TEXT NOT NULL, guardian_name TEXT NOT NULL,
                birth_date DATE, gender TEXT NOT NULL DEFAULT '', class_name TEXT NOT NULL,
                phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
                previous_school TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            ALTER TABLE site_admissions
                ADD COLUMN IF NOT EXISTS application_no TEXT,
                ADD COLUMN IF NOT EXISTS student_name_en TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS father_name TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS mother_name TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS birth_reg_no TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS religion TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS nationality TEXT NOT NULL DEFAULT 'বাংলাদেশী',
                ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS previous_class TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS guardian_phone TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS guardian_occupation TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS present_address TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS permanent_address TEXT NOT NULL DEFAULT '';
            UPDATE site_admissions
                SET application_no = LPAD(id::text, 6, '0')
                WHERE application_no IS NULL OR application_no = '';
            ALTER TABLE site_admissions ALTER COLUMN application_no SET NOT NULL;
            ALTER TABLE site_admissions
                ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS payment_transaction TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Not Required',
                ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS admit_roll TEXT NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS admit_card_enabled BOOLEAN NOT NULL DEFAULT FALSE;
            INSERT INTO site_settings(key,value) VALUES
                ('admission_fee','0'),('admission_online_payment','true'),('admission_school_payment','true'),
                ('admission_bkash',''),('admission_nagad',''),('admission_rocket',''),('admission_payment_note',''),
                ('admission_exam_date',''),('admission_exam_time',''),('admission_exam_center',''),('admission_exam_instructions','')
            ON CONFLICT(key) DO NOTHING;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_site_admission_number
                ON site_admissions(class_name, application_no);
            CREATE TABLE IF NOT EXISTS site_admission_counters (
                class_name TEXT PRIMARY KEY,
                last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 999999)
            );
            INSERT INTO site_admission_counters(class_name, last_number)
                SELECT class_name, MAX(application_no::integer)
                FROM site_admissions
                GROUP BY class_name
                ON CONFLICT(class_name) DO UPDATE
                SET last_number = GREATEST(site_admission_counters.last_number, EXCLUDED.last_number);
            CREATE TABLE IF NOT EXISTS site_messages (
                id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', message TEXT NOT NULL,
                read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS value_en TEXT;
            ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS title_en TEXT, ADD COLUMN IF NOT EXISTS content_en TEXT;
            ALTER TABLE site_notices ADD COLUMN IF NOT EXISTS title_en TEXT, ADD COLUMN IF NOT EXISTS category_en TEXT, ADD COLUMN IF NOT EXISTS body_en TEXT;
            ALTER TABLE site_staff ADD COLUMN IF NOT EXISTS name_en TEXT, ADD COLUMN IF NOT EXISTS designation_en TEXT, ADD COLUMN IF NOT EXISTS department_en TEXT;
            ALTER TABLE site_gallery ADD COLUMN IF NOT EXISTS title_en TEXT, ADD COLUMN IF NOT EXISTS category_en TEXT;
            ALTER TABLE site_routines ADD COLUMN IF NOT EXISTS title_en TEXT, ADD COLUMN IF NOT EXISTS class_name_en TEXT;
            ALTER TABLE site_downloads ADD COLUMN IF NOT EXISTS title_en TEXT, ADD COLUMN IF NOT EXISTS category_en TEXT;
            ALTER TABLE site_menu_links ADD COLUMN IF NOT EXISTS label_en TEXT;
        `);
        await client.query(`
            INSERT INTO site_settings(key,value) VALUES
            ('school_name','Shaheed Nur Hossain Memorial School'),
            ('tagline','শিক্ষার আলোয় গড়ি আগামীর ভবিষ্যৎ'),
            ('school_name_en','Shaheed Nur Hossain Memorial School'),
            ('tagline_en','Building a brighter future through the light of education'),
            ('address','Biral, Dinajpur'),('phone',''),('email',''),('eiin','140721'),
            ('logo_url','/6716-removebg-preview.png'),('hero_image_url',''),
            ('about','শিক্ষার্থীদের জ্ঞান, নৈতিকতা, শৃঙ্খলা ও মানবিক মূল্যবোধসম্পন্ন নাগরিক হিসেবে গড়ে তোলাই আমাদের লক্ষ্য।'),
            ('about_en','Our mission is to nurture knowledgeable, ethical, disciplined and compassionate citizens.'),
            ('mission_en','To provide quality education and build responsible citizens with strong moral values.'),
            ('vision_en','To become a model institution for excellence in learning, character and creativity.'),
            ('principal_message_en','We are committed to helping every student grow into a responsible and capable citizen.'),
            ('principal_name',''),('principal_message',''),('history',''),('mission',''),('vision',''),
            ('facilities',''),('achievements',''),('facebook_url',''),('youtube_url','')
            ON CONFLICT(key) DO NOTHING
        `);
        await client.query(`
            INSERT INTO site_pages(slug,title,content,sort_order) VALUES
            ('history','প্রতিষ্ঠানের ইতিহাস','প্রতিষ্ঠানের ইতিহাস ও ঐতিহ্যের বিবরণ এখানে যোগ করুন।',1),
            ('mission','লক্ষ্য ও উদ্দেশ্য','প্রতিষ্ঠানের লক্ষ্য, উদ্দেশ্য ও শিক্ষাদর্শন।',2),
            ('facilities','সুযোগ-সুবিধা','লাইব্রেরি, বিজ্ঞানাগার, কম্পিউটার ল্যাব ও অন্যান্য সুবিধা।',3),
            ('governing-body','পরিচালনা পর্ষদ','পরিচালনা পর্ষদের তথ্য এখানে যোগ করুন।',4),
            ('academic-calendar','একাডেমিক ক্যালেন্ডার','শিক্ষাবর্ষের গুরুত্বপূর্ণ তারিখ ও কার্যক্রম।',5),
            ('holiday-list','ছুটির তালিকা','বার্ষিক ছুটির তালিকা।',6)
            ON CONFLICT(slug) DO NOTHING
        `);
        await client.query(`
            UPDATE site_pages SET title_en='Institution History',content_en='Learn about the history and heritage of our institution.' WHERE slug='history' AND (title_en IS NULL OR content_en IS NULL);
            UPDATE site_pages SET title_en='Mission & Objectives',content_en='Our institutional mission, objectives and educational philosophy.' WHERE slug='mission' AND (title_en IS NULL OR content_en IS NULL);
            UPDATE site_pages SET title_en='Facilities',content_en='Library, science laboratory, computer lab and other learning facilities.' WHERE slug='facilities' AND (title_en IS NULL OR content_en IS NULL);
            UPDATE site_pages SET title_en='Governing Body',content_en='Information about the governing body of the institution.' WHERE slug='governing-body' AND (title_en IS NULL OR content_en IS NULL);
            UPDATE site_pages SET title_en='Academic Calendar',content_en='Important dates and activities for the academic year.' WHERE slug='academic-calendar' AND (title_en IS NULL OR content_en IS NULL);
            UPDATE site_pages SET title_en='Holiday List',content_en='Annual holiday schedule.' WHERE slug='holiday-list' AND (title_en IS NULL OR content_en IS NULL);
        `);
        // ------------------------------------------------------------------
        // 4. Indexes (speed)
        // ------------------------------------------------------------------
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_students_lookup ON students (class_name, exam_name, exam_year, roll)`,
            `CREATE INDEX IF NOT EXISTS idx_students_status ON students (status)`,
            `CREATE INDEX IF NOT EXISTS idx_results_student ON results (student_id)`,
            `CREATE INDEX IF NOT EXISTS idx_results_subject ON results (subject_id)`,
            `CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects (class_name)`,
            `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire)`
        ];
        for (const sql of indexes) await client.query(sql);

        // ------------------------------------------------------------------
        // 5. Uniqueness (stops duplicate students / results)
        // ------------------------------------------------------------------
        await tryUniqueIndex(
            "uq_students_roll",
            `CREATE UNIQUE INDEX IF NOT EXISTS uq_students_roll
             ON students (class_name, exam_name, exam_year, roll)`,
            "Some students have the same roll in the same class, exam and year."
        );
        await tryUniqueIndex(
            "uq_results_student_subject",
            `CREATE UNIQUE INDEX IF NOT EXISTS uq_results_student_subject ON results (student_id, subject_id)`,
            "Some students have the same subject saved twice."
        );
        await tryUniqueIndex(
            "uq_exams",
            `CREATE UNIQUE INDEX IF NOT EXISTS uq_exams ON exams (exam_name, exam_year, class_name)`,
            "The same exam was added more than once."
        );
        await tryUniqueIndex(
            "uq_subjects_class_code",
            `CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_class_code ON subjects (class_name, subject_code)`,
            "The same subject code was added twice for one class."
        );
    } finally {
        try {
            await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
        } catch (e) { /* ignore */ }
        client.release();
    }

    await bootstrapAdmin();
}

// Creates the first admin ONLY when there is no admin at all, and only from environment
// variables. No password is ever written in the source code.
async function bootstrapAdmin() {
    const count = Number((await db.one(`SELECT COUNT(*) AS n FROM admins`)).n);
    if (count > 0) return;

    const { username, password } = config.bootstrapAdmin;
    if (!username || !password) {
        console.warn(
            "\n[setup] There is no admin account yet.\n" +
            "        Create one with:  npm run set-admin\n" +
            "        (or set ADMIN_USERNAME and ADMIN_PASSWORD once, then restart)\n"
        );
        return;
    }
    if (password.length < 8) {
        console.error("[setup] ADMIN_PASSWORD must be at least 8 characters. Admin not created.");
        return;
    }

    const hash = await bcrypt.hash(password, 12);
    await db.query(
        `INSERT INTO admins (username, password, role, must_change_password)
         VALUES (?, ?, 'admin', FALSE) ON CONFLICT (username) DO NOTHING`,
        [username.trim(), hash]
    );
    console.log(`[setup] Admin account "${username.trim()}" created. You can now remove ADMIN_PASSWORD from the environment.`);
}

module.exports = { migrate };
