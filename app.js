const DATA_URL = "./data/enchantments.json";
const TEXTURE_URL = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.10/assets/minecraft/textures/item/";
const ARMOR_IDS = ["helmet", "chest", "legs", "boots"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const ANVIL_LIMIT = 40;
const INCOMPATIBLE_GROUPS = [
  ["Affilatezza", "Anatema", "Flagello degli artropodi", "Densità", "Breccia"],
  ["Protezione", "Protezione dal fuoco", "Protezione dalle esplosioni", "Protezione dai proiettili"],
  ["Fortuna", "Tocco di velluto"],
  ["Infinità", "Ripristino"],
  ["Tiro multiplo", "Perforazione"],
  ["Lealtà", "Risacca"],
  ["Risacca", "Canalizzazione"],
  ["Passo anfibio", "Passo gelato"]
];
const ENCHANTMENT_ALIASES = {
  "aqua affinity": "affinità all'acqua",
  "bane of arthropods": "flagello degli artropodi",
  "blast protection": "protezione dalle esplosioni",
  "depth strider": "passo anfibio",
  "fire aspect": "aspetto di fuoco",
  "fire protection": "protezione dal fuoco",
  "fortune": "fortuna",
  "infinity": "infinità",
  "looting": "saccheggio",
  "loyalty": "lealtà",
  "mending": "ripristino",
  "multishot": "tiro multiplo",
  "piercing": "perforazione",
  "power": "potenza",
  "projectile protection": "protezione dai proiettili",
  "punch": "impatto",
  "riptide": "risacca",
  "sharpness": "affilatezza",
  "silk touch": "tocco di velluto",
  "smite": "anatema",
  "thorns": "spine"
};

const $ = (selector) => document.querySelector(selector);
const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const canonicalEnchantmentName = (name) => ENCHANTMENT_ALIASES[normalize(name)] || normalize(name);
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
        !(typeof enchantment.anvilCost === "string" && enchantment.anvilCost.trim() ||
          typeof enchantment.anvilCost === "number" && Number.isFinite(enchantment.anvilCost) && enchantment.anvilCost >= 0)) {
      throw new Error(`Dati mancanti o non validi per l'incantesimo "${enchantment.name || enchantment.id || "senza nome"}".`);
    }
    if (enchantment.applicableTo.some((itemId) => !itemIds.has(itemId))) {
      throw new Error(`"${enchantment.name}" fa riferimento a un ID oggetto inesistente.`);
    }
    if (enchantment.category === "custom" &&
        (!enchantment.rarity ||
         !Array.isArray(enchantment.conflicts) ||
         !Array.isArray(enchantment.requirements) ||
         typeof enchantment.unique !== "boolean" ||
         (enchantment.unique && enchantment.maxPerItem !== 1))) {
      throw new Error(`Rarità, conflitti, requisiti o limite non validi per "${enchantment.name}".`);
    }
    if (enchantment.targetScope === "armor_set" && ARMOR_IDS.some((id) => !enchantment.applicableTo.includes(id))) {
      throw new Error(`"${enchantment.name}" è dichiarato per tutta l'armatura ma non elenca tutti e quattro i pezzi.`);
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
  return `Costo incudine: ${typeof anvilCost === "number" ? `+${anvilCost} livelli` : anvilCost}`;
}

