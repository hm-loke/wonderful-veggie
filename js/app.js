import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, isFirebaseConfigured } from "./firebase-config.js";
import { RESTAURANT_INFO, INITIAL_MENU, INITIAL_PACKAGES } from "./menu-data.js";

let menuItems = [];
let packages = [];
let currentLang = "en";
let activeCategory = "all";
let activeDiet = "all";
let searchQuery = "";

function waUrl(text) {
  return `https://wa.me/${RESTAURANT_INFO.whatsapp}?text=${encodeURIComponent(text)}`;
}

// 1. Load Data (Firestore -> LocalStorage -> menu-data.js)
async function loadRestaurantData() {
  if (isFirebaseConfigured && db) {
    try {
      const menuSnap = await getDocs(query(collection(db, "wv_menu"), orderBy("order", "asc")));
      if (!menuSnap.empty) {
        menuItems = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const pkgSnap = await getDocs(query(collection(db, "wv_packages"), orderBy("order", "asc")));
      if (!pkgSnap.empty) {
        packages = pkgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.warn("Firestore read fallback:", err);
    }
  }

  if (menuItems.length === 0) {
    const localMenu = localStorage.getItem("wv_menu_cache");
    menuItems = localMenu ? JSON.parse(localMenu) : INITIAL_MENU;
  }
  if (packages.length === 0) {
    const localPkgs = localStorage.getItem("wv_packages_cache");
    packages = localPkgs ? JSON.parse(localPkgs) : INITIAL_PACKAGES;
  }

  renderPackages();
  renderMenu();
}

// 2. Render Festive / CNY Packages
function renderPackages() {
  const section = document.getElementById("packages");
  const navLink = document.getElementById("nav-packages-link");
  const grid = document.getElementById("packages-grid");
  const activePkgs = packages.filter(p => p.active);

  if (activePkgs.length === 0) {
    section.style.display = "none";
    if (navLink) navLink.style.display = "none";
    return;
  }

  section.style.display = "block";
  if (navLink) navLink.style.display = "inline";

  grid.innerHTML = activePkgs.map(pkg => `
    <article class="pkg-card">
      <div>
        <span class="pkg-badge">${pkg.badge || "Special Set"}</span>
        <h3 class="pkg-title">${pkg.titleEn}</h3>
        <div class="pkg-zh">${pkg.titleZh || ""}</div>
        <div class="pkg-price">RM ${Number(pkg.price).toFixed(2)}</div>
        <ul class="pkg-items">
          ${(pkg.items || []).map(line => `<li>${line}</li>`).join("")}
        </ul>
        ${pkg.notes ? `<p style="font-size:0.84rem;color:var(--muted);margin-bottom:1rem;">${pkg.notes}</p>` : ""}
      </div>
      <button type="button" class="btn btn-primary btn-full book-pkg-btn"
        data-title="${pkg.titleEn} (${pkg.titleZh || ""})"
        data-price="RM ${Number(pkg.price).toFixed(2)}">
        ${currentLang === "zh" ? "立即 WhatsApp 预订套餐" : "Book Package via WhatsApp"}
      </button>
    </article>
  `).join("");

  document.querySelectorAll(".book-pkg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("modal-pkg-title").textContent = btn.dataset.title;
      document.getElementById("modal-pkg-price").textContent = btn.dataset.price;
      document.getElementById("selected-pkg-name").value = btn.dataset.title;
      document.getElementById("selected-pkg-price").value = btn.dataset.price;
      document.getElementById("pkg-modal").classList.remove("hidden");
    });
  });
}

// 3. Render Menu Cards
function formatPrices(item) {
  if (item.priceType === "sb") {
    return `
      <span class="price-pill">S(小) RM ${Number(item.priceS).toFixed(2)}</span>
      <span class="price-pill">B(大) RM ${Number(item.priceB).toFixed(2)}</span>
    `;
  }
  if (item.priceType === "drink") {
    const parts = [];
    if (item.priceHotS != null && item.priceHotS !== "") parts.push(`<span class="price-pill">小热 RM ${Number(item.priceHotS).toFixed(2)}</span>`);
    if (item.priceHotB != null && item.priceHotB !== "") parts.push(`<span class="price-pill">大热 RM ${Number(item.priceHotB).toFixed(2)}</span>`);
    if (item.priceCold != null && item.priceCold !== "") parts.push(`<span class="price-pill">冰 RM ${Number(item.priceCold).toFixed(2)}</span>`);
    return parts.join("");
  }
  return `<span class="price-pill">RM ${Number(item.price).toFixed(2)}</span>`;
}

