const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const state = {
  settings: null,
  products: [],
  filters: {
    search: "",
    category: "",
    size: "",
    color: "",
    sort: "featured"
  }
};

const elements = {
  grid: document.querySelector("#productGrid"),
  empty: document.querySelector("#emptyState"),
  count: document.querySelector("#catalogCount"),
  search: document.querySelector("#searchInput"),
  category: document.querySelector("#categoryFilter"),
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

  if (settings.instagram) {
    const username = settings.instagram.replace(/^@/, "");
    elements.instagram.href = `https://instagram.com/${encodeURIComponent(username)}`;
    elements.instagram.hidden = false;
  }

  elements.address.textContent = settings.address || "";
}

function bindEvents() {
  const filterInputs = [elements.search, elements.category, elements.size, elements.color, elements.sort];

  filterInputs.forEach((input) => {
    input.addEventListener("input", () => {
      state.filters.search = elements.search.value.trim().toLowerCase();
      state.filters.category = elements.category.value;
      state.filters.size = elements.size.value;
      state.filters.color = elements.color.value;
      state.filters.sort = elements.sort.value;
      renderProducts();
    });
  });

  elements.grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-product]");

    if (button) {
      openProduct(button.dataset.openProduct);
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

function buildFilters(products) {
  fillSelect(elements.category, unique(products.map((product) => product.category)), "Todas");
  fillSelect(elements.size, unique(products.flatMap((product) => product.sizes || [])), "Todos");
  fillSelect(elements.color, unique(products.flatMap((product) => product.colors || [])), "Todas");
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

function renderProducts() {
  const products = filteredProducts();
  elements.grid.innerHTML = "";
  elements.empty.hidden = products.length > 0;
  elements.count.textContent = `${products.length} ${products.length === 1 ? "peça" : "peças"}`;

  products.forEach((product) => {
    elements.grid.append(createProductCard(product));
  });
}

function filteredProducts() {
  const { search, category, size, color, sort } = state.filters;

  return state.products
    .filter((product) => {
      const haystack = [
        product.name,
        product.category,
        product.description,
        ...(product.sizes || []),
        ...(product.colors || [])
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!search || haystack.includes(search)) &&
        (!category || product.category === category) &&
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

  article.innerHTML = `
    <button class="product-photo" type="button" data-open-product="${escapeAttr(product.id)}">
      ${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}" loading="lazy" />` : `<span>Sem foto</span>`}
      ${product.featured ? `<strong>Destaque</strong>` : ""}
    </button>
    <div class="product-content">
      <p class="product-category">${escapeHtml(product.category || "Geral")}</p>
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-price">${money.format(product.price || 0)}</p>
      <div class="chip-row">${renderChips([...(product.sizes || []), ...(product.colors || [])])}</div>
      <div class="product-actions">
        <a class="button button-primary" href="${buildWhatsappUrl(productMessage(product))}">Pedir</a>
        <button class="button button-quiet" type="button" data-open-product="${escapeAttr(product.id)}">Detalhes</button>
      </div>
    </div>
  `;

  return article;
}

function renderChips(items) {
  return items.slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
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

  elements.dialogBody.innerHTML = `
    <div class="dialog-photo">
      ${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}" />` : `<span>Sem foto</span>`}
    </div>
    <div class="dialog-info">
      <p class="product-category">${escapeHtml(product.category || "Geral")}</p>
      <h2>${escapeHtml(product.name)}</h2>
      <p class="product-price">${money.format(product.price || 0)}</p>
      ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
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
    await navigator.clipboard.writeText(`${location.origin}/produto/${product.id}`);
    document.querySelector("#copyProductLink").textContent = "Link copiado";
  });

  if (push) {
    history.pushState({}, "", `/produto/${product.id}`);
  }

  elements.dialog.showModal();
}

function closeProductDialog() {
  elements.dialog.close();

  if (location.pathname.startsWith("/produto/")) {
    history.pushState({}, "", "/");
  }
}

function productMessage(product) {
  return `Olá! Tenho interesse na peça ${product.name} (${money.format(product.price || 0)}).`;
}

function buildWhatsappUrl(message) {
  const phone = state.settings?.whatsapp?.replace(/\D/g, "");

  if (!phone) {
    return "";
  }

  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
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
