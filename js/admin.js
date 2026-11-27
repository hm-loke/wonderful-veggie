import {
  collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth, googleProvider, isFirebaseConfigured } from "./firebase-config.js";
import { RESTAURANT_INFO, INITIAL_MENU, INITIAL_PACKAGES } from "./menu-data.js";

// =========================================================================
// AUTHORIZED GMAIL ACCOUNTS (Add your Gmail & your mum's Gmail below)
// =========================================================================
const ALLOWED_ADMIN_EMAILS = [
  "your.email@gmail.com",
  "mum.email@gmail.com"
].map(e => e.toLowerCase());

let menuList = [];
let pkgList = [];

const authGate = document.getElementById("auth-gate");
const adminPanel = document.getElementById("admin-panel");
const authError = document.getElementById("auth-error");
const signedInUserEl = document.getElementById("signed-in-user");

// 1. Firebase Auth State Gate
if (isFirebaseConfigured && auth) {
  onAuthStateChanged(auth, async (user) => {
    const email = (user?.email || "").toLowerCase();
    if (user && ALLOWED_ADMIN_EMAILS.includes(email)) {
      authGate.style.display = "none";
      adminPanel.style.display = "block";
      signedInUserEl.textContent = `Signed in as: ${user.email}`;
      initAdmin();
    } else if (user) {
      authError.textContent = `Access denied for ${user.email}. Add this Gmail to ALLOWED_ADMIN_EMAILS and Firestore Rules.`;
      await signOut(auth);
    } else {
      authGate.style.display = "block";
      adminPanel.style.display = "none";
    }
  });
} else {
  // Local fallback if firebase-config.js keys are not filled yet
  authGate.style.display = "none";
  adminPanel.style.display = "block";
  initAdmin();
}

document.getElementById("google-login-btn").addEventListener("click", async () => {
  authError.textContent = "";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    authError.textContent = err.message;
  }
});

document.getElementById("email-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("admin-email").value.trim();
  const pass = document.getElementById("admin-pass").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    authError.textContent = err.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  if (auth) await signOut(auth);
});

// 2. Load Data
async function initAdmin() {
  const statusEl = document.getElementById("sync-status");
  const noticeEl = document.getElementById("firebase-notice");

  if (isFirebaseConfigured && db) {
    statusEl.textContent = "Connected to Firebase Firestore (Live Cloud Sync)";
    noticeEl.style.display = "none";
    const mSnap = await getDocs(query(collection(db, "wv_menu"), orderBy("order", "asc")));
    menuList = mSnap.empty ? [...INITIAL_MENU] : mSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const pSnap = await getDocs(query(collection(db, "wv_packages"), orderBy("order", "asc")));
    pkgList = pSnap.empty ? [...INITIAL_PACKAGES] : pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    statusEl.textContent = "Local Preview Mode (Configure firebase-config.js for Cloud Sync)";
    noticeEl.style.display = "block";
    const cachedM = localStorage.getItem("wv_menu_cache");
    const cachedP = localStorage.getItem("wv_packages_cache");
    menuList = cachedM ? JSON.parse(cachedM) : [...INITIAL_MENU];
    pkgList = cachedP ? JSON.parse(cachedP) : [...INITIAL_PACKAGES];
  }

  populateDishPicker();
  renderAdminMenu();
  renderAdminPackages();
}

function saveLocalCache() {
  localStorage.setItem("wv_menu_cache", JSON.stringify(menuList));
  localStorage.setItem("wv_packages_cache", JSON.stringify(pkgList));
}

async function persistMenuItem(item) {
  saveLocalCache();
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, "wv_menu", item.id), item);
  }
}

async function persistAllOrder() {
  menuList.forEach((item, idx) => { item.order = idx + 1; });
  saveLocalCache();
  if (isFirebaseConfigured && db) {
    const batch = writeBatch(db);
    menuList.forEach(item => batch.set(doc(db, "wv_menu", item.id), item));
    await batch.commit();
  }
}

