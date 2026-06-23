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
    gender: "",
    delivery: "",
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
  brandWall: document.querySelector("#marcas"),
  brandWallGrid: document.querySelector("#brandWallGrid"),
  menuToggle: document.querySelector("#menuToggle"),
  siteNav: document.querySelector("#siteNav"),
  navClothing: document.querySelector("#navClothingMenu"),
  navSneakers: document.querySelector("#navSneakersMenu"),
  navAccessories: document.querySelector("#navAccessoriesMenu"),
  navBrands: document.querySelector("#navBrandsMenu"),
  genderGroup: document.querySelector("#genderFilterGroup"),
  deliveryGroup: document.querySelector("#deliveryFilterGroup"),
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

  elements.menuToggle.addEventListener("click", toggleSiteMenu);
  elements.clearFilters.addEventListener("click", () => {
    resetFilters();
    renderProducts();
  });

  elements.brandWallGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-brand-wall]");

    if (!button) {
      return;
    }

    applyNavFilter(button);
  });

  elements.genderGroup.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gender-filter]");

    if (!button) {
      return;
    }

    state.filters.gender = button.dataset.genderFilter;
    syncGenderButtons();
    renderProducts();
  });

  elements.deliveryGroup.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delivery-filter]");

    if (!button) {
      return;
    }

    state.filters.delivery = button.dataset.deliveryFilter;
    syncDeliveryButtons();
    renderProducts();
  });

  elements.siteNav.addEventListener("click", (event) => {
    const dropdownButton = event.target.closest("[data-nav-dropdown]");
    const filterButton = event.target.closest("[data-nav-group], [data-nav-brand], [data-nav-category], [data-nav-search], [data-nav-delivery]");
    const closeLink = event.target.closest("[data-nav-close]");

    if (dropdownButton) {
      toggleNavDropdown(dropdownButton);
      return;
    }

    if (filterButton) {
      applyNavFilter(filterButton);
      return;
    }

    if (closeLink) {
      closeSiteMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".site-header")) {
      return;
    }

    closeNavDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSiteMenu();
      closeNavDropdowns();
    }
  });

  document.addEventListener("focusin", (event) => {
    if (event.target.closest(".site-header")) {
      return;
    }

    closeNavDropdowns();
  });

  elements.siteNav.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeSiteMenu();
    closeNavDropdowns();
    elements.menuToggle.focus();
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
    gender: "",
    delivery: "",
    category: "",
    brand: "",
    size: "",
    color: "",
    sort: "featured"
  };
  syncFilterControls();
  syncGenderButtons();
  syncDeliveryButtons();
}

function updateActiveFilterCount() {
  const count = [
    state.filters.search,
    state.filters.group || state.filters.category,
    state.filters.group ? "" : state.filters.brand,
    state.filters.gender,
    state.filters.delivery,
    state.filters.size,
    state.filters.color,
    state.filters.sort !== "featured" ? state.filters.sort : ""
  ].filter(Boolean).length;

  elements.activeFilterCount.hidden = count === 0;
  elements.activeFilterCount.textContent = count;
}

