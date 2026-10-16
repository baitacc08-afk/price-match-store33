"use strict";

// ==================================================
// EMS AUTO PARTS — PRODUCT CATALOGUE
// Supports 112,905 products across split JSON files.
// ==================================================

const SEARCH_INDEX_FILE = "./search_index_compact.json";
const CART_STORAGE_KEY = "ems-auto-parts-cart";

const PRODUCTS_PER_PAGE = 24;
const DISCOUNT_MULTIPLIER = 0.25;

const productContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const categoryContainer = document.getElementById("categories");

let searchIndex = [];
let selectedCategory = "All";
let displayLimit = PRODUCTS_PER_PAGE;
let renderVersion = 0;

const productCache = new Map();
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
// PRICES
// ==================================================

function getEMSPrice(price) {
  if (
    price === null ||
    price === undefined ||
    price === "" ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return null;
  }

  return Math.round(
    (Number(price) * DISCOUNT_MULTIPLIER + Number.EPSILON) * 100
  ) / 100;
}

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

// ==================================================
// PRODUCT IMAGES AND URLS
// ==================================================

function getProductImage(product) {
  if (!product || !product.image) {
    return "";
  }

  try {
    const url = new URL(product.image, window.location.href);

    if (
      url.protocol === "https:" ||
      url.origin === window.location.origin
    ) {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}

function getProductURL(product) {
  if (!product || !product.productUrl) {
    return "";
  }

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

// ==================================================
// SHOPPING CART
// ==================================================

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

  const discountedPrice = getEMSPrice(product.price);

  if (discountedPrice === null) {
    alert(
      "This product has no available price and cannot be added to your cart."
    );
    return;
  }

  const cart = getCart();

  const existingItem = cart.find(
    item => String(item.id) === String(product.id)
  );

  if (existingItem) {
    existingItem.name = product.name || existingItem.name;
    existingItem.brand = product.brand || existingItem.brand;
    existingItem.price = discountedPrice;
    existingItem.originalPrice = Number(product.price);
    existingItem.currency = product.currency || "AUD";
    existingItem.image = getProductImage(product);
    existingItem.productUrl = getProductURL(product);
    existingItem.discountPercentage = 75;

    existingItem.quantity =
      (Number(existingItem.quantity) || 0) + 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name || "Unnamed product",
      brand: product.brand || "",
      originalPrice: Number(product.price),
      price: discountedPrice,
      currency: product.currency || "AUD",
      image: getProductImage(product),
      productUrl: getProductURL(product),
      discountPercentage: 75,
      quantity: 1
    });
  }

  if (saveCart(cart)) {
    const button = productContainer.querySelector(
      `.add-to-cart-button[data-product-id="${CSS.escape(String(product.id))}"]`
    );

    if (button) {
      const originalText = button.textContent;

      button.textContent = "Added!";
      button.disabled = true;

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1000);
    }
  }
}

// ==================================================
// CATEGORY FILTERING
// ==================================================

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

// ==================================================
// LOAD INDIVIDUAL PRODUCT FILES
// ==================================================

async function loadProductFile(filename) {
  if (!filename || typeof filename !== "string") {
    throw new Error("A product file is missing from the search index.");
  }

  // Reuse an existing request or cached file.
  if (productFileCache.has(filename)) {
    return productFileCache.get(filename);
  }

  const request = (async () => {
    const response = await fetch(`./${encodeURIComponent(filename)}`, {
      cache: "force-cache"
    });

    if (!response.ok) {
      throw new Error(
        `Unable to load ${filename}: HTTP ${response.status}`
      );
    }

    const products = await response.json();

    if (!Array.isArray(products)) {
      throw new Error(`${filename} does not contain a product array.`);
    }

    for (const product of products) {
      if (product && product.id !== undefined) {
        productCache.set(String(product.id), product);
      }
    }

    return products;
  })();

  productFileCache.set(filename, request);

  try {
    return await request;
  } catch (error) {
    productFileCache.delete(filename);
    throw error;
  }
}

async function loadProductsForEntries(entries) {
  const filenames = [
    ...new Set(entries.map(entry => entry.file).filter(Boolean))
  ];

  await Promise.all(
    filenames.map(filename => loadProductFile(filename))
  );

  return entries
    .map(entry => productCache.get(String(entry.id)))
    .filter(Boolean);
}

// ==================================================
// SEARCH INDEX
// ==================================================