// 3. Render Admin Menu Rows with Top / Up / Down / Bottom Buttons
function renderAdminMenu() {
  const listEl = document.getElementById("admin-menu-list");
  const q = document.getElementById("admin-search").value.toLowerCase().trim();
  const cat = document.getElementById("admin-cat-filter").value;

  const filtered = menuList.filter(item => {
    if (cat !== "all" && item.category !== cat) return false;
    if (q && !`${item.code} ${item.nameZh} ${item.nameEn}`.toLowerCase().includes(q)) return false;
    return true;
  });

  listEl.innerHTML = filtered.map(item => {
    const priceText = item.priceType === "sb"
      ? `S: RM${item.priceS} | B: RM${item.priceB}`
      : item.priceType === "drink"
        ? `小热:${item.priceHotS ?? "-"} | 大热:${item.priceHotB ?? "-"} | 冰:${item.priceCold ?? "-"}`
        : `RM ${item.price}`;

    return `
      <div class="admin-row">
        <img src="${item.image || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3Crect width='100%25' height='100%25' fill='%23f8f3e8'/%3E%3Ctext x='50%25' y='54%25' font-size='11' text-anchor='middle' fill='%238e1319'%3ENo Photo%3C/text%3E%3C/svg%3E"}" class="thumb-preview" alt="" />
        <div>
          <strong>[${item.code}] ${item.nameZh} · ${item.nameEn}</strong>
          <div style="font-size:0.85rem;color:var(--crimson-dark);font-weight:700;">${priceText}</div>
          <div style="font-size:0.78rem;color:var(--muted);">
            Category: ${item.category} ${item.soldOut ? "· ⚠️ SOLD OUT" : ""}
          </div>
        </div>
        <div class="row-actions">
          <button type="button" class="move-btn" data-action="top" data-id="${item.id}" title="Move to Top">Top</button>
          <button type="button" class="move-btn" data-action="up" data-id="${item.id}" title="Move Up">↑</button>
          <button type="button" class="move-btn" data-action="down" data-id="${item.id}" title="Move Down">↓</button>
          <button type="button" class="move-btn" data-action="bottom" data-id="${item.id}" title="Move to Bottom">Bottom</button>
          <button type="button" class="btn btn-gold btn-sm edit-btn" data-id="${item.id}">Edit</button>
          <button type="button" class="btn btn-outline btn-sm del-btn" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".move-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = menuList.findIndex(x => x.id === btn.dataset.id);
      if (idx === -1) return;
      const [item] = menuList.splice(idx, 1);
      const act = btn.dataset.action;
      if (act === "top") menuList.unshift(item);
      else if (act === "bottom") menuList.push(item);
      else if (act === "up") menuList.splice(Math.max(0, idx - 1), 0, item);
      else if (act === "down") menuList.splice(Math.min(menuList.length, idx + 1), 0, item);

      renderAdminMenu();
      await persistAllOrder();
    });
  });

  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => openDishModal(menuList.find(x => x.id === btn.dataset.id)));
  });

  document.querySelectorAll(".del-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this dish?")) return;
      const id = btn.dataset.id;
      menuList = menuList.filter(x => x.id !== id);
      saveLocalCache();
      renderAdminMenu();
      if (isFirebaseConfigured && db) await deleteDoc(doc(db, "wv_menu", id));
    });
  });
}

// 4. Dish Modal & Client-Side Photo Compressor
const dishModal = document.getElementById("dish-modal");
const priceTypeSelect = document.getElementById("edit-price-type");

function togglePriceInputs(type) {
  document.getElementById("price-fields-single").style.display = type === "single" ? "block" : "none";
  document.getElementById("price-fields-sb").style.display = type === "sb" ? "grid" : "none";
  document.getElementById("price-fields-drink").style.display = type === "drink" ? "grid" : "none";
}

priceTypeSelect.addEventListener("change", (e) => togglePriceInputs(e.target.value));

function openDishModal(item = null) {
  document.getElementById("dish-modal-title").textContent = item ? `Edit ${item.code}` : "Add New Dish";
  document.getElementById("edit-dish-id").value = item ? item.id : `item-${Date.now()}`;
  document.getElementById("edit-code").value = item?.code || "";
  document.getElementById("edit-category").value = item?.category || "dishes";
  document.getElementById("edit-name-zh").value = item?.nameZh || "";
  document.getElementById("edit-name-en").value = item?.nameEn || "";
  const pType = item?.priceType || "single";
  priceTypeSelect.value = pType;
  togglePriceInputs(pType);

  document.getElementById("edit-price-single").value = item?.price ?? "";
  document.getElementById("edit-price-s").value = item?.priceS ?? "";
  document.getElementById("edit-price-b").value = item?.priceB ?? "";
  document.getElementById("edit-price-hs").value = item?.priceHotS ?? "";
  document.getElementById("edit-price-hb").value = item?.priceHotB ?? "";
  document.getElementById("edit-price-cold").value = item?.priceCold ?? "";
  document.getElementById("edit-spicy").value = item?.spicy ?? 0;
  document.getElementById("edit-eggfree").checked = item ? !!item.eggFree : true;
  document.getElementById("edit-preorder").checked = !!item?.preorder;
  document.getElementById("edit-soldout").checked = !!item?.soldOut;
  document.getElementById("edit-photo-url").value = item?.image || "";
  document.getElementById("edit-photo-file").value = "";
  dishModal.classList.remove("hidden");
}

document.getElementById("add-new-dish-btn").addEventListener("click", () => openDishModal(null));
document.getElementById("close-dish-modal").addEventListener("click", () => dishModal.classList.add("hidden"));

function compressImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 560;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.78));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById("dish-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-dish-id").value;
  const fileInput = document.getElementById("edit-photo-file");
  let imageVal = document.getElementById("edit-photo-url").value.trim();

  if (fileInput.files && fileInput.files[0]) {
    imageVal = await compressImageFile(fileInput.files[0]);
  }

  const pType = priceTypeSelect.value;
  const existingIdx = menuList.findIndex(x => x.id === id);
  const updated = {
    id,
    code: document.getElementById("edit-code").value.trim(),
    category: document.getElementById("edit-category").value,
    nameZh: document.getElementById("edit-name-zh").value.trim(),
    nameEn: document.getElementById("edit-name-en").value.trim(),
    priceType: pType,
    price: Number(document.getElementById("edit-price-single").value || 0),
    priceS: Number(document.getElementById("edit-price-s").value || 0),
    priceB: Number(document.getElementById("edit-price-b").value || 0),
    priceHotS: document.getElementById("edit-price-hs").value === "" ? null : Number(document.getElementById("edit-price-hs").value),
    priceHotB: document.getElementById("edit-price-hb").value === "" ? null : Number(document.getElementById("edit-price-hb").value),
    priceCold: document.getElementById("edit-price-cold").value === "" ? null : Number(document.getElementById("edit-price-cold").value),
    spicy: Number(document.getElementById("edit-spicy").value),
    eggFree: document.getElementById("edit-eggfree").checked,
    preorder: document.getElementById("edit-preorder").checked,
    soldOut: document.getElementById("edit-soldout").checked,
    image: imageVal,
    order: existingIdx >= 0 ? menuList[existingIdx].order : menuList.length + 1
  };

  if (existingIdx >= 0) menuList[existingIdx] = updated;
  else menuList.unshift(updated);

  dishModal.classList.add("hidden");
  renderAdminMenu();
  populateDishPicker();
  await persistMenuItem(updated);
});

// 5. Festive / CNY Packages Manager
function populateDishPicker() {
  const picker = document.getElementById("menu-dish-picker");
  picker.innerHTML = menuList.map(m =>
    `<option value="${m.nameEn} (${m.nameZh})">[${m.code}] ${m.nameZh} · ${m.nameEn}</option>`
  ).join("");
}

document.getElementById("append-dish-to-pkg").addEventListener("click", () => {
  const val = document.getElementById("menu-dish-picker").value;
  const area = document.getElementById("pkg-items-text");
  area.value = area.value ? `${area.value.trim()}\n${val}` : val;
});

function renderAdminPackages() {
  const el = document.getElementById("admin-pkg-list");
  el.innerHTML = pkgList.map(pkg => `
    <div class="admin-row" style="grid-template-columns:1fr auto;">
      <div>
        <strong>${pkg.titleEn} · ${pkg.titleZh || ""}</strong>
        <div style="color:var(--crimson);font-weight:800;">RM ${Number(pkg.price).toFixed(2)} · ${pkg.active ? "✅ Visible on Site" : "🙈 Hidden"}</div>
        <div style="font-size:0.82rem;color:var(--muted);">${(pkg.items || []).join(" | ")}</div>
      </div>
      <div class="row-actions">
        <button type="button" class="btn btn-gold btn-sm edit-pkg-btn" data-id="${pkg.id}">Edit</button>
        <button type="button" class="btn btn-outline btn-sm del-pkg-btn" data-id="${pkg.id}">Delete</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-pkg-btn").forEach(btn => {
    btn.addEventListener("click", () => openPkgModal(pkgList.find(p => p.id === btn.dataset.id)));
  });

  document.querySelectorAll(".del-pkg-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this package?")) return;
      const id = btn.dataset.id;
      pkgList = pkgList.filter(p => p.id !== id);
      saveLocalCache();
      renderAdminPackages();
      if (isFirebaseConfigured && db) await deleteDoc(doc(db, "wv_packages", id));
    });
  });
}

