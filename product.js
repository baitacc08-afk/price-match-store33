"use strict";

const SEARCH_INDEX_FILE = "./search_index_compact.json";
const DISCOUNT_MULTIPLIER = 0.25;
const DISCOUNT_PERCENTAGE = 75;

const productDetail = document.getElementById("product-detail");
const productFileCache = new Map();

/* =========================
   GENERAL HELPERS
========================= */

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function formatPrice(price, currency = "AUD") {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
        return "Price unavailable";
    }

    try {
        return new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: currency || "AUD"
        }).format(numericPrice);
    } catch {
        return `$${numericPrice.toFixed(2)}`;
    }
}

function isValidPrice(price) {
    return (
        price !== null &&
        price !== undefined &&
        price !== "" &&
        Number.isFinite(Number(price)) &&
        Number(price) >= 0
    );
}

function getProductImage(product) {
    const image = product.image || product.imageUrl || product.image_url || "";

    if (typeof image !== "string" || !image.trim()) {
        return "";
    }

    try {
        const parsedURL = new URL(image);

        if (parsedURL.protocol !== "https:") {
            return "";
        }

        return parsedURL.href;
    } catch {
        return "";
    }
}

function getProductCurrency(product) {
    return product.currency || "AUD";
}

/* =========================
   LOAD PRODUCT DATA
========================= */

async function loadSearchIndex() {
    const response = await fetch(SEARCH_INDEX_FILE, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(
            `Could not load the product search index. HTTP ${response.status}`
        );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("The product search index has an invalid format.");
    }

    return data;
}

