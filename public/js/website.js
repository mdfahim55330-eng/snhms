"use strict";

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[char]));

async function api(url, options = {}) {
    const headers = options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json", ...(options.headers || {}) };
    const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "The operation could not be completed.");
    return data;
}

async function upload(file) {
    if (!file) return "";
    const form = new FormData();
    form.append("file", file);
    return (await api("/api/admin/website/upload", { method: "POST", body: form })).url;
}

const definitions = {
    pages: ["title", "slug"],
    notices: ["title", "category"],
    staff: ["name", "designation"],
    gallery: ["title", "category"],
    routines: ["title", "class_name"],
    downloads: ["title", "category"],
    menu: ["label", "url"]
};

function renderItems(key, items) {
    const list = $("#list-" + key);
    list.innerHTML = items.map((item) => {
        const title = item.title || item.name || item.slug || item.label;
        const detail = item.designation || item.category || item.class_name || item.body ||
            item.content || item.file_url || item.url || "";
        const menuEdit = key === "menu"
            ? '<button class="btn-secondary btn-sm" data-edit="menu" data-id="' + esc(item.id) +
              '" data-label="' + esc(item.label) + '" data-url="' + esc(item.url) + '">Edit</button>'
            : "";
        return '<article class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-3">' +
            '<div class="min-w-0"><b class="text-sm text-slate-900">' + esc(title) + '</b><p class="mt-1 break-words text-xs text-slate-500">' +
            esc(detail) + "</p></div><div class=\"flex flex-wrap gap-2\">" +
            '<button class="btn-secondary btn-sm" data-edit-en="' + key + '" data-id="' + esc(item.id) + '">English Edit</button>' +
            menuEdit +
            '<button class="btn-danger btn-sm" data-delete="' + key + '" data-id="' + esc(item.id) + '">Delete</button></div></article>';
    }).join("") || '<p class="py-4 text-sm text-slate-400">No information available.</p>';
}

function renderAdmissions(admissions, summary) {
    const stats = [
        ["Total Applications", summary.total, "bg-brand-100 text-brand-700"],
        ["Pending", summary.pending, "bg-amber-100 text-amber-700"],
        ["Reviewed", summary.reviewed, "bg-violet-100 text-violet-700"],
        ["Accepted", summary.accepted, "bg-emerald-100 text-emerald-700"],
        ["Rejected", summary.rejected, "bg-red-100 text-red-700"]
    ];
    $("#admission-summary").innerHTML = stats.map(([label, count, tone]) =>
        '<article class="card flex items-center gap-3 !p-4"><div class="flex h-10 w-10 items-center justify-center rounded-xl ' +
        tone + '">' + App.icon("users", "h-5 w-5") + '</div><div><p class="text-xs font-semibold text-slate-500">' +
        label + '</p><p class="text-2xl font-bold text-slate-900">' + esc(count) + "</p></div></article>"
    ).join("");

    const statusLabels = { Pending: "Pending", Reviewed: "Reviewed", Accepted: "Accepted", Rejected: "Rejected" };
    $("#list-admissions").innerHTML = admissions.map((item) =>
        "<tr><td>" + esc(item.application_no || String(item.id).padStart(6, "0")) + '</td><td class="font-semibold text-slate-900">' + esc(item.student_name) +
        (item.student_name_en ? '<small class="block text-slate-500">' + esc(item.student_name_en) + '</small>' : "") +
        "</td><td>" + esc([item.father_name, item.mother_name].filter(Boolean).join(" / ") || item.guardian_name) + "</td><td>" + esc(item.class_name) + "</td><td>" +
        esc(item.phone) + "</td><td>" + esc(App.fmtDate(item.created_at)) + '</td><td><select class="input min-w-32" data-admission="' +
        esc(item.id) + '">' + Object.entries(statusLabels).map(([status, label]) =>
            '<option value="' + status + '"' + (item.status === status ? " selected" : "") + ">" + label + "</option>"
        ).join("") + "</select></td></tr>"
    ).join("") || '<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-slate-400">No admission applications have been submitted yet.</td></tr>';
}

async function refresh() {
    const [siteResponse, admissionsResponse, summaryResponse] = await Promise.all([
        api("/api/admin/website/data"),
        api("/api/admin/website/admissions"),
        api("/api/admin/website/admissions/summary")
    ]);
    const data = siteResponse.data;

    for (const key of Object.keys(definitions)) {
        const table = key === "menu" ? "site_menu_links" : "site_" + key;
        renderItems(key, data[table] || []);
    }

    renderAdmissions(admissionsResponse.items || [], summaryResponse.summary || {});

    $("#list-messages").innerHTML = (data.site_messages || []).map((item) =>
        '<article class="border-t border-slate-100 py-3"><div class="flex flex-wrap items-start justify-between gap-3"><div>' +
        '<b class="text-sm text-slate-900">' + esc(item.subject || item.name) + '</b><p class="mt-1 text-xs text-slate-500">' +
        esc(item.name) + " · " + esc(item.phone) + " · " + esc(item.email) + '</p><p class="mt-2 text-sm text-slate-700">' +
        esc(item.message) + '</p></div><button class="btn-secondary btn-sm" data-read="' + esc(item.id) + '">Mark as Read</button></div></article>'
    ).join("") || '<p class="py-4 text-sm text-slate-400">No messages available.</p>';

    const settingsForm = $("#settingsForm");
    for (const setting of data.site_settings || []) {
        const field = Array.from(settingsForm.elements).find((element) => element.name === setting.key);
        if (field && field.type !== "file") field.value = setting.value || "";
    }
}

