const state = {
  ornaments: [],
  filtered: [],
};

const els = {
  collectionCount: document.getElementById("collectionCount"),
  searchInput: document.getElementById("searchInput"),
  seriesFilter: document.getElementById("seriesFilter"),
  featuredGrid: document.getElementById("featuredGrid"),
  galleryGrid: document.getElementById("galleryGrid"),
  resultsCount: document.getElementById("resultsCount"),
  detailModal: document.getElementById("detailModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  modalTitle: document.getElementById("modalTitle"),
  modalImage: document.getElementById("modalImage"),
  modalMeta: document.getElementById("modalMeta"),
  modalDetails: document.getElementById("modalDetails"),
};

function currency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function rarityForValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Unknown";
  if (value >= 50) return "Museum";
  if (value >= 30) return "Rare";
  if (value >= 15) return "Notable";
  return "Classic";
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

function renderFeatured(ornaments) {
  const top = ornaments
    .filter((o) => typeof o.approx_retail_usd === "number")
    .sort((a, b) => b.approx_retail_usd - a.approx_retail_usd)
    .slice(0, 10);

  els.featuredGrid.innerHTML = "";
  if (!top.length) {
    const p = document.createElement("p");
    p.className = "text-slate-500 text-sm";
    p.textContent = "No approx_retail_usd values found in current data.";
    els.featuredGrid.appendChild(p);
    return;
  }

  for (const item of top) {
    const card = document.createElement("button");
    card.className =
      "text-left rounded-xl border border-slate-200 p-3 hover:shadow-md transition bg-white";
    card.innerHTML = `
      <div class="aspect-square rounded-lg overflow-hidden bg-slate-100 mb-3">
        <img src="./${item.image_path || ""}" alt="${item.name}" class="w-full h-full object-cover" />
      </div>
      <p class="text-xs uppercase tracking-wide text-slate-500">${item.code || "No code"}</p>
      <h4 class="font-medium text-sm line-clamp-2 min-h-[2.5rem]">${item.name}</h4>
      <div class="mt-2 flex items-center justify-between">
        <span class="text-sm font-semibold">${currency(item.approx_retail_usd)}</span>
        <span class="text-[11px] px-2 py-1 rounded-full bg-slate-900 text-white">${rarityForValue(
          item.approx_retail_usd
        )}</span>
      </div>
    `;
    card.addEventListener("click", () => openModal(item));
    els.featuredGrid.appendChild(card);
  }
}

function renderGallery(ornaments) {
  els.galleryGrid.innerHTML = "";
  els.resultsCount.textContent = `${ornaments.length} ornaments`;

  for (const item of ornaments) {
    const card = document.createElement("button");
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

function openModal(item) {
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
}

function closeModal() {
  els.detailModal.classList.add("hidden");
  els.detailModal.classList.remove("flex");
  els.detailModal.setAttribute("aria-hidden", "true");
}

function applyFilters() {
  const query = els.searchInput.value || "";
  const series = els.seriesFilter.value || "";
  state.filtered = state.ornaments.filter((o) => ornamentMatches(o, query, series));
  renderGallery(state.filtered);
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
  renderFeatured(state.ornaments);
  applyFilters();

  if (els.searchInput) els.searchInput.addEventListener("input", applyFilters);
  if (els.seriesFilter) els.seriesFilter.addEventListener("change", applyFilters);
  if (els.closeModalBtn) els.closeModalBtn.addEventListener("click", closeModal);
  if (els.detailModal) {
    els.detailModal.addEventListener("click", (e) => {
      if (e.target === els.detailModal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

init().catch((err) => {
  console.error(err);
  els.galleryGrid.innerHTML =
    '<p class="text-red-600">Failed to load data.json. Run build_data.py first.</p>';
});

