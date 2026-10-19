const DATA_URL = "data/enchantments.json";
const TEXTURE_URL = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.10/assets/minecraft/textures/item/";
const ARMOR_IDS = ["helmet", "chest", "legs", "boots"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const $ = (selector) => document.querySelector(selector);
const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

function validateData(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items) || !Array.isArray(data.enchantments)) {
    throw new Error("Il JSON non rispetta la struttura richiesta (schemaVersion 1, items, enchantments).");
  }
  const itemIds = new Set(data.items.map((item) => item.id));
  if (itemIds.size !== data.items.length || data.items.some((item) => !item.id || !item.name || !item.group)) {
    throw new Error("La lista degli oggetti contiene ID duplicati o campi obbligatori mancanti.");
  }
  const enchantmentIds = new Set();
  for (const enchantment of data.enchantments) {
    if (!enchantment.id || enchantmentIds.has(enchantment.id) ||
        !enchantment.name || !enchantment.description ||
        !["vanilla", "custom"].includes(enchantment.category) ||
        !Number.isInteger(enchantment.maxLevel) || enchantment.maxLevel < 1 ||
        !Array.isArray(enchantment.applicableTo) || enchantment.applicableTo.length === 0 ||
        !["armor_set", "specific_items", "multiple_items", "all_items"].includes(enchantment.targetScope) ||
        !enchantment.anvilCost || !["known", "unknown"].includes(enchantment.anvilCost.status)) {
      throw new Error(`Dati mancanti o non validi per l'incantesimo "${enchantment.name || enchantment.id || "senza nome"}".`);
    }
    if (enchantment.applicableTo.some((itemId) => !itemIds.has(itemId))) {
      throw new Error(`"${enchantment.name}" fa riferimento a un ID oggetto inesistente.`);
    }
    if (enchantment.targetScope === "armor_set" && ARMOR_IDS.some((id) => !enchantment.applicableTo.includes(id))) {
      throw new Error(`"${enchantment.name}" è dichiarato per tutta l'armatura ma non elenca tutti e quattro i pezzi.`);
    }
    if (enchantment.anvilCost.status === "known" &&
        (!Number.isFinite(enchantment.anvilCost.levels) || enchantment.anvilCost.levels < 0)) {
      throw new Error(`Il costo incudine di "${enchantment.name}" deve essere un numero di livelli uguale o maggiore di zero.`);
    }
    enchantmentIds.add(enchantment.id);
  }
  return data;
}

function icon(item, className = "mc") {
  const emoji = item.emoji || "📦";
  if (!item.texture) return `<span class="${className} fb" aria-hidden="true">${escapeHTML(emoji)}</span>`;
  return `<img class="${className}" src="${TEXTURE_URL}${encodeURIComponent(item.texture)}.png" data-emoji="${escapeHTML(emoji)}" alt="" loading="lazy">`;
}

function makeAnvilCost(anvilCost) {
  if (anvilCost.status === "known") {
    return `Costo incudine: ${anvilCost.levels} ${anvilCost.levels === 1 ? "livello" : "livelli"}`;
  }
  return `Costo incudine: da configurare${anvilCost.notes ? ` — ${anvilCost.notes}` : ""}`;
}

function makeScopeLabel(enchantment, itemsById) {
  if (enchantment.targetScope === "armor_set") return "Tutti i pezzi dell’armatura";
  if (enchantment.targetScope === "all_items") return "Tutti gli oggetti elencati";
  if (enchantment.targetScope === "specific_items" && enchantment.applicableTo.length === 1) {
    return `Solo: ${itemsById.get(enchantment.applicableTo[0]).name}`;
  }
  return "Più oggetti";
}

