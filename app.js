"use strict";

// ==================================================
// EMS AUTO PARTS — PRODUCT CATALOGUE
// Supports 112,905+ products across split JSON files.
// Dynamic categories are generated from catalogue data.
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

// Stores the expandable state of category groups.
const expandedCategories = new Set();

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
// CATEGORY DATA
// ==================================================

function normaliseCategoryPath(value) {
  return String(value || "")
    .split("/")
    .map(part => part.trim())
    .filter(Boolean)
    .join("/");
}

function getCategoryParts(value) {
  const normalised = normaliseCategoryPath(value);

  return normalised
    ? normalised.split("/")
    : ["Uncategorised"];
}

// Build a hierarchy from the actual category paths in the index.
// This avoids inventing categories or modifying product records.

function buildCategoryTree() {
  const root = {
    name: "All Products",
    path: "All",
    children: new Map(),
    count: 0
  };

  for (const product of searchIndex) {
    const parts = getCategoryParts(product.category);

    root.count++;

    let currentNode = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath
        ? `${currentPath}/${part}`
        : part;

      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, {
          name: part,
          path: currentPath,
          children: new Map(),
          count: 0
        });
      }

      currentNode = currentNode.children.get(part);
      currentNode.count++;
    }
  }

  return root;
}

// ==================================================
// CATEGORY DISPLAY
// ==================================================