const editPkgModal = document.getElementById("edit-pkg-modal");
function openPkgModal(pkg = null) {
  document.getElementById("pkg-id").value = pkg ? pkg.id : `pkg-${Date.now()}`;
  document.getElementById("pkg-active").checked = pkg ? !!pkg.active : true;
  document.getElementById("pkg-badge").value = pkg?.badge || "CNY / Festive Set";
  document.getElementById("pkg-price").value = pkg?.price ?? 388;
  document.getElementById("pkg-title-en").value = pkg?.titleEn || "";
  document.getElementById("pkg-title-zh").value = pkg?.titleZh || "";
  document.getElementById("pkg-items-text").value = (pkg?.items || []).join("\n");
  document.getElementById("pkg-notes").value = pkg?.notes || "";
  editPkgModal.classList.remove("hidden");
}

document.getElementById("add-new-pkg-btn").addEventListener("click", () => openPkgModal(null));
document.getElementById("close-edit-pkg-modal").addEventListener("click", () => editPkgModal.classList.add("hidden"));

document.getElementById("admin-pkg-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("pkg-id").value;
  const idx = pkgList.findIndex(p => p.id === id);
  const updated = {
    id,
    active: document.getElementById("pkg-active").checked,
    badge: document.getElementById("pkg-badge").value.trim(),
    price: Number(document.getElementById("pkg-price").value),
    titleEn: document.getElementById("pkg-title-en").value.trim(),
    titleZh: document.getElementById("pkg-title-zh").value.trim(),
    items: document.getElementById("pkg-items-text").value.split("\n").map(s => s.trim()).filter(Boolean),
    notes: document.getElementById("pkg-notes").value.trim(),
    order: idx >= 0 ? pkgList[idx].order : pkgList.length + 1
  };
  if (idx >= 0) pkgList[idx] = updated;
  else pkgList.push(updated);

  saveLocalCache();
  editPkgModal.classList.add("hidden");
  renderAdminPackages();
  if (isFirebaseConfigured && db) await setDoc(doc(db, "wv_packages", id), updated);
});