function render(data) {
  const itemsById = new Map(data.items.map((item) => [item.id, item]));
  const groups = new Map();
  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.emoji) return;
    const fallback = document.createElement("span");
    fallback.className = `${image.className} fb`;
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = image.dataset.emoji;
    image.replaceWith(fallback);
  }, true);
  for (const item of data.items) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }

  $("#groups").innerHTML = [...groups].map(([groupName, items]) =>
    `<div class="gname">${escapeHTML(groupName)}</div><div class="items">${items.map((item) =>
      `<button class="item" data-id="${escapeHTML(item.id)}" aria-pressed="false">${icon(item)}${escapeHTML(item.name)}</button>`
    ).join("")}</div>`
  ).join("");

  let selectedItemId = null;
  let categoryFilter = "all";
  let query = "";

  function updateList() {
    const results = data.enchantments.filter((enchantment) =>
      (!selectedItemId || enchantment.applicableTo.includes(selectedItemId)) &&
      (categoryFilter === "all" || enchantment.category === categoryFilter) &&
      (!query || normalize(`${enchantment.name} ${enchantment.description} ${enchantment.anvilCost.notes || ""}`).includes(query))
    );
    const selectedItem = selectedItemId ? itemsById.get(selectedItemId) : null;
    $("#h-ench").innerHTML = selectedItem
      ? `${icon(selectedItem)} Incantesimi per ${escapeHTML(selectedItem.name.toLowerCase())}`
      : "Incantesimi";
    $("#status").textContent = `${results.length} ${results.length === 1 ? "incantesimo" : "incantesimi"}${selectedItem ? "" : " · scegli un oggetto per filtrare"}`;
    $("#list").innerHTML = results.length ? results.map((enchantment) => `
      <article class="ench${enchantment.category === "custom" ? " custom" : ""}">
        <strong>${escapeHTML(enchantment.name)}${enchantment.category === "custom" ? '<span class="badge">Custom</span>' : ""}</strong>
        <span class="lvl">Liv. max ${ROMAN[enchantment.maxLevel] || enchantment.maxLevel}</span>
        <p>${escapeHTML(enchantment.description)}</p>
        <div class="details">
          <span class="detail">${escapeHTML(makeScopeLabel(enchantment, itemsById))}</span>
          <span class="detail">${escapeHTML(makeAnvilCost(enchantment.anvilCost))}</span>
        </div>
        <div class="on">${enchantment.applicableTo.map((id) => {
          const item = itemsById.get(id);
          return `<i>${icon(item)}${escapeHTML(item.name)}</i>`;
        }).join("")}</div>
      </article>`).join("") : '<div class="empty">Nessun incantesimo trovato.<br>Prova un altro nome o togli un filtro.</div>';
  }

  $("#groups").addEventListener("click", (event) => {
    const button = event.target.closest(".item");
    if (!button) return;
    selectedItemId = selectedItemId === button.dataset.id ? null : button.dataset.id;
    $("#groups").querySelectorAll(".item").forEach((itemButton) =>
      itemButton.setAttribute("aria-pressed", String(itemButton.dataset.id === selectedItemId))
    );
    updateList();
  });

  $("#filters").addEventListener("click", (event) => {
    const button = event.target.closest(".chip");
    if (!button) return;
    categoryFilter = button.dataset.filter;
    $("#filters").querySelectorAll(".chip").forEach((chip) =>
      chip.setAttribute("aria-pressed", String(chip === button))
    );
    updateList();
  });

  $("#q").addEventListener("input", (event) => {
    query = normalize(event.target.value.trim());
    updateList();
  });

  updateList();
}

async function start() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Impossibile caricare ${DATA_URL} (HTTP ${response.status}).`);
    render(validateData(await response.json()));
  } catch (error) {
    console.error("Errore nel caricamento del catalogo:", error);
    $("#status").textContent = "Catalogo non disponibile.";
    $("#list").innerHTML = `<div class="error">Non è stato possibile caricare il catalogo JSON.<br>${escapeHTML(error.message)}<br>Avvia il server locale indicato nel README e ricarica la pagina.</div>`;
  }
}

start();
