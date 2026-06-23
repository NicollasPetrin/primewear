const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const state = {
  products: [],
  settings: null,
  editingId: null,
  selectedImages: [],
  existingImages: [],
  imageEditor: {
    index: null,
    image: null,
    minScale: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    drag: null
  }
};

const loginView = document.querySelector("#loginView");
const adminApp = document.querySelector("#adminApp");
const passwordWarning = document.querySelector("#passwordWarning");

const fields = {
  productId: document.querySelector("#productId"),
  productName: document.querySelector("#productName"),
  productPrice: document.querySelector("#productPrice"),
  productCategory: document.querySelector("#productCategory"),
  productBrand: document.querySelector("#productBrand"),
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
  settingsMessage: document.querySelector("#settingsMessage"),
  imageEditorDialog: document.querySelector("#imageEditorDialog"),
  imageEditorCanvas: document.querySelector("#imageEditorCanvas"),
  imageEditorZoom: document.querySelector("#imageEditorZoom"),
  imageEditorReset: document.querySelector("#imageEditorReset"),
  imageEditorApply: document.querySelector("#imageEditorApply"),
  imageEditorClose: document.querySelector("#imageEditorClose")
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
  fields.productReplaceImages.addEventListener("change", renderImagePreview);
  fields.imagePreview.addEventListener("click", handleImagePreviewClick);
  fields.imageEditorClose.addEventListener("click", closeImageEditor);
  fields.imageEditorReset.addEventListener("click", resetImageEditor);
  fields.imageEditorApply.addEventListener("click", applyImageEdit);
  fields.imageEditorZoom.addEventListener("input", updateEditorZoom);
  fields.imageEditorCanvas.addEventListener("pointerdown", startEditorDrag);
  fields.imageEditorCanvas.addEventListener("pointermove", moveEditorDrag);
  fields.imageEditorCanvas.addEventListener("pointerup", stopEditorDrag);
  fields.imageEditorCanvas.addEventListener("pointercancel", stopEditorDrag);
  fields.imageEditorCanvas.addEventListener("wheel", handleEditorWheel, { passive: false });

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
    openProductRegistration();
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

function openProductRegistration() {
  selectTab("products");
  resetProductForm();
  document.querySelector("#productsTab").scrollIntoView({ behavior: "smooth", block: "start" });
  fields.productName.focus({ preventScroll: true });
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
  const shouldReplaceImages =
    fields.productReplaceImages.checked || state.selectedImages.some((item) => item.fromExisting);
  formData.set("active", String(fields.productActive.checked));
  formData.set("inStock", String(fields.productInStock.checked));
  formData.set("featured", String(fields.productFeatured.checked));
  formData.set("replaceImages", String(shouldReplaceImages));
  formData.delete("images");

  state.selectedImages.forEach((item, index) => {
    const image = item.editedBlob || item.file;
    const fileName = item.editedBlob ? editedFileName(item.file.name, index) : item.file.name;
    formData.append("images", image, fileName);
  });

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
    return [product.name, product.category, product.brand, product.description]
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
          <p class="product-category">${escapeHtml(product.brand || product.category || "Geral")}</p>
          <h3>${escapeHtml(product.name)}</h3>
        </div>
        <p>${money.format(product.price || 0)}</p>
        <div class="chip-row">
          <span>${escapeHtml(product.category || "Geral")}</span>
          ${product.brand ? `<span>${escapeHtml(product.brand)}</span>` : ""}
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
  fields.productBrand.value = product.brand || "";
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
  clearSelectedImages();
  state.existingImages = productImages(product);
  renderImagePreview();
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
  clearSelectedImages();
  state.existingImages = [];
  document.querySelector("#productForm").reset();
  fields.productActive.checked = true;
  fields.productInStock.checked = true;
  fields.productFeatured.checked = false;
  fields.productBrand.value = "";
  fields.productReplaceImages.checked = false;
  fields.replaceImagesToggle.hidden = true;
  fields.productFormTitle.textContent = "Nova peça";
  fields.productMessage.textContent = "";
  renderImagePreview();
}

function previewSelectedImage() {
  const files = [...fields.productImage.files];

  if (!files.length) {
    renderImagePreview();
    return;
  }

  const availableSlots = remainingImageSlots();

  if (availableSlots <= 0) {
    fields.productMessage.textContent = "Limite de 12 fotos por produto.";
    fields.productImage.value = "";
    renderImagePreview();
    return;
  }

  const existingKeys = new Set(state.selectedImages.map((item) => fileKey(item.file)));
  const imagesToAdd = files
    .filter((file) => !existingKeys.has(fileKey(file)))
    .slice(0, availableSlots)
    .map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      editedBlob: null,
      fromExisting: false
    }));

  state.selectedImages.push(...imagesToAdd);
  fields.productImage.value = "";
  fields.productMessage.textContent =
    files.length > imagesToAdd.length
      ? "Algumas fotos nao entraram porque o limite e 12 por produto."
      : "";
  renderImagePreview();
}