// 6. View Switchers, Cloud Seed & Unified File Backups (.js & .json)
document.getElementById("tab-manage-menu").addEventListener("click", () => {
  document.getElementById("menu-manager-view").style.display = "block";
  document.getElementById("pkg-manager-view").style.display = "none";
});

document.getElementById("tab-manage-pkgs").addEventListener("click", () => {
  document.getElementById("menu-manager-view").style.display = "none";
  document.getElementById("pkg-manager-view").style.display = "block";
});

document.getElementById("admin-search").addEventListener("input", renderAdminMenu);
document.getElementById("admin-cat-filter").addEventListener("change", renderAdminMenu);

document.getElementById("seed-cloud-btn").addEventListener("click", async () => {
  if (!isFirebaseConfigured || !db) {
    alert("Please paste your Firebase project config into js/firebase-config.js first!");
    return;
  }
  if (!confirm(`Upload all ${menuList.length} menu items and ${pkgList.length} packages to Firebase Firestore?`)) return;
  const batch = writeBatch(db);
  menuList.forEach((item, i) => {
    item.order = i + 1;
    batch.set(doc(db, "wv_menu", item.id), item);
  });
  pkgList.forEach((pkg, i) => {
    pkg.order = i + 1;
    batch.set(doc(db, "wv_packages", pkg.id), pkg);
  });
  await batch.commit();
  alert("All menu items and packages synced to Firebase Firestore!");
});

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("export-js-btn").addEventListener("click", () => {
  const jsContent = [
    `// Wonderful Veggie Backup Snapshot (${new Date().toISOString()})`,
    `export const RESTAURANT_INFO = ${JSON.stringify(RESTAURANT_INFO, null, 2)};`,
    `export const INITIAL_PACKAGES = ${JSON.stringify(pkgList, null, 2)};`,
    `export const INITIAL_MENU = ${JSON.stringify(menuList, null, 2)};`
  ].join("\n\n");
  triggerDownload("menu-data.js", jsContent, "application/javascript");
});

document.getElementById("export-json-btn").addEventListener("click", () => {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), packages: pkgList, menu: menuList }, null, 2);
  triggerDownload(`wonderful-veggie-backup-${new Date().toISOString().slice(0, 10)}.json`, payload, "application/json");
});

document.getElementById("restore-json-input").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data.menu)) menuList = data.menu;
      if (Array.isArray(data.packages)) pkgList = data.packages;
      saveLocalCache();
      renderAdminMenu();
      renderAdminPackages();
      alert("Backup restored locally! Click 'Seed / Sync Full Menu to Cloud' if using Firebase.");
    } catch {
      alert("Invalid JSON backup file.");
    }
  };
  reader.readAsText(file);
});