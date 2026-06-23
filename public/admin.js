const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const state = {
  products: [],
  settings: null,
  editingId: null
};

const loginView = document.querySelector("#loginView");
const adminApp = document.querySelector("#adminApp");
const passwordWarning = document.querySelector("#passwordWarning");

const fields = {
  productId: document.querySelector("#productId"),
  productName: document.querySelector("#productName"),
  productPrice: document.querySelector("#productPrice"),
  productCategory: document.querySelector("#productCategory"),
  productSizes: document.querySelector("#productSizes"),
  productColors: document.querySelector("#productColors"),
  productDescription: document.querySelector("#productDescription"),
  productImage: document.querySelector("#productImage"),
  productReplaceImages: document.querySelector("#productReplaceImages"),
  replaceImagesToggle: document.querySelector("#replaceImagesToggle"),
  productActive: document.querySelector("#productActive"),
  productInStock: document.querySelector("#productInStock"),
  productFeatured: document.querySelector("#productFeatured"),
  productMessage: document.querySelector("#productMessage"),
  productFormTitle: document.querySelector("#productFormTitle"),
  imagePreview: document.querySelector("#imagePreview"),
  adminSearch: document.querySelector("#adminSearch"),
  adminProductList: document.querySelector("#adminProductList"),
  adminEmptyState: document.querySelector("#adminEmptyState"),
  adminStoreName: document.querySelector("#adminStoreName"),
  settingsMessage: document.querySelector("#settingsMessage")
};

const settingFields = {
  storeName: document.querySelector("#settingStoreName"),
  tagline: document.querySelector("#settingTagline"),
  whatsapp: document.querySelector("#settingWhatsapp"),
  instagram: document.querySelector("#settingInstagram"),
  address: document.querySelector("#settingAddress"),
  notice: document.querySelector("#settingNotice")
};

init();

async function init() {
  bindEvents();

  try {
    const session = await fetchJson("/api/auth/me");
    applySessionState(session);
    await showAdmin();
  } catch {
    loginView.hidden = false;
    adminApp.hidden = true;
  }
}

function bindEvents() {
  document.querySelector("#loginForm").addEventListener("submit", handleLogin);
  document.querySelector("#logoutButton").addEventListener("click", handleLogout);
  document.querySelector("#productForm").addEventListener("submit", handleProductSubmit);
  document.querySelector("#settingsForm").addEventListener("submit", handleSettingsSubmit);
  document.querySelector("#resetProductButton").addEventListener("click", resetProductForm);
  fields.adminSearch.addEventListener("input", renderAdminProducts);
  fields.productImage.addEventListener("change", previewSelectedImage);

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.tab));
  });

  fields.adminProductList.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    const copy = event.target.closest("[data-copy]");

    if (edit) editProduct(edit.dataset.edit);
    if (remove) deleteProduct(remove.dataset.delete);
    if (copy) copyProductLink(copy.dataset.copy, copy);
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const message = document.querySelector("#loginMessage");
  message.textContent = "Entrando...";

  try {
    await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.querySelector("#loginPassword").value })
    });
    applySessionState(await fetchJson("/api/auth/me"));
    message.textContent = "";
    await showAdmin();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function handleLogout() {
  await fetchJson("/api/auth/logout", { method: "POST" });
  location.reload();
}

async function showAdmin() {
  loginView.hidden = true;
  adminApp.hidden = false;
  await loadAdminData();
}

async function loadAdminData() {
  const [settings, products] = await Promise.all([
    fetchJson("/api/settings"),
    fetchJson("/api/admin/products")
  ]);

  state.settings = settings;
  state.products = products;
  fields.adminStoreName.textContent = settings.storeName;
  fillSettingsForm(settings);
  renderAdminProducts();
}

