"use strict";

// ==================================================
// EMS AUTO PARTS — PRODUCT CATALOGUE
// Advanced search for 112,905+ products across split
// JSON files, with a compact category dropdown.
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

let searchScope = "all";
let brandFilter = "";
let skuFilter = "";
let sortMode = "relevance";

const productCache = new Map();
const productFileCache = new Map();
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
  if (!product || !product.image) return "";

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
  if (!product || !product.productUrl) return "";

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
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
    return true;
  } catch (error) {
    console.error("Could not save shopping cart:", error);
    alert("Unable to save your cart. Please check your browser storage.");
    return false;
  }
}

function updateCartCount() {
  const countElement = document.getElementById("cart-count");
  if (!countElement) return;

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
// CATEGORY DROPDOWN STYLES
// ==================================================

function injectCategoryStyles() {
  if (document.getElementById("ems-category-styles")) return;

  const style = document.createElement("style");
  style.id = "ems-category-styles";

  style.textContent = `
    #categories {
      position: relative;
      display: inline-block;
      width: auto;
      max-width: 100%;
      margin: 0 0 16px;
      z-index: 20;
    }

    #categories .ems-category-dropdown-button {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-width: 190px;
      max-width: min(360px, calc(100vw - 32px));
      padding: 11px 14px;
      border: 1px solid rgba(255, 106, 0, 0.65);
      border-radius: 8px;
      background: #171717;
      color: #fff;
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.16);
    }

    #categories .ems-category-dropdown-button:hover,
    #categories .ems-category-dropdown-button:focus-visible {
      border-color: #ff6a00;
      outline: 2px solid rgba(255, 106, 0, 0.35);
      outline-offset: 2px;
    }

    #categories .ems-category-chevron {
      color: #ff6a00;
      font-size: 0.9em;
      transition: transform 160ms ease;
    }

    #categories .ems-category-dropdown-button[aria-expanded="true"]
    .ems-category-chevron {
      transform: rotate(180deg);
    }

    #categories .ems-category-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      width: min(360px, calc(100vw - 32px));
      max-height: min(65vh, 520px);
      overflow-y: auto;
      padding: 8px;
      margin: 0;
      border: 1px solid rgba(255, 106, 0, 0.45);
      border-radius: 9px;
      background: #171717;
      color: #fff;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
      list-style: none;
    }

    #categories .ems-category-menu[hidden] {
      display: none !important;
    }

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
      width: 100%;
      padding: 9px 10px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    #categories .category:hover {
      background: rgba(255, 106, 0, 0.12);
    }

    #categories .category.active {
      background: rgba(255, 106, 0, 0.2);
      color: #ff8a38;
    }

    #categories .ems-category-toggle {
      flex: 0 0 30px;
      width: 30px;
      min-height: 30px;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.13);
      border-radius: 5px;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    #categories .ems-category-toggle:hover {
      border-color: #ff6a00;
      color: #ff8a38;
    }

    #categories .ems-category-toggle:focus-visible,
    #categories .category:focus-visible {
      outline: 2px solid #ff6a00;
      outline-offset: 1px;
    }

    #categories .ems-category-children {
      padding-left: 12px;
      margin: 2px 0 5px 8px;
      border-left: 1px solid rgba(255, 106, 0, 0.35);
    }

    #categories .ems-category-count {
      display: inline-block;
      margin-left: 5px;
      opacity: 0.65;
      font-size: 0.8em;
      white-space: nowrap;
    }

    #categories .ems-category-all {
      padding-bottom: 5px;
      margin-bottom: 5px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    @media (max-width: 600px) {
      #categories .ems-category-dropdown-button {
        min-width: 170px;
      }

      #categories .ems-category-menu {
        width: min(330px, calc(100vw - 28px));
      }
    }
  `;

  document.head.appendChild(style);
}

// ==================================================
// RENDER CATEGORY TREE
// ==================================================

function renderCategoryNode(node) {
  const hasChildren = node.children.size > 0;
  const expanded = expandedCategories.has(node.path);
  const active = selectedCategory === node.path;

  const childNodes = [...node.children.values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  const childrenHTML = hasChildren && expanded
    ? `
      <ul class="ems-category-list ems-category-children">
        ${childNodes.map(renderCategoryNode).join("")}
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
    : `<span style="flex: 0 0 30px;"></span>`;

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
  if (!categoryContainer) return;

  injectCategoryStyles();

  const tree = buildCategoryTree();

  const rootCategories = [...tree.children.values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedLabel = selectedCategory === "All"
    ? "All Products"
    : selectedCategory.split("/").pop();

  const menuOpen = categoryContainer.dataset.open === "true";

  categoryContainer.innerHTML = `
    <button
      type="button"
      class="ems-category-dropdown-button"
      id="ems-category-dropdown-button"
      aria-haspopup="true"
      aria-expanded="${menuOpen}"
      aria-controls="ems-category-menu"
    >
      <span>
        Categories:
        <span id="ems-selected-category">
          ${escapeHTML(selectedLabel)}
        </span>
      </span>

      <span class="ems-category-chevron" aria-hidden="true">▼</span>
    </button>

    <div
      class="ems-category-menu"
      id="ems-category-menu"
      ${menuOpen ? "" : "hidden"}
    >
      <div class="ems-category-all">
        <button
          type="button"
          class="category${selectedCategory === "All" ? " active" : ""}"
          data-category="All"
          aria-pressed="${selectedCategory === "All"}"
        >
          All Products
          <span class="ems-category-count">
            ${searchIndex.length.toLocaleString()}
          </span>
        </button>
      </div>

      <ul class="ems-category-list">
        ${rootCategories.map(renderCategoryNode).join("")}
      </ul>
    </div>
  `;
}

function closeCategoryMenu() {
  if (!categoryContainer) return;

  categoryContainer.dataset.open = "false";
  renderCategories();
}

// ==================================================
// CATEGORY FILTERING
// ==================================================

function matchesCategory(product) {
  if (selectedCategory === "All") return true;

  const productCategory = normaliseCategoryPath(product.category);
  const selectedPath = normaliseCategoryPath(selectedCategory);

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
    throw new Error("A product file is missing from the search index.");
  }

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
  const filenames = [...new Set(
    entries.map(entry => entry.file).filter(Boolean)
  )];

  await Promise.all(filenames.map(loadProductFile));

  return entries
    .map(entry => productCache.get(String(entry.id)))
    .filter(Boolean);
}

// ==================================================
// ADVANCED SEARCH AND RELEVANCE
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

function getSearchFieldText(product, scope) {
  const fields = {
    name: product.name,
    brand: product.brand,
    sku: product.sku,
    category: product.category,
    id: product.id
  };

  if (scope === "all") {
    return getSearchText(product);
  }

  return String(fields[scope] || "").toLowerCase();
}

function scoreSearchResult(product, query) {
  if (!query) return 0;

  const name = String(product.name || "").toLowerCase();
  const brand = String(product.brand || "").toLowerCase();
  const sku = String(product.sku || "").toLowerCase();
  const id = String(product.id || "").toLowerCase();
  const normalisedQuery = query.trim().toLowerCase();

  if (sku && sku === normalisedQuery) return 1000;
  if (id && id === normalisedQuery) return 950;
  if (name === normalisedQuery) return 900;
  if (name.startsWith(normalisedQuery)) return 800;
  if (brand === normalisedQuery) return 750;
  if (brand.startsWith(normalisedQuery)) return 700;
  if (name.includes(normalisedQuery)) return 600;
  if (sku.includes(normalisedQuery)) return 550;
  if (brand.includes(normalisedQuery)) return 500;

  return 100;
}

function findMatchingEntries() {
  const query = searchInput.value.trim().toLowerCase();

  // Correct whitespace splitting allows multi-word searches.
  const queryTerms = query.split(/\s+/).filter(Boolean);

  const brandQuery = brandFilter.trim().toLowerCase();
  const skuQuery = skuFilter.trim().toLowerCase();

  const matches = searchIndex.filter(product => {
    const scopedText = getSearchFieldText(product, searchScope);

    const matchesQuery = queryTerms.every(term =>
      scopedText.includes(term)
    );

    const matchesBrand = !brandQuery ||
      String(product.brand || "").toLowerCase().includes(brandQuery);

    const matchesSKU = !skuQuery ||
      String(product.sku || "").toLowerCase().includes(skuQuery) ||
      String(product.id || "").toLowerCase().includes(skuQuery);

    return (
      matchesQuery &&
      matchesBrand &&
      matchesSKU &&
      matchesCategory(product)
    );
  });

  if (sortMode === "name") {
    matches.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  } else if (sortMode === "brand") {
    matches.sort((a, b) =>
      String(a.brand || "").localeCompare(String(b.brand || "")) ||
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  } else if (query) {
    matches.sort((a, b) =>
      scoreSearchResult(b, query) - scoreSearchResult(a, query) ||
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }

  return matches;
}

// ==================================================
// ADVANCED SEARCH INTERFACE
// ==================================================

function injectAdvancedSearch() {
  if (
    !searchInput ||
    document.getElementById("ems-advanced-search")
  ) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ems-advanced-search-styles";

  style.textContent = `
    #ems-advanced-search {
      width: min(100%, 760px);
      margin: 8px 0 16px;
      color: inherit;
      font: inherit;
    }

    #ems-advanced-search .ems-advanced-toggle {
      border: 0;
      padding: 6px 0;
      background: transparent;
      color: #ff7a1a;
      font: inherit;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
    }

    #ems-advanced-search .ems-advanced-toggle:hover {
      color: #ff9a52;
    }

    #ems-advanced-search .ems-advanced-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 8px;
      padding: 14px;
      border: 1px solid rgba(255, 106, 0, 0.45);
      border-radius: 9px;
      background: #171717;
      color: #fff;
    }

    #ems-advanced-search .ems-advanced-panel[hidden] {
      display: none !important;
    }

    #ems-advanced-search label {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
      font-size: 0.88rem;
    }

    #ems-advanced-search input,
    #ems-advanced-search select {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: 9px 10px;
      border: 1px solid #555;
      border-radius: 6px;
      background: #242424;
      color: #fff;
      font: inherit;
    }

    #ems-advanced-search input:focus,
    #ems-advanced-search select:focus {
      outline: 2px solid #ff7a1a;
      outline-offset: 1px;
    }

    #ems-advanced-search .ems-advanced-actions {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    #ems-advanced-search .ems-advanced-actions button {
      padding: 9px 13px;
      border: 1px solid #ff7a1a;
      border-radius: 6px;
      background: #ff7a1a;
      color: #111;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    #ems-advanced-search .ems-advanced-actions button:hover {
      filter: brightness(1.08);
    }

    #ems-advanced-search .ems-advanced-actions .ems-reset-search {
      background: transparent;
      color: #fff;
    }

    @media (max-width: 560px) {
      #ems-advanced-search .ems-advanced-panel {
        grid-template-columns: 1fr;
      }

      #ems-advanced-search .ems-advanced-actions {
        grid-column: auto;
      }
    }
  `;

  document.head.appendChild(style);

  const wrapper = document.createElement("section");
  wrapper.id = "ems-advanced-search";

  wrapper.innerHTML = `
    <button
      type="button"
      class="ems-advanced-toggle"
      id="ems-advanced-toggle"
      aria-expanded="false"
      aria-controls="ems-advanced-panel"
    >
      Advanced search +
    </button>

    <div
      class="ems-advanced-panel"
      id="ems-advanced-panel"
      hidden
    >
      <label>
        Search in
        <select id="ems-search-scope">
          <option value="all">All fields</option>
          <option value="name">Product name</option>
          <option value="brand">Brand</option>
          <option value="sku">SKU / product code</option>
          <option value="category">Category</option>
          <option value="id">Product ID</option>
        </select>
      </label>

      <label>
        Brand contains
        <input
          id="ems-brand-filter"
          type="search"
          placeholder="e.g. Ryco"
        >
      </label>

      <label>
        SKU or product ID contains
        <input
          id="ems-sku-filter"
          type="search"
          placeholder="Enter a code"
        >
      </label>

      <label>
        Sort results
        <select id="ems-sort-mode">
          <option value="relevance">Most relevant</option>
          <option value="name">Product name (A–Z)</option>
          <option value="brand">Brand (A–Z)</option>
        </select>
      </label>

      <div class="ems-advanced-actions">
        <button type="button" id="ems-apply-advanced">
          Apply filters
        </button>

        <button
          type="button"
          class="ems-reset-search"
          id="ems-reset-advanced"
        >
          Reset
        </button>
      </div>
    </div>
  `;

  searchInput.insertAdjacentElement("afterend", wrapper);

  const toggle = wrapper.querySelector("#ems-advanced-toggle");
  const panel = wrapper.querySelector("#ems-advanced-panel");

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";

    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open
      ? "Advanced search −"
      : "Advanced search +";

    panel.hidden = !open;
  });

  wrapper
    .querySelector("#ems-apply-advanced")
    .addEventListener("click", () => {
      searchScope = wrapper.querySelector("#ems-search-scope").value;
      brandFilter = wrapper.querySelector("#ems-brand-filter").value;
      skuFilter = wrapper.querySelector("#ems-sku-filter").value;
      sortMode = wrapper.querySelector("#ems-sort-mode").value;

      displayLimit = PRODUCTS_PER_PAGE;
      renderProducts();
    });

  wrapper
    .querySelector("#ems-reset-advanced")
    .addEventListener("click", () => {
      searchInput.value = "";

      wrapper.querySelector("#ems-search-scope").value = "all";
      wrapper.querySelector("#ems-brand-filter").value = "";
      wrapper.querySelector("#ems-sku-filter").value = "";
      wrapper.querySelector("#ems-sort-mode").value = "relevance";

      searchScope = "all";
      brandFilter = "";
      skuFilter = "";
      sortMode = "relevance";
      selectedCategory = "All";
      displayLimit = PRODUCTS_PER_PAGE;

      if (categoryContainer) {
        categoryContainer.dataset.open = "false";
        renderCategories();
      }

      renderProducts();
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

  const price = escapeHTML(formatPrice(
    discountedPrice,
    product.currency || "AUD"
  ));

  const imageURL = getProductImage(product);

  const imageHTML = imageURL
    ? `<img src="${escapeHTML(imageURL)}" alt="${name}" loading="lazy" decoding="async">`
    : `<span>Image unavailable</span>`;

  return `
    <article class="product-card">
      <div class="product-image">${imageHTML}</div>

      <div class="product-info">
        <span class="product-category">${category}</span>
        <h3>${name}</h3>
        <p class="product-brand">${brand}</p>
        <p class="product-price">${price}</p>
        <p class="price-label">EMS Auto Parts</p>

        <a
          class="compare-button details-button"
          href="./product.html?id=${encodeURIComponent(String(product.id))}"
        >View product details</a>

        <button
          type="button"
          class="compare-button add-to-cart-button"
          data-product-id="${escapeHTML(String(product.id))}"
          ${discountedPrice === null ? "disabled" : ""}
        >Add to Cart</button>
      </div>
    </article>
  `;
}

// ==================================================
// RENDER SEARCH RESULTS
// ==================================================

async function renderProducts() {
  if (!productContainer || !searchInput || !resultCount) return;

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
        <p>Try another search, adjust your filters or select All Products.</p>
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

    if (currentVersion !== renderVersion) return;

    resultCount.textContent =
      `Showing ${products.length} of ${totalMatches.toLocaleString()} products`;

    const cardsHTML = products.map(createProductCard).join("");

    const loadMoreHTML = totalMatches > displayLimit
      ? `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px;">
          <button type="button" class="compare-button load-more-button">
            Load More Products
          </button>
        </div>
      `
      : "";

    productContainer.innerHTML = cardsHTML + loadMoreHTML;
  } catch (error) {
    if (currentVersion !== renderVersion) return;

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
// PRODUCT GRID EVENTS
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

    if (!addButton) return;

    const product = productCache.get(
      String(addButton.dataset.productId)
    );

    if (product) addToCart(product);
  });
}

// ==================================================
// LIVE SEARCH
// ==================================================

if (searchInput) {
  let searchTimer;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);

    displayLimit = PRODUCTS_PER_PAGE;

    searchTimer = setTimeout(renderProducts, 150);
  });
}

// ==================================================
// CATEGORY DROPDOWN EVENTS — FIXED
// ==================================================

if (categoryContainer) {
  categoryContainer.dataset.open = "false";

  categoryContainer.addEventListener("click", event => {
    const dropdownButton = event.target.closest(
      "#ems-category-dropdown-button"
    );

    if (dropdownButton) {
      const currentlyOpen =
        categoryContainer.dataset.open === "true";

      categoryContainer.dataset.open = currentlyOpen
        ? "false"
        : "true";

      renderCategories();

      document.removeEventListener(
        "click",
        handleOutsideCategoryClick
      );

      document.removeEventListener(
        "keydown",
        handleCategoryEscape
      );

      if (!currentlyOpen) {
        // Delay registration so the click that opens the menu
        // cannot immediately close it during the same event.
        setTimeout(() => {
          if (categoryContainer.dataset.open === "true") {
            document.addEventListener(
              "click",
              handleOutsideCategoryClick
            );

            document.addEventListener(
              "keydown",
              handleCategoryEscape
            );
          }
        }, 0);
      }

      return;
    }

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

      // Keep the dropdown open when expanding or collapsing a branch.
      categoryContainer.dataset.open = "true";
      renderCategories();

      return;
    }

    const categoryButton = event.target.closest(".category");

    if (!categoryButton) return;

    selectedCategory = categoryButton.dataset.category || "All";
    displayLimit = PRODUCTS_PER_PAGE;

    categoryContainer.dataset.open = "false";

    document.removeEventListener(
      "click",
      handleOutsideCategoryClick
    );

    document.removeEventListener(
      "keydown",
      handleCategoryEscape
    );

    renderCategories();
    renderProducts();
  });
}

function handleOutsideCategoryClick(event) {
  // Ignore the old click target if re-rendering detached it.
  if (!event.target || !event.target.isConnected) return;

  if (
    categoryContainer &&
    !categoryContainer.contains(event.target)
  ) {
    closeCategoryMenu();

    document.removeEventListener(
      "click",
      handleOutsideCategoryClick
    );

    document.removeEventListener(
      "keydown",
      handleCategoryEscape
    );
  }
}

function handleCategoryEscape(event) {
  if (event.key !== "Escape") return;

  closeCategoryMenu();

  document.removeEventListener(
    "click",
    handleOutsideCategoryClick
  );

  document.removeEventListener(
    "keydown",
    handleCategoryEscape
  );

  const button = document.getElementById(
    "ems-category-dropdown-button"
  );

  if (button) button.focus();
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
  injectAdvancedSearch();

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

    renderCategories();
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