function renderImagePreview() {
  fields.imagePreview.innerHTML = "";
  fields.imagePreview.style.backgroundImage = "";
  const showExistingImages =
    state.existingImages.length > 0 &&
    !fields.productReplaceImages.checked &&
    !state.selectedImages.some((item) => item.fromExisting);
  const cards = [
    ...(showExistingImages
      ? state.existingImages.map((source, index) => ({
          type: "existing",
          index,
          source,
          label: "Atual",
          editable: true,
          removable: false
        }))
      : []),
    ...state.selectedImages.map((item, index) => ({
      type: "selected",
      index,
      source: item.previewUrl,
      label: item.fromExisting ? "Atual editada" : "Nova",
      editable: true,
      removable: !item.fromExisting
    }))
  ];

  if (!cards.length) {
    fields.imagePreview.textContent = "Sem foto";
    return;
  }

  cards.forEach((item, visualIndex) => {
    const card = document.createElement("div");
    card.className = "image-preview-card";

    const image = document.createElement("img");
    image.src = item.source;
    image.alt = `Prévia da foto ${visualIndex + 1}`;
    card.append(image);

    const badge = document.createElement("span");
    badge.className = "image-preview-badge";
    badge.textContent = item.label;
    card.append(badge);

    if (item.editable) {
      const editButton = document.createElement("button");
      editButton.className = "button button-quiet image-edit-button";
      editButton.type = "button";
      editButton.textContent = "Editar";

      if (item.type === "existing") {
        editButton.dataset.editExistingImage = String(item.index);
      } else {
        editButton.dataset.editSelectedImage = String(item.index);
      }

      card.append(editButton);
    }

    if (item.removable) {
      const removeButton = document.createElement("button");
      removeButton.className = "button button-quiet image-remove-button";
      removeButton.type = "button";
      removeButton.dataset.removeSelectedImage = String(item.index);
      removeButton.textContent = "Remover";
      card.append(removeButton);
    }

    fields.imagePreview.append(card);
  });
}

function renderSelectedImagePreview() {
  renderImagePreview();
}

