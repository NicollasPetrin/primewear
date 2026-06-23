const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const state = {
  settings: null,
  products: [],
  carouselIndexes: {},
  dialogProductId: null,
  dialogImageIndex: 0,
  filters: {
    search: "",
    group: "",
    category: "",
    brand: "",
    size: "",
    color: "",
    sort: "featured"
  }
};

const elements = {
  grid: document.querySelector("#productGrid"),
  empty: document.querySelector("#emptyState"),
  count: document.querySelector("#catalogCount"),
  filtersForm: document.querySelector("#catalogFilters"),
  filterDrawer: document.querySelector("#filterDrawer"),
  filterOverlay: document.querySelector("#filterOverlay"),
  openFilters: document.querySelector("#openFiltersButton"),
  closeFilters: document.querySelector("#closeFiltersButton"),
  filterGroups: document.querySelector("#filterGroups"),
  activeFilterCount: document.querySelector("#activeFilterCount"),
  clearFilters: document.querySelector("#clearFiltersButton"),
  search: document.querySelector("#searchInput"),
  category: document.querySelector("#categoryFilter"),
  brand: document.querySelector("#brandFilter"),
  size: document.querySelector("#sizeFilter"),
  color: document.querySelector("#colorFilter"),
  sort: document.querySelector("#sortFilter"),
  dialog: document.querySelector("#productDialog"),
  dialogBody: document.querySelector("#dialogBody"),
  closeDialog: document.querySelector("#closeDialog"),
  instagram: document.querySelector("#instagramLink"),
  address: document.querySelector("#storeAddress")
};

init();

async function init() {
  try {
    const [settings, products] = await Promise.all([
      fetchJson("/api/settings"),
      fetchJson("/api/products")
    ]);

    state.settings = settings;
    state.products = products;
    applySettings(settings);
    buildFilters(products);
    bindEvents();
    renderProducts();
    openProductFromPath();
  } catch (error) {
    elements.count.textContent = "Não foi possível carregar o catálogo.";
    console.error(error);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Falha ao carregar dados.");
  }

  return response.json();
}

function applySettings(settings) {
  document.title = `Catálogo | ${settings.storeName}`;

  document.querySelectorAll("[data-store-name]").forEach((node) => {
    node.textContent = settings.storeName;
  });

  document.querySelector("[data-store-tagline]").textContent = settings.tagline;
  document.querySelector("[data-store-notice]").textContent = settings.notice;

  const heroImage = document.querySelector("[data-hero-image]");
  heroImage.src = settings.heroImage || "/assets/boutique-hero.png";

  const whatsappUrl = buildWhatsappUrl("Olá! Vi o catálogo e quero atendimento.");
  document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
    link.href = whatsappUrl || "#";
    link.removeAttribute("target");
    link.removeAttribute("rel");
    link.addEventListener("click", (event) => {
      if (!whatsappUrl) {
        event.preventDefault();
        alert("Cadastre o WhatsApp da loja no painel administrativo.");
      }
    });
  });

  const instagramUrl = buildInstagramUrl(settings.instagram);
  if (instagramUrl) {
    elements.instagram.href = instagramUrl;
    elements.instagram.hidden = false;
  }

  elements.address.textContent = settings.address || "";
}

