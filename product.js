const productContainer = document.getElementById("product-detail");

const CATALOGUE_FILE = "./supercheap_products.json";

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

// Validate product image URLs.
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

// Allow only genuine Supercheap Auto product links.
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

// Format a price without inventing unavailable values.
function formatPrice(price, currency = "AUD") {
  if (
    price === null ||
    price === undefined ||
    price === "" ||
    !Number.isFinite(Number(price))
  ) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency
  }).format(Number(price));
}

// Display a product's details.
function renderProduct(product) {
  const name = escapeHTML(product.name || "Unnamed product");
  const brand = escapeHTML(product.brand || "Brand unavailable");
  const category = escapeHTML(product.category || "Uncategorised");

  const price = escapeHTML(
    formatPrice(product.price, product.currency || "AUD")
  );

  const sku = String(product.sku || "").trim();

  const imageURL = getProductImage(product);
  const productURL = getProductURL(product);

  const imageHTML = imageURL
    ? `
      <img
        class="product-detail-image"
        src="${escapeHTML(imageURL)}"
        alt="${name}"
        onerror="
          this.style.display='none';
          this.nextElementSibling.style.display='block';
        "
      >
      <div class="product-detail-image-fallback" style="display:none">
        Product image unavailable
      </div>
    `
    : `
      <div class="product-detail-image-fallback">
        Product image unavailable
      </div>
    `;

  const externalButton = productURL
    ? `
      <a
        class="product-detail-buy"
        href="${escapeHTML(productURL)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        View at Supercheap Auto
      </a>
    `
    : `
      <p class="product-detail-notice">
        The original product link is unavailable.
      </p>
    `;

  productContainer.innerHTML = `
    <article class="product-detail-card">

      <div class="product-detail-gallery">
        ${imageHTML}
      </div>

      <div class="product-detail-information">

        <span class="product-detail-eyebrow">
          ${category}
        </span>

        <h1>${name}</h1>

        <p class="product-detail-brand">
          Brand: <strong>${brand}</strong>
        </p>

        <p class="product-detail-price">
          ${price}
        </p>

        <p class="product-detail-source">
          Product information supplied by the Supercheap Auto catalogue.
        </p>

        <div class="product-detail-divider"></div>

        <h2>Product Information</h2>

        <dl class="product-specifications">

          <div>
            <dt>Product name</dt>
            <dd>${name}</dd>
          </div>

          <div>
            <dt>Brand</dt>
            <dd>${brand}</dd>
          </div>

          <div>
            <dt>Category</dt>
            <dd>${category}</dd>
          </div>

          ${
            sku
              ? `
                <div>
                  <dt>Product code</dt>
                  <dd>${escapeHTML(sku)}</dd>
                </div>
              `
              : ""
          }

          <div>
            <dt>Retailer</dt>
            <dd>Supercheap Auto</dd>
          </div>

        </dl>

        ${externalButton}

        <a class="product-detail-back" href="index.html">
          Return to Product Catalogue
        </a>

        <p class="product-detail-disclaimer">
          Prices and availability may change. Check the retailer's
          website for current product information and pricing.
        </p>

      </div>

    </article>
  `;

  document.title = `${product.name || "Product"} | EMS Auto Parts`;
}

// Display a helpful message if a product cannot be found.
function showError(message) {
  productContainer.innerHTML = `
    <div class="product-detail-error">
      <h1>Product Not Found</h1>

      <p>${escapeHTML(message)}</p>

      <a class="product-detail-back" href="index.html">
        Return to Product Catalogue
      </a>
    </div>
  `;
}

// Load the selected product.
async function initialiseProductPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  if (!productId) {
    showError("No product was selected.");
    return;
  }

  try {
    const response = await fetch(CATALOGUE_FILE, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Unable to load the product catalogue.");
    }

    const products = await response.json();

    if (!Array.isArray(products)) {
      throw new Error("The product catalogue has an invalid format.");
    }

    const product = products.find(item =>
      item &&
      typeof item.id === "string" &&
      item.id === productId
    );

    if (!product) {
      showError("This product could not be found in the catalogue.");
      return;
    }

    renderProduct(product);

  } catch (error) {
    console.error("Product page error:", error);

    showError(
      "Unable to load this product. Please try again later."
    );
  }
}

initialiseProductPage();
