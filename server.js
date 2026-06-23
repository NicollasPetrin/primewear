import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs/promises";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const tokenSecret =
  process.env.ADMIN_TOKEN_SECRET || "catalogo-local-dev-secret-change-before-publishing";

app.set("trust proxy", true);

const publicDir = path.join(__dirname, "public");
const storageDir = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : null;
const bundledDataDir = path.join(__dirname, "data");
const seedUploadsDir = path.join(__dirname, "seed", "uploads");
const dataDir = path.resolve(
  process.env.DATA_DIR || (storageDir ? path.join(storageDir, "data") : bundledDataDir)
);
const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR ||
    (storageDir ? path.join(storageDir, "uploads") : path.join(publicDir, "uploads"))
);
const settingsFile = path.join(dataDir, "settings.json");
const productsFile = path.join(dataDir, "products.json");
const authCookie = "catalog_admin";

const defaultSettings = {
  storeName: "Primewear Imports",
  tagline: "Moda importada com curadoria, elegancia e pronta entrega.",
  whatsapp: "5511989925108",
  instagram: "https://www.instagram.com/primewearimports/",
  address: "",
  notice: "Estilo global para o seu guarda-roupa",
  heroImage: "/assets/boutique-hero.png"
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await seedJson(settingsFile, path.join(bundledDataDir, "settings.json"), defaultSettings);
  await seedJson(productsFile, path.join(bundledDataDir, "products.json"), []);
  await copySeedUploads();
}

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function seedJson(targetFile, sourceFile, fallback) {
  if (await pathExists(targetFile)) {
    return readJson(targetFile, fallback);
  }

  if (path.resolve(targetFile) !== path.resolve(sourceFile) && (await pathExists(sourceFile))) {
    await fs.copyFile(sourceFile, targetFile);
    return readJson(targetFile, fallback);
  }

  await writeJson(targetFile, fallback);
  return fallback;
}

async function copySeedUploads() {
  if (!(await pathExists(seedUploadsDir))) {
    return;
  }

  const entries = await fs.readdir(seedUploadsDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const source = path.join(seedUploadsDir, entry.name);
        const target = path.join(uploadsDir, entry.name);

        if (!(await pathExists(target))) {
          await fs.copyFile(source, target);
        }
      })
  );
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await writeJson(file, fallback);
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cleanText(value, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanPhone(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 18);
}

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item, 40)).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => cleanText(item, 40))
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return value === true || value === "true" || value === "on" || value === "1";
}

function parsePrice(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0 ? price : fallback;
}

function sortProducts(products) {
  return [...products].sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });
}