function bindEvents() {
  const filterInputs = [
    elements.search,
    elements.category,
    elements.brand,
    elements.size,
    elements.color,
    elements.sort
  ];

  filterInputs.forEach((input) => {
    input.addEventListener("input", () => {
      updateFiltersFromControls({
        clearGroup: input === elements.category || input === elements.brand
      });
      renderProducts();
    });
  });

  elements.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  elements.openFilters.addEventListener("click", openFiltersDrawer);
  elements.closeFilters.addEventListener("click", closeFiltersDrawer);
  elements.filterOverlay.addEventListener("click", closeFiltersDrawer);
  elements.clearFilters.addEventListener("click", () => {
    resetFilters();
    renderProducts();
  });

  elements.filterGroups.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-group]");

    if (!button) {
      return;
    }

    state.filters.group = button.dataset.filterGroup;
    state.filters.category = button.dataset.filterCategory || "";
    state.filters.brand = button.dataset.filterBrand || "";
    syncFilterControls();
    renderProducts();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.filterDrawer.classList.contains("is-open")) {
      closeFiltersDrawer();
    }
  });

  elements.grid.addEventListener("click", (event) => {
    const carouselButton = event.target.closest("[data-carousel-action]");

    if (carouselButton) {
      event.preventDefault();
      event.stopPropagation();
      moveCardCarousel(carouselButton.dataset.productId, carouselButton.dataset.carouselAction);
      return;
    }

    const button = event.target.closest("[data-open-product]");

    if (button) {
      openProduct(button.dataset.openProduct);
    }
  });

  elements.grid.addEventListener("keydown", (event) => {
    if (event.target.closest("[data-carousel-action]")) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const cardPhoto = event.target.closest("[data-open-product]");

    if (cardPhoto) {
      event.preventDefault();
      openProduct(cardPhoto.dataset.openProduct);
    }
  });

  elements.dialogBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dialog-carousel]");

    if (button) {
      event.preventDefault();
      moveDialogCarousel(button.dataset.dialogCarousel);
    }
  });

  elements.closeDialog.addEventListener("click", closeProductDialog);
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeProductDialog();
    }
  });

  window.addEventListener("popstate", () => {
    if (location.pathname.startsWith("/produto/")) {
      openProductFromPath(false);
      return;
    }

    if (elements.dialog.open) {
      elements.dialog.close();
    }
  });
}

function updateFiltersFromControls({ clearGroup = false } = {}) {
  state.filters.search = elements.search.value.trim();
  state.filters.category = elements.category.value;
  state.filters.brand = elements.brand.value;
  state.filters.size = elements.size.value;
  state.filters.color = elements.color.value;
  state.filters.sort = elements.sort.value;

  if (clearGroup) {
    state.filters.group = "";
  }
}

function syncFilterControls() {
  elements.search.value = state.filters.search;
  elements.category.value = state.filters.category;
  elements.brand.value = state.filters.brand;
  elements.size.value = state.filters.size;
  elements.color.value = state.filters.color;
  elements.sort.value = state.filters.sort;
}

function resetFilters() {
  state.filters = {
    search: "",
    group: "",
    category: "",
    brand: "",
    size: "",
    color: "",
    sort: "featured"
  };
  syncFilterControls();
}

function updateActiveFilterCount() {
  const count = [
    state.filters.search,
    state.filters.group || state.filters.category,
    state.filters.group ? "" : state.filters.brand,
    state.filters.size,
    state.filters.color,
    state.filters.sort !== "featured" ? state.filters.sort : ""
  ].filter(Boolean).length;

  elements.activeFilterCount.hidden = count === 0;
  elements.activeFilterCount.textContent = count;
}

function openFiltersDrawer() {
  elements.filterDrawer.classList.add("is-open");
  elements.filterDrawer.setAttribute("aria-hidden", "false");
  elements.filterDrawer.removeAttribute("inert");
  elements.filterOverlay.hidden = false;
  document.body.classList.add("filters-open");
  elements.closeFilters.focus();
}

function closeFiltersDrawer() {
  elements.filterDrawer.classList.remove("is-open");
  elements.filterDrawer.setAttribute("aria-hidden", "true");
  elements.filterDrawer.setAttribute("inert", "");
  elements.filterOverlay.hidden = true;
  document.body.classList.remove("filters-open");
  elements.openFilters.focus();
}

function buildFilters(products) {
  fillSelect(elements.category, unique(products.map((product) => product.category)), "Todas");
  fillSelect(elements.brand, unique(products.map((product) => product.brand)), "Todas");
  fillSelect(elements.size, unique(products.flatMap((product) => product.sizes || [])), "Todos");
  fillSelect(elements.color, unique(products.flatMap((product) => product.colors || [])), "Todas");
  renderFilterGroups(products);
}