async function loadProductFile(filename) {
    if (!filename || typeof filename !== "string") {
        throw new Error("The product data file could not be identified.");
    }

    if (productFileCache.has(filename)) {
        return productFileCache.get(filename);
    }

    const promise = (async () => {
        const safeFilename = filename.replace(/^\.\/+/, "");

        if (
            safeFilename.includes("..") ||
            safeFilename.includes("/") ||
            safeFilename.includes("\\")
        ) {
            throw new Error("The product data file name is invalid.");
        }

        const response = await fetch(`./${safeFilename}`, {
            cache: "force-cache"
        });

        if (!response.ok) {
            throw new Error(
                `Could not load the product data. HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("The product data file has an invalid format.");
        }

        return data;
    })();

    productFileCache.set(filename, promise);

    try {
        return await promise;
    } catch (error) {
        productFileCache.delete(filename);
        throw error;
    }
}

async function findProduct(productId) {
    const searchIndex = await loadSearchIndex();

    const indexEntry = searchIndex.find(entry =>
        String(entry.id) === String(productId)
    );

    if (!indexEntry) {
        return null;
    }

    if (!indexEntry.file) {
        throw new Error("The product data file is missing from the index.");
    }

    const products = await loadProductFile(indexEntry.file);

    const product = products.find(item =>
        String(item.id) === String(productId)
    );

    if (!product) {
        return null;
    }

    return {
        ...indexEntry,
        ...product
    };
}

/* =========================
   PRODUCT INFORMATION
========================= */

function getProductDescription(product) {
    const possibleFields = [
        "description",
        "longDescription",
        "long_description",
        "shortDescription",
        "short_description",
        "productDescription",
        "product_description",
        "overview"
    ];

    for (const field of possibleFields) {
        const value = product[field];

        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
}

function getProductSpecifications(product) {
    const possibleSpecifications = [
        ["Brand", ["brand"]],
        ["SKU / Product code", ["sku", "productCode", "product_code"]],
        ["Category", ["category"]],
        ["Part number", ["partNumber", "part_number"]],
        ["Barcode", ["barcode", "ean", "gtin"]],
        ["Manufacturer", ["manufacturer"]],
        ["Model", ["model"]],
        ["Material", ["material"]],
        ["Colour", ["colour", "color"]],
        ["Size", ["size"]],
        ["Weight", ["weight"]],
        ["Dimensions", ["dimensions"]],
        ["Vehicle compatibility", ["vehicleCompatibility", "vehicle_compatibility", "fitment"]]
    ];

    const specifications = [];

    for (const [label, fields] of possibleSpecifications) {
        let value = "";

        for (const field of fields) {
            if (
                product[field] !== null &&
                product[field] !== undefined &&
                String(product[field]).trim() !== ""
            ) {
                value = product[field];
                break;
            }
        }

        if (value !== "") {
            if (Array.isArray(value)) {
                value = value.join(", ");
            } else if (typeof value === "object") {
                value = JSON.stringify(value);
            }

            specifications.push({
                label,
                value: String(value)
            });
        }
    }

    return specifications;
}

function getProductFeatures(product) {
    const possibleFields = [
        "features",
        "bulletPoints",
        "bullet_points",
        "highlights",
        "benefits"
    ];

    for (const field of possibleFields) {
        const value = product[field];

        if (Array.isArray(value)) {
            const features = value
                .map(item => String(item).trim())
                .filter(Boolean);

            if (features.length) {
                return features;
            }
        }

        if (typeof value === "string" && value.trim()) {
            const features = value
                .split(/\r?\n|•|;/)
                .map(item => item.trim())
                .filter(Boolean);

            if (features.length) {
                return features;
            }
        }
    }

    return [];
}

function formatLastChecked(product) {
    const value =
        product.sourceCheckedAt ||
        product.lastChecked ||
        product.last_checked ||
        "";

    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

/* =========================
   PAGE STYLING
========================= */

function addProductPageStyles() {
    if (document.getElementById("ems-product-page-styles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "ems-product-page-styles";

    style.textContent = `
        .detail-page {
            max-width: 1200px;
            margin: 0 auto;
            padding: 30px 20px 60px;
            color: #f5f5f5;
        }

        .detail-panel {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
            gap: 35px;
            align-items: start;
            background: #151515;
            border: 1px solid #303030;
            border-radius: 16px;
            padding: 28px;
        }

        .detail-image-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 350px;
            padding: 20px;
            background: #fff;
            border-radius: 12px;
        }

        .detail-image {
            display: block;
            width: 100%;
            max-width: 450px;
            max-height: 440px;
            object-fit: contain;
        }

        .detail-image-placeholder {
            color: #777;
            text-align: center;
            font-size: 15px;
        }

        .detail-brand {
            margin: 0 0 10px;
            color: #ff8a00;
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1.5px;
        }

        .detail-title {
            margin: 0 0 16px;
            color: #fff;
            font-size: clamp(25px, 3vw, 36px);
            line-height: 1.2;
            overflow-wrap: anywhere;
        }

        .detail-sku {
            margin: 0 0 22px;
            color: #bdbdbd;
            font-size: 14px;
        }

        .detail-price-box {
            margin: 22px 0;
            padding: 20px;
            background: #202020;
            border: 1px solid #383838;
            border-left: 5px solid #ff8a00;
            border-radius: 10px;
        }

        .detail-price-label {
            margin-bottom: 12px;
            color: #c8c8c8;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .detail-original-price-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 10px;
        }

        .detail-original-price {
            color: #bcbcbc;
            font-size: 18px;
            text-decoration: line-through;
            text-decoration-thickness: 2px;
        }

        .detail-promotion-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px 10px;
            border-radius: 5px;
            background: #ff8a00;
            color: #111;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }

        .detail-discounted-price {
            margin: 0;
            color: #ff8a00;
            font-size: clamp(30px, 4vw, 42px);
            font-weight: 900;
            line-height: 1.15;
        }

        .detail-savings {
            margin: 10px 0 0;
            color: #72d99a;
            font-size: 14px;
            font-weight: 700;
        }

        .detail-price-unavailable {
            margin: 0;
            color: #ff8a00;
            font-size: 24px;
            font-weight: 800;
        }

        .detail-section {
            margin-top: 30px;
        }

        .detail-section h2 {
            margin: 0 0 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid #383838;
            color: #fff;
            font-size: 21px;
        }

        .detail-description {
            color: #d0d0d0;
            font-size: 15px;
            line-height: 1.8;
            white-space: pre-line;
            overflow-wrap: anywhere;
        }

        .detail-features {
            margin: 0;
            padding-left: 22px;
            color: #d0d0d0;
            line-height: 1.8;
        }

        .detail-features li {
            margin-bottom: 7px;
        }

        .detail-specifications {
            width: 100%;
            border-collapse: collapse;
        }

        .detail-specifications tr {
            border-bottom: 1px solid #303030;
        }

        .detail-specifications th,
        .detail-specifications td {
            padding: 12px 8px;
            text-align: left;
            vertical-align: top;
            font-size: 14px;
            overflow-wrap: anywhere;
        }

        .detail-specifications th {
            width: 40%;
            color: #bdbdbd;
            font-weight: 600;
        }

        .detail-specifications td {
            color: #f5f5f5;
        }

        .detail-back-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-top: 30px;
            padding: 13px 20px;
            border: 0;
            border-radius: 7px;
            background: #ff8a00;
            color: #111;
            font-size: 14px;
            font-weight: 800;
            text-decoration: none;
            transition: background 0.2s ease, transform 0.2s ease;
        }

        .detail-back-button:hover {
            background: #ffa733;
            color: #111;
            transform: translateY(-1px);
        }

        .detail-last-checked {
            margin-top: 18px;
            color: #858585;
            font-size: 12px;
        }

        .detail-error {
            max-width: 750px;
            margin: 40px auto;
            padding: 25px;
            border: 1px solid #393939;
            border-radius: 12px;
            background: #151515;
            color: #eee;
        }

        .detail-error h1 {
            color: #ff8a00;
        }

        @media (max-width: 760px) {
            .detail-page {
                padding: 20px 12px 40px;
            }

            .detail-panel {
                grid-template-columns: 1fr;
                gap: 25px;
                padding: 16px;
            }

            .detail-image-container {
                min-height: 230px;
            }

            .detail-image {
                max-height: 300px;
            }

            .detail-title {
                font-size: 26px;
            }

            .detail-price-box {
                padding: 16px;
            }
        }
    `;

    document.head.appendChild(style);
}

/* =========================
   ERROR DISPLAY
========================= */

function showError(title, message) {
    if (!productDetail) {
        return;
    }

    productDetail.innerHTML = `
        <div class="detail-error">
            <h1>${escapeHTML(title)}</h1>
            <p>${escapeHTML(message)}</p>
            <a class="detail-back-button" href="./index.html">
                Back to catalogue
            </a>
        </div>
    `;
}

/* =========================
   PRICE DISPLAY
========================= */

function renderPrice(product) {
    const currency = getProductCurrency(product);

    if (!isValidPrice(product.price)) {
        return `
            <div class="detail-price-box">
                <div class="detail-price-label">EMS Auto Parts price</div>
                <p class="detail-price-unavailable">Price unavailable</p>
                <p class="detail-savings">
                    The price for this product has not been confirmed.
                </p>
            </div>
        `;
    }

    const originalPrice = Number(product.price);
    const discountedPrice = originalPrice * DISCOUNT_MULTIPLIER;
    const savings = originalPrice - discountedPrice;

    return `
        <div class="detail-price-box">
            <div class="detail-price-label">Special promotion</div>

            <div class="detail-original-price-row">
                <span class="detail-original-price">
                    ${escapeHTML(formatPrice(originalPrice, currency))}
                </span>

                <span class="detail-promotion-badge">
                    ${DISCOUNT_PERCENTAGE}% OFF
                </span>
            </div>

            <p class="detail-discounted-price">
                ${escapeHTML(formatPrice(discountedPrice, currency))}
            </p>

            <p class="detail-savings">
                You save ${escapeHTML(formatPrice(savings, currency))}
            </p>
        </div>
    `;
}

/* =========================
   RENDER PRODUCT PAGE
========================= */

function renderProduct(product) {
    const name = product.name || "Product details";
    const brand = product.brand || "";
    const sku = product.sku || product.productCode || product.product_code || "";
    const image = getProductImage(product);
    const description = getProductDescription(product);
    const features = getProductFeatures(product);
    const specifications = getProductSpecifications(product);
    const lastChecked = formatLastChecked(product);

    const imageHTML = image
        ? `
            <img
                class="detail-image"
                src="${escapeHTML(image)}"
                alt="${escapeHTML(name)}"
                loading="eager"
            >
        `
        : `
            <div class="detail-image-placeholder">
                Product image unavailable
            </div>
        `;

    const descriptionHTML = description
        ? `
            <section class="detail-section">
                <h2>Product Description</h2>
                <div class="detail-description">
                    ${escapeHTML(description)}
                </div>
            </section>
        `
        : "";

    const featuresHTML = features.length
        ? `
            <section class="detail-section">
                <h2>Features & Benefits</h2>
                <ul class="detail-features">
                    ${features.map(feature => `
                        <li>${escapeHTML(feature)}</li>
                    `).join("")}
                </ul>
            </section>
        `
        : "";

    const specificationsHTML = specifications.length
        ? `
            <section class="detail-section">
                <h2>Specifications</h2>
                <table class="detail-specifications">
                    <tbody>
                        ${specifications.map(specification => `
                            <tr>
                                <th>${escapeHTML(specification.label)}</th>
                                <td>${escapeHTML(specification.value)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </section>
        `
        : "";

    const lastCheckedHTML = lastChecked
        ? `
            <p class="detail-last-checked">
                Product information last checked:
                ${escapeHTML(lastChecked)}
            </p>
        `
        : "";

    productDetail.innerHTML = `
        <main class="detail-page">
            <div class="detail-panel">
                <div class="detail-image-container">
                    ${imageHTML}
                </div>

                <div class="detail-information">
                    ${brand ? `
                        <p class="detail-brand">${escapeHTML(brand)}</p>
                    ` : ""}

                    <h1 class="detail-title">${escapeHTML(name)}</h1>

                    ${sku ? `
                        <p class="detail-sku">
                            Product code: ${escapeHTML(sku)}
                        </p>
                    ` : ""}

                    ${renderPrice(product)}

                    ${descriptionHTML}
                    ${featuresHTML}
                    ${specificationsHTML}
                </div>
            </div>

            ${lastCheckedHTML}

            <a class="detail-back-button" href="./index.html">
                Back to catalogue
            </a>
        </main>
    `;

    const productImage = productDetail.querySelector(".detail-image");

    if (productImage) {
        productImage.addEventListener("error", () => {
            const container = productImage.parentElement;

            if (container) {
                container.innerHTML = `
                    <div class="detail-image-placeholder">
                        Product image unavailable
                    </div>
                `;
            }
        }, { once: true });
    }

    document.title = `${name} | EMS Auto Parts`;

    let metaDescription = document.querySelector(
        'meta[name="description"]'
    );

    if (!metaDescription) {
        metaDescription = document.createElement("meta");
        metaDescription.name = "description";
        document.head.appendChild(metaDescription);
    }

    metaDescription.content = description
        ? description.slice(0, 155)
        : `${name} product details at EMS Auto Parts.`;
}

/* =========================
   INITIALISE PAGE
========================= */

async function initialiseProductPage() {
    if (!productDetail) {
        return;
    }

    addProductPageStyles();

    const parameters = new URLSearchParams(window.location.search);
    const productId = parameters.get("id");

    if (!productId) {
        showError(
            "Product not selected",
            "Return to the catalogue and select a product to view its details."
        );
        return;
    }

    productDetail.innerHTML = `
        <div class="detail-error">
            <h1>Loading product...</h1>
            <p>Please wait while the product information loads.</p>
        </div>
    `;

    try {
        const product = await findProduct(productId);

        if (!product) {
            showError(
                "Product not found",
                "This product could not be found in the catalogue. It may have been removed or its details may be unavailable."
            );
            return;
        }

        renderProduct(product);
    } catch (error) {
        console.error("Unable to load product details:", error);

        showError(
            "Unable to load product",
            "The product information could not be loaded. Please try again or return to the catalogue."
        );
    }
}

initialiseProductPage();