function clearSelectedImages() {
  state.selectedImages.forEach((item) => {
    if (item.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
  state.selectedImages = [];
}

function removeSelectedImage(index) {
  const [item] = state.selectedImages.splice(index, 1);

  if (item?.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(item.previewUrl);
  }

  fields.productMessage.textContent = "";
  renderImagePreview();
}

function remainingImageSlots() {
  const replacingExisting =
    fields.productReplaceImages.checked || state.selectedImages.some((item) => item.fromExisting);
  const currentCount = (replacingExisting ? 0 : state.existingImages.length) + state.selectedImages.length;
  return Math.max(12 - currentCount, 0);
}

function fileKey(file) {
  return [file.name, file.size, file.lastModified].join(":");
}

async function handleImagePreviewClick(event) {
  const removeButton = event.target.closest("[data-remove-selected-image]");

  if (removeButton) {
    removeSelectedImage(Number(removeButton.dataset.removeSelectedImage));
    return;
  }

  const selectedButton = event.target.closest("[data-edit-selected-image]");

  if (selectedButton) {
    openImageEditor(Number(selectedButton.dataset.editSelectedImage));
    return;
  }

  const existingButton = event.target.closest("[data-edit-existing-image]");

  if (!existingButton) {
    return;
  }

  const index = Number(existingButton.dataset.editExistingImage);

  if (state.existingImages[index]) {
    try {
      fields.productMessage.textContent = "Preparando foto...";
      await prepareExistingImagesForEditing();
      fields.productMessage.textContent = "";
    } catch (error) {
      fields.productMessage.textContent = error.message;
      return;
    }
  }

  openImageEditor(index);
}

async function prepareExistingImagesForEditing() {
  if (!state.existingImages.length) {
    return;
  }

  const queuedImages = state.selectedImages;
  const images = await Promise.all(
    state.existingImages.map(async (source, index) => {
      const response = await fetch(source);

      if (!response.ok) {
        throw new Error("Nao foi possivel preparar a foto atual.");
      }

      const blob = await response.blob();
      const extension = mimeExtension(blob.type);
      const file = new File([blob], `foto-atual-${index + 1}.${extension}`, {
        type: blob.type || "image/jpeg"
      });

      return {
        id: `existing-${Date.now()}-${index}`,
        file,
        previewUrl: URL.createObjectURL(blob),
        editedBlob: null,
        fromExisting: true
      };
    })
  );

  state.selectedImages = [...images, ...queuedImages];
  state.existingImages = [];
  fields.productReplaceImages.checked = true;
  fields.replaceImagesToggle.hidden = false;
  renderImagePreview();
}

function openImageEditor(index) {
  const item = state.selectedImages[index];

  if (!item) {
    return;
  }

  const image = new Image();
  image.addEventListener("load", () => {
    state.imageEditor.index = index;
    state.imageEditor.image = image;
    state.imageEditor.drag = null;
    fitEditorImage();
    fields.imageEditorDialog.showModal();
  });
  image.addEventListener("error", () => {
    fields.productMessage.textContent = "Nao foi possivel abrir essa foto.";
  });
  image.src = item.previewUrl;
}

function closeImageEditor() {
  state.imageEditor.index = null;
  state.imageEditor.image = null;
  state.imageEditor.drag = null;

  if (fields.imageEditorDialog.open) {
    fields.imageEditorDialog.close();
  }
}

function fitEditorImage() {
  const { image } = state.imageEditor;

  if (!image) {
    return;
  }

  const canvas = fields.imageEditorCanvas;
  const minScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  state.imageEditor.minScale = minScale;
  state.imageEditor.scale = minScale;
  state.imageEditor.offsetX = (canvas.width - image.naturalWidth * minScale) / 2;
  state.imageEditor.offsetY = (canvas.height - image.naturalHeight * minScale) / 2;
  fields.imageEditorZoom.value = "1";
  clampEditorImage();
  drawImageEditor();
}

function resetImageEditor() {
  fitEditorImage();
}

function updateEditorZoom() {
  setEditorZoom(Number(fields.imageEditorZoom.value));
}

function handleEditorWheel(event) {
  if (!fields.imageEditorDialog.open || !state.imageEditor.image) {
    return;
  }

  event.preventDefault();
  const nextZoom = Number(fields.imageEditorZoom.value) + (event.deltaY > 0 ? -0.08 : 0.08);
  setEditorZoom(nextZoom);
}

function setEditorZoom(value) {
  const editor = state.imageEditor;

  if (!editor.image) {
    return;
  }

  const zoom = clamp(value, 1, 3);
  const nextScale = editor.minScale * zoom;
  const ratio = nextScale / editor.scale;
  const canvas = fields.imageEditorCanvas;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  editor.offsetX = centerX - (centerX - editor.offsetX) * ratio;
  editor.offsetY = centerY - (centerY - editor.offsetY) * ratio;
  editor.scale = nextScale;
  fields.imageEditorZoom.value = String(zoom);
  clampEditorImage();
  drawImageEditor();
}

function startEditorDrag(event) {
  if (!state.imageEditor.image) {
    return;
  }

  const point = editorCanvasPoint(event);
  state.imageEditor.drag = {
    pointerId: event.pointerId,
    x: point.x,
    y: point.y
  };
  fields.imageEditorCanvas.setPointerCapture(event.pointerId);
}

function moveEditorDrag(event) {
  const drag = state.imageEditor.drag;

  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const point = editorCanvasPoint(event);
  state.imageEditor.offsetX += point.x - drag.x;
  state.imageEditor.offsetY += point.y - drag.y;
  drag.x = point.x;
  drag.y = point.y;
  clampEditorImage();
  drawImageEditor();
}

function stopEditorDrag(event) {
  const drag = state.imageEditor.drag;

  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  if (fields.imageEditorCanvas.hasPointerCapture(event.pointerId)) {
    fields.imageEditorCanvas.releasePointerCapture(event.pointerId);
  }

  state.imageEditor.drag = null;
}

function editorCanvasPoint(event) {
  const canvas = fields.imageEditorCanvas;
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function clampEditorImage() {
  const editor = state.imageEditor;
  const canvas = fields.imageEditorCanvas;

  if (!editor.image) {
    return;
  }

  const imageWidth = editor.image.naturalWidth * editor.scale;
  const imageHeight = editor.image.naturalHeight * editor.scale;

  editor.offsetX =
    imageWidth <= canvas.width
      ? (canvas.width - imageWidth) / 2
      : clamp(editor.offsetX, canvas.width - imageWidth, 0);
  editor.offsetY =
    imageHeight <= canvas.height
      ? (canvas.height - imageHeight) / 2
      : clamp(editor.offsetY, canvas.height - imageHeight, 0);
}

function drawImageEditor() {
  const editor = state.imageEditor;
  const canvas = fields.imageEditorCanvas;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f7f4ed";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (!editor.image) {
    return;
  }

  const width = editor.image.naturalWidth * editor.scale;
  const height = editor.image.naturalHeight * editor.scale;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(editor.image, editor.offsetX, editor.offsetY, width, height);

  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 2;
  for (let line = 1; line < 3; line += 1) {
    const x = (canvas.width / 3) * line;
    const y = (canvas.height / 3) * line;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(184, 137, 58, 0.95)";
  context.lineWidth = 6;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.restore();
}

async function applyImageEdit() {
  const item = state.selectedImages[state.imageEditor.index];

  if (!item || !state.imageEditor.image) {
    return;
  }

  const blob = await canvasToBlob(fields.imageEditorCanvas, "image/jpeg", 0.9);

  if (!blob) {
    fields.productMessage.textContent = "Nao foi possivel aplicar o recorte.";
    return;
  }

  if (item.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(item.previewUrl);
  }

  item.editedBlob = blob;
  item.previewUrl = URL.createObjectURL(blob);
  renderSelectedImagePreview();
  closeImageEditor();
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function editedFileName(originalName, index) {
  const baseName = String(originalName || `foto-${index + 1}`)
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 60);

  return `${baseName || `foto-${index + 1}`}-recorte.jpg`;
}

function mimeExtension(type) {
  const extensions = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return extensions[type] || "jpg";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