function renderFilterGroups(products) {
  const groups = [
    {
      id: "clothing",
      title: "Roupas",
      allLabel: "Ver todos em roupas",
      empty: "Nenhuma roupa cadastrada.",
      type: "category",
      values: sortedByPreference(
        unique(products.filter((product) => productGroup(product) === "clothing").map((product) => product.category)),
        ["shorts", "calças", "blusas", "camisetas"]
      )
    },
    {
      id: "sneakers",
      title: "Tênis",
      allLabel: "Ver todos em tênis",
      empty: "Nenhum tênis cadastrado.",
      type: "brand",
      values: unique(products.filter((product) => productGroup(product) === "sneakers").map((product) => product.brand))
    },
    {
      id: "accessories",
      title: "Acessórios",
      allLabel: "Ver todos em acessórios",
      empty: "Nenhum acessório cadastrado.",
      type: "category",
      values: sortedByPreference(
        unique(products.filter((product) => productGroup(product) === "accessories").map((product) => product.category)),
        ["relógios", "óculos de sol", "pulseiras", "colares"]
      )
    }
  ];

  elements.filterGroups.innerHTML = groups.map((group) => renderFilterGroup(group, products)).join("");
}

function renderFilterGroup(group, products) {
  const groupCount = products.filter((product) => productGroup(product) === group.id).length;
  const allActive = state.filters.group === group.id && !state.filters.category && !state.filters.brand;

  return `
    <section class="filter-section">
      <div class="filter-section-title">
        <h4>${escapeHtml(group.title)}</h4>
        <span>${groupCount}</span>
      </div>
      <button class="filter-option filter-option-all${allActive ? " is-active" : ""}" type="button" data-filter-group="${escapeAttr(group.id)}">
        <span>${escapeHtml(group.allLabel)}</span>
        <strong>${groupCount}</strong>
      </button>
      <div class="filter-option-list">
        ${
          group.values.length
            ? group.values.map((value) => renderFilterOption(group, value, products)).join("")
            : `<p class="filter-empty">${escapeHtml(group.empty)}</p>`
        }
      </div>
    </section>
  `;
}

function renderFilterOption(group, value, products) {
  const category = group.type === "category" ? value : "";
  const brand = group.type === "brand" ? value : "";
  const count = products.filter((product) => {
    return (
      productGroup(product) === group.id &&
      (!category || product.category === category) &&
      (!brand || product.brand === brand)
    );
  }).length;
  const active =
    state.filters.group === group.id &&
    (!category || state.filters.category === category) &&
    (!brand || state.filters.brand === brand);

  return `
    <button
      class="filter-option${active ? " is-active" : ""}"
      type="button"
      data-filter-group="${escapeAttr(group.id)}"
      data-filter-category="${escapeAttr(category)}"
      data-filter-brand="${escapeAttr(brand)}"
    >
      <span>${escapeHtml(value)}</span>
      <strong>${count}</strong>
    </button>
  `;
}

function sortedByPreference(values, preferred) {
  return [...values].sort((a, b) => {
    const aIndex = preferredIndex(a, preferred);
    const bIndex = preferredIndex(b, preferred);

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.localeCompare(b, "pt-BR");
  });
}

function preferredIndex(value, preferred) {
  const normalizedValue = normalizeForFilter(value);
  const index = preferred.findIndex((item) => {
    const normalizedItem = normalizeForFilter(item);
    return normalizedValue.includes(normalizedItem) || normalizedItem.includes(normalizedValue);
  });

  return index === -1 ? 999 : index;
}