$("#settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#settingsMsg");
    const data = Object.fromEntries(new FormData(form));
    try {
        data.logo_url = await upload(form.elements.logo_file.files[0]) || data.logo_url || "";
        data.hero_image_url = await upload(form.elements.hero_file.files[0]) || data.hero_image_url || "";
        data.principal_photo_url = await upload(form.elements.principal_photo_file.files[0]) || data.principal_photo_url || "";
        delete data.logo_file;
        delete data.hero_file;
        const result = await api("/api/admin/website/settings", {
            method: "PUT",
            body: JSON.stringify(data)
        });
        message.textContent = result.message;
        await refresh();
    } catch (error) {
        message.textContent = error.message;
    }
});

document.querySelectorAll("form[data-resource]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const data = Object.fromEntries(new FormData(form));
            for (const [field, target] of Object.entries({
                attachment_file: "attachment_url",
                photo_file: "photo_url",
                image_file: "image_url",
                document_file: "file_url"
            })) {
                const input = form.elements.namedItem(field);
                if (input && input.files[0]) data[target] = await upload(input.files[0]);
                delete data[field];
            }
            form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
                data[checkbox.name] = checkbox.checked;
            });
            await api("/api/admin/website/" + form.dataset.resource, {
                method: "POST",
                body: JSON.stringify(data)
            });
            form.reset();
            await refresh();
            $("#globalMsg").textContent = "Information saved successfully.";
        } catch (error) {
            $("#globalMsg").textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
});

document.addEventListener("click", async (event) => {
    const englishEdit = event.target.closest("[data-edit-en]");
    if (englishEdit) {
        const key = englishEdit.dataset.editEn;
        const fields = {
            pages: ["title_en", "content_en"],
            notices: ["title_en", "category_en", "body_en"],
            staff: ["name_en", "designation_en", "department_en"],
            gallery: ["title_en", "category_en"],
            routines: ["title_en", "class_name_en"],
            downloads: ["title_en", "category_en"],
            menu: ["label_en"]
        }[key] || [];
        try {
            const list = await api("/api/admin/website/" + key);
            const item = (list.items || []).find((row) => String(row.id) === englishEdit.dataset.id);
            if (!item) throw new Error("Record not found");
            const data = {};
            for (const field of fields) {
                const value = prompt("English: " + field, item[field] || "");
                if (value === null) return;
                data[field] = value;
            }
            await api("/api/admin/website/" + key + "/" + englishEdit.dataset.id, {
                method: "PUT",
                body: JSON.stringify(data)
            });
            await refresh();
            $("#globalMsg").textContent = "English content updated.";
        } catch (error) {
            alert(error.message);
        }
        return;
    }

    const menuEdit = event.target.closest('[data-edit="menu"]');
    if (menuEdit) {
        const label = prompt("Menu Label", menuEdit.dataset.label);
        if (label === null) return;
        const url = prompt("Link / URL", menuEdit.dataset.url);
        if (url === null) return;
        try {
            await api("/api/admin/website/menu/" + menuEdit.dataset.id, {
                method: "PUT",
                body: JSON.stringify({ label, url })
            });
            await refresh();
            $("#globalMsg").textContent = "Menu link updated successfully.";
        } catch (error) {
            alert(error.message);
        }
        return;
    }

    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton && await App.confirm("Delete Information", "Are you sure you want to permanently delete this information?", {
        danger: true,
        confirmText: "Delete"
    })) {
        try {
            await api("/api/admin/website/" + deleteButton.dataset.delete + "/" + deleteButton.dataset.id, {
                method: "DELETE"
            });
            await refresh();
        } catch (error) {
            $("#globalMsg").textContent = error.message;
        }
        return;
    }

    const readButton = event.target.closest("[data-read]");
    if (readButton) {
        try {
            await api("/api/admin/website/messages/" + readButton.dataset.read + "/read", {
                method: "PUT",
                body: "{}"
            });
            await refresh();
        } catch (error) {
            $("#globalMsg").textContent = error.message;
        }
    }
});

document.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-admission]");
    if (!select) return;
    try {
        await api("/api/admin/website/admissions/" + select.dataset.admission, {
            method: "PUT",
            body: JSON.stringify({ status: select.value })
        });
        await refresh();
    } catch (error) {
        $("#globalMsg").textContent = error.message;
        await refresh().catch(() => {});
    }
});

App.shell("website").then((user) => {
    if (user) return refresh().catch((error) => { $("#globalMsg").textContent = error.message; });
});
