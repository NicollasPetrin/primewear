const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const cartStorageKey = "primewear-cart-v1";
const maxCartQuantity = 99;

const state = {
  settings: null,
  products: [],
  cart: loadCart(),
  carouselIndexes: {},
  selectedColors: {},
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

const defaultClothingCategories = ["Camisetas", "Jaquetas / Moletons", "Shorts", "Calças", "Blusas", "Conjuntos"];
const defaultSneakerCategories = ["Tênis", "Sneakers"];
const defaultAccessoryCategories = ["Relógios", "Óculos de sol", "Pulseiras", "Colares", "Bolsas", "Bonés", "Cintos", "Brincos", "Anéis"];
const defaultCatalogCategories = [
  ...defaultClothingCategories,
  ...defaultSneakerCategories,
  ...defaultAccessoryCategories
];

const elements = {
  grid: document.querySelector("#productGrid"),
  empty: document.querySelector("#emptyState"),
  count: document.querySelector("#catalogCount"),
  filtersForm: document.querySelector("#catalogFilters"),
  storeHome: document.querySelector("#storeHome"),
  productPage: document.querySelector("#productPage"),
  brandWall: document.querySelector("#marcas"),
  brandWallGrid: document.querySelector("#brandWallGrid"),
  menuToggle: document.querySelector("#menuToggle"),
  menuOverlay: document.querySelector("#menuOverlay"),
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
  cartToggle: document.querySelector("#cartToggle"),
  cartCount: document.querySelector("#cartCount"),
  cartDialog: document.querySelector("#cartDialog"),
  closeCart: document.querySelector("#closeCart"),
  cartItems: document.querySelector("#cartItems"),
  cartEmpty: document.querySelector("#cartEmpty"),
  cartTotal: document.querySelector("#cartTotal"),
  cartWhatsappLink: document.querySelector("#cartWhatsappLink"),
  clearCart: document.querySelector("#clearCartButton"),
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
    syncCartWithProducts();
    applySettings(settings);
    buildFilters(products);
    bindEvents();
    renderProducts();
    renderCart();
    renderCurrentRoute();
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

function loadCart() {
  try {
    const value = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");

    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => ({
        id: String(item.id || ""),
        quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), maxCartQuantity)
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(cartStorageKey, JSON.stringify(state.cart));
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
  elements.menuOverlay.addEventListener("click", closeSiteMenu);
  elements.cartToggle.addEventListener("click", openCartDialog);
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
    const backButton = event.target.closest("[data-nav-back]");
    const dropdownButton = event.target.closest("[data-nav-dropdown]");
    const filterButton = event.target.closest("[data-nav-group], [data-nav-brand], [data-nav-category], [data-nav-search], [data-nav-delivery]");
    const closeLink = event.target.closest("[data-nav-close]");

    if (backButton) {
      closeNavDropdowns();
      return;
    }

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
    if (event.target.closest(".site-header") || event.target.closest(".site-nav")) {
      return;
    }

    closeSiteMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSiteMenu();
      closeNavDropdowns();
    }
  });

  document.addEventListener("focusin", (event) => {
    if (event.target.closest(".site-header") || event.target.closest(".site-nav")) {
      return;
    }

    closeSiteMenu();
  });

  elements.siteNav.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeSiteMenu();
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

    const colorButton = event.target.closest("[data-product-color]");

    if (colorButton) {
      event.preventDefault();
      selectProductColor(colorButton.dataset.productId, colorButton.dataset.productColor);
      return;
    }

    const cartButton = event.target.closest("[data-add-cart]");

    if (cartButton) {
      event.preventDefault();
      addToCart(cartButton.dataset.addCart);
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
    const cartButton = event.target.closest("[data-add-cart]");

    if (cartButton) {
      event.preventDefault();
      addToCart(cartButton.dataset.addCart);
      return;
    }

    const button = event.target.closest("[data-dialog-carousel]");

    if (button) {
      event.preventDefault();
      moveDialogCarousel(button.dataset.dialogCarousel);
    }
  });

  elements.productPage.addEventListener("click", (event) => {
    const carouselButton = event.target.closest("[data-product-page-carousel]");

    if (carouselButton) {
      event.preventDefault();
      moveProductPageCarousel(carouselButton.dataset.productId, carouselButton.dataset.productPageCarousel);
      return;
    }

    const colorButton = event.target.closest("[data-product-color]");

    if (colorButton) {
      event.preventDefault();
      selectProductColor(colorButton.dataset.productId, colorButton.dataset.productColor);
      return;
    }

    const cartButton = event.target.closest("[data-add-cart]");

    if (cartButton) {
      event.preventDefault();
      addToCart(cartButton.dataset.addCart);
    }
  });

  elements.cartItems.addEventListener("click", (event) => {
    const decrease = event.target.closest("[data-cart-decrease]");
    const increase = event.target.closest("[data-cart-increase]");
    const remove = event.target.closest("[data-cart-remove]");

    if (decrease) {
      updateCartQuantity(decrease.dataset.cartDecrease, -1);
      return;
    }

    if (increase) {
      updateCartQuantity(increase.dataset.cartIncrease, 1);
      return;
    }

    if (remove) {
      removeCartItem(remove.dataset.cartRemove);
    }
  });

  elements.clearCart.addEventListener("click", clearCart);
  elements.cartWhatsappLink.addEventListener("click", (event) => {
    if (!activeCartItems().length || !elements.cartWhatsappLink.href || elements.cartWhatsappLink.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      alert(state.settings?.whatsapp ? "Adicione pelo menos uma peça ao carrinho." : "Cadastre o WhatsApp da loja no painel administrativo.");
    }
  });
  elements.closeCart.addEventListener("click", closeCartDialog);
  elements.cartDialog.addEventListener("click", (event) => {
    if (event.target === elements.cartDialog) {
      closeCartDialog();
      return;
    }

    if (event.target.closest("[data-close-cart]")) {
      closeCartDialog();
    }
  });

  elements.closeDialog.addEventListener("click", closeProductDialog);
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeProductDialog();
    }
  });

  window.addEventListener("popstate", () => {
    renderCurrentRoute();
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
  elements.menuOverlay.hidden = !open;
  document.body.classList.toggle("menu-open", open);

  if (!open) {
    closeNavDropdowns();
  }
}

function closeSiteMenu() {
  elements.siteNav.classList.remove("is-open");
  elements.menuToggle.classList.remove("is-open");
  elements.menuToggle.setAttribute("aria-expanded", "false");
  elements.menuOverlay.hidden = true;
  document.body.classList.remove("menu-open");
  closeNavDropdowns();
}

function toggleNavDropdown(button) {
  const dropdown = button.closest(".nav-dropdown");
  const open = !dropdown.classList.contains("is-open");

  closeNavDropdowns(dropdown);
  dropdown.classList.toggle("is-open", open);
  button.setAttribute("aria-expanded", String(open));
  elements.siteNav.classList.toggle("has-submenu-open", open);
}

function closeNavDropdowns(except = null) {
  elements.siteNav.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
    if (dropdown === except) {
      return;
    }

    dropdown.classList.remove("is-open");
    dropdown.querySelector("[data-nav-dropdown]")?.setAttribute("aria-expanded", "false");
  });
  elements.siteNav.classList.toggle("has-submenu-open", Boolean(except));
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
  fillSelect(elements.category, catalogCategories(products), "Todas");
  fillSelect(elements.brand, unique(products.map((product) => product.brand)), "Todas");
  fillSelect(elements.size, catalogSizes(products), "Todos");
  fillSelect(elements.color, unique(products.flatMap((product) => productColors(product))), "Todas");
  renderNavMenus(products);
  renderBrandWall(products);
}

