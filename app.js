"use strict";
const productContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const categoryContainer = document.getElementById("categories");

const CATALOGUE_FILE = "./supercheap_products.json";

let allProducts = [];
let selectedCategory = "All";

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

// Format prices without inventing missing values.
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

// Validate Supercheap Auto product URLs.
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

// Filter products by the selected category.
function matchesCategory(product) {
  if (selectedCategory === "All") {
    return true;
  }

  const category = String(product.category || "").toLowerCase();
  const name = String(product.name || "").toLowerCase();
  const combined = `${category} ${name}`;

  switch (selectedCategory) {
    case "Oils & Fluids":
      return /oil|fluid|lubricant|additive|filter|coolant/.test(combined);

    case "Tools":
      return /tools?|tool kits?|equipment|workshop/.test(combined);

    case "Accessories":
      return /accessor|interior|exterior|car care|cleaning|paint/.test(combined);

    default:
      return category === selectedCategory.toLowerCase();
  }
}

// Create the product details window.
const productModal = document.createElement("dialog");

productModal.id = "product-modal";
productModal.className = "product-modal";

productModal.innerHTML = `
  <button
    type="button"
    class="modal-close"
    aria-label="Close product details"
  >
    &times;
  </button>

  <div id="modal-product-content"></div>
`;

document.body.appendChild(productModal);

const modalContent = document.getElementById("modal-product-content");

// Open the product details window.
function openProductDetails(product) {
  if (!product) {
    return;
  }

  const imageURL = getProductImage(product);
  const productURL = getProductURL(product);
  const name = escapeHTML(product.name || "Unnamed product");
  const brand = escapeHTML(product.brand || "Brand unavailable");
  const category = escapeHTML(product.category || "Uncategorised");
  const price = escapeHTML(
    formatPrice(product.price, product.currency || "AUD")
  );

  const imageHTML = imageURL
    ? `
      <img
        class="modal-product-image"
        src="${escapeHTML(imageURL)}"
        alt="${name}"
        onerror="this.style.display='none';document.getElementById('modal-image-fallback').style.display='grid'"
      >
      <div
        id="modal-image-fallback"
        class="modal-image-fallback"
        style="display:none"
      >
        Image unavailable
      </div>
    `
    : `
      <div class="modal-image-fallback">
        Image unavailable
      </div>
    `;

  modalContent.innerHTML = `
    ${imageHTML}

    <div class="modal-product-information">
      <p class="product-category">${category}</p>

      <h2>${name}</h2>

      <p class="product-brand">
        Brand: ${brand}
      </p>

      <p class="product-price">${price}</p>

      <p class="price-label">
        Listed in the Supercheap Auto catalogue.
      </p>

      ${
        productURL
          ? `
            <a
              class="compare-button modal-retailer-button"
              href="${escapeHTML(productURL)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              View at Supercheap Auto
            </a>
          `
          : `
            <button
              class="compare-button"
              type="button"
              disabled
            >
              Product link unavailable
            </button>
          `
      }
    </div>
  `;

  productModal.showModal();
}

// Close button.
productModal
  .querySelector(".modal-close")
  .addEventListener("click", () => {
    productModal.close();
  });

// Close when the user clicks the backdrop.
productModal.addEventListener("click", event => {
  if (event.target === productModal) {
    productModal.close();
  }
});

