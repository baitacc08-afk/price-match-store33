"use strict";

const CATALOGUE_FILE = "./supercheap_products.json";

const productDetail = document.getElementById("product-detail");

// Escape text before inserting it into HTML.
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Format the product price.
function formatPrice(price, currency = "AUD") {
  if (
    price === null ||
    price === undefined ||
    price === "" ||
    !Number.isFinite(Number(price))
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

// Only allow valid HTTPS Supercheap Auto product URLs.
function getProductURL(product) {
  try {
    const url = new URL(product.productUrl);

    if (
      url.protocol === "https:" &&
      url.hostname === "www.supercheapauto.com.au"
    ) {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}

// Only allow HTTPS product images.
function getProductImage(product) {
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

// Display an error inside the product page.
function showError(title, message) {
  productDetail.innerHTML = `
    <div class="detail-status">
      <h1>${escapeHTML(title)}</h1>
      <p>${escapeHTML(message)}</p>
      <a href="./index.html">Return to EMS Auto Parts</a>
    </div>
  `;
}

// Display the selected product.
function renderProduct(product) {
  const name = escapeHTML(product.name || "Unnamed product");

  const brand = escapeHTML(
    product.brand || "Brand unavailable"
  );

  const category = escapeHTML(
    product.category || "Uncategorised"
  );

  const price = escapeHTML(
    formatPrice(product.price, product.currency || "AUD")
  );

  const imageURL = getProductImage(product);
  const productURL = getProductURL(product);

  const imageHTML = imageURL
    ? `
      <div class="detail-image-container">
        <img
          class="detail-image"
          src="${escapeHTML(imageURL)}"
          alt="${name}"
          onerror="
            this.style.display='none';
            this.nextElementSibling.style.display='block';
          "
        >

        <div class="detail-image-fallback">
          Product image unavailable
        </div>
      </div>
    `
    : `
      <div class="detail-image-container">
        <div class="detail-image-fallback" style="display:block">
          Product image unavailable
        </div>
      </div>
    `;

  const retailerButton = productURL
    ? `
      <a
        class="detail-retailer-button"
        href="${escapeHTML(productURL)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        View at Supercheap Auto
      </a>
    `
    : "";

  productDetail.innerHTML = `
    <article class="detail-panel">
      <div class="detail-product-visual">
        ${imageHTML}
      </div>

      <div class="detail-product-information">
        <p class="detail-category">
          ${category}
        </p>

        <h1 class="detail-title">
          ${name}
        </h1>

        <p class="detail-brand">
          <strong>Brand:</strong> ${brand}
        </p>

        ${
          product.sku
            ? `
              <p class="detail-sku">
                <strong>SKU:</strong>
                ${escapeHTML(product.sku)}
              </p>
            `
            : ""
        }

        <p class="detail-price">
          ${price}
        </p>

        <p class="detail-price-note">
          Listed in the Supercheap Auto catalogue.
          Check the retailer's listing for the latest
          availability and pricing.
        </p>

        ${
          product.description
            ? `
              <div class="detail-description">
                <h2>Product description</h2>
                <p>${escapeHTML(product.description)}</p>
              </div>
            `
            : ""
        }

        <div class="detail-actions">
          ${retailerButton}

          <a
            class="detail-back-button"
            href="./index.html"
          >
            Back to products
          </a>
        </div>
      </div>
    </article>
  `;

  document.title = `${product.name || "Product"} | EMS Auto Parts`;
}

// Load the selected product from the existing catalogue.
async function initialiseProductPage() {
  const parameters = new URLSearchParams(window.location.search);
  const productId = parameters.get("id");

  if (!productId) {
    showError(
      "No product selected",
      "Return to the catalogue and select a product to view its details."
    );
    return;
  }

  try {
    const response = await fetch(CATALOGUE_FILE, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Unable to load the catalogue. HTTP ${response.status}.`
      );
    }

    const products = await response.json();

    if (!Array.isArray(products)) {
      throw new Error("The product catalogue has an invalid format.");
    }

    const product = products.find(item => {
      return (
        item &&
        typeof item.id === "string" &&
        item.id === productId
      );
    });

    if (!product) {
      showError(
        "Product not found",
        "This product could not be found in the current catalogue. Return to the catalogue and select another product."
      );
      return;
    }

    renderProduct(product);
  } catch (error) {
    console.error("Product detail loading error:", error);

    showError(
      "Unable to load product",
      "The product information could not be loaded. Please try again later."
    );
  }
}

initialiseProductPage();