function fillSelect(select, values, label) {
  select.innerHTML = `<option value="">${label}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function productGroup(product = {}) {
  const text = normalizeForFilter([product.category, product.name, product.description].join(" "));
  const sneakerTerms = ["tênis", "tenis", "sneaker", "sneakers", "calçado", "calçados"];
  const accessoryTerms = [
    "acessório",
    "acessórios",
    "relógio",
    "relógios",
    "óculos",
    "óculos de sol",
    "pulseira",
    "pulseiras",
    "colar",
    "colares",
    "bolsa",
    "bolsas",
    "boné",
    "bonés",
    "cinto",
    "cintos",
    "brinco",
    "brincos",
    "anel",
    "anéis"
  ];

  if (sneakerTerms.some((term) => text.includes(normalizeForFilter(term)))) {
    return "sneakers";
  }

  if (accessoryTerms.some((term) => text.includes(normalizeForFilter(term)))) {
    return "accessories";
  }

  return "clothing";
}

function normalizeForFilter(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function renderProducts() {
  const products = filteredProducts();
  elements.grid.innerHTML = "";
  elements.empty.hidden = products.length > 0;
  elements.count.textContent = `${products.length} ${products.length === 1 ? "peça" : "peças"}`;
  updateActiveFilterCount();
  renderFilterGroups(state.products);

  products.forEach((product) => {
    elements.grid.append(createProductCard(product));
  });
}

function filteredProducts() {
  const { search, group, category, brand, size, color, sort } = state.filters;
  const normalizedSearch = normalizeForFilter(search);

  return state.products
    .filter((product) => {
      const haystack = normalizeForFilter([
        product.name,
        product.category,
        product.brand,
        product.description,
        ...(product.sizes || []),
        ...(product.colors || [])
      ].join(" "));

      return (
        (!normalizedSearch || haystack.includes(normalizedSearch)) &&
        (!group || productGroup(product) === group) &&
        (!category || product.category === category) &&
        (!brand || product.brand === brand) &&
        (!size || (product.sizes || []).includes(size)) &&
        (!color || (product.colors || []).includes(color))
      );
    })
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "newest") return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
}

function createProductCard(product) {
  const article = document.createElement("article");
  article.className = "product-card";
  const images = productImages(product);
  const imageIndex = Math.min(state.carouselIndexes[product.id] || 0, Math.max(images.length - 1, 0));
  const currentImage = images[imageIndex];

  article.innerHTML = `
    <div class="product-photo" role="button" tabindex="0" data-open-product="${escapeAttr(product.id)}">
      ${currentImage ? `<img src="${escapeAttr(currentImage)}" alt="${escapeAttr(product.name)}" loading="lazy" />` : `<span>Sem foto</span>`}
      ${product.featured ? `<strong>Destaque</strong>` : ""}
      ${renderCarouselControls(product.id, images, imageIndex)}
    </div>
    <div class="product-content">
      <p class="product-category">${escapeHtml(productSubtitle(product))}</p>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-price">${money.format(product.price || 0)}</p>
      <div class="chip-row">${renderChips([product.category, ...(product.sizes || []), ...(product.colors || [])])}</div>
      <div class="product-actions">
        <a class="button button-primary" href="${buildWhatsappUrl(productMessage(product))}">Pedir</a>
        <button class="button button-quiet" type="button" data-open-product="${escapeAttr(product.id)}">Detalhes</button>
      </div>
    </div>
  `;

  return article;
}

function renderCarouselControls(productId, images, imageIndex) {
  if (images.length < 2) {
    return "";
  }

  return `
    <div class="carousel-controls" aria-label="Fotos do produto">
      <button class="carousel-button" type="button" data-product-id="${escapeAttr(productId)}" data-carousel-action="prev" aria-label="Foto anterior">‹</button>
      <button class="carousel-button" type="button" data-product-id="${escapeAttr(productId)}" data-carousel-action="next" aria-label="Próxima foto">›</button>
    </div>
    <div class="carousel-dots" aria-hidden="true">
      ${images.map((_image, index) => `<span class="${index === imageIndex ? "active" : ""}"></span>`).join("")}
    </div>
  `;
}

function moveCardCarousel(productId, action) {
  const product = state.products.find((item) => item.id === productId);
  const images = productImages(product);

  if (images.length < 2) {
    return;
  }

  const current = state.carouselIndexes[productId] || 0;
  state.carouselIndexes[productId] =
    action === "prev" ? (current - 1 + images.length) % images.length : (current + 1) % images.length;
  renderProducts();
}

function renderChips(items) {
  return items
    .filter(Boolean)
    .slice(0, 6)
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");
}

function productSubtitle(product) {
  return [product.brand, product.category || "Geral"].filter(Boolean).join(" • ");
}

function openProductFromPath(push = false) {
  const match = location.pathname.match(/^\/produto\/([^/]+)/);

  if (!match) {
    return;
  }

  openProduct(decodeURIComponent(match[1]), push);
}

function openProduct(productId, push = true) {
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  state.dialogProductId = product.id;
  state.dialogImageIndex = Math.min(
    state.carouselIndexes[product.id] || 0,
    Math.max(productImages(product).length - 1, 0)
  );
  renderProductDialog(product);

  if (push) {
    history.pushState({}, "", `/produto/${product.id}`);
  }

  elements.dialog.showModal();
}

function renderProductDialog(product) {
  const images = productImages(product);
  const imageIndex = Math.min(state.dialogImageIndex, Math.max(images.length - 1, 0));
  const currentImage = images[imageIndex];

  elements.dialogBody.innerHTML = `
    <div class="dialog-photo">
      ${currentImage ? `<img src="${escapeAttr(currentImage)}" alt="${escapeAttr(product.name)}" />` : `<span>Sem foto</span>`}
      ${renderDialogCarouselControls(images, imageIndex)}
    </div>
    <div class="dialog-info">
      <p class="product-category">${escapeHtml(productSubtitle(product))}</p>
      <h2>${escapeHtml(product.name)}</h2>
      <p class="product-price">${money.format(product.price || 0)}</p>
      ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
      ${
        product.brand
          ? `<div class="info-group">
        <strong>Marca</strong>
        <div class="chip-row"><span>${escapeHtml(product.brand)}</span></div>
      </div>`
          : ""
      }
      <div class="info-group">
        <strong>Tamanhos</strong>
        <div class="chip-row">${renderChips(product.sizes || []) || "<span>Consultar</span>"}</div>
      </div>
      <div class="info-group">
        <strong>Cores</strong>
        <div class="chip-row">${renderChips(product.colors || []) || "<span>Consultar</span>"}</div>
      </div>
      <div class="dialog-actions">
        <a class="button button-primary" href="${buildWhatsappUrl(productMessage(product))}">Pedir pelo WhatsApp</a>
        <button class="button button-quiet" id="copyProductLink" type="button">Copiar link</button>
      </div>
    </div>
  `;

  document.querySelector("#copyProductLink").addEventListener("click", async () => {
    await navigator.clipboard.writeText(productLink(product));
    document.querySelector("#copyProductLink").textContent = "Link copiado";
  });
}

function renderDialogCarouselControls(images, imageIndex) {
  if (images.length < 2) {
    return "";
  }

  return `
    <div class="carousel-controls dialog-carousel-controls" aria-label="Fotos do produto">
      <button class="carousel-button" type="button" data-dialog-carousel="prev" aria-label="Foto anterior">‹</button>
      <button class="carousel-button" type="button" data-dialog-carousel="next" aria-label="Próxima foto">›</button>
    </div>
    <div class="carousel-dots dialog-carousel-dots" aria-hidden="true">
      ${images.map((_image, index) => `<span class="${index === imageIndex ? "active" : ""}"></span>`).join("")}
    </div>
  `;
}

function moveDialogCarousel(action) {
  const product = state.products.find((item) => item.id === state.dialogProductId);
  const images = productImages(product);

  if (!product || images.length < 2) {
    return;
  }

  state.dialogImageIndex =
    action === "prev"
      ? (state.dialogImageIndex - 1 + images.length) % images.length
      : (state.dialogImageIndex + 1) % images.length;
  state.carouselIndexes[product.id] = state.dialogImageIndex;
  renderProductDialog(product);
}

function closeProductDialog() {
  elements.dialog.close();

  if (location.pathname.startsWith("/produto/")) {
    history.pushState({}, "", "/");
  }
}

function productMessage(product) {
  return `Olá! Tenho interesse na peça ${product.name} (${money.format(product.price || 0)}).\n\nFoto e detalhes: ${productLink(product)}`;
}

function productLink(product) {
  return `${location.origin}/produto/${encodeURIComponent(product.id)}`;
}

function productImages(product = {}) {
  const images = Array.isArray(product.images) ? product.images : [];
  return [...new Set([...images, product.image].filter(Boolean))];
}

function buildWhatsappUrl(message) {
  const phone = state.settings?.whatsapp?.replace(/\D/g, "");

  if (!phone) {
    return "";
  }

  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

function buildInstagramUrl(value) {
  const instagram = String(value || "").trim();

  if (!instagram) {
    return "";
  }

  if (/^https?:\/\//i.test(instagram)) {
    return instagram;
  }

  const username = instagram.replace(/^@/, "");
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
