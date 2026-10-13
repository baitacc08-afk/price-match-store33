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

// Escape text before inserting it into HTML.
// ------------------------------
// SAFELY ESCAPE HTML
// ------------------------------

function escapeHTML(value = "") {
return String(value).replace(/[&<>"']/g, character => ({
"&": "&amp;",
@@ -22,7 +30,10 @@ function escapeHTML(value = "") {
})[character]);
}

// Format prices without inventing missing values.
// ------------------------------
// FORMAT PRICES
// ------------------------------

function formatPrice(price, currency = "AUD") {
if (
price === null ||
@@ -33,17 +44,53 @@ function formatPrice(price, currency = "AUD") {
return "Price unavailable";
}

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency
  }).format(Number(price));
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
// PRODUCT IMAGES
// ------------------------------

// Validate product image URLs.
function getProductImage(product) {
  if (!product || !product.image) {
    return "";
  }

try {
    const url = new URL(product.image);
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
@@ -59,7 +106,6 @@ function getProductImage(product) {
// SHOPPING CART
// ------------------------------

// Retrieve the saved cart.
function getCart() {
try {
const cart = JSON.parse(
@@ -73,7 +119,6 @@ function getCart() {
}
}

// Save the cart.
function saveCart(cart) {
try {
localStorage.setItem(
@@ -95,7 +140,6 @@ function saveCart(cart) {
}
}

// Update the number displayed beside the Cart button.
function updateCartCount() {
const countElement = document.getElementById("cart-count");

@@ -116,7 +160,6 @@ function updateCartCount() {
);
}

// Add a product to the cart.
function addToCart(product) {
if (!product || !product.id) {
alert("This product cannot be added to your cart.");
@@ -148,9 +191,11 @@ function addToCart(product) {
if (saveCart(cart)) {
const productIndex = allProducts.indexOf(product);

    const button = productContainer.querySelector(
      `.add-to-cart-button[data-product-index="${productIndex}"]`
    );
    const button = productContainer
      ? productContainer.querySelector(
          `.add-to-cart-button[data-product-index="${productIndex}"]`
        )
      : null;

if (button) {
const originalText = button.textContent;
@@ -195,20 +240,25 @@ function matchesCategory(product) {
}

// ------------------------------
// RENDER PRODUCT CATALOGUE
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
      product.category,
      product.source
      product.category
]
      .filter(Boolean)
.join(" ")
.toLowerCase();

@@ -225,7 +275,7 @@ function renderProducts() {
if (filteredProducts.length === 0) {
productContainer.innerHTML = `
     <div class="empty-state">
        <h3>No Supercheap Auto products found</h3>
        <h3>No products found</h3>
       <p>Try another search or select All products.</p>
     </div>
   `;
@@ -288,7 +338,7 @@ function renderProducts() {
           </p>

           <p class="price-label">
              Supercheap Auto catalogue
              EMS Auto Parts
           </p>

           <a
@@ -315,75 +365,84 @@ function renderProducts() {
}

// ------------------------------
// PRODUCT AND CART CLICK HANDLING
// ADD TO CART BUTTON HANDLING
// ------------------------------

// Only Add to Cart buttons receive special click handling.
// Clicking a product card, image, name, or description
// will not open a modal or navigate to another page.
productContainer.addEventListener("click", event => {
  const addButton = event.target.closest(
    ".add-to-cart-button"
  );
if (productContainer) {
  productContainer.addEventListener("click", event => {
    const addButton = event.target.closest(
      ".add-to-cart-button"
    );

  if (!addButton) {
    return;
  }
    if (!addButton) {
      return;
    }

  event.preventDefault();
  event.stopPropagation();
    event.preventDefault();
    event.stopPropagation();

  const index = Number(addButton.dataset.productIndex);
    const index = Number(addButton.dataset.productIndex);

  if (!Number.isInteger(index) || !allProducts[index]) {
    return;
  }
    if (!Number.isInteger(index) || !allProducts[index]) {
      return;
    }

  addToCart(allProducts[index]);
});
    addToCart(allProducts[index]);
  });
}

// ------------------------------
// SEARCH PRODUCTS
// ------------------------------

searchInput.addEventListener("input", renderProducts);
if (searchInput) {
  searchInput.addEventListener("input", renderProducts);
}

// ------------------------------
// CATEGORY FILTERS
// ------------------------------

categoryContainer.addEventListener("click", event => {
  const button = event.target.closest(".category");
if (categoryContainer) {
  categoryContainer.addEventListener("click", event => {
    const button = event.target.closest(".category");

  if (!button) {
    return;
  }
    if (!button) {
      return;
    }

  selectedCategory = button.dataset.category || "All";
    selectedCategory = button.dataset.category || "All";

  document.querySelectorAll(".category").forEach(
    categoryButton => {
      const isActive = categoryButton === button;
    document.querySelectorAll(".category").forEach(
      categoryButton => {
        const isActive = categoryButton === button;

      categoryButton.classList.toggle("active", isActive);
        categoryButton.classList.toggle("active", isActive);

      categoryButton.setAttribute(
        "aria-pressed",
        String(isActive)
      );
    }
  );
        categoryButton.setAttribute(
          "aria-pressed",
          String(isActive)
        );
      }
    );

  renderProducts();
});
    renderProducts();
  });
}

// ------------------------------
// LOAD CATALOGUE
// LOAD PRODUCT DATA
// ------------------------------

async function initialiseCatalogue() {
  resultCount.textContent =
    "Loading Supercheap Auto products...";
  if (!productContainer || !searchInput || !resultCount) {
    console.error(
      "Product catalogue could not start because required HTML elements are missing."
    );
    return;
  }

  resultCount.textContent = "Loading products...";

updateCartCount();

@@ -394,15 +453,15 @@ async function initialiseCatalogue() {

if (!response.ok) {
throw new Error(
        `Could not load catalogue: HTTP ${response.status}`
        `Could not load products: HTTP ${response.status}`
);
}

const products = await response.json();

if (!Array.isArray(products)) {
throw new Error(
        "The catalogue must contain a JSON array."
        "The product data must contain a JSON array."
);
}

@@ -416,41 +475,46 @@ async function initialiseCatalogue() {
});

console.log(
      "Supercheap Auto products loaded:",
      "EMS Auto Parts products loaded:",
allProducts.length
);

renderProducts();
} catch (error) {
console.error(
      "Supercheap Auto catalogue error:",
      "EMS Auto Parts product loading error:",
error
);

    resultCount.textContent =
      "Unable to load catalogue";
    resultCount.textContent = "Unable to load products";

productContainer.innerHTML = `
     <div class="empty-state">
        <h3>Unable to load Supercheap Auto products</h3>
        <h3>Unable to load products</h3>

       <p>${escapeHTML(error.message)}</p>

       <p>
          Check that supercheap_products.json is published
          alongside index.html and app.js.
          Please try again later. If the problem continues,
          the product data may be temporarily unavailable.
       </p>
     </div>
   `;
}
}

// Keep the cart counter updated if the cart changes in another tab.
// ------------------------------
// KEEP CART COUNT UPDATED
// ------------------------------

window.addEventListener("storage", event => {
if (event.key === CART_STORAGE_KEY) {
updateCartCount();
}
});

// Start the catalogue.
// ------------------------------
// START THE PRODUCT CATALOGUE
// ------------------------------

initialiseCatalogue();