function productImages(product = {}) {
  const images = Array.isArray(product.images) ? product.images : [];
  return [...new Set([...images, product.image].filter(Boolean))];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function requestOrigin(request) {
  const forwardedProto = request.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.get("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = forwardedProto || request.protocol;
  const host = forwardedHost || request.get("host");

  return `${protocol}://${host}`;
}

function absoluteUrl(request, value) {
  const pathOrUrl = cleanText(value, 300);

  if (!pathOrUrl) {
    return `${requestOrigin(request)}/assets/primewear-logo-cropped.png`;
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${requestOrigin(request)}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function normalizeProduct(input, existing = {}, files = []) {
  const name = cleanText(input.name ?? existing.name, 90);

  if (!name) {
    const error = new Error("Informe o nome da peca.");
    error.status = 400;
    throw error;
  }

  const category = cleanText(input.category ?? existing.category, 50) || "Geral";
  const uploadedImages = files.map((file) => `/uploads/${file.filename}`);
  const replaceImages = parseBoolean(input.replaceImages, false);
  const existingImages = replaceImages ? [] : productImages(existing);
  const images = [...new Set([...existingImages, ...uploadedImages])].slice(0, 12);
  const fallbackImage = cleanText(input.image ?? existing.image, 180);
  const image = images[0] || fallbackImage;

  return {
    id: existing.id || crypto.randomUUID(),
    name,
    price: parsePrice(input.price, existing.price || 0),
    category,
    sizes: parseList(input.sizes ?? existing.sizes),
    colors: parseList(input.colors ?? existing.colors),
    description: cleanText(input.description ?? existing.description, 500),
    image,
    images: image ? [...new Set([image, ...images])] : [],
    featured: parseBoolean(input.featured, existing.featured || false),
    inStock: parseBoolean(input.inStock, existing.inStock ?? true),
    active: parseBoolean(input.active, existing.active ?? true),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function cleanSettings(input) {
  return {
    storeName: cleanText(input.storeName, 70) || defaultSettings.storeName,
    tagline: cleanText(input.tagline, 180) || defaultSettings.tagline,
    whatsapp: cleanPhone(input.whatsapp),
    instagram: cleanText(input.instagram, 80),
    address: cleanText(input.address, 160),
    notice: cleanText(input.notice, 100) || defaultSettings.notice,
    heroImage: cleanText(input.heroImage, 180) || defaultSettings.heroImage
  };
}

function productMetaDescription(product) {
  const parts = [
    product.category,
    money.format(product.price || 0),
    product.sizes?.length ? `Tamanhos: ${product.sizes.join(", ")}` : "",
    product.colors?.length ? `Cores: ${product.colors.join(", ")}` : ""
  ].filter(Boolean);

  return cleanText(product.description || parts.join(" | "), 220);
}

function renderMetaPage(html, meta) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const image = escapeHtml(meta.image);
  const siteName = escapeHtml(meta.siteName);
  const tags = [
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="${siteName}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:secure_url" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`
  ].join("\n    ");

  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${description}" />`
    )
    .replace("</head>", `    ${tags}\n  </head>`);
}

async function renderProductPage(request, product, settings) {
  const html = await fs.readFile(path.join(publicDir, "index.html"), "utf8");
  const image = productImages(product)[0] || settings.heroImage || defaultSettings.heroImage;
  const title = `${product.name} | ${settings.storeName}`;
  const description = productMetaDescription(product) || settings.tagline;

  return renderMetaPage(html, {
    title,
    description,
    siteName: settings.storeName,
    image: absoluteUrl(request, image),
    url: absoluteUrl(request, `/produto/${encodeURIComponent(product.id)}`)
  });
}

function signPayload(payload) {
  return crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
}

function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [payload, signature] = token.split(".");
  const expected = signPayload(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(session.exp) > Date.now();
  } catch {
    return false;
  }
}

function passwordMatches(password) {
  const input = Buffer.from(String(password ?? ""));
  const expected = Buffer.from(String(adminPassword));

  if (input.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(input, expected);
}

function requireAdmin(request, response, next) {
  if (verifySessionToken(request.cookies[authCookie])) {
    next();
    return;
  }

  response.status(401).json({ error: "Acesso administrativo necessario." });
}

async function removeUploadedImage(imagePath) {
  if (!imagePath || !imagePath.startsWith("/uploads/")) {
    return;
  }

  const absolutePath = path.join(uploadsDir, path.basename(imagePath));

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

    if (!allowed.has(file.mimetype)) {
      callback(new Error("Envie uma imagem JPG, PNG, WEBP ou GIF."));
      return;
    }

    callback(null, true);
  }
});

await ensureStorage();

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(publicDir));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/settings", async (_request, response, next) => {
  try {
    response.json(await readJson(settingsFile, defaultSettings));
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async (_request, response, next) => {
  try {
    const products = await readJson(productsFile, []);
    response.json(sortProducts(products).filter((product) => product.active));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (request, response) => {
  if (!passwordMatches(request.body.password)) {
    response.status(401).json({ error: "Senha incorreta." });
    return;
  }

  response.cookie(authCookie, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
  response.json({ ok: true });
});

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie(authCookie);
  response.json({ ok: true });
});

app.get("/api/auth/me", requireAdmin, (_request, response) => {
  response.json({
    authenticated: true,
    defaultPassword: !process.env.ADMIN_PASSWORD
  });
});

app.get("/api/admin/products", requireAdmin, async (_request, response, next) => {
  try {
    response.json(sortProducts(await readJson(productsFile, [])));
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/settings", requireAdmin, async (request, response, next) => {
  try {
    const settings = cleanSettings(request.body);
    await writeJson(settingsFile, settings);
    response.json(settings);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/admin/products",
  requireAdmin,
  upload.array("images", 12),
  async (request, response, next) => {
    try {
      const products = await readJson(productsFile, []);
      const product = normalizeProduct(request.body, {}, request.files || []);
      products.push(product);
      await writeJson(productsFile, products);
      response.status(201).json(product);
    } catch (error) {
      if (request.files?.length) {
        await Promise.all(
          request.files.map((file) => removeUploadedImage(`/uploads/${file.filename}`))
        );
      }

      next(error);
    }
  }
);

app.put(
  "/api/admin/products/:id",
  requireAdmin,
  upload.array("images", 12),
  async (request, response, next) => {
    try {
      const products = await readJson(productsFile, []);
      const index = products.findIndex((product) => product.id === request.params.id);

      if (index === -1) {
        response.status(404).json({ error: "Produto nao encontrado." });
        return;
      }

      const previous = products[index];
      const product = normalizeProduct(request.body, previous, request.files || []);
      products[index] = product;
      await writeJson(productsFile, products);

      if (parseBoolean(request.body.replaceImages, false)) {
        const currentImages = new Set(productImages(product));
        await Promise.all(
          productImages(previous)
            .filter((image) => !currentImages.has(image))
            .map((image) => removeUploadedImage(image))
        );
      }

      response.json(product);
    } catch (error) {
      if (request.files?.length) {
        await Promise.all(
          request.files.map((file) => removeUploadedImage(`/uploads/${file.filename}`))
        );
      }

      next(error);
    }
  }
);

app.delete("/api/admin/products/:id", requireAdmin, async (request, response, next) => {
  try {
    const products = await readJson(productsFile, []);
    const product = products.find((item) => item.id === request.params.id);

    if (!product) {
      response.status(404).json({ error: "Produto nao encontrado." });
      return;
    }

    await writeJson(
      productsFile,
      products.filter((item) => item.id !== request.params.id)
    );
    await Promise.all(productImages(product).map((image) => removeUploadedImage(image)));
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/admin", (_request, response) => {
  response.sendFile(path.join(publicDir, "admin.html"));
});

app.get("/produto/:id", async (request, response, next) => {
  try {
    const [settings, products] = await Promise.all([
      readJson(settingsFile, defaultSettings),
      readJson(productsFile, [])
    ]);
    const product = products.find((item) => item.id === request.params.id && item.active);

    if (!product) {
      response.status(404).sendFile(path.join(publicDir, "index.html"));
      return;
    }

    response.send(await renderProductPage(request, product, settings));
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  const message =
    status === 500 ? "Nao foi possivel concluir a operacao agora." : error.message;

  if (status === 500) {
    console.error(error);
  }

  response.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`Catalogo online em http://localhost:${port}`);

  if (!process.env.ADMIN_PASSWORD) {
    console.log("Senha admin inicial: admin123");
    console.log("Antes de publicar, defina ADMIN_PASSWORD no ambiente.");
  }
});