function syncGenderButtons() {
  elements.genderGroup.querySelectorAll("[data-gender-filter]").forEach((button) => {
    const active = button.dataset.genderFilter === state.filters.gender;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function syncDeliveryButtons() {
  elements.deliveryGroup.querySelectorAll("[data-delivery-filter]").forEach((button) => {
    const active = button.dataset.deliveryFilter === state.filters.delivery;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function toggleSiteMenu() {
  const open = !elements.siteNav.classList.contains("is-open");
  elements.siteNav.classList.toggle("is-open", open);
  elements.menuToggle.classList.toggle("is-open", open);
  elements.menuToggle.setAttribute("aria-expanded", String(open));

  if (!open) {
    closeNavDropdowns();
  }
}

function closeSiteMenu() {
  elements.siteNav.classList.remove("is-open");
  elements.menuToggle.classList.remove("is-open");
  elements.menuToggle.setAttribute("aria-expanded", "false");
  closeNavDropdowns();
}

function toggleNavDropdown(button) {
  const dropdown = button.closest(".nav-dropdown");
  const open = !dropdown.classList.contains("is-open");

  closeNavDropdowns(dropdown);
  dropdown.classList.toggle("is-open", open);
  button.setAttribute("aria-expanded", String(open));
}

function closeNavDropdowns(except = null) {
  elements.siteNav.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
    if (dropdown === except) {
      return;
    }

    dropdown.classList.remove("is-open");
    dropdown.querySelector("[data-nav-dropdown]")?.setAttribute("aria-expanded", "false");
  });
}

function applyNavFilter(button) {
  if (button.dataset.navDelivery) {
    state.filters.group = "";
    state.filters.gender = "";
    state.filters.category = "";
    state.filters.brand = "";
    state.filters.size = "";
    state.filters.color = "";
    state.filters.search = "";
    state.filters.delivery = button.dataset.navDelivery;
    state.filters.sort = "featured";
  } else {
    state.filters.group = button.dataset.navGroup || "";
    state.filters.category = button.dataset.navCategory || "";
    state.filters.brand = button.dataset.navBrand || "";
    state.filters.search = button.dataset.navSearch || "";
    state.filters.sort = "featured";
  }

  syncFilterControls();
  syncDeliveryButtons();
  renderProducts();
  closeNavDropdowns();
  closeSiteMenu();
  document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateNavState() {
  elements.siteNav.querySelectorAll(".nav-menu-item, [data-nav-search], [data-nav-delivery]").forEach((button) => {
    const active =
      (button.dataset.navDelivery && state.filters.delivery === button.dataset.navDelivery && !state.filters.brand) ||
      (button.dataset.navSearch && state.filters.search === button.dataset.navSearch) ||
      (button.dataset.navGroup === state.filters.group &&
        button.dataset.navCategory === state.filters.category &&
        button.dataset.navBrand === state.filters.brand &&
        (button.dataset.navGroup || button.dataset.navCategory || button.dataset.navBrand));

    button.classList.toggle("is-active", Boolean(active));
  });
}

function buildFilters(products) {
  fillSelect(elements.category, unique(products.map((product) => product.category)), "Todas");
  fillSelect(elements.brand, unique(products.map((product) => product.brand)), "Todas");
  fillSelect(elements.size, catalogSizes(products), "Todos");
  fillSelect(elements.color, unique(products.flatMap((product) => product.colors || [])), "Todas");
  renderNavMenus(products);
  renderBrandWall(products);
}

function renderNavMenus(products) {
  const clothingCategories = sortedByPreference(
    unique(products.filter((product) => productGroup(product) === "clothing").map((product) => product.category)),
    ["shorts", "calças", "blusas", "camisetas", "conjuntos"]
  );
  const sneakerBrands = unique(products.filter((product) => productGroup(product) === "sneakers").map((product) => product.brand));
  const accessoryCategories = sortedByPreference(
    unique(products.filter((product) => productGroup(product) === "accessories").map((product) => product.category)),
    ["relógios", "óculos de sol", "pulseiras", "colares"]
  );
  const brands = unique(products.map((product) => product.brand));

  elements.navClothing.innerHTML = renderNavMenuItems({
    allLabel: "Ver todos em roupas",
    emptyLabel: "Nenhuma roupa cadastrada.",
    group: "clothing",
    values: clothingCategories,
    type: "category"
  });
  elements.navSneakers.innerHTML = renderNavMenuItems({
    allLabel: "Ver todos em sneakers",
    emptyLabel: "Nenhum sneaker cadastrado.",
    group: "sneakers",
    values: sneakerBrands,
    type: "brand"
  });
  elements.navAccessories.innerHTML = renderNavMenuItems({
    allLabel: "Ver todos em acessórios",
    emptyLabel: "Nenhum acessório cadastrado.",
    group: "accessories",
    values: accessoryCategories,
    type: "category"
  });
  elements.navBrands.innerHTML = brands.length
    ? brands.map((brand) => navMenuButton(brand, { brand })).join("")
    : `<p class="nav-menu-empty">Nenhuma marca cadastrada.</p>`;
}

function renderBrandWall(products) {
  const brands = brandSummaries(products);

  elements.brandWall.hidden = brands.length === 0;
  elements.brandWallGrid.innerHTML = brands.map(renderBrandTile).join("");
  updateBrandWallState();
}

function brandSummaries(products) {
  const byBrand = new Map();

  products.forEach((product) => {
    const brand = product.brand;

    if (!brand) {
      return;
    }

    const summary = byBrand.get(brand) || {
      brand,
      count: 0,
      image: ""
    };

    summary.count += 1;
    summary.image ||= productImages(product)[0] || "";
    byBrand.set(brand, summary);
  });

  return [...byBrand.values()].sort((a, b) => a.brand.localeCompare(b.brand, "pt-BR"));
}

function renderBrandTile({ brand, count, image }) {
  const imageStyle = image ? ` style="--brand-image: url(&quot;${escapeAttr(image)}&quot;)"` : "";

  return `
    <button
      class="brand-tile"
      type="button"
      data-brand-wall
      data-nav-brand="${escapeAttr(brand)}"
      aria-label="Ver produtos da marca ${escapeAttr(brand)}"
      ${imageStyle}
    >
      <span class="brand-tile-logo">${escapeHtml(brand)}</span>
      <small>${count} ${count === 1 ? "peça" : "peças"}</small>
    </button>
  `;
}

function updateBrandWallState() {
  elements.brandWallGrid.querySelectorAll("[data-brand-wall]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.navBrand === state.filters.brand);
  });
}

function renderNavMenuItems({ allLabel, emptyLabel, group, values, type }) {
  const items = [
    navMenuButton(allLabel, { group }),
    ...values.map((value) =>
      navMenuButton(value, {
        group,
        category: type === "category" ? value : "",
        brand: type === "brand" ? value : ""
      })
    )
  ];

  if (values.length === 0) {
    items.push(`<p class="nav-menu-empty">${escapeHtml(emptyLabel)}</p>`);
  }

  return items.join("");
}

function navMenuButton(label, { group = "", category = "", brand = "" } = {}) {
  return `
    <button
      class="nav-menu-item"
      type="button"
      data-nav-group="${escapeAttr(group)}"
      data-nav-category="${escapeAttr(category)}"
      data-nav-brand="${escapeAttr(brand)}"
    >
      ${escapeHtml(label)}
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

function catalogSizes(products) {
  const defaultSizes = ["PP", "P", "M", "G", "GG", "XG", "XGG", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];
  return sortSizes(unique([...defaultSizes, ...products.flatMap((product) => product.sizes || [])]));
}

function sortSizes(values) {
  const preferred = ["PP", "P", "M", "G", "GG", "XG", "XGG", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

  return [...values].sort((a, b) => {
    const aIndex = sizeIndex(a, preferred);
    const bIndex = sizeIndex(b, preferred);

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
  });
}

function sizeIndex(value, preferred) {
  const normalized = normalizeForFilter(value);
  const index = preferred.findIndex((item) => normalizeForFilter(item) === normalized);
  return index === -1 ? 999 : index;
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

function productAudiences(product = {}) {
  const explicit = normalizeForFilter(product.audience);
  const text = normalizeForFilter([product.category, product.name, product.description].join(" "));
  const feminineTerms = ["feminino", "feminina", "mulher", "mulheres", "female", "ladies"];
  const masculineTerms = ["masculino", "masculina", "homem", "homens", "male", "men"];
  const hasFeminine =
    ["feminine", "feminino", "feminina"].includes(explicit) ||
    feminineTerms.some((term) => text.includes(normalizeForFilter(term)));
  const hasMasculine =
    ["masculine", "masculino", "masculina"].includes(explicit) ||
    masculineTerms.some((term) => text.includes(normalizeForFilter(term)));

  if (explicit === "unissex" || explicit === "unisex") {
    return ["feminine", "masculine"];
  }

  if (hasFeminine || hasMasculine) {
    return [hasFeminine ? "feminine" : "", hasMasculine ? "masculine" : ""].filter(Boolean);
  }

  return ["feminine", "masculine"];
}

function productDeliveryType(product = {}) {
  return product.deliveryType === "preorder" ? "preorder" : "immediate";
}

function deliveryLabel(value) {
  return value === "preorder" ? "Sob encomenda" : "Envio imediato";
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
  syncGenderButtons();
  syncDeliveryButtons();
  updateNavState();
  updateBrandWallState();

  products.forEach((product) => {
    elements.grid.append(createProductCard(product));
  });
}

function filteredProducts() {
  const { search, group, gender, delivery, category, brand, size, color, sort } = state.filters;
  const normalizedSearch = normalizeForFilter(search);

  return state.products
    .filter((product) => {
      const haystack = normalizeForFilter([
        product.name,
        product.category,
        product.brand,
        product.description,
        deliveryLabel(productDeliveryType(product)),
        ...(product.sizes || []),
        ...(product.colors || [])
      ].join(" "));

      return (
        (!normalizedSearch || haystack.includes(normalizedSearch)) &&
        (!group || productGroup(product) === group) &&
        (!gender || productAudiences(product).includes(gender)) &&
        (!delivery || productDeliveryType(product) === delivery) &&
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
      <em class="delivery-badge">${escapeHtml(deliveryLabel(productDeliveryType(product)))}</em>
      ${renderCarouselControls(product.id, images, imageIndex)}
    </div>
    <div class="product-content">
      <p class="product-category">${escapeHtml(productSubtitle(product))}</p>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-price">${money.format(product.price || 0)}</p>
      <div class="chip-row">${renderChips([deliveryLabel(productDeliveryType(product)), product.category, ...(product.sizes || []), ...(product.colors || [])])}</div>
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
        <strong>Envio</strong>
        <div class="chip-row"><span>${escapeHtml(deliveryLabel(productDeliveryType(product)))}</span></div>
      </div>
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
  return `Olá! Tenho interesse na peça ${product.name} (${money.format(product.price || 0)}).\nEnvio: ${deliveryLabel(productDeliveryType(product))}.\n\nFoto e detalhes: ${productLink(product)}`;
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