function getSearchText(product) {
  return [
    product.name,
    product.brand,
    product.sku,
    product.category,
    product.id
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function findMatchingEntries() {
  const query = searchInput.value.trim().toLowerCase();

  return searchIndex.filter(product => {
    const searchableText = getSearchText(product);

    return (
      searchableText.includes(query) &&
      matchesCategory(product)
    );
  });
}

// ==================================================
// PRODUCT CARDS
// ==================================================

function createProductCard(product) {
  const name = escapeHTML(product.name || "Unnamed product");
  const brand = escapeHTML(product.brand || "Brand unavailable");
  const category = escapeHTML(product.category || "Uncategorised");

  const discountedPrice = getEMSPrice(product.price);

  const price = escapeHTML(
    formatPrice(discountedPrice, product.currency || "AUD")
  );

  const imageURL = getProductImage(product);

  const imageHTML = imageURL
    ? `
      <img
        src="${escapeHTML(imageURL)}"
        alt="${name}"
        loading="lazy"
        decoding="async"
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
          href="./product.html?id=${encodeURIComponent(String(product.id))}"
        >
          View product details
        </a>

        <button
          type="button"
          class="compare-button add-to-cart-button"
          data-product-id="${escapeHTML(String(product.id))}"
          ${discountedPrice === null ? "disabled" : ""}
        >
          Add to Cart
        </button>

      </div>

    </article>
  `;
}

// ==================================================
// RENDER SEARCH RESULTS
// ==================================================

async function renderProducts() {
  if (!productContainer || !searchInput || !resultCount) {
    return;
  }

  const currentVersion = ++renderVersion;
  const matchingEntries = findMatchingEntries();

  const totalMatches = matchingEntries.length;
  const visibleEntries = matchingEntries.slice(0, displayLimit);

  resultCount.textContent = `Loading products...`;

  if (totalMatches === 0) {
    resultCount.textContent = "0 products";

    productContainer.innerHTML = `
      <div class="no-results">
        <h3>No products found</h3>
        <p>Try another search or select All products.</p>
      </div>
    `;

    return;
  }

  productContainer.innerHTML = `
    <div class="no-results">
      <p>Loading matching products...</p>
    </div>
  `;

  try {
    const products = await loadProductsForEntries(visibleEntries);

    // Ignore old requests if the user searched again.
    if (currentVersion !== renderVersion) {
      return;
    }

    resultCount.textContent =
      `Showing ${products.length} of ${totalMatches.toLocaleString()} products`;

    const cardsHTML = products
      .map(createProductCard)
      .join("");

    const loadMoreHTML = totalMatches > displayLimit
      ? `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px;">
          <button
            type="button"
            class="compare-button load-more-button"
          >
            Load More Products
          </button>
        </div>
      `
      : "";

    productContainer.innerHTML = cardsHTML + loadMoreHTML;

  } catch (error) {
    if (currentVersion !== renderVersion) {
      return;
    }

    console.error("Product loading error:", error);

    resultCount.textContent = "Unable to load products";

    productContainer.innerHTML = `
      <div class="no-results">
        <h3>Unable to load products</h3>
        <p>${escapeHTML(error.message)}</p>
        <p>Please check that the product JSON files are uploaded correctly.</p>
      </div>
    `;
  }
}

// ==================================================
// CATALOGUE EVENT HANDLERS
// ==================================================

if (productContainer) {
  productContainer.addEventListener("click", event => {
    const loadMoreButton = event.target.closest(".load-more-button");

    if (loadMoreButton) {
      displayLimit += PRODUCTS_PER_PAGE;
      renderProducts();
      return;
    }

    const addButton = event.target.closest(".add-to-cart-button");

    if (!addButton) {
      return;
    }

    const product = productCache.get(
      String(addButton.dataset.productId)
    );

    if (product) {
      addToCart(product);
    }
  });
}

if (searchInput) {
  let searchTimer;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);

    displayLimit = PRODUCTS_PER_PAGE;

    searchTimer = setTimeout(() => {
      renderProducts();
    }, 150);
  });
}

if (categoryContainer) {
  categoryContainer.addEventListener("click", event => {
    const button = event.target.closest(".category");

    if (!button) {
      return;
    }

    selectedCategory = button.dataset.category || "All";
    displayLimit = PRODUCTS_PER_PAGE;

    document.querySelectorAll(".category").forEach(categoryButton => {
      const active = categoryButton === button;

      categoryButton.classList.toggle("active", active);
      categoryButton.setAttribute("aria-pressed", String(active));
    });

    renderProducts();
  });
}

// ==================================================
// LOAD SEARCH INDEX
// ==================================================

async function initialiseCatalogue() {
  if (!productContainer || !searchInput || !resultCount) {
    console.error("Required catalogue HTML elements are missing.");
    return;
  }

  updateCartCount();

  resultCount.textContent = "Loading product catalogue...";

  try {
    const response = await fetch(SEARCH_INDEX_FILE, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Unable to load the search index: HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("The search index must contain a JSON array.");
    }

    searchIndex = data.filter(product =>
      product &&
      typeof product.id === "string" &&
      typeof product.name === "string" &&
      typeof product.file === "string"
    );

    console.log(
      "EMS Auto Parts search index loaded:",
      searchIndex.length,
      "products"
    );

    await renderProducts();

  } catch (error) {
    console.error("Catalogue initialisation error:", error);

    resultCount.textContent = "Unable to load products";

    productContainer.innerHTML = `
      <div class="no-results">
        <h3>Unable to load the catalogue</h3>
        <p>${escapeHTML(error.message)}</p>
        <p>
          Check that search_index_compact.json and the product files
          are published alongside index.html.
        </p>
      </div>
    `;
  }
}

// ==================================================
// KEEP CART COUNT UPDATED
// ==================================================

window.addEventListener("storage", event => {
  if (event.key === CART_STORAGE_KEY) {
    updateCartCount();
  }
});

// ==================================================
// START
// ==================================================

initialiseCatalogue();
