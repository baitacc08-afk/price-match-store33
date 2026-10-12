const productContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const categoryContainer = document.getElementById("categories");

let allProducts = [];
let selectedCategory = "All";

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

// Allow only valid HTTPS Supercheap Auto product links.
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

// Validate image URLs.
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

// Group detailed catalogue categories into the website's filters.
function matchesCategory(product) {
  if (selectedCategory === "All") {
    return true;
  }

  const category = String(product.category || "").toLowerCase();
  const name = String(product.name || "").toLowerCase();

  switch (selectedCategory) {
    case "Oils & Fluids":
      return (
        /oil|fluid|lubricant|additive|filter|coolant|brake fluid|transmission fluid/
          .test(category + " " + name)
      );

    case "Tools":
      return (
        /tools?|tool kits?|equipment|workshop/
          .test(category + " " + name)
      );

    case "Accessories":
      return (
        /accessor|interior|exterior|car care|cleaning|paint/
          .test(category + " " + name)
      );

    default:
      return category === selectedCategory.toLowerCase();
  }
}

// Display products.
function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter(product => {
    const searchableText = [
      product.name,
      product.brand,
      product.sku,
      product.category,
      product.source
    ].join(" ").toLowerCase();

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

  productContainer.innerHTML = filteredProducts.map(product => {
    const name = escapeHTML(product.name || "Unnamed product");
    const brand = escapeHTML(product.brand || "Brand unavailable");
    const category = escapeHTML(product.category || "Uncategorised");
    const price = escapeHTML(
      formatPrice(product.price, product.currency || "AUD")
    );

    const imageURL = getProductImage(product);
    const productURL = getProductURL(product);

    const imageHTML = imageURL
      ? `
        <img
          src="${escapeHTML(imageURL)}"
          alt="${name}"
          loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='block'"
        >
        <span style="display:none">Image unavailable</span>
      `
      : `<span>Image unavailable</span>`;

    const imageContainer = productURL
      ? `
        <a
          class="product-image"
          href="${escapeHTML(productURL)}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View ${name} at Supercheap Auto"
        >
          ${imageHTML}
        </a>
      `
      : `
        <div class="product-image">
          ${imageHTML}
        </div>
      `;

    const productButton = productURL
      ? `
        <a
          class="compare-button"
          href="${escapeHTML(productURL)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          View at Supercheap Auto
        </a>
      `
      : `
        <button class="compare-button" type="button" disabled>
          Product link unavailable
        </button>
      `;

    return `
      <article class="product-card">
        ${imageContainer}

        <div class="product-info">
          <span class="product-category">${category}</span>

          <h3>${name}</h3>

          <p class="product-brand">${brand}</p>

          <p class="product-price">${price}</p>

          <p class="price-label">
            Supercheap Auto catalogue
          </p>

          ${productButton}
        </div>
      </article>
    `;
  }).join("");
}

// Search products as the user types.
searchInput.addEventListener("input", renderProducts);

// Handle category buttons.
categoryContainer.addEventListener("click", event => {
  const button = event.target.closest(".category");

  if (!button) {
    return;
  }

  selectedCategory = button.dataset.category;

  document.querySelectorAll(".category").forEach(categoryButton => {
    categoryButton.classList.toggle(
      "active",
      categoryButton === button
    );
  });

  renderProducts();
});

// Load ONLY the Supercheap Auto catalogue.
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

    // Keep only valid product records from this catalogue.
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
          Check that supercheap_products.json exists
          alongside index.html and app.js.
        </p>
      </div>
    `;
  }
}

initialiseCatalogue();