async function handleProductSubmit(event) {
  event.preventDefault();
  fields.productMessage.textContent = "Salvando...";

  const formData = new FormData(event.currentTarget);
  formData.set("active", String(fields.productActive.checked));
  formData.set("inStock", String(fields.productInStock.checked));
  formData.set("featured", String(fields.productFeatured.checked));
  formData.set("replaceImages", String(fields.productReplaceImages.checked));

  if (!fields.productImage.files.length) {
    formData.delete("images");
  }

  const url = state.editingId
    ? `/api/admin/products/${encodeURIComponent(state.editingId)}`
    : "/api/admin/products";
  const method = state.editingId ? "PUT" : "POST";

  try {
    await fetchJson(url, { method, body: formData });
    resetProductForm();
    fields.productMessage.textContent = "Peça salva.";
    await loadAdminData();
  } catch (error) {
    fields.productMessage.textContent = error.message;
  }
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  fields.settingsMessage.textContent = "Salvando...";

  const payload = {
    storeName: settingFields.storeName.value,
    tagline: settingFields.tagline.value,
    whatsapp: settingFields.whatsapp.value,
    instagram: settingFields.instagram.value,
    address: settingFields.address.value,
    notice: settingFields.notice.value,
    heroImage: state.settings.heroImage
  };

  try {
    const settings = await fetchJson("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.settings = settings;
    fields.adminStoreName.textContent = settings.storeName;
    fields.settingsMessage.textContent = "Dados da loja salvos.";
  } catch (error) {
    fields.settingsMessage.textContent = error.message;
  }
}

function renderAdminProducts() {
  const query = fields.adminSearch.value.trim().toLowerCase();
  const products = state.products.filter((product) => {
    return [product.name, product.category, product.description]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  fields.adminProductList.innerHTML = "";
  fields.adminEmptyState.hidden = products.length > 0;

  products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "admin-product-item";
    item.innerHTML = `
      <div class="admin-thumb">
        ${productImages(product)[0] ? `<img src="${escapeAttr(productImages(product)[0])}" alt="${escapeAttr(product.name)}" />` : "<span>Sem foto</span>"}
      </div>
      <div class="admin-product-info">
        <div>
          <p class="product-category">${escapeHtml(product.category || "Geral")}</p>
          <h3>${escapeHtml(product.name)}</h3>
        </div>
        <p>${money.format(product.price || 0)}</p>
        <div class="chip-row">
          <span>${product.active ? "No site" : "Oculta"}</span>
          <span>${product.inStock ? "Disponível" : "Indisponível"}</span>
          <span>${productImages(product).length} ${productImages(product).length === 1 ? "foto" : "fotos"}</span>
          ${product.featured ? "<span>Destaque</span>" : ""}
        </div>
      </div>
      <div class="admin-actions">
        <button class="button button-quiet" type="button" data-copy="${escapeAttr(product.id)}">Copiar link</button>
        <button class="button button-quiet" type="button" data-edit="${escapeAttr(product.id)}">Editar</button>
        <button class="button button-danger" type="button" data-delete="${escapeAttr(product.id)}">Excluir</button>
      </div>
    `;
    fields.adminProductList.append(item);
  });
}

function editProduct(productId) {
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  state.editingId = product.id;
  fields.productId.value = product.id;
  fields.productName.value = product.name;
  fields.productPrice.value = String(product.price || "").replace(".", ",");
  fields.productCategory.value = product.category || "";
  fields.productSizes.value = (product.sizes || []).join(", ");
  fields.productColors.value = (product.colors || []).join(", ");
  fields.productDescription.value = product.description || "";
  fields.productActive.checked = Boolean(product.active);
  fields.productInStock.checked = Boolean(product.inStock);
  fields.productFeatured.checked = Boolean(product.featured);
  fields.productReplaceImages.checked = false;
  fields.replaceImagesToggle.hidden = false;
  fields.productImage.value = "";
  fields.productFormTitle.textContent = "Editar peça";
  fields.productMessage.textContent = "";
  setImagePreview(productImages(product));
  document.querySelector("#productsTab").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteProduct(productId) {
  const product = state.products.find((item) => item.id === productId);

  if (!product || !confirm(`Excluir "${product.name}" do catálogo?`)) {
    return;
  }

  await fetchJson(`/api/admin/products/${encodeURIComponent(productId)}`, {
    method: "DELETE"
  });
  await loadAdminData();
}

function resetProductForm() {
  state.editingId = null;
  document.querySelector("#productForm").reset();
  fields.productActive.checked = true;
  fields.productInStock.checked = true;
  fields.productFeatured.checked = false;
  fields.productReplaceImages.checked = false;
  fields.replaceImagesToggle.hidden = true;
  fields.productFormTitle.textContent = "Nova peça";
  fields.productMessage.textContent = "";
  setImagePreview("");
}

function previewSelectedImage() {
  const files = [...fields.productImage.files];

  if (!files.length) {
    setImagePreview("");
    return;
  }

  Promise.all(
    files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(reader.result));
          reader.readAsDataURL(file);
        })
    )
  ).then((sources) => setImagePreview(sources));
}

function setImagePreview(source) {
  fields.imagePreview.innerHTML = "";
  fields.imagePreview.style.backgroundImage = "";
  const sources = Array.isArray(source) ? source.filter(Boolean) : [source].filter(Boolean);

  if (!sources.length) {
    fields.imagePreview.textContent = "Sem foto";
    return;
  }

  sources.forEach((item, index) => {
    const image = document.createElement("img");
    image.src = item;
    image.alt = `Prévia da foto ${index + 1}`;
    fields.imagePreview.append(image);
  });
}

function fillSettingsForm(settings) {
  settingFields.storeName.value = settings.storeName || "";
  settingFields.tagline.value = settings.tagline || "";
  settingFields.whatsapp.value = settings.whatsapp || "";
  settingFields.instagram.value = settings.instagram || "";
  settingFields.address.value = settings.address || "";
  settingFields.notice.value = settings.notice || "";
}

function selectTab(tabName) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.id === `${tabName}Tab`);
  });
}

function applySessionState(session) {
  passwordWarning.hidden = !session.defaultPassword;
}

function productImages(product = {}) {
  const images = Array.isArray(product.images) ? product.images : [];
  return [...new Set([...images, product.image].filter(Boolean))];
}

async function copyProductLink(productId, button) {
  await navigator.clipboard.writeText(`${location.origin}/produto/${productId}`);
  button.textContent = "Copiado";
  setTimeout(() => {
    button.textContent = "Copiar link";
  }, 1800);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Falha na operação.");
  }

  return response.json();
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
