"use strict";

// ------------------------------
// PAGE ELEMENTS AND CONFIGURATION
// ------------------------------

const productContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const categoryContainer = document.getElementById("categories");

// Keep the existing filename so the product data continues to load.
const CATALOGUE_FILE = "./supercheap_products.json";
const CART_STORAGE_KEY = "ems-auto-parts-cart";

let allProducts = [];
let selectedCategory = "All";

// ------------------------------
// SAFELY ESCAPE HTML
// ------------------------------

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// ------------------------------
// FORMAT PRICES
// ------------------------------

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

// ------------------------------
// EMS AUTO PARTS PRICING
// 75% OFF THE STORED CATALOGUE PRICE
// ------------------------------

function getEMSPrice(price) {
  if (
    price === null ||
    price === undefined ||
    price === "" ||
    !Number.isFinite(Number(price))
  ) {
    return null;
  }

  return Math.round(Number(price) * 25) / 100;
}

// ------------------------------
// PRODUCT IMAGES
// ------------------------------

function getProductImage(product) {
  if (!product || !product.image) {
    return "";
  }

  try {
    const url = new URL(product.image, window.location.href);

    if (
      url.protocol === "https:" &&
      (url.hostname === window.location.hostname ||
        url.hostname.includes("."))
    ) {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}

// ------------------------------
// PRODUCT URLS
// ------------------------------

function getProductURL(product) {
  if (!product || !product.productUrl) {
    return "";
  }

  try {
    const url = new URL(product.productUrl);

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

    const button = productContainer
      ? productContainer.querySelector(
          `.add-to-cart-button[data-product-index="${productIndex}"]`
        )
      : null;

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
// RENDER PRODUCTS
// ------------------------------

function renderProducts() {
  if (!productContainer || !searchInput || !resultCount) {
    console.error("Required product catalogue elements are missing.");
    return;
  }

  const query = searchInput.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter(product => {
    const searchableText = [
      product.name,
      product.brand,
      product.sku,
      product.category
    ]
      .filter(Boolean)
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
        <h3>No products found</h3>
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
              EMS Auto Parts
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

          </div>

        </article>
      `;
    })
    .join("");
}

// ------------------------------
// ADD TO CART BUTTON HANDLING
// ------------------------------

if (productContainer) {
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
}

// ------------------------------
// SEARCH PRODUCTS
// ------------------------------

if (searchInput) {
  searchInput.addEventListener("input", renderProducts);
}

// ------------------------------
// CATEGORY FILTERS
// ------------------------------

if (categoryContainer) {
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
}

// ------------------------------
// LOAD PRODUCT DATA
// ------------------------------

async function initialiseCatalogue() {
  if (!productContainer || !searchInput || !resultCount) {
    console.error(
      "Product catalogue could not start because required HTML elements are missing."
    );
    return;
  }

  resultCount.textContent = "Loading products...";

  updateCartCount();

  try {
    const response = await fetch(CATALOGUE_FILE, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load products: HTTP ${response.status}`
      );
    }

    const products = await response.json();

    if (!Array.isArray(products)) {
      throw new Error(
        "The product data must contain a JSON array."
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
      "EMS Auto Parts products loaded:",
      allProducts.length
    );

    renderProducts();
  } catch (error) {
    console.error(
      "EMS Auto Parts product loading error:",
      error
    );

    resultCount.textContent = "Unable to load products";

    productContainer.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load products</h3>

        <p>${escapeHTML(error.message)}</p>

        <p>
          Please try again later. If the problem continues,
          the product data may be temporarily unavailable.
        </p>
      </div>
    `;
  }
}

// ------------------------------
// KEEP CART COUNT UPDATED
// ------------------------------

window.addEventListener("storage", event => {
  if (event.key === CART_STORAGE_KEY) {
    updateCartCount();
  }
});

// ------------------------------
// START THE PRODUCT CATALOGUE
// ------------------------------

initialiseCatalogue();