// Render the catalogue.
function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter(product => {
    const searchableText = [
      product.name,
      product.brand,
      product.sku,
      product.category,
      product.source
    ]
      .join(" ")
      .toLowerCase();

    return (
      searchableText.includes(query) &&
      matchesCategory(product)
    );
  });

  resultCount.textContent =
    `${filteredProducts.length} product` +
    `${filteredProducts.length === 1 ? "" : "s"}`;

  if (filteredProducts.length === 0) {
    productContainer.innerHTML = `
      <div class="empty-state">
        <h3>No Supercheap Auto products found</h3>
        <p>Try another search or select All products.</p>
      </div>
    `;

    return;
  }

  productContainer.innerHTML = filteredProducts
    .map(product => {
      const name = escapeHTML(product.name || "Unnamed product");
      const brand = escapeHTML(product.brand || "Brand unavailable");
      const category = escapeHTML(product.category || "Uncategorised");

      const price = escapeHTML(
        formatPrice(product.price, product.currency || "AUD")
      );

      const imageURL = getProductImage(product);
      const productURL = getProductURL(product);

      // Use the original catalogue position so clicks open the correct item.
      const productIndex = allProducts.indexOf(product);

      const imageHTML = imageURL
        ? `
          <img
            src="${escapeHTML(imageURL)}"
            alt="${name}"
            loading="lazy"
          >
        `
        : `<span>Image unavailable</span>`;

      return `
        <article
          class="product-card"
          data-product-index="${productIndex}"
          tabindex="0"
          role="button"
          aria-label="View details for ${name}"
        >
          <div class="product-image">
            ${imageHTML}
          </div>

          <div class="product-info">
            <span class="product-category">${category}</span>

            <h3>${name}</h3>

            <p class="product-brand">${brand}</p>

            <p class="product-price">${price}</p>

            <p class="price-label">
              Supercheap Auto catalogue
            </p>

            <button
              class="compare-button details-button"
              type="button"
              data-product-index="${productIndex}"
            >
              View product details
            </button>

            ${
              productURL
                ? `
                  <a
                    class="retailer-link"
                    href="${escapeHTML(productURL)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View at Supercheap Auto
                  </a>
                `
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

// Handle clicks on product cards.
// Retailer links open normally without triggering the product window.
productContainer.addEventListener("click", event => {
  const retailerLink = event.target.closest(".retailer-link");

  if (retailerLink) {
    return;
  }

  const card = event.target.closest(".product-card");

  if (!card) {
    return;
  }

  const index = Number(card.dataset.productIndex);
  openProductDetails(allProducts[index]);
});

// Support keyboard navigation.
productContainer.addEventListener("keydown", event => {
  const card = event.target.closest(".product-card");

  if (!card) {
    return;
  }

  // Let buttons and links handle their own keyboard actions.
  if (event.target.closest("a, button")) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();

    const index = Number(card.dataset.productIndex);
    openProductDetails(allProducts[index]);
  }
});

// Search products as the user types.
searchInput.addEventListener("input", renderProducts);

// Category filters.
categoryContainer.addEventListener("click", event => {
  const button = event.target.closest(".category");

  if (!button) {
    return;
  }

  selectedCategory = button.dataset.category;

  document.querySelectorAll(".category").forEach(categoryButton => {
    const isActive = categoryButton === button;

    categoryButton.classList.toggle("active", isActive);
    categoryButton.setAttribute("aria-pressed", String(isActive));
  });

  renderProducts();
});

// Load ONLY Supercheap Auto products.
async function initialiseCatalogue() {
  resultCount.textContent = "Loading Supercheap Auto products...";

  try {
    const response = await fetch(CATALOGUE_FILE, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load catalogue: HTTP ${response.status}`
      );
    }

    const products = await response.json();

    if (!Array.isArray(products)) {
      throw new Error("The catalogue must contain a JSON array.");
    }

    allProducts = products.filter(product => {
      return (
        product &&
        typeof product.id === "string" &&
        typeof product.name === "string" &&
        product.name.trim() !== ""
      );
    });

    console.log(
      "Supercheap Auto products loaded:",
      allProducts.length
    );

    renderProducts();
  } catch (error) {
    console.error("Supercheap Auto catalogue error:", error);

    resultCount.textContent = "Unable to load catalogue";

    productContainer.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load Supercheap Auto products</h3>
        <p>${escapeHTML(error.message)}</p>
        <p>
          Check that supercheap_products.json is published
          alongside index.html and app.js.
        </p>
      </div>
    `;
  }
}

initialiseCatalogue();