function renderNavMenus(products) {
  const clothingCategories = sortedByPreference(
    uniqueNormalized([
      ...defaultClothingCategories,
      ...products.filter((product) => productGroup(product) === "clothing").map((product) => product.category)
    ]),
    defaultClothingCategories
  );
  const sneakerBrands = unique(products.filter((product) => productGroup(product) === "sneakers").map((product) => product.brand));
  const accessoryCategories = sortedByPreference(
    uniqueNormalized([
      ...defaultAccessoryCategories,
      ...products.filter((product) => productGroup(product) === "accessories").map((product) => product.category)
    ]),
    defaultAccessoryCategories
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
    ? [
        `<button class="nav-menu-back" type="button" data-nav-back>Voltar</button>`,
        `<p class="nav-menu-title">Marcas</p>`,
        ...brands.map((brand) => navMenuButton(brand, { brand }))
      ].join("")
    : [
        `<button class="nav-menu-back" type="button" data-nav-back>Voltar</button>`,
        `<p class="nav-menu-title">Marcas</p>`,
        `<p class="nav-menu-empty">Nenhuma marca cadastrada.</p>`
      ].join("");
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
    `<button class="nav-menu-back" type="button" data-nav-back>Voltar</button>`,
    `<p class="nav-menu-title">${escapeHtml(allLabel.replace(/^Ver todos em\s*/i, ""))}</p>`,
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

function uniqueNormalized(values) {
  const seen = new Set();

  return values.filter((value) => {
    if (!value) {
      return false;
    }

    const key = normalizeForFilter(value);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function catalogCategories(products) {
  return sortedByPreference(
    uniqueNormalized([...defaultCatalogCategories, ...products.map((product) => product.category)]),
    defaultCatalogCategories
  );
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
        (!category || normalizeForFilter(product.category) === normalizeForFilter(category)) &&
        (!brand || product.brand === brand) &&
        (!size || (product.sizes || []).includes(size)) &&
        (!color || productColors(product).some((productColor) => normalizeForFilter(productColor) === normalizeForFilter(color)))
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
  const selectedColor = selectedProductColor(product);
  const images = productImages(product, selectedColor);
  const imageIndex = Math.min(state.carouselIndexes[product.id] || 0, Math.max(images.length - 1, 0));
  const currentImage = images[imageIndex];

  article.innerHTML = `
    <div class="product-photo">
      <a class="product-photo-link" href="${escapeAttr(productLink(product, selectedColor))}" aria-label="Ver detalhes de ${escapeAttr(product.name)}">
        ${currentImage ? `<img src="${escapeAttr(currentImage)}" alt="${escapeAttr(product.name)}" loading="lazy" />` : `<span>Sem foto</span>`}
        ${product.featured ? `<strong>Destaque</strong>` : ""}
        <em class="delivery-badge">${escapeHtml(deliveryLabel(productDeliveryType(product)))}</em>
      </a>
      ${renderCarouselControls(product.id, images, imageIndex)}
    </div>
    <div class="product-content">
      <p class="product-category">${escapeHtml(productSubtitle(product))}</p>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-price">${money.format(product.price || 0)}</p>
      ${renderColorOptions(product, selectedColor)}
      <div class="chip-row">${renderChips([deliveryLabel(productDeliveryType(product)), product.category, ...(product.sizes || []), ...(product.colors || [])])}</div>
      <div class="product-actions">
        <button class="button button-primary" type="button" data-add-cart="${escapeAttr(product.id)}">${escapeHtml(cartButtonLabel(product.id))}</button>
        <a class="button button-quiet" href="${escapeAttr(productLink(product, selectedColor))}">Detalhes</a>
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
  const images = productImages(product, selectedProductColor(product));

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

function renderColorOptions(product, selectedColor = selectedProductColor(product)) {
  const colors = productColors(product);

  if (!colors.length) {
    return "";
  }

  return `
    <div class="color-options" aria-label="Cores disponiveis">
      ${colors
        .map((color) => {
          const active = normalizeForFilter(color) === normalizeForFilter(selectedColor);

          return `
            <button
              class="color-option ${active ? "is-active" : ""}"
              type="button"
              style="--swatch: ${escapeAttr(colorSwatch(color))}"
              data-product-id="${escapeAttr(product.id)}"
              data-product-color="${escapeAttr(color)}"
              aria-pressed="${active}"
            >
              <span></span>
              ${escapeHtml(color)}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function productColors(product = {}) {
  return uniqueNormalized([...(product.colors || []), ...Object.values(product.imageColors || {})]);
}

function selectedProductColor(product = {}) {
  const selected = state.selectedColors[product.id] || "";
  return productColors(product).some((color) => normalizeForFilter(color) === normalizeForFilter(selected)) ? selected : "";
}

function selectProductColor(productId, color) {
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  const current = selectedProductColor(product);
  state.selectedColors[productId] = normalizeForFilter(current) === normalizeForFilter(color) ? "" : color;
  state.carouselIndexes[productId] = 0;

  if (location.pathname === `/produto/${encodeURIComponent(product.id)}`) {
    history.replaceState({}, "", productLink(product, state.selectedColors[productId]));
  }

  renderProducts();
  renderCurrentRoute();
}

function colorSwatch(color) {
  const key = normalizeForFilter(color);
  const swatches = {
    preto: "#050505",
    black: "#050505",
    branco: "#ffffff",
    white: "#ffffff",
    "off-white": "#f2eadb",
    offwhite: "#f2eadb",
    cinza: "#9aa1a9",
    grey: "#9aa1a9",
    gray: "#9aa1a9",
    azul: "#2459a8",
    blue: "#2459a8",
    verde: "#2f7d4f",
    green: "#2f7d4f",
    vermelho: "#bd2236",
    red: "#bd2236",
    rosa: "#e58aaa",
    pink: "#e58aaa",
    bege: "#d4b982",
    beige: "#d4b982",
    marrom: "#704a2a",
    brown: "#704a2a",
    dourado: "#b8893a",
    gold: "#b8893a",
    prata: "#b8bdc3",
    silver: "#b8bdc3"
  };

  return swatches[key] || "#d4aa57";
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  const item = state.cart.find((cartItem) => cartItem.id === productId);

  if (item) {
    item.quantity = Math.min(item.quantity + 1, maxCartQuantity);
  } else {
    state.cart.push({ id: productId, quantity: 1 });
  }

  saveCart();
  refreshCartViews();
}

function updateCartQuantity(productId, delta) {
  const item = state.cart.find((cartItem) => cartItem.id === productId);

  if (!item) {
    return;
  }

  item.quantity += delta;

  if (item.quantity <= 0) {
    removeCartItem(productId);
    return;
  }

  item.quantity = Math.min(item.quantity, maxCartQuantity);
  saveCart();
  refreshCartViews();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter((item) => item.id !== productId);
  saveCart();
  refreshCartViews();
}

function clearCart() {
  state.cart = [];
  saveCart();
  refreshCartViews();
}

function syncCartWithProducts() {
  const productIds = new Set(state.products.map((product) => product.id));
  const nextCart = state.cart.filter((item) => productIds.has(item.id));

  if (nextCart.length !== state.cart.length) {
    state.cart = nextCart;
    saveCart();
  }
}

function refreshCartViews() {
  renderCart();
  renderProducts();
  renderOpenProductDialog();
  renderCurrentRoute();
}

function activeCartItems() {
  return state.cart
    .map((item) => {
      const product = state.products.find((candidate) => candidate.id === item.id);

      if (!product) {
        return null;
      }

      return {
        product,
        quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), maxCartQuantity)
      };
    })
    .filter(Boolean);
}

function cartQuantity(productId) {
  return state.cart.find((item) => item.id === productId)?.quantity || 0;
}

function cartButtonLabel(productId) {
  const quantity = cartQuantity(productId);
  return quantity ? `Adicionar mais (${quantity})` : "Adicionar ao carrinho";
}

function cartItemsCount() {
  return state.cart.reduce((total, item) => total + item.quantity, 0);
}

function cartTotal(items = activeCartItems()) {
  return items.reduce((total, item) => total + (item.product.price || 0) * item.quantity, 0);
}

function renderCart() {
  const items = activeCartItems();
  const total = cartTotal(items);
  elements.cartCount.textContent = cartItemsCount();
  elements.cartCount.hidden = cartItemsCount() === 0;
  elements.cartItems.hidden = items.length === 0;
  elements.cartEmpty.hidden = items.length > 0;
  elements.clearCart.hidden = items.length === 0;
  elements.cartItems.innerHTML = items.map(renderCartItem).join("");
  elements.cartTotal.textContent = `Total estimado: ${money.format(total)}`;

  const whatsappUrl = items.length ? buildWhatsappUrl(cartMessage(items, total)) : "";
  elements.cartWhatsappLink.href = whatsappUrl || "#";
  elements.cartWhatsappLink.classList.toggle("is-disabled", !whatsappUrl);
  elements.cartWhatsappLink.setAttribute("aria-disabled", String(!whatsappUrl));
}

function renderCartItem({ product, quantity }) {
  const image = productImages(product)[0];

  return `
    <article class="cart-item">
      <div class="cart-item-photo">
        ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)}" />` : "<span>Sem foto</span>"}
      </div>
      <div class="cart-item-info">
        <p class="product-category">${escapeHtml(productSubtitle(product))}</p>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${money.format(product.price || 0)} cada</p>
        <small>${escapeHtml(deliveryLabel(productDeliveryType(product)))}</small>
      </div>
      <div class="cart-item-controls">
        <div class="cart-quantity" aria-label="Quantidade">
          <button type="button" data-cart-decrease="${escapeAttr(product.id)}" aria-label="Diminuir quantidade">−</button>
          <span>${quantity}</span>
          <button type="button" data-cart-increase="${escapeAttr(product.id)}" aria-label="Aumentar quantidade">+</button>
        </div>
        <button class="cart-remove" type="button" data-cart-remove="${escapeAttr(product.id)}">Remover</button>
      </div>
    </article>
  `;
}

function openCartDialog() {
  renderCart();

  if (!elements.cartDialog.open) {
    elements.cartDialog.showModal();
  }
}

function closeCartDialog() {
  elements.cartDialog.close();
}

function renderOpenProductDialog() {
  if (!elements.dialog.open || !state.dialogProductId) {
    return;
  }

  const product = state.products.find((item) => item.id === state.dialogProductId);

  if (product) {
    renderProductDialog(product);
  }
}

function cartMessage(items = activeCartItems(), total = cartTotal(items)) {
  const storeName = state.settings?.storeName || "loja";
  const lines = [
    `Olá! Quero pedir estes itens do catálogo da ${storeName}:`,
    ""
  ];

  items.forEach(({ product, quantity }, index) => {
    lines.push(
      `${index + 1}. ${quantity}x ${product.name}`,
      `Valor: ${money.format(product.price || 0)} cada`,
      `Categoria: ${productSubtitle(product) || "Geral"}`,
      `Envio: ${deliveryLabel(productDeliveryType(product))}`,
      `Link: ${productLink(product)}`,
      ""
    );
  });

  lines.push(`Total estimado: ${money.format(total)}`, "Pode confirmar disponibilidade e entrega?");
  return lines.join("\n");
}

function productSubtitle(product) {
  return [product.brand, product.category || "Geral"].filter(Boolean).join(" • ");
}

function renderCurrentRoute() {
  const match = location.pathname.match(/^\/produto\/([^/]+)/);

  if (!match) {
    elements.storeHome.hidden = false;
    elements.productPage.hidden = true;
    document.title = `Catálogo | ${state.settings?.storeName || "Primewear Imports"}`;
    return;
  }

  const productId = decodeURIComponent(match[1]);
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    elements.storeHome.hidden = true;
    elements.productPage.hidden = false;
    document.title = `Peça não encontrada | ${state.settings?.storeName || "Primewear Imports"}`;
    elements.productPage.innerHTML = `
      <div class="product-page-empty">
        <p class="eyebrow">Produto</p>
        <h1>Peça não encontrada</h1>
        <p>Essa peça pode ter saído do catálogo.</p>
        <a class="button button-primary" href="/">Voltar para a loja</a>
      </div>
    `;
    return;
  }

  const routeColor = new URLSearchParams(location.search).get("cor");

  if (routeColor && !state.selectedColors[product.id]) {
    state.selectedColors[product.id] = routeColor;
  }

  elements.storeHome.hidden = true;
  elements.productPage.hidden = false;
  renderProductPage(product);
}

function openProduct(productId) {
  const product = state.products.find((item) => item.id === productId);

  if (product) {
    location.href = productLink(product);
  }
}

function renderProductPage(product) {
  const selectedColor = selectedProductColor(product);
  const images = productImages(product, selectedColor);
  const imageIndex = Math.min(state.carouselIndexes[product.id] || 0, Math.max(images.length - 1, 0));
  const currentImage = images[imageIndex];
  document.title = `${product.name} | ${state.settings?.storeName || "Primewear Imports"}`;

  elements.productPage.innerHTML = `
    <div class="product-page-shell">
      <a class="back-link" href="/">Voltar para a loja</a>
      <div class="product-page-media">
        <div class="product-page-photo">
          ${currentImage ? `<img src="${escapeAttr(currentImage)}" alt="${escapeAttr(product.name)}" />` : "<span>Sem foto</span>"}
          ${renderProductPageCarouselControls(product.id, images, imageIndex)}
        </div>
      </div>
      <div class="product-page-info">
        <p class="product-category">${escapeHtml(productSubtitle(product))}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-price">${money.format(product.price || 0)}</p>
        ${product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : ""}
        <div class="info-group">
          <strong>Envio</strong>
          <div class="chip-row"><span>${escapeHtml(deliveryLabel(productDeliveryType(product)))}</span></div>
        </div>
        <div class="info-group">
          <strong>Cores</strong>
          ${renderColorOptions(product, selectedColor) || "<div class=\"chip-row\"><span>Consultar</span></div>"}
        </div>
        <div class="info-group">
          <strong>Tamanhos</strong>
          <div class="chip-row">${renderChips(product.sizes || []) || "<span>Consultar</span>"}</div>
        </div>
        <div class="dialog-actions">
          <button class="button button-primary" type="button" data-add-cart="${escapeAttr(product.id)}">${escapeHtml(cartButtonLabel(product.id))}</button>
          <a class="button button-quiet" href="${buildWhatsappUrl(productMessage(product))}">Pedir agora</a>
        </div>
      </div>
    </div>
  `;
}

function renderProductPageCarouselControls(productId, images, imageIndex) {
  if (images.length < 2) {
    return "";
  }

  return `
    <div class="carousel-controls product-page-carousel-controls" aria-label="Fotos do produto">
      <button class="carousel-button" type="button" data-product-id="${escapeAttr(productId)}" data-product-page-carousel="prev" aria-label="Foto anterior">‹</button>
      <button class="carousel-button" type="button" data-product-id="${escapeAttr(productId)}" data-product-page-carousel="next" aria-label="Próxima foto">›</button>
    </div>
    <div class="carousel-dots product-page-carousel-dots" aria-hidden="true">
      ${images.map((_image, index) => `<span class="${index === imageIndex ? "active" : ""}"></span>`).join("")}
    </div>
  `;
}

function moveProductPageCarousel(productId, action) {
  const product = state.products.find((item) => item.id === productId);
  const images = productImages(product, selectedProductColor(product));

  if (!product || images.length < 2) {
    return;
  }

  const current = state.carouselIndexes[productId] || 0;
  state.carouselIndexes[productId] =
    action === "prev" ? (current - 1 + images.length) % images.length : (current + 1) % images.length;
  renderProductPage(product);
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
        <button class="button button-primary" type="button" data-add-cart="${escapeAttr(product.id)}">${escapeHtml(cartButtonLabel(product.id))}</button>
        <a class="button button-quiet" href="${buildWhatsappUrl(productMessage(product))}">Pedir agora</a>
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

function productLink(product, color = "") {
  const url = new URL(`/produto/${encodeURIComponent(product.id)}`, location.origin);

  if (color) {
    url.searchParams.set("cor", color);
  }

  return url.toString();
}

function productImages(product = {}, color = "") {
  const images = Array.isArray(product.images) ? product.images : [];
  const allImages = [...new Set([...images, product.image].filter(Boolean))];
  const selectedColor = normalizeForFilter(color);

  if (!selectedColor) {
    return allImages;
  }

  const filteredImages = allImages.filter((image) => {
    const imageColor = product.imageColors?.[image];
    return normalizeForFilter(imageColor) === selectedColor;
  });

  return filteredImages.length ? filteredImages : allImages;
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
