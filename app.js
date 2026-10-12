const productContainer = document.getElementById("products");
const searchInput = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const categoryButtons = document.querySelectorAll(".category");

let allProducts = [];
let selectedCategory = "All";

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatPrice(price, currency = "AUD") {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency
  }).format(price);
}

function getProductURL(product) {
  const url = product.productUrl;

  if (typeof url !== "string") {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol === "https:" &&
      parsed.hostname === "www.supercheapauto.com.au"
    ) {
      return parsed.href;
    }
  } catch {
    return "";
  }

  return "";
}

function matchesCategory(product) {
  if (selectedCategory === "All") {
    return true;
  }

  const category = String(product.category || "").toLowerCase();
  const name = String(product.name || "").toLowerCase();

  switch (selectedCategory) {
    case "Oils & Fluids":
      return (
        category.includes("oil") ||
        category.includes("fluid") ||
        category.includes("additive") ||
        category.includes("filter") ||
        name.includes("engine oil")
      );

    case "Tools":
      return (
        category.includes("tool") ||
        category.includes("equipment")
      );

    case "Accessories":
      return (
        category.includes("accessor") ||
        category.includes("interior") ||
        category.includes("exterior")
      );

    default:
      return category === selectedCategory.toLowerCase();
  }
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allProducts.filter(product => {
    const searchable = [
      product.name,
      product.brand,
      product.sku,
      product.category,
      product.source
    ].join(" ").toLowerCase();

    return searchable.includes(query) && matchesCategory(product);
  });

  resultCount.textContent =
    `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    productContainer.innerHTML = `
      <div class="empty-state">
        <h3>No products found</h3>
        <p>Try another search or select All products.</p>
      </div>
    `;
    return;
  }

  productContainer.innerHTML = filtered.map(product => {
    const name = escapeHTML(product.name);
    const brand = escapeHTML(product.brand || "Brand unavailable");
    const category = escapeHTML(product.category || "Uncategorised");
    const price = escapeHTML(
      formatPrice(product.price, product.currency || "AUD")
    );

    const image = typeof product.image === "string"
      ? product.image.trim()
      : "";

    const safeImage = /^https:\/\/[^"'<> ]+$/i.test(image)
      ? image
      : "";

    const productURL = getProductURL(product);
    const safeURL = escapeHTML(productURL);

    const imageContent = safeImage
      ? `<img src="${escapeHTML(safeImage)}"
              alt="${name}"
              loading="lazy"
              onerror="this.style.display='none'">`
      : `<span>Product image unavailable</span>`;

    const retailerButton = productURL
      ? `<a class="compare-button"
            href="${safeURL}"
            target="_blank"
            rel="noopener noreferrer">View at Supercheap Auto</a>`
      : `<button class="compare-button" type="button" disabled>
           Product link unavailable
         </button>`;

    return `
      <article class="product-card">
        <a class="product-image"
           href="${safeURL || "#"}"
           ${productURL
             ? 'target="_blank" rel="noopener noreferrer"'
             : 'aria-disabled="true"'}
           aria-label="View ${name} at Supercheap Auto">
          ${imageContent}
        </a>

        <div class="product-info">
          <span class="product-category">${category}</span>
          <h3>${name}</h3>
          <p class="product-brand">${brand}</p>
          <p class="product-price">${price}</p>
          <p class="price-label">
            Catalogue price — verify with retailer
          </p>
          ${retailerButton}
        </div>
      </article>
    `;
  }).join("");
}

searchInput.addEventListener("input", renderProducts);

categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;

    categoryButtons.forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderProducts();
  });
});

async function loadCatalogue(filename) {
  const response = await fetch(`./${filename}`);

  if (!response.ok) {
    throw new Error(`${filename} returned HTTP ${response.status}`);
  }

  const products = await response.json();

  if (!Array.isArray(products)) {
    throw new Error(`${filename} must contain a JSON array`);
  }

  return products;
}

async function initialiseCatalogue() {
  try {
    const results = await Promise.allSettled([
      loadCatalogue("products.json"),
      loadCatalogue("supercheap_products.json")
    ]);

    const existingResult = results[0];
    const supercheapResult = results[1];

    const existingProducts = existingResult.status === "fulfilled"
      ? existingResult.value
      : [];

    const supercheapProducts = supercheapResult.status === "fulfilled"
      ? supercheapResult.value
      : [];

    if (results.every(result => result.status === "rejected")) {
      throw new Error(
        "Neither products.json nor supercheap_products.json could be loaded."
      );
    }

    const seenIds = new Set();

    allProducts = [
      ...existingProducts,
      ...supercheapProducts
    ].filter(product => {
      if (
        !product ||
        typeof product.id !== "string" ||
        typeof product.name !== "string" ||
        seenIds.has(product.id)
      ) {
        return false;
      }

      seenIds.add(product.id);
      return true;
    });

    if (existingResult.status === "rejected") {
      console.error("Existing catalogue failed:", existingResult.reason);
    }

    if (supercheapResult.status === "rejected") {
      console.error("Supercheap catalogue failed:", supercheapResult.reason);
    }

    console.log("Existing products:", existingProducts.length);
    console.log("Supercheap Auto products:", supercheapProducts.length);
    console.log("Total unique products:", allProducts.length);

    renderProducts();
  } catch (error) {
    console.error("Catalogue loading error:", error);

    resultCount.textContent = "Catalogue unavailable";

    productContainer.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load products</h3>
        <p>
          Check the browser console for errors and verify
          that the JSON files contain valid product arrays.
        </p>
      </div>
    `;
  }
}

initialiseCatalogue();
