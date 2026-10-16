"use strict";

/*
======================================================
EMS AUTO PARTS — VEHICLE SELECTOR
======================================================

Features:
- Broad Australian-market vehicle makes
- Model, year, series and engine selection
- Remembers the selected vehicle
- Displays the selected vehicle above the catalogue
- Allows customers to change or clear their vehicle
- Does not falsely claim that products fit a vehicle

Storage:
ems-auto-parts-selected-vehicle

======================================================
*/

(() => {
    const STORAGE_KEY = "ems-auto-parts-selected-vehicle";

    const currentYear = new Date().getFullYear();

    const MAKES = [
        "Abarth",
        "Acura",
        "Alfa Romeo",
        "Audi",
        "BMW",
        "BYD",
        "Chery",
        "Chevrolet",
        "Chrysler",
        "Citroen",
        "Cupra",
        "Daewoo",
        "Daihatsu",
        "Dodge",
        "Fiat",
        "Ford",
        "Foton",
        "GWM",
        "Genesis",
        "Great Wall",
        "Haval",
        "Hino",
        "Honda",
        "Holden",
        "Hyundai",
        "Infiniti",
        "Isuzu",
        "Iveco",
        "Jaguar",
        "Jeep",
        "Kia",
        "LDV",
        "Lexus",
        "Mahindra",
        "Maserati",
        "Mazda",
        "Mercedes-Benz",
        "MG",
        "Mini",
        "Mitsubishi",
        "Nissan",
        "Opel",
        "Peugeot",
        "Polestar",
        "Porsche",
        "Proton",
        "Ram",
        "Renault",
        "Rover",
        "Saab",
        "Skoda",
        "Smart",
        "SsangYong",
        "Subaru",
        "Suzuki",
        "Tesla",
        "Toyota",
        "Volkswagen",
        "Volvo"
    ];

    const YEARS = [];

    for (let year = currentYear; year >= 1950; year--) {
        YEARS.push(year);
    }

    const escapeHTML = (value) => {
        return String(value ?? "").replace(/[&<>"']/g, (character) => {
            const replacements = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return replacements[character];
        });
    };

    function loadSavedVehicle() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (!saved) {
                return null;
            }

            const vehicle = JSON.parse(saved);

            if (
                !vehicle ||
                typeof vehicle !== "object" ||
                typeof vehicle.make !== "string" ||
                typeof vehicle.model !== "string" ||
                !vehicle.make.trim() ||
                !vehicle.model.trim()
            ) {
                return null;
            }

            return vehicle;
        } catch (error) {
            console.warn(
                "EMS Auto Parts: Could not load saved vehicle.",
                error
            );

            return null;
        }
    }

    function saveVehicle(vehicle) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(vehicle)
            );

            return true;
        } catch (error) {
            console.error(
                "EMS Auto Parts: Could not save vehicle.",
                error
            );

            return false;
        }
    }

    function clearSavedVehicle() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn(
                "EMS Auto Parts: Could not clear saved vehicle.",
                error
            );
        }
    }

    function vehicleLabel(vehicle) {
        if (!vehicle) {
            return "No vehicle selected";
        }

        return [
            vehicle.year,
            vehicle.make,
            vehicle.model,
            vehicle.series,
            vehicle.engine
        ]
            .filter(Boolean)
            .join(" ");
    }

    function addVehicleStyles() {
        if (document.getElementById("ems-vehicle-selector-styles")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "ems-vehicle-selector-styles";

        style.textContent = `
            .ems-vehicle-selector,
            .ems-vehicle-selector * {
                box-sizing: border-box;
            }

            .ems-vehicle-selector {
                width: 100%;
                max-width: 1200px;
                margin: 24px auto;
                padding: 22px;
                border: 1px solid rgba(255, 107, 0, 0.45);
                border-radius: 12px;
                background: #171717;
                color: #ffffff;
                font-family: inherit;
            }

            .ems-vehicle-heading {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 18px;
            }

            .ems-vehicle-title {
                margin: 0 0 6px;
                color: #ff7900;
                font-size: 1.3rem;
                font-weight: 800;
            }

            .ems-vehicle-description {
                margin: 0;
                color: #c9c9c9;
                font-size: 0.92rem;
                line-height: 1.5;
            }

            .ems-vehicle-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 14px;
            }

            .ems-vehicle-field {
                display: flex;
                flex-direction: column;
                gap: 7px;
                min-width: 0;
            }

            .ems-vehicle-field label {
                color: #eeeeee;
                font-size: 0.86rem;
                font-weight: 700;
            }

            .ems-vehicle-field input,
            .ems-vehicle-field select {
                width: 100%;
                min-height: 44px;
                padding: 10px 12px;
                border: 1px solid #494949;
                border-radius: 6px;
                background: #242424;
                color: #ffffff;
                font: inherit;
                font-size: 0.94rem;
            }

            .ems-vehicle-field input:focus,
            .ems-vehicle-field select:focus {
                outline: 2px solid #ff7900;
                outline-offset: 1px;
                border-color: #ff7900;
            }

            .ems-vehicle-actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 10px;
                margin-top: 18px;
            }

            .ems-vehicle-button {
                min-height: 42px;
                padding: 10px 18px;
                border: 1px solid #ff7900;
                border-radius: 6px;
                background: #ff7900;
                color: #111111;
                font: inherit;
                font-weight: 800;
                cursor: pointer;
                transition:
                    background 0.15s ease,
                    color 0.15s ease,
                    border-color 0.15s ease;
            }

            .ems-vehicle-button:hover {
                background: #ff963d;
                border-color: #ff963d;
            }

            .ems-vehicle-button-secondary {
                background: transparent;
                color: #ffffff;
                border-color: #555555;
            }

            .ems-vehicle-button-secondary:hover {
                background: #2a2a2a;
                border-color: #ff7900;
                color: #ffffff;
            }

            .ems-vehicle-saved {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 18px;
                padding: 13px 15px;
                border: 1px solid #454545;
                border-radius: 8px;
                background: #222222;
            }

            .ems-vehicle-saved-label {
                display: block;
                margin-bottom: 4px;
                color: #bcbcbc;
                font-size: 0.8rem;
            }

            .ems-vehicle-saved-name {
                color: #ffffff;
                font-weight: 800;
                overflow-wrap: anywhere;
            }

            .ems-vehicle-notice {
                margin: 14px 0 0;
                color: #bcbcbc;
                font-size: 0.82rem;
                line-height: 1.55;
            }

            .ems-vehicle-message {
                min-height: 20px;
                margin: 12px 0 0;
                color: #ffb36d;
                font-size: 0.9rem;
                line-height: 1.45;
            }

            .ems-vehicle-selector[hidden],
            .ems-vehicle-saved[hidden] {
                display: none !important;
            }

            @media (max-width: 760px) {
                .ems-vehicle-selector {
                    margin: 18px auto;
                    padding: 16px;
                }

                .ems-vehicle-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                }

                .ems-vehicle-heading {
                    flex-direction: column;
                }
            }

            @media (max-width: 480px) {
                .ems-vehicle-grid {
                    grid-template-columns: 1fr;
                }

                .ems-vehicle-actions {
                    flex-direction: column;
                    align-items: stretch;
                }

                .ems-vehicle-button {
                    width: 100%;
                }

                .ems-vehicle-saved {
                    align-items: stretch;
                    flex-direction: column;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function findInsertionPoint() {
        return (
            document.getElementById("categories") ||
            document.getElementById("category-filter") ||
            document.getElementById("products") ||
            document.querySelector("main")
        );
    }

    function createSelector() {
        const existing = document.getElementById("ems-vehicle-selector");

        if (existing) {
            return existing;
        }

        const section = document.createElement("section");

        section.id = "ems-vehicle-selector";
        section.className = "ems-vehicle-selector";
        section.setAttribute("aria-labelledby", "ems-vehicle-title");

        const makeOptions = MAKES.map((make) => {
            return `<option value="${escapeHTML(make)}">${escapeHTML(make)}</option>`;
        }).join("");

        const yearOptions = YEARS.map((year) => {
            return `<option value="${year}">${year}</option>`;
        }).join("");

        section.innerHTML = `
            <div class="ems-vehicle-heading">
                <div>
                    <h2 class="ems-vehicle-title" id="ems-vehicle-title">
                        Find parts for your vehicle
                    </h2>

                    <p class="ems-vehicle-description">
                        Select your vehicle to save it to your catalogue.
                    </p>
                </div>
            </div>

            <div class="ems-vehicle-saved" id="ems-vehicle-saved" hidden>
                <div>
                    <span class="ems-vehicle-saved-label">
                        Your selected vehicle
                    </span>

                    <span
                        class="ems-vehicle-saved-name"
                        id="ems-vehicle-saved-name"
                    ></span>
                </div>

                <button
                    type="button"
                    class="ems-vehicle-button ems-vehicle-button-secondary"
                    id="ems-vehicle-change"
                >
                    Change vehicle
                </button>
            </div>

            <form id="ems-vehicle-form">
                <div class="ems-vehicle-grid">
                    <div class="ems-vehicle-field">
                        <label for="ems-vehicle-make">Make *</label>

                        <select id="ems-vehicle-make" required>
                            <option value="">Select make</option>
                            ${makeOptions}
                        </select>
                    </div>

                    <div class="ems-vehicle-field">
                        <label for="ems-vehicle-model">Model *</label>

                        <input
                            id="ems-vehicle-model"
                            type="text"
                            maxlength="100"
                            placeholder="e.g. i30, Corolla, Ranger"
                            autocomplete="off"
                            required
                        >
                    </div>

                    <div class="ems-vehicle-field">
                        <label for="ems-vehicle-year">Year *</label>

                        <select id="ems-vehicle-year" required>
                            <option value="">Select year</option>
                            ${yearOptions}
                        </select>
                    </div>

                    <div class="ems-vehicle-field">
                        <label for="ems-vehicle-series">Series / variant</label>

                        <input
                            id="ems-vehicle-series"
                            type="text"
                            maxlength="100"
                            placeholder="e.g. SR, N-Line, ZR6"
                            autocomplete="off"
                        >
                    </div>

                    <div class="ems-vehicle-field">
                        <label for="ems-vehicle-engine">Engine</label>

                        <input
                            id="ems-vehicle-engine"
                            type="text"
                            maxlength="100"
                            placeholder="e.g. 1.6L Turbo"
                            autocomplete="off"
                        >
                    </div>

                    <div class="ems-vehicle-field">
                        <label for="ems-vehicle-transmission">
                            Transmission
                        </label>

                        <select id="ems-vehicle-transmission">
                            <option value="">Not specified</option>
                            <option value="Manual">Manual</option>
                            <option value="Automatic">Automatic</option>
                            <option value="CVT">CVT</option>
                            <option value="DCT">Dual-clutch (DCT)</option>
                        </select>
                    </div>
                </div>

                <div class="ems-vehicle-actions">
                    <button
                        type="submit"
                        class="ems-vehicle-button"
                    >
                        Save vehicle
                    </button>

                    <button
                        type="button"
                        class="ems-vehicle-button ems-vehicle-button-secondary"
                        id="ems-vehicle-clear-form"
                    >
                        Clear selection
                    </button>
                </div>

                <p
                    class="ems-vehicle-message"
                    id="ems-vehicle-message"
                    role="status"
                    aria-live="polite"
                ></p>
            </form>

            <p class="ems-vehicle-notice">
                Vehicle details are saved in this browser. Selecting a
                vehicle does not yet confirm that a product fits it.
                Product compatibility must be verified separately.
            </p>
        `;

        return section;
    }

    function setFormValues(vehicle) {
        document.getElementById("ems-vehicle-make").value =
            vehicle?.make || "";

        document.getElementById("ems-vehicle-model").value =
            vehicle?.model || "";

        document.getElementById("ems-vehicle-year").value =
            vehicle?.year || "";

        document.getElementById("ems-vehicle-series").value =
            vehicle?.series || "";

        document.getElementById("ems-vehicle-engine").value =
            vehicle?.engine || "";

        document.getElementById("ems-vehicle-transmission").value =
            vehicle?.transmission || "";
    }

    function displaySavedVehicle(vehicle) {
        const savedPanel = document.getElementById("ems-vehicle-saved");
        const savedName = document.getElementById("ems-vehicle-saved-name");
        const form = document.getElementById("ems-vehicle-form");
        const message = document.getElementById("ems-vehicle-message");

        if (vehicle) {
            savedPanel.hidden = false;
            savedName.textContent = vehicleLabel(vehicle);
            form.hidden = true;

            message.textContent = "";
        } else {
            savedPanel.hidden = true;
            form.hidden = false;
            savedName.textContent = "";

            setFormValues(null);
        }
    }

    function emitVehicleEvent(vehicle) {
        window.dispatchEvent(
            new CustomEvent("emsVehicleChanged", {
                detail: {
                    vehicle: vehicle ? { ...vehicle } : null
                }
            })
        );
    }

    function initialise() {
        if (!document.body) {
            return;
        }

        addVehicleStyles();

        const insertionPoint = findInsertionPoint();

        if (!insertionPoint) {
            console.error(
                "EMS Auto Parts: Could not find a location for the vehicle selector."
            );

            return;
        }

        const selector = createSelector();

        /*
         * Insert before the category controls or product grid so the
         * selector appears above the catalogue.
         */
        if (!selector.isConnected) {
            insertionPoint.parentNode.insertBefore(
                selector,
                insertionPoint
            );
        }

        const form = document.getElementById("ems-vehicle-form");

        const makeInput = document.getElementById("ems-vehicle-make");
        const modelInput = document.getElementById("ems-vehicle-model");
        const yearInput = document.getElementById("ems-vehicle-year");
        const seriesInput = document.getElementById("ems-vehicle-series");
        const engineInput = document.getElementById("ems-vehicle-engine");
        const transmissionInput = document.getElementById(
            "ems-vehicle-transmission"
        );

        const message = document.getElementById("ems-vehicle-message");

        let selectedVehicle = loadSavedVehicle();

        setFormValues(selectedVehicle);
        displaySavedVehicle(selectedVehicle);

        form.addEventListener("submit", (event) => {
            event.preventDefault();

            const vehicle = {
                make: makeInput.value.trim(),
                model: modelInput.value.trim(),
                year: yearInput.value,
                series: seriesInput.value.trim(),
                engine: engineInput.value.trim(),
                transmission: transmissionInput.value
            };

            if (!vehicle.make || !vehicle.model || !vehicle.year) {
                message.textContent =
                    "Select a make, enter a model and select a year.";

                return;
            }

            vehicle.year = Number(vehicle.year);

            if (
                !Number.isInteger(vehicle.year) ||
                vehicle.year < 1950 ||
                vehicle.year > currentYear
            ) {
                message.textContent = "Select a valid vehicle year.";
                return;
            }

            const saved = saveVehicle(vehicle);

            if (!saved) {
                message.textContent =
                    "The vehicle could not be saved in this browser.";

                return;
            }

            selectedVehicle = vehicle;

            displaySavedVehicle(selectedVehicle);
            emitVehicleEvent(selectedVehicle);

            message.textContent = "";

            /*
             * Notify any other catalogue code listening for vehicle changes.
             * This selector deliberately does not hide products without
             * verified compatibility data.
             */
        });

        document
            .getElementById("ems-vehicle-change")
            .addEventListener("click", () => {
                displaySavedVehicle(null);

                makeInput.focus();

                emitVehicleEvent(null);
            });

        document
            .getElementById("ems-vehicle-clear-form")
            .addEventListener("click", () => {
                clearSavedVehicle();

                selectedVehicle = null;

                setFormValues(null);
                displaySavedVehicle(null);
                emitVehicleEvent(null);

                message.textContent = "Vehicle selection cleared.";
            });

        /*
         * Expose a small public interface for later fitment integration.
         */
        window.EMSVehicleSelector = {
            getSelectedVehicle() {
                return selectedVehicle
                    ? { ...selectedVehicle }
                    : null;
            },

            clear() {
                clearSavedVehicle();

                selectedVehicle = null;

                setFormValues(null);
                displaySavedVehicle(null);
                emitVehicleEvent(null);
            },

            getLabel() {
                return vehicleLabel(selectedVehicle);
            }
        };

        emitVehicleEvent(selectedVehicle);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialise, {
            once: true
        });
    } else {
        initialise();
    }
})();
