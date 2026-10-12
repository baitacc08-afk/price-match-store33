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

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allProducts.filter(product => {
    const searchable = [
      product.name,
      product.brand,
      product.sku,
      product.category
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(query);

    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  resultCount.textContent =
    `${filtered.length} product${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    productContainer.innerHTML = `
      <div class="empty-state">
        <h3>No products found</h3>
        <p>Try another search or select a different category.</p>
      </div>
    `;
    return;
  }

  productContainer.innerHTML = filtered.map(product => {
    const name = escapeHTML(product.name);
    const brand = escapeHTML(product.brand);
    const category = escapeHTML(product.category);
    const image = typeof product.image === "string"
      ? product.image.trim()
      : "";

    const safeImage = /^https:\/\/[^"'<> ]+$/i.test(image)
      ? image
      : "";

    const price = formatPrice(product.price, product.currency);

    const imageContent = safeImage
      ? `<img src="${escapeHTML(safeImage)}" alt="${name}" loading="lazy">`
      : `<span>Product image</span>`;

    const badge = product.demo
      ? `<p class="price-label">DEMONSTRATION DATA</p>`
      : `<p class="price-label">Catalogue price — verify before use</p>`;

    return `
      <article class="product-card">
        <div class="product-image">${imageContent}</div>
        <div class="product-info">
          <span class="product-category">${category}</span>
          <h3>${name}</h3>
          <p class="product-brand">${brand}</p>
          <p class="product-price">${escapeHTML(price)}</p>
          ${badge}
          <button
            class="compare-button"
            type="button"
            data-product-id="${escapeHTML(product.id)}"
          >View product</button>
        </div>
      </article>
    `;
  }).join("");
}

productContainer.addEventListener("click", event => {
  const button = event.target.closest("[data-product-id]");

  if (!button) return;

  const product = allProducts.find(
    item => item.id === button.dataset.productId
  );

  if (!product) return;

  const offers = Array.isArray(product.offers) ? product.offers : [];

  const offerText = offers.length
    ? offers.map(offer => {
        const price = formatPrice(offer.price, offer.currency || "AUD");
        const retailer = escapeHTML(offer.retailer || "Retailer");
        const url = typeof offer.url === "string" &&
          /^https:\/\/[^"'<> ]+$/i.test(offer.url)
          ? offer.url
          : "";

        return `${retailer}: ${price}${url ? "\n" + url : ""}`;
      }).join("\n\n")
    : "No competing offers have been added yet.";

  alert(
    `${product.name}\n\n` +
    `Catalogue price: ${formatPrice(product.price, product.currency)}\n\n` +
    `Competing offers:\n${offerText}\n\n` +
    `Only use prices verified against the original retailer listing.`
  );
});

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

fetch("./products.json")
  .then(response => {
    if (!response.ok) throw new Error("Could not load product catalogue.");
    return response.json();
  })
  .then(products => {
    if (!Array.isArray(products)) {
      throw new Error("Product catalogue must be a JSON array.");
    }

    allProducts = products.filter(product =>
      product &&
      typeof product.id === "string" &&
      typeof product.name === "string"
    );

    renderProducts();
  })
  .catch(error => {
    console.error(error);
    resultCount.textContent = "Catalogue unavailable";
    productContainer.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load products</h3>
        <p>Check that products.json exists and contains valid JSON.</p>
      </div>
    `;
  });