function injectCategoryStyles() {
  if (document.getElementById("ems-category-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ems-category-styles";

  style.textContent = `
    #categories .ems-category-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    #categories .ems-category-item {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    #categories .ems-category-row {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
    }

    #categories .category {
      flex: 1;
      min-width: 0;
      text-align: left;
    }

    #categories .ems-category-toggle {
      flex: 0 0 32px;
      min-width: 32px;
      min-height: 32px;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    #categories .ems-category-toggle:hover {
      border-color: #ff6a00;
    }

    #categories .ems-category-toggle:focus-visible,
    #categories .category:focus-visible {
      outline: 2px solid #ff6a00;
      outline-offset: 2px;
    }

    #categories .ems-category-children {
      padding-left: 14px;
      margin: 3px 0 6px;
      border-left: 1px solid rgba(255, 106, 0, 0.35);
    }

    #categories .ems-category-count {
      display: inline-block;
      margin-left: 6px;
      opacity: 0.7;
      font-size: 0.82em;
      white-space: nowrap;
    }

    #categories .ems-all-products {
      margin-bottom: 8px;
    }
  `;

  document.head.appendChild(style);
}

function renderCategoryNode(node, depth = 0) {
  const hasChildren = node.children.size > 0;
  const expanded = expandedCategories.has(node.path);
  const active = selectedCategory === node.path;

  const childNodes = [...node.children.values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  const childrenHTML = hasChildren && expanded
    ? `
      <ul class="ems-category-list ems-category-children">
        ${childNodes
          .map(child => renderCategoryNode(child, depth + 1))
          .join("")}
      </ul>
    `
    : "";

  const toggleHTML = hasChildren
    ? `
      <button
        type="button"
        class="ems-category-toggle"
        data-toggle-category="${escapeHTML(node.path)}"
        aria-expanded="${expanded}"
        aria-label="${expanded ? "Collapse" : "Expand"} ${escapeHTML(node.name)}"
        title="${expanded ? "Collapse" : "Expand"} ${escapeHTML(node.name)}"
      >${expanded ? "−" : "+"}</button>
    `
    : `
      <span style="flex: 0 0 32px;"></span>
    `;

  return `
    <li class="ems-category-item">
      <div class="ems-category-row">
        ${toggleHTML}

        <button
          type="button"
          class="category${active ? " active" : ""}"
          data-category="${escapeHTML(node.path)}"
          aria-pressed="${active}"
          title="${escapeHTML(node.path)}"
        >
          ${escapeHTML(node.name)}
          <span class="ems-category-count">
            ${node.count.toLocaleString()}
          </span>
        </button>
      </div>

      ${childrenHTML}
    </li>
  `;
}

function renderCategories() {
  if (!categoryContainer) {
    return;
  }

  injectCategoryStyles();

  const tree = buildCategoryTree();

  const allActive = selectedCategory === "All";

  const rootCategories = [...tree.children.values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  categoryContainer.innerHTML = `
    <div class="ems-all-products">
      <button
        type="button"
        class="category${allActive ? " active" : ""}"
        data-category="All"
        aria-pressed="${allActive}"
      >
        All Products
        <span class="ems-category-count">
          ${searchIndex.length.toLocaleString()}
        </span>
      </button>
    </div>

    <ul class="ems-category-list">
      ${rootCategories
        .map(node => renderCategoryNode(node))
        .join("")}
    </ul>
  `;
}

// ==================================================
// CATEGORY FILTERING
// ==================================================

function matchesCategory(product) {
  if (selectedCategory === "All") {
    return true;
  }

  const productCategory = normaliseCategoryPath(product.category);
  const selectedPath = normaliseCategoryPath(selectedCategory);

  // Include products directly in this category and in any
  // nested subcategory beneath it.
  return (
    productCategory === selectedPath ||
    productCategory.startsWith(`${selectedPath}/`)
  );
}

// ==================================================
// LOAD INDIVIDUAL PRODUCT FILES
// ==================================================

async function loadProductFile(filename) {
  if (!filename || typeof filename !== "string") {
    throw new Error(
      "A product file is missing from the search index."
    );
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
        `Unable to load ${filename}: HTTP ${response.status}`
      );
    }

    const products = await response.json();

    if (!Array.isArray(products)) {
      throw new Error(
        `${filename} does not contain a product array.`
      );
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
    ...new Set(
      entries
        .map(entry => entry.file)
        .filter(Boolean)
    )
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
  const name = escapeHTML(
    product.name || "Unnamed product"
  );

  const brand = escapeHTML(
    product.brand || "Brand unavailable"
  );

  const category = escapeHTML(
    product.category || "Uncategorised"
  );

  const discountedPrice = getEMSPrice(product.price);

  const price = escapeHTML(
    formatPrice(
      discountedPrice,
      product.currency || "AUD"
    )
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

  resultCount.textContent = "Loading products...";

  if (totalMatches === 0) {
    resultCount.textContent = "0 products";

    productContainer.innerHTML = `
      <div class="no-results">
        <h3>No products found</h3>
        <p>Try another search or select All Products.</p>
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
    const loadMoreButton = event.target.closest(
      ".load-more-button"
    );

    if (loadMoreButton) {
      displayLimit += PRODUCTS_PER_PAGE;
      renderProducts();
      return;
    }

    const addButton = event.target.closest(
      ".add-to-cart-button"
    );

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
    const toggleButton = event.target.closest(
      "[data-toggle-category]"
    );

    if (toggleButton) {
      const path = toggleButton.dataset.toggleCategory;

      if (expandedCategories.has(path)) {
        expandedCategories.delete(path);
      } else {
        expandedCategories.add(path);
      }

      renderCategories();
      return;
    }

    const button = event.target.closest(".category");

    if (!button) {
      return;
    }

    selectedCategory = button.dataset.category || "All";
    displayLimit = PRODUCTS_PER_PAGE;

    renderCategories();
    renderProducts();
  });
}

// ==================================================
// LOAD SEARCH INDEX
// ==================================================

async function initialiseCatalogue() {
  if (!productContainer || !searchInput || !resultCount) {
    console.error(
      "Required catalogue HTML elements are missing."
    );
    return;
  }

  updateCartCount();

  resultCount.textContent = "Loading product catalogue...";

  try {
    const response = await fetch(
      SEARCH_INDEX_FILE,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load the search index: HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "The search index must contain a JSON array."
      );
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

    renderCategories();

    await renderProducts();

  } catch (error) {
    console.error(
      "Catalogue initialisation error:",
      error
    );

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
