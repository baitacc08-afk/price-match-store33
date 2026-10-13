"use strict";

const productContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const categoryContainer = document.getElementById("categories");

const CATALOGUE_FILE = "./supercheap_products.json";
const CART_STORAGE_KEY = "ems-auto-parts-cart";

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

// ------------------------------
// SHOPPING CART
// ------------------------------

// Retrieve the saved cart.
function getCart() {
  try {
    const cart = JSON.parse(
      localStorage.getItem(CART_STORAGE_KEY) || "[]"
    );

    return Array.isArray(cart) ? cart : [];
  } catch (error) {
    console.error("Could not read shopping cart:", error);
    return [];
  }
}

// Save the cart.
function saveCart(cart) {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cart)
    );

    updateCartCount();

    return true;
  } catch (error) {
    console.error("Could not save shopping cart:", error);

    alert(
      "Unable to save your cart. Please check your browser storage."
    );

    return false;
  }
}

// Update the number displayed beside the Cart button.
function updateCartCount() {
  const countElement = document.getElementById("cart-count");

  if (!countElement) {
    return;
  }

  const totalItems = getCart().reduce(
    (total, item) => total + (Number(item.quantity) || 0),
    0
  );

  countElement.textContent = totalItems;

  countElement.setAttribute(
    "aria-label",
    `${totalItems} items in cart`
  );
}

// Add a product to the cart.
function addToCart(product) {
  if (!product || !product.id) {
    alert("This product cannot be added to your cart.");
    return;
  }

  const cart = getCart();

  const existingItem = cart.find(
    item => item.id === product.id
  );

  if (existingItem) {
    existingItem.quantity =
      (Number(existingItem.quantity) || 0) + 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name || "Unnamed product",
      brand: product.brand || "",
      price: product.price ?? null,
      currency: product.currency || "AUD",
      image: getProductImage(product),
      productUrl: getProductURL(product),
      quantity: 1
    });
  }

  if (saveCart(cart)) {
    const productIndex = allProducts.indexOf(product);

    const button = productContainer.querySelector(
      `.add-to-cart-button[data-product-index="${productIndex}"]`
    );

    if (button) {
      const originalText = button.textContent;

      button.textContent = "✓ Added!";
      button.disabled = true;

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1000);
    }
  }
}

// ------------------------------
// CATEGORY FILTERS
// ------------------------------

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

// ------------------------------
// RENDER PRODUCT CATALOGUE
// ------------------------------

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
      const name = escapeHTML(
        product.name || "Unnamed product"
      );

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
        <article class="product-card">

          <div class="product-image">
            ${imageHTML}
          </div>

          <div class="product-info">

            <span class="product-category">
              ${category}
            </span>

            <h3>${name}</h3>

            <p class="product-brand">
              ${brand}
            </p>

            <p class="product-price">
              ${price}
            </p>

            <p class="price-label">
              Supercheap Auto catalogue
            </p>

            <a
              class="compare-button details-button"
              href="./product.html?id=${encodeURIComponent(product.id)}"
            >
              View product details
            </a>

            <button
              type="button"
              class="compare-button add-to-cart-button"
              data-product-index="${productIndex}"
            >
              🛒 Add to Cart
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

// ------------------------------
// PRODUCT AND CART CLICK HANDLING
// ------------------------------

// Only Add to Cart buttons receive special click handling.
// Clicking a product card, image, name, or description
// will not open a modal or navigate to another page.
productContainer.addEventListener("click", event => {
  const addButton = event.target.closest(
    ".add-to-cart-button"
  );

  if (!addButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const index = Number(addButton.dataset.productIndex);

  if (!Number.isInteger(index) || !allProducts[index]) {
    return;
  }

  addToCart(allProducts[index]);
});

// ------------------------------
// SEARCH PRODUCTS
// ------------------------------

searchInput.addEventListener("input", renderProducts);

// ------------------------------
// CATEGORY FILTERS
// ------------------------------

categoryContainer.addEventListener("click", event => {
  const button = event.target.closest(".category");

  if (!button) {
    return;
  }

  selectedCategory = button.dataset.category || "All";

  document.querySelectorAll(".category").forEach(
    categoryButton => {
      const isActive = categoryButton === button;

      categoryButton.classList.toggle("active", isActive);

      categoryButton.setAttribute(
        "aria-pressed",
        String(isActive)
      );
    }
  );

  renderProducts();
});

// ------------------------------
// LOAD CATALOGUE
// ------------------------------

async function initialiseCatalogue() {
  resultCount.textContent =
    "Loading Supercheap Auto products...";

  updateCartCount();

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
      throw new Error(
        "The catalogue must contain a JSON array."
      );
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
    console.error(
      "Supercheap Auto catalogue error:",
      error
    );

    resultCount.textContent =
      "Unable to load catalogue";

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

// Keep the cart counter updated if the cart changes in another tab.
window.addEventListener("storage", event => {
  if (event.key === CART_STORAGE_KEY) {
    updateCartCount();
  }
});

// Start the catalogue.
initialiseCatalogue();