function renderMenu() {
  const grid = document.getElementById("menu-grid");
  const countEl = document.getElementById("menu-count");
  const q = searchQuery.toLowerCase();

  const filtered = menuItems.filter(item => {
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    if (activeDiet === "egg-free" && !item.eggFree) return false;
    if (activeDiet === "spicy" && !(item.spicy > 0)) return false;
    if (activeDiet === "preorder" && !item.preorder) return false;
    if (q) {
      const hay = `${item.code} ${item.nameZh} ${item.nameEn}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  countEl.textContent = currentLang === "zh"
    ? `显示 ${filtered.length} 道菜品`
    : `Showing ${filtered.length} items`;

  grid.innerHTML = filtered.map(item => `
    <article class="menu-card ${item.soldOut ? "sold-out" : ""}">
      <div>
        ${item.image ? `<img src="${item.image}" alt="${item.nameEn}" class="dish-img" loading="lazy" />` : ""}
        <div class="code-row">
          <span class="dish-code">${item.code}</span>
          ${item.soldOut ? `<span class="tag soldout">Sold Out / 售罄</span>` : ""}
        </div>
        <div class="dish-zh">${item.nameZh}</div>
        <div class="dish-en">${item.nameEn}</div>

        <div class="tag-row">
          ${item.eggFree ? `<span class="tag vegan">Egg-Free / 纯素</span>` : `<span class="tag egg">Contains Egg/Dairy</span>`}
          ${item.spicy > 0 ? `<span class="tag spicy">${"🌶️".repeat(item.spicy)} Spicy</span>` : ""}
          ${item.preorder ? `<span class="tag preorder">Pre-Order 预定</span>` : ""}
        </div>
      </div>
      <div class="price-box">${formatPrices(item)}</div>
    </article>
  `).join("");
}

// 4. Event Listeners
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.cat;
    renderMenu();
  });
});

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeDiet = chip.dataset.diet;
    renderMenu();
  });
});

document.getElementById("menu-search").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  renderMenu();
});

// Export Menu to PDF (Preserves crisp Chinese + English typography via Print stylesheet)
document.getElementById("export-pdf-btn").addEventListener("click", () => {
  window.print();
});

// Bilingual UI Toggle
document.getElementById("lang-toggle").addEventListener("click", () => {
  currentLang = currentLang === "en" ? "zh" : "en";
  document.querySelectorAll("[data-en]").forEach(el => {
    el.textContent = el.dataset[currentLang];
  });
  renderPackages();
  renderMenu();
});

// Booking Mode Switch (Dine-In vs Self-Pickup)
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.dataset.mode;
    document.getElementById("booking-mode").value = mode;
    document.getElementById("pax-row").style.display = mode.includes("Pickup") ? "none" : "grid";
  });
});

// General Table / Pickup WhatsApp Form
document.getElementById("booking-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const mode = document.getElementById("booking-mode").value;
  const name = document.getElementById("cust-name").value.trim();
  const date = document.getElementById("cust-date").value;
  const time = document.getElementById("cust-time").value;
  const pax = document.getElementById("cust-pax").value;
  const diet = document.getElementById("cust-diet").value;
  const notes = document.getElementById("cust-notes").value.trim();

  const lines = [
    `Hi Wonderful Veggie (满福德素食馆)!`,
    `Request: *${mode}*`,
    `• Name: ${name}`,
    `• Date: ${date}`,
    `• Time: ${time}`,
    !mode.includes("Pickup") ? `• Pax: ${pax}` : null,
    !mode.includes("Pickup") ? `• Dietary: ${diet}` : null,
    notes ? `• Order / Notes: ${notes}` : null
  ].filter(Boolean).join("\n");

  window.open(waUrl(lines), "_blank", "noopener");
});

// Package Modal Booking Form
document.getElementById("close-pkg-modal").addEventListener("click", () => {
  document.getElementById("pkg-modal").classList.add("hidden");
});

document.getElementById("pkg-booking-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const pkgTitle = document.getElementById("selected-pkg-name").value;
  const pkgPrice = document.getElementById("selected-pkg-price").value;
  const name = document.getElementById("pkg-cust-name").value.trim();
  const date = document.getElementById("pkg-date").value;
  const time = document.getElementById("pkg-time").value;
  const type = document.getElementById("pkg-type").value;
  const qty = document.getElementById("pkg-qty").value;
  const notes = document.getElementById("pkg-notes").value.trim();

  const lines = [
    `Hi Wonderful Veggie (满福德素食馆)! I would like to book a Festive Package:`,
    `• Package: *${pkgTitle}* (${pkgPrice})`,
    `• Quantity: ${qty} set(s)`,
    `• Type: ${type}`,
    `• Name: ${name}`,
    `• Date: ${date} at ${time}`,
    notes ? `• Notes: ${notes}` : null
  ].filter(Boolean).join("\n");

  document.getElementById("pkg-modal").classList.add("hidden");
  window.open(waUrl(lines), "_blank", "noopener");
});

// General WhatsApp Links & Live Operating Status
const generalWa = waUrl("Hi Wonderful Veggie (满福德素食馆)! I have a general enquiry.");
["hero-wa-btn", "floating-wa", "direct-wa-link"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.href = generalWa;
});

function updateLiveHours() {
  const now = new Date();
  const h = now.getHours();
  const isOpen = h >= RESTAURANT_INFO.openHour && h < RESTAURANT_INFO.closeHour;
  document.getElementById("live-status").textContent = isOpen
    ? "Open Now · Closes 10:00 PM"
    : "Closed Now · Opens 8:00 AM";
}

updateLiveHours();
loadRestaurantData();