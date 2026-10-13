"use strict";

const CATALOGUE_FILE = "./supercheap_products.json";
const CART_STORAGE_KEY = "ems-auto-parts-cart";
const DISCOUNT_PERCENTAGE = 75;
const DISCOUNT_MULTIPLIER = (100 - DISCOUNT_PERCENTAGE) / 100;

const productDetail = document.getElementById("product-detail");

let selectedProduct = null;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function hasValidPrice(price) {
  if (
    price === null ||
    price === undefined ||
    price === ""
  ) {
    return false;
  }

  const number = Number(price);

  return Number.isFinite(number) && number >= 0;
}

function getDiscountedPrice(originalPrice) {
  if (!hasValidPrice(originalPrice)) {
    return null;
  }

  return Math.round(
    (Number(originalPrice) * DISCOUNT_MULTIPLIER + Number.EPSILON) * 100
  ) / 100;
}

function formatPrice(price, currency = "AUD") {
  if (!hasValidPrice(price)) {
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

    alert("Unable to save your cart. Please check your browser storage.");
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
  if (!product || product.id === undefined || product.id === null) {
    alert("This product cannot be added to your cart.");
    return;
  }

  if (!hasValidPrice(product.price)) {
    alert("This product has no available price and cannot be added to your cart.");
    return;
  }

  const originalPrice = Number(product.price);
  const discountedPrice = getDiscountedPrice(originalPrice);
  const currency = product.currency || "AUD";

  if (discountedPrice === null) {
    alert("Unable to calculate this product's price.");
    return;
  }

  const cart = getCart();

  const existingItem = cart.find(
    item => String(item.id) === String(product.id)
  );

  if (existingItem) {
    existingItem.quantity =
      (Number(existingItem.quantity) || 0) + 1;

    // Keep existing cart entries aligned with the current discount.
    existingItem.originalPrice = originalPrice;
    existingItem.price = discountedPrice;
    existingItem.currency = currency;
    existingItem.discountPercentage = DISCOUNT_PERCENTAGE;
  } else {
    cart.push({
      id: product.id,
      name: product.name || "Unnamed product",
      brand: product.brand || "",
      originalPrice,
      price: discountedPrice,
      currency,
      discountPercentage: DISCOUNT_PERCENTAGE,
      image: getProductImage(product),
      quantity: 1
    });
  }

  if (!saveCart(cart)) {
    return;
  }

  const button = document.getElementById("add-to-cart-button");

  if (button) {
    button.textContent = "✓ Added to Cart!";
    button.disabled = true;

    setTimeout(() => {
      button.textContent = "🛒 Add to Cart";
      button.disabled = false;
    }, 1200);
  }
}

function showError(title, message) {
  productDetail.innerHTML = `
    <div class="detail-status">
      <h1>${escapeHTML(title)}</h1>
      <p>${escapeHTML(message)}</p>
      <a href="./index.html">Return to EMS Auto Parts</a>
    </div>
  `;
}

function renderProduct(product) {
  selectedProduct = product;

  const name = escapeHTML(product.name || "Unnamed product");
  const brand = escapeHTML(product.brand || "Brand unavailable");
  const category = escapeHTML(product.category || "Uncategorised");
  const currency = product.currency || "AUD";
  const imageURL = getProductImage(product);

  const originalPriceAvailable = hasValidPrice(product.price);
  const originalPrice = originalPriceAvailable
    ? Number(product.price)
    : null;

  const discountedPrice = originalPriceAvailable
    ? getDiscountedPrice(originalPrice)
    : null;

  const priceHTML = originalPriceAvailable
    ? `
        <div class="detail-price-section">
          <span class="detail-discount-badge">
            ${DISCOUNT_PERCENTAGE}% OFF
          </span>

          <p class="detail-original-price">
            Original price:
            ${escapeHTML(formatPrice(originalPrice, currency))}
          </p>

          <p class="detail-price">
            ${escapeHTML(formatPrice(discountedPrice, currency))}
          </p>

          <p class="detail-savings">
            You save
            ${escapeHTML(
              formatPrice(originalPrice - discountedPrice, currency)
            )}
          </p>
        </div>
      `
    : `
        <div class="detail-price-section">
          <span class="detail-discount-badge">
            ${DISCOUNT_PERCENTAGE}% OFF
          </span>
          <p class="detail-price">Price unavailable</p>
        </div>
      `;

  const imageHTML = imageURL
    ? `
        <div class="detail-image-container">
          <img
            class="detail-image"
            src="${escapeHTML(imageURL)}"
            alt="${name}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
          >

          <div
            class="detail-image-fallback"
            style="display:none"
          >
            Product image unavailable
          </div>
        </div>
      `
    : `
        <div class="detail-image-container">
          <div class="detail-image-fallback">
            Product image unavailable
          </div>
        </div>
      `;

  productDetail.innerHTML = `
    <article class="detail-panel">
      <div class="detail-product-visual">
        ${imageHTML}
      </div>

      <div class="detail-product-information">
        <p class="detail-category">${category}</p>

        <h1 class="detail-title">${name}</h1>

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

        ${priceHTML}

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
          <button
            type="button"
            class="detail-add-to-cart-button"
            id="add-to-cart-button"
            ${!originalPriceAvailable ? "disabled" : ""}
          >
            🛒 Add to Cart
          </button>

          <a
            class="detail-back-button"
            href="./index.html"
          >
            Back to products
          </a>

          <a
            class="detail-back-button"
            href="./cart.html"
          >
            View Cart
          </a>
        </div>
      </div>
    </article>
  `;

  document.title = `${product.name || "Product"} | EMS Auto Parts`;

  const addToCartButton = document.getElementById("add-to-cart-button");

  if (addToCartButton) {
    addToCartButton.addEventListener("click", () => {
      addToCart(selectedProduct);
    });
  }

  updateCartCount();
}

async function initialiseProductPage() {
  const parameters = new URLSearchParams(
    window.location.search
  );

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
      return item && String(item.id) === productId;
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

window.addEventListener("storage", event => {
  if (event.key === CART_STORAGE_KEY) {
    updateCartCount();
  }
});

initialiseProductPage();
