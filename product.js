"use strict";

// ==================================================
// EMS AUTO PARTS — PRODUCT INFORMATION PAGE
// Loads products from the search index and split JSON files.
// No external retailer links or references.
// ==================================================

const SEARCH_INDEX_FILE = "./search_index_compact.json";

const productDetail = document.getElementById("product-detail");

const productFileCache = new Map();

// ==================================================
// HTML SAFETY
// ==================================================

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// ==================================================
// PRICE FORMATTING
// ==================================================

function formatPrice(price, currency = "AUD") {
  if (
    price === null ||
    price === undefined ||
    price === "" ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return "Price unavailable";
  }

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency
    }).format(Number(price));
  } catch {
    return "Price unavailable";
  }
}

// ==================================================
// PRODUCT IMAGE
// ==================================================

function getProductImage(product) {
  if (!product || !product.image) {
    return "";
  }

  try {
    const url = new URL(product.image);

    if (url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}

// ==================================================
// LOAD SEARCH INDEX
// ==================================================

async function loadSearchIndex() {
  const response = await fetch(SEARCH_INDEX_FILE, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Could not load the product index. HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("The product index has an invalid format.");
  }

  return data;
}

// ==================================================
// LOAD PRODUCT FILE
// ==================================================

async function loadProductFile(filename) {
  if (!filename || typeof filename !== "string") {
    throw new Error("The product file could not be identified.");
  }

  if (productFileCache.has(filename)) {
    return productFileCache.get(filename);
  }

  const request = (async () => {
    const response = await fetch(
      `./${encodeURIComponent(filename)}`,
      { cache: "force-cache" }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load product data. HTTP ${response.status}.`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("The product file has an invalid format.");
    }

    return data;
  })();

  productFileCache.set(filename, request);

  try {
    return await request;
  } catch (error) {
    productFileCache.delete(filename);
    throw error;
  }
}

// ==================================================
// FIND PRODUCT
// ==================================================

async function findProduct(productId) {
  const searchIndex = await loadSearchIndex();

  const indexEntry = searchIndex.find(entry =>
    entry &&
    String(entry.id) === String(productId)
  );

  if (!indexEntry) {
    return null;
  }

  const products = await loadProductFile(indexEntry.file);

  const product = products.find(item =>
    item &&
    String(item.id) === String(productId)
  );

  if (!product) {
    return null;
  }

  return {
    ...indexEntry,
    ...product
  };
}

// ==================================================
// PRODUCT DESCRIPTION
// ==================================================

function getProductDescription(product) {
  const fields = [
    product.description,
    product.longDescription,
    product.long_description,
    product.shortDescription,
    product.short_description,
    product.productDescription,
    product.product_description,
    product.overview
  ];

  for (const description of fields) {
    if (
      typeof description === "string" &&
      description.trim()
    ) {
      return description.trim();
    }
  }

  return "";
}

// ==================================================
// PRODUCT SPECIFICATIONS
// ==================================================

function getProductSpecifications(product) {
  const specifications = [];

  const fields = [
    ["Brand", product.brand],
    ["SKU / Product code", product.sku],
    ["Category", product.category],
    ["Currency", product.currency],
    ["Part number", product.partNumber || product.part_number],
    ["Barcode", product.barcode],
    ["Manufacturer", product.manufacturer],
    ["Model", product.model],
    ["Material", product.material],
    ["Colour", product.colour || product.color],
    ["Size", product.size],
    ["Weight", product.weight],
    ["Dimensions", product.dimensions],
    ["Fitment", product.fitment],
    ["Vehicle compatibility", product.compatibility]
  ];

  const usedLabels = new Set();

  for (const [label, value] of fields) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== "" &&
      !usedLabels.has(label)
    ) {
      specifications.push({
        label,
        value: String(value)
      });

      usedLabels.add(label);
    }
  }

  return specifications;
}

// ==================================================
// PRODUCT FEATURES
// ==================================================

function getProductFeatures(product) {
  const fields = [
    product.features,
    product.bulletPoints,
    product.bullet_points,
    product.highlights,
    product.benefits
  ];

  for (const value of fields) {
    if (Array.isArray(value)) {
      const features = value
        .filter(item =>
          typeof item === "string" &&
          item.trim()
        )
        .map(item => item.trim());

      if (features.length) {
        return features;
      }
    }

    if (typeof value === "string" && value.trim()) {
      const features = value
        .split(/\n|•/)
        .map(item => item.trim())
        .filter(Boolean);

      if (features.length) {
        return features;
      }
    }
  }

  return [];
}

// ==================================================
// LAST CHECKED
// ==================================================

function formatLastChecked(product) {
  const value =
    product.sourceCheckedAt ||
    product.lastChecked ||
    product.last_checked;

  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

// ==================================================
// PRODUCT PAGE STYLING
// ==================================================

function addProductPageStyles() {
  if (document.getElementById("ems-product-page-styles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "ems-product-page-styles";

  style.textContent = `
    .detail-page {
      max-width: 1180px;
      margin: 36px auto;
    }

    .detail-breadcrumb {
      margin-bottom: 22px;
      color: #777;
    }

    .detail-breadcrumb a {
      color: #ff6600;
      text-decoration: none;
    }

    .detail-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
      gap: 36px;
      align-items: start;
      padding: 30px;
      border: 1px solid #e5e5e5;
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.07);
    }

    .detail-image-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 350px;
      padding: 24px;
      border: 1px solid #eee;
      border-radius: 12px;
      background: #f8f8f8;
    }

    .detail-image {
      display: block;
      width: 100%;
      max-height: 470px;
      object-fit: contain;
    }

    .detail-image-fallback {
      display: none;
      padding: 35px 15px;
      color: #777;
      text-align: center;
    }

    .detail-category {
      margin: 0 0 14px;
      color: #ff6600;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.2px;
      line-height: 1.7;
      text-transform: uppercase;
    }

    .detail-title {
      margin: 0 0 18px;
      color: #151515;
      font-size: clamp(26px, 3vw, 36px);
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .detail-brand-line {
      margin: 0 0 20px;
      color: #555;
      font-size: 15px;
    }

    .detail-price-box {
      margin: 24px 0;
      padding: 20px;
      border: 1px solid #ffe0cc;
      border-left: 5px solid #ff6600;
      border-radius: 8px;
      background: #fff8f3;
    }

    .detail-price-label {
      margin: 0 0 6px;
      color: #666;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .detail-price {
      margin: 0;
      color: #111;
      font-size: 30px;
      font-weight: 800;
      line-height: 1.3;
    }

    .detail-price-note {
      margin: 8px 0 0;
      color: #777;
      font-size: 12px;
      line-height: 1.6;
    }

    .detail-section {
      margin-top: 30px;
      padding-top: 24px;
      border-top: 1px solid #e9e9e9;
    }

    .detail-section h2 {
      margin: 0 0 14px;
      color: #171717;
      font-size: 20px;
    }

    .detail-description {
      color: #444;
      font-size: 15px;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }

    .detail-description p {
      margin: 0 0 12px;
      white-space: pre-line;
    }

    .detail-description-empty {
      padding: 16px;
      border-radius: 8px;
      background: #f6f6f6;
      color: #666;
      font-size: 14px;
      line-height: 1.7;
    }

    .detail-specifications {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      margin: 0;
    }

    .detail-specification {
      display: grid;
      grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1.2fr);
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
      font-size: 14px;
      line-height: 1.6;
    }

    .detail-specification dt {
      color: #666;
      font-weight: 600;
    }

    .detail-specification dd {
      margin: 0;
      color: #222;
      overflow-wrap: anywhere;
    }

    .detail-features {
      margin: 0;
      padding-left: 22px;
      color: #444;
      font-size: 14px;
      line-height: 1.8;
    }

    .detail-features li {
      margin-bottom: 8px;
    }

    .detail-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }

    .detail-actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 13px 20px;
      border: 1px solid #ccc;
      border-radius: 7px;
      font-size: 14px;
      font-weight: 700;
      text-align: center;
      text-decoration: none;
      transition: background 0.2s ease;
    }

    .detail-back-button {
      border-color: #ff6600 !important;
      background: #ff6600;
      color: #fff !important;
    }

    .detail-back-button:hover {
      background: #e65c00;
    }

    .detail-source-note {
      margin-top: 18px;
      color: #777;
      font-size: 12px;
      line-height: 1.7;
    }

    .detail-status {
      padding: 55px 20px;
      text-align: center;
      line-height: 1.8;
    }

    .detail-status h1 {
      margin-bottom: 12px;
    }

    .detail-status a {
      color: #ff6600;
    }

    @media (max-width: 760px) {
      .detail-page {
        width: 94%;
        margin: 24px auto;
      }

      .detail-panel {
        grid-template-columns: minmax(0, 1fr);
        gap: 24px;
        padding: 18px;
      }

      .detail-image-container {
        min-height: 240px;
      }

      .detail-title {
        font-size: 26px;
      }

      .detail-actions {
        flex-direction: column;
      }

      .detail-actions a {
        width: 100%;
        box-sizing: border-box;
      }
    }

    @media (max-width: 420px) {
      .detail-specification {
        grid-template-columns: 1fr;
        gap: 3px;
      }
    }
  `;

  document.head.appendChild(style);
}

// ==================================================
// ERROR DISPLAY
// ==================================================

function showError(title, message) {
  productDetail.innerHTML = `
    <div class="detail-status">
      <h1>${escapeHTML(title)}</h1>
      <p>${escapeHTML(message)}</p>
      <a href="./index.html">Return to EMS Auto Parts</a>
    </div>
  `;
}

// ==================================================
// RENDER PRODUCT
// ==================================================

function renderProduct(product) {
  const name = product.name || "Unnamed product";
  const brand = product.brand || "Brand unavailable";
  const category = product.category || "Uncategorised";
  const sku = product.sku || "";
  const currency = product.currency || "AUD";

  const imageURL = getProductImage(product);
  const description = getProductDescription(product);
  const specifications = getProductSpecifications(product);
  const features = getProductFeatures(product);
  const lastChecked = formatLastChecked(product);

  const priceAvailable =
    product.price !== null &&
    product.price !== undefined &&
    product.price !== "" &&
    Number.isFinite(Number(product.price)) &&
    Number(product.price) >= 0;

const DISCOUNT_MULTIPLIER = 0.20;

const price = priceAvailable
    ? formatPrice(Number(product.price) * DISCOUNT_MULTIPLIER, currency)
    : "Price unavailable";

  const imageHTML = imageURL
    ? `
      <div class="detail-image-container">
        <img
          class="detail-image"
          src="${escapeHTML(imageURL)}"
          alt="${escapeHTML(name)}"
          fetchpriority="high"
        >
        <div class="detail-image-fallback">
          Product image unavailable
        </div>
      </div>
    `
    : `
      <div class="detail-image-container">
        <div class="detail-image-fallback" style="display:block">
          No product image is available for this listing.
        </div>
      </div>
    `;

  const descriptionHTML = description
    ? `
      <section class="detail-section">
        <h2>Product description</h2>
        <div class="detail-description">
          <p>${escapeHTML(description)}</p>
        </div>
      </section>
    `
    : `
      <section class="detail-section">
        <h2>Product description</h2>
        <div class="detail-description-empty">
          A detailed description is not available in the current
          catalogue data for this product.
        </div>
      </section>
    `;

  const specificationsHTML = specifications.length
    ? `
      <section class="detail-section">
        <h2>Product information</h2>
        <dl class="detail-specifications">
          ${specifications.map(item => `
            <div class="detail-specification">
              <dt>${escapeHTML(item.label)}</dt>
              <dd>${escapeHTML(item.value)}</dd>
            </div>
          `).join("")}
        </dl>
      </section>
    `
    : "";

  const featuresHTML = features.length
    ? `
      <section class="detail-section">
        <h2>Features</h2>
        <ul class="detail-features">
          ${features.map(feature => `
            <li>${escapeHTML(feature)}</li>
          `).join("")}
        </ul>
      </section>
    `
    : "";

  productDetail.innerHTML = `
    <article class="detail-panel">

      <div class="detail-product-visual">
        ${imageHTML}
      </div>

      <div class="detail-product-information">

        <p class="detail-category">
          ${escapeHTML(category)}
        </p>

        <h1 class="detail-title">
          ${escapeHTML(name)}
        </h1>

        <p class="detail-brand-line">
          <strong>Brand:</strong>
          ${escapeHTML(brand)}
          ${
            sku
              ? `&nbsp; | &nbsp; <strong>SKU:</strong> ${escapeHTML(sku)}`
              : ""
          }
        </p>

        <div class="detail-price-box">
          <p class="detail-price-label">Listed price</p>

          <p class="detail-price">
            ${escapeHTML(price)}
          </p>

          <p class="detail-price-note">
            This is the price recorded in the EMS Auto Parts catalogue.
            Prices may change over time.
          </p>
        </div>

        ${descriptionHTML}
        ${featuresHTML}
        ${specificationsHTML}

        <div class="detail-actions">
          <a
            class="detail-back-button"
            href="./index.html"
          >
            Back to catalogue
          </a>
        </div>

        <p class="detail-source-note">
          ${
            lastChecked
              ? `Product information last checked: ${escapeHTML(lastChecked)}.`
              : "Product information may change over time."
          }
        </p>

      </div>
    </article>
  `;

  const image = productDetail.querySelector(".detail-image");

  if (image) {
    image.addEventListener("error", () => {
      image.style.display = "none";

      const fallback = image.nextElementSibling;

      if (fallback) {
        fallback.style.display = "block";
      }
    }, { once: true });
  }

  document.title = `${name} | EMS Auto Parts`;

  const metaDescription = document.querySelector(
    'meta[name="description"]'
  );

  if (metaDescription) {
    const text = description
      ? `${name} — ${description}`
      : `View product information, specifications and pricing for ${name} at EMS Auto Parts.`;

    metaDescription.setAttribute(
      "content",
      text.slice(0, 155)
    );
  }
}

// ==================================================
// INITIALISE
// ==================================================

async function initialiseProductPage() {
  if (!productDetail) {
    console.error(
      "Product page error: #product-detail was not found."
    );
    return;
  }

  addProductPageStyles();

  const parameters = new URLSearchParams(
    window.location.search
  );

  const productId = parameters.get("id");

  if (!productId) {
    showError(
      "No product selected",
      "Return to the catalogue and select a product to view its information."
    );
    return;
  }

  try {
    const product = await findProduct(productId);

    if (!product) {
      showError(
        "Product not found",
        "This product could not be found in the current catalogue. Return to the catalogue and select another product."
      );
      return;
    }

    renderProduct(product);

  } catch (error) {
    console.error("Product page loading error:", error);

    showError(
      "Unable to load product information",
      "The product details could not be loaded. Please try again later."
    );
  }
}

initialiseProductPage();
