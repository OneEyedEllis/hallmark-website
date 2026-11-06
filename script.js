const state = {
  ornaments: [],
  filtered: [],
};

const CSV_FIELDS = [
  "code",
  "upc",
  "name",
  "year",
  "series",
  "approx_retail_usd",
  "description",
  "page_url",
];

const els = {
  downloadCatalogBtn: document.getElementById("downloadCatalogBtn"),
  collectionCount: document.getElementById("collectionCount"),
  searchInput: document.getElementById("searchInput"),
  seriesFilter: document.getElementById("seriesFilter"),
  galleryGrid: document.getElementById("galleryGrid"),
  resultsCount: document.getElementById("resultsCount"),
  highlightLightbox: document.getElementById("highlightLightbox"),
  highlightLightboxImage: document.getElementById("highlightLightboxImage"),
  highlightLightboxCaption: document.getElementById("highlightLightboxCaption"),
  closeHighlightBtn: document.getElementById("closeHighlightBtn"),
  detailModal: document.getElementById("detailModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  modalTitle: document.getElementById("modalTitle"),
  modalImage: document.getElementById("modalImage"),
  modalMeta: document.getElementById("modalMeta"),
  modalDetails: document.getElementById("modalDetails"),
};

function ornamentIdFromHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function pageUrlFor(id) {
  return `${location.origin}${location.pathname}#${id}`;
}

function setOrnamentHash(id) {
  const next = id ? `#${id}` : "";
  if ((location.hash || "") === next) return;
  const y = window.scrollY;
  if (id) {
    location.hash = id;
  } else {
    history.pushState(null, "", `${location.pathname}${location.search}`);
  }
  window.scrollTo(0, y);
}

function buildSeriesOptions(ornaments) {
  const values = Array.from(
    new Set(ornaments.map((o) => (o.series || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  for (const series of values) {
    const opt = document.createElement("option");
    opt.value = series;
    opt.textContent = series;
    els.seriesFilter.appendChild(opt);
  }
}

function ornamentMatches(ornament, query, series) {
  const q = query.trim().toLowerCase();
  const inSeries = !series || (ornament.series || "") === series;
  if (!inSeries) return false;
  if (!q) return true;

  const haystack = [
    ornament.name,
    ornament.year,
    ornament.code,
    ornament.upc,
    ornament.series,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function renderGallery(ornaments) {
  els.galleryGrid.innerHTML = "";
  els.resultsCount.textContent = `${ornaments.length} ornaments`;

  for (const item of ornaments) {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "group text-left rounded-xl border border-slate-200 overflow-hidden bg-white hover:shadow-lg hover:-translate-y-0.5 transition";
    card.innerHTML = `
      <div class="aspect-[4/3] bg-slate-100 overflow-hidden">
        <img
          src="./${item.image_path || ""}"
          alt="${item.name}"
          class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
      </div>
      <div class="p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs uppercase tracking-wide text-slate-500">${item.year || "Year n/a"}</span>
          <span class="text-xs text-slate-500">${item.series || "General"}</span>
        </div>
        <h4 class="mt-1 font-medium text-slate-900 line-clamp-2 min-h-[2.8rem]">${item.name}</h4>
        <div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-slate-600">${item.code || item.upc || "Uncoded"}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openModal(item));
    els.galleryGrid.appendChild(card);
  }
}

function openModal(item, { updateHash = true } = {}) {
  els.modalTitle.textContent = item.name;
  els.modalImage.src = `./${item.image_path || ""}`;
  els.modalImage.alt = item.name;
  els.modalMeta.innerHTML = `
    <p><strong>Code:</strong> ${item.code || "—"}</p>
    <p><strong>UPC:</strong> ${item.upc || "—"}</p>
    <p><strong>Year:</strong> ${item.year || "—"}</p>
    <p><strong>Series:</strong> ${item.series || "—"}</p>
    ${item.description ? `<p><strong>Description:</strong> ${item.description}</p>` : ""}
  `;

  els.modalDetails.innerHTML = "";
  const hiddenDetailKeys = new Set([
    "source_url",
    "photo_filename",
    "recorded_at",
    "approx_value_usd",
    "approx_retail_usd",
    "approximage_value",
    "source",
  ]);
  for (const [k, v] of Object.entries(item.details || {})) {
    if (hiddenDetailKeys.has(k)) continue;
    const row = document.createElement("div");
    row.className = "grid grid-cols-2 gap-3 border-b border-slate-100 py-1";
    row.innerHTML = `<dt class="text-slate-500">${k}</dt><dd class="text-slate-800 break-words">${
      v || "—"
    }</dd>`;
    els.modalDetails.appendChild(row);
  }

  els.detailModal.classList.remove("hidden");
  els.detailModal.classList.add("flex");
  els.detailModal.setAttribute("aria-hidden", "false");

  if (updateHash) setOrnamentHash(item.id);
}

function closeModal({ updateHash = true } = {}) {
  els.detailModal.classList.add("hidden");
  els.detailModal.classList.remove("flex");
  els.detailModal.setAttribute("aria-hidden", "true");
  if (updateHash) setOrnamentHash("");
}

function syncModalToHash() {
  if (!state.ornaments.length) return;
  const id = ornamentIdFromHash();
  if (!id) {
    closeModal({ updateHash: false });
    return;
  }
  const item = state.ornaments.find((o) => o.id === id);
  if (item) openModal(item, { updateHash: false });
}

function applyFilters() {
  const query = els.searchInput.value || "";
  const series = els.seriesFilter.value || "";
  state.filtered = state.ornaments.filter((o) => ornamentMatches(o, query, series));
  renderGallery(state.filtered);
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCatalog() {
  const lines = [CSV_FIELDS.join(",")];
  for (const item of state.ornaments) {
    const row = {
      code: item.code,
      upc: item.upc,
      name: item.name,
      year: item.year,
      series: item.series,
      approx_retail_usd: item.approx_retail_usd ?? "",
      description: item.description,
      page_url: pageUrlFor(item.id),
    };
    lines.push(CSV_FIELDS.map((key) => csvEscape(row[key])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "catalog_all_ornaments.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openHighlight(button) {
  els.highlightLightboxImage.src = button.dataset.src || "";
  els.highlightLightboxImage.alt = button.dataset.alt || "";
  els.highlightLightboxCaption.textContent = button.dataset.caption || "";
  els.highlightLightbox.classList.remove("hidden");
  els.highlightLightbox.classList.add("flex");
  els.highlightLightbox.setAttribute("aria-hidden", "false");
}

function closeHighlight() {
  els.highlightLightbox.classList.add("hidden");
  els.highlightLightbox.classList.remove("flex");
  els.highlightLightbox.setAttribute("aria-hidden", "true");
  els.highlightLightboxImage.src = "";
}

function bindHighlights() {
  for (const button of document.querySelectorAll("[data-highlight]")) {
    button.addEventListener("click", () => openHighlight(button));
  }
  if (els.closeHighlightBtn) els.closeHighlightBtn.addEventListener("click", closeHighlight);
  if (els.highlightLightbox) {
    els.highlightLightbox.addEventListener("click", (event) => {
      if (event.target === els.highlightLightbox) closeHighlight();
    });
  }
}

async function init() {
  const res = await fetch("./data.json");
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while loading data.json`);
  }
  const data = await res.json();
  state.ornaments = data.ornaments || [];

  if (els.collectionCount) {
    els.collectionCount.textContent = `${state.ornaments.length} total ornaments`;
  }
  buildSeriesOptions(state.ornaments);
  applyFilters();
  syncModalToHash();

  if (els.downloadCatalogBtn) {
    els.downloadCatalogBtn.disabled = false;
    els.downloadCatalogBtn.addEventListener("click", downloadCatalog);
  }
}

bindHighlights();
window.addEventListener("hashchange", syncModalToHash);
window.addEventListener("popstate", syncModalToHash);

if (els.searchInput) els.searchInput.addEventListener("input", applyFilters);
if (els.seriesFilter) els.seriesFilter.addEventListener("change", applyFilters);
if (els.closeModalBtn) els.closeModalBtn.addEventListener("click", () => closeModal());
if (els.detailModal) {
  els.detailModal.addEventListener("click", (e) => {
    if (e.target === els.detailModal) closeModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (els.highlightLightbox && !els.highlightLightbox.classList.contains("hidden")) {
    closeHighlight();
    return;
  }
  closeModal();
});

init().catch((err) => {
  console.error(err);
  els.galleryGrid.innerHTML =
    '<p class="text-red-600">Failed to load data.json. Run build_data.py first.</p>';
});