function makeScopeLabel(enchantment, itemsById) {
  if (enchantment.targetScope === "armor_set") {
    return "Tutti i pezzi dell’armatura";
  }
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
      (!query || normalize(`${enchantment.name} ${enchantment.description} ${enchantment.rarity || ""} ${(enchantment.conflicts || []).join(" ")} ${(enchantment.requirements || []).join(" ")}`).includes(query))
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
          ${enchantment.category === "custom" ? `<span class="detail rarity">Rarità: ${escapeHTML(enchantment.rarity)}</span>` : ""}
          <span class="detail">${escapeHTML(makeAnvilCost(enchantment.anvilCost))}</span>
        </div>
        ${enchantment.category === "custom" ? `<div class="custom-meta">
          <span><strong>Requisiti:</strong> ${enchantment.requirements.length ? escapeHTML(enchantment.requirements.join(", ")) : "Nessun requisito"}</span>
          <span><strong>Conflitti:</strong> ${enchantment.conflicts.length ? escapeHTML(enchantment.conflicts.join(", ")) : "Nessun conflitto"}</span>
          ${enchantment.unique ? `<span class="unique">Unico · max ${enchantment.maxPerItem} per oggetto</span>` : ""}
        </div>` : ""}
        <div class="on">${enchantment.applicableTo.map((id) => {
          const item = itemsById.get(id);
          return `<i>${icon(item)}${escapeHTML(item.name)}</i>`;
        }).join("")}</div>
      </article>`).join("") : '<div class="empty">Nessun incantesimo trovato.<br>Prova un altro nome o togli un filtro.</div>';
  }

  const loadout = ARMOR_IDS.map((itemId, index) => ({ key: `slot-${index}`, itemId, enchantments: [] }));
  let nextSlotId = loadout.length;

  $("#loadout-item-select").innerHTML = [...groups].map(([groupName, items]) =>
    `<optgroup label="${escapeHTML(groupName)}">${items.map((item) =>
      `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`
    ).join("")}</optgroup>`
  ).join("");

  function findLoadoutConflict(candidate, current) {
    const candidateName = canonicalEnchantmentName(candidate.name);
    const currentName = canonicalEnchantmentName(current.name);
    const candidateConflicts = (candidate.conflicts || []).map(canonicalEnchantmentName);
    const currentConflicts = (current.conflicts || []).map(canonicalEnchantmentName);
    if (candidateConflicts.includes(currentName) || currentConflicts.includes(candidateName) ||
        candidateConflicts.includes("tutti gli altri incantesimi") ||
        currentConflicts.includes("tutti gli altri incantesimi")) {
      return true;
    }
    return INCOMPATIBLE_GROUPS.some((group) => {
      const names = group.map(canonicalEnchantmentName);
      return names.includes(candidateName) && names.includes(currentName);
    });
  }

  function renderLoadout() {
    $("#loadout-slots").innerHTML = loadout.length ? loadout.map((slot) => {
      const item = itemsById.get(slot.itemId);
      const compatible = data.enchantments.filter((enchantment) => enchantment.applicableTo.includes(slot.itemId));
      const knownCost = slot.enchantments.reduce((sum, entry) => {
        const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
        return sum + (typeof enchantment.anvilCost === "number" ? enchantment.anvilCost : 0);
      }, 0);
      const unknownCosts = slot.enchantments.filter((entry) => {
        const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
        return typeof enchantment.anvilCost !== "number";
      }).length;
      const costWarning = knownCost >= ANVIL_LIMIT;
      return `
        <article class="loadout-slot" data-slot-key="${escapeHTML(slot.key)}">
          <h3>${icon(item)}${escapeHTML(item.name)}
            <button class="chip remove-slot" type="button" data-remove-slot aria-label="Rimuovi ${escapeHTML(item.name)} dal loadout">Rimuovi</button>
          </h3>
          <div class="loadout-controls">
            <select data-enchantment aria-label="Scegli un incantesimo per ${escapeHTML(item.name)}">
              <option value="">Scegli un incantesimo…</option>
              ${compatible.map((enchantment) => {
                const alreadyAdded = slot.enchantments.some((entry) => entry.id === enchantment.id);
                return `<option value="${escapeHTML(enchantment.id)}"${alreadyAdded ? " disabled" : ""}>${escapeHTML(enchantment.name)}${enchantment.category === "custom" ? " · Custom" : ""}${alreadyAdded ? " ✓" : ""}</option>`;
              }).join("")}
            </select>
            <select data-level aria-label="Livello dell’incantesimo" disabled><option value="">Livello</option></select>
            <button class="chip" type="button" data-add-enchantment>Aggiungi</button>
          </div>
          ${slot.enchantments.length ? `<ul class="loadout-enchantments">${slot.enchantments.map((entry) => {
            const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
            return `<li><span>${escapeHTML(enchantment.name)} ${escapeHTML(ROMAN[entry.level] || entry.level)}</span><button type="button" data-remove-enchantment="${escapeHTML(entry.id)}" aria-label="Rimuovi ${escapeHTML(enchantment.name)}">Rimuovi</button></li>`;
          }).join("")}</ul>` : '<p class="loadout-cost">Nessun incantesimo aggiunto.</p>'}
          ${slot.enchantments.length ? `<p class="loadout-cost${costWarning || unknownCosts ? " warning" : ""}">Somma dei costi noti: +${knownCost} livelli${unknownCosts ? ` · ${unknownCosts} costo/i “?”` : ""}${costWarning ? " · raggiunge la soglia di 40: verifica l’ordine delle combinazioni" : ""}</p>` : ""}
        </article>`;
    }).join("") : '<div class="loadout-empty">Il loadout è vuoto. Aggiungi un oggetto per iniziare.</div>';
    $("#loadout-status").textContent = `${loadout.length} ${loadout.length === 1 ? "oggetto" : "oggetti"} nel loadout`;
  }

  $("#loadout-slots").addEventListener("change", (event) => {
    if (!event.target.matches("[data-enchantment]")) return;
    const slotElement = event.target.closest(".loadout-slot");
    const levelSelect = slotElement.querySelector("[data-level]");
    const enchantment = data.enchantments.find((entry) => entry.id === event.target.value);
    levelSelect.innerHTML = enchantment
      ? Array.from({ length: enchantment.maxLevel }, (_, index) =>
        `<option value="${index + 1}">${ROMAN[index + 1] || index + 1}</option>`
      ).join("")
      : "";
    levelSelect.disabled = !enchantment;
  });

  $("#loadout-slots").addEventListener("click", (event) => {
    const slotElement = event.target.closest(".loadout-slot");
    if (!slotElement) return;
    const slot = loadout.find((entry) => entry.key === slotElement.dataset.slotKey);
    if (event.target.closest("[data-remove-slot]")) {
      loadout.splice(loadout.indexOf(slot), 1);
      renderLoadout();
      return;
    }
    const removeButton = event.target.closest("[data-remove-enchantment]");
    if (removeButton) {
      slot.enchantments = slot.enchantments.filter((entry) => entry.id !== removeButton.dataset.removeEnchantment);
      renderLoadout();
      return;
    }
    if (!event.target.closest("[data-add-enchantment]")) return;
    const select = slotElement.querySelector("[data-enchantment]");
    const enchantment = data.enchantments.find((entry) => entry.id === select.value);
    if (!enchantment) {
      $("#loadout-status").textContent = "Scegli prima un incantesimo.";
      return;
    }
    if (slot.enchantments.some((entry) => entry.id === enchantment.id)) {
      $("#loadout-status").textContent = `${enchantment.name} è già presente su questo oggetto.`;
      return;
    }
    const conflict = slot.enchantments
      .map((entry) => data.enchantments.find((candidate) => candidate.id === entry.id))
      .find((current) => findLoadoutConflict(enchantment, current));
    if (conflict) {
      $("#loadout-status").textContent = `${enchantment.name} è incompatibile con ${conflict.name} su questo oggetto.`;
      return;
    }
    const level = Number(slotElement.querySelector("[data-level]").value);
    if (!Number.isInteger(level) || level < 1 || level > enchantment.maxLevel) {
      $("#loadout-status").textContent = "Scegli un livello valido per l’incantesimo.";
      return;
    }
    slot.enchantments.push({ id: enchantment.id, level });
    renderLoadout();
  });

  $("#loadout-add-item").addEventListener("click", () => {
    const itemId = $("#loadout-item-select").value;
    if (!itemsById.has(itemId)) {
      $("#loadout-status").textContent = "Scegli un oggetto valido.";
      return;
    }
    loadout.push({ key: `slot-${nextSlotId++}`, itemId, enchantments: [] });
    renderLoadout();
  });

  $("#loadout-reset").addEventListener("click", () => {
    loadout.splice(0, loadout.length);
    renderLoadout();
  });

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
  renderLoadout();
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
