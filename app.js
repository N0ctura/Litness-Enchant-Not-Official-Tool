const DATA_URL = "./data/enchantments.json";
const TEXTURE_URL = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.10/assets/minecraft/textures/item/";
const ARMOR_IDS = ["helmet", "chest", "legs", "boots"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
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

function makeAnvilCost(enchantment) {
  if (enchantment.category === "vanilla") return "Costo libro: calcolato secondo Java";
  return `Costo incudine: ${typeof enchantment.anvilCost === "number" ? `+${enchantment.anvilCost} livelli` : enchantment.anvilCost}`;
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
  const STORAGE_KEY = "litness-custom-books";
  const customBooks = [];

  function saveCustomBooks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customBooks.map((book) => ({
      id: book.id,
      name: book.name,
      emoji: book.emoji,
      applicableTo: book.applicableTo,
      anvilCost: book.anvilCost,
      customBook: true
    }))));
  }

  function loadCustomBooks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      customBooks.splice(0, customBooks.length, ...parsed.map((book) => ({
        id: book.id,
        name: book.name,
        emoji: book.emoji || "📘",
        description: "Libro creato dall’utente per un server in evoluzione.",
        category: "custom",
        rarity: "Personalizzato",
        conflicts: [],
        requirements: [],
        unique: false,
        maxLevel: 1,
        applicableTo: Array.isArray(book.applicableTo) && book.applicableTo.length ? book.applicableTo : ["sword"],
        targetScope: "specific_items",
        anvilCost: Number(book.anvilCost) || 0,
        customBook: true
      })));
      customBooks.forEach((book) => data.enchantments.push(book));
    } catch (error) {
      console.warn("Impossibile leggere i libri custom salvati:", error);
    }
  }

  function renderCustomBooks() {
    const customList = $("#custom-book-list");
    if (!customList) return;
    customList.innerHTML = customBooks.length ? customBooks.map((book) => {
      const compatibleItem = itemsById.get(book.applicableTo[0]);
      return `
        <li class="custom-book-item">
          <div class="custom-book-emoji" aria-hidden="true">${escapeHTML(book.emoji || "📘")}</div>
          <div>
            <strong>${escapeHTML(book.name)}</strong>
            <small>${icon(compatibleItem)} ${escapeHTML(compatibleItem.name)} · +${escapeHTML(book.anvilCost)} livelli</small>
          </div>
          <div class="custom-book-actions">
            <button class="chip" type="button" data-add-custom-book="${escapeHTML(book.id)}">Aggiungi</button>
            <button class="chip reset" type="button" data-remove-custom-book="${escapeHTML(book.id)}">Rimuovi</button>
          </div>
        </li>
      `;
    }).join("") : '<li class="empty">Nessun libro custom ancora creato.</li>';
  }

  function createCustomBookEntry(name, itemId, emoji, cost) {
    const safeName = name.trim();
    if (!safeName) throw new Error("Inserisci un nome valido per il libro.");
    const parsedCost = Number(cost);
    if (!Number.isFinite(parsedCost) || parsedCost < 0 || parsedCost > 99) {
      throw new Error("Il costo in livelli deve essere un numero compreso tra 0 e 99.");
    }
    const book = {
      id: `custom-book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: safeName,
      emoji: emoji.trim() || "📘",
      description: "Libro creato dall’utente per un server in evoluzione.",
      category: "custom",
      rarity: "Personalizzato",
      conflicts: [],
      requirements: [],
      unique: false,
      maxLevel: 1,
      applicableTo: [itemId],
      targetScope: "specific_items",
      anvilCost: parsedCost,
      customBook: true
    };
    data.enchantments.push(book);
    customBooks.push(book);
    saveCustomBooks();
    renderCustomBooks();
    updateList();
    renderLoadout();
    return book;
  }

  function addCustomBookToLoadout(bookId) {
    const book = data.enchantments.find((entry) => entry.id === bookId && entry.customBook);
    if (!book) return;
    const targetItemId = book.applicableTo[0];
    let slot = loadout.find((entry) => entry.itemId === targetItemId);
    if (!slot) {
      slot = { key: `slot-${nextSlotId++}`, itemId: targetItemId, enchantments: [], books: [], targetEnchantments: [], targetWorks: "" };
      loadout.push(slot);
    }
    const existingBook = slot.books.find((entry) => entry.customBookId === book.id);
    if (existingBook) {
      return;
    }
    const newBook = {
      key: `loadout-book-${nextSlotId++}`,
      works: "0",
      enchantments: [{ id: book.id, level: 1 }],
      customBookId: book.id
    };
    slot.books.push(newBook);
    slot.enchantments.push({ id: book.id, level: 1, bookKey: newBook.key, customBookId: book.id });
    saveLoadout();
    renderLoadout();
  }

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
          <span class="detail">${escapeHTML(makeAnvilCost(enchantment))}</span>
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

  const loadout = ARMOR_IDS.map((itemId, index) => ({
    key: `slot-${index}`, itemId, enchantments: [], books: [], targetEnchantments: [], targetWorks: ""
  }));
  let nextSlotId = loadout.length;
  const LOADOUT_STORAGE_KEY = "litness-loadout";

  function saveLoadout() {
    try {
      localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(loadout));
    } catch (error) {
      console.error("Impossibile salvare il loadout:", error);
      $("#loadout-status").textContent = "Impossibile salvare il loadout in questo browser.";
    }
  }

  function loadLoadout() {
    try {
      const saved = localStorage.getItem(LOADOUT_STORAGE_KEY);
      if (saved === null) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("Il loadout salvato non è una lista.");

      const restored = parsed.map((slot) => {
        if (!slot || typeof slot.key !== "string" || !itemsById.has(slot.itemId) ||
            !Array.isArray(slot.targetEnchantments) || !Array.isArray(slot.books)) {
          throw new Error("Uno slot del loadout salvato non è valido.");
        }
        const targetEnchantments = slot.targetEnchantments.map((entry) => {
          const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
          if (!enchantment || !enchantment.applicableTo.includes(slot.itemId) ||
              !Number.isInteger(entry.level) || entry.level < 1 || entry.level > enchantment.maxLevel) {
            throw new Error("Un incantesimo salvato nel loadout non è più valido.");
          }
          return { id: entry.id, level: entry.level };
        });
        const books = slot.books.map((book) => {
          if (!book || typeof book.key !== "string" || !Array.isArray(book.enchantments) ||
              (book.customBookId && !customBooks.some((customBook) => customBook.id === book.customBookId))) {
            throw new Error("Un libro salvato nel loadout non è più valido.");
          }
          const enchantments = book.enchantments.map((entry) => {
            const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
            if (!enchantment || !enchantment.applicableTo.includes(slot.itemId) ||
                !Number.isInteger(entry.level) || entry.level < 1 || entry.level > enchantment.maxLevel) {
              throw new Error("Un incantesimo salvato in un libro non è più valido.");
            }
            return { id: entry.id, level: entry.level };
          });
          return {
            key: book.key,
            works: String(book.works ?? "0"),
            enchantments,
            ...(book.customBookId ? { customBookId: book.customBookId } : {})
          };
        });
        const allEntries = [...targetEnchantments, ...books.flatMap((book) => book.enchantments)];
        if (allEntries.length > 12 || new Set(allEntries.map((entry) => entry.id)).size !== allEntries.length) {
          throw new Error("Il loadout salvato contiene incantesimi duplicati o supera il limite consentito.");
        }
        return {
          key: slot.key,
          itemId: slot.itemId,
          targetWorks: String(slot.targetWorks ?? ""),
          targetEnchantments,
          books,
          enchantments: books.flatMap((book) => book.enchantments.map((entry) => ({
            ...entry,
            bookKey: book.key,
            ...(book.customBookId ? { customBookId: book.customBookId } : {})
          })))
        };
      });

      loadout.splice(0, loadout.length, ...restored);
      const savedIds = restored.flatMap((slot) => [slot.key, ...slot.books.map((book) => book.key)])
        .map((key) => Number(key.match(/\d+$/)?.[0]))
        .filter(Number.isFinite);
      nextSlotId = Math.max(loadout.length, ...savedIds.map((id) => id + 1));
    } catch (error) {
      console.error("Impossibile ripristinare il loadout salvato:", error);
      $("#loadout-status").textContent = "Il loadout salvato non è valido e non è stato ripristinato.";
    }
  }

  $("#loadout-item-select").innerHTML = [...groups].map(([groupName, items]) =>
    `<optgroup label="${escapeHTML(groupName)}">${items.map((item) =>
      `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`
    ).join("")}</optgroup>`
  ).join("");
  $("#custom-book-item").innerHTML = [...groups].map(([groupName, items]) =>
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
    const bookName = (book) => book.enchantments.map((entry) => {
      const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
      return `${enchantment.name} ${ROMAN[entry.level] || entry.level}`;
    }).join(" + ") || "Libro vuoto";
    $("#loadout-slots").innerHTML = loadout.length ? loadout.map((slot) => {
      const item = itemsById.get(slot.itemId);
      const compatible = data.enchantments.filter((enchantment) => enchantment.applicableTo.includes(slot.itemId));
      const usedEnchantmentIds = new Set([
        ...slot.targetEnchantments.map((entry) => entry.id),
        ...slot.enchantments.map((entry) => entry.id)
      ]);
      const available = compatible.filter((enchantment) => !usedEnchantmentIds.has(enchantment.id));
      return `
        <article class="loadout-slot" data-slot-key="${escapeHTML(slot.key)}">
          <h3>${icon(item)}${escapeHTML(item.name)}
            <button class="chip remove-slot" type="button" data-remove-slot aria-label="Rimuovi ${escapeHTML(item.name)} dal loadout">Rimuovi</button>
          </h3>
          <label class="loadout-work-count">Lavorazioni pregresse dell’oggetto
            <input data-target-works type="number" min="0" max="5" step="1" inputmode="numeric" value="${escapeHTML(slot.targetWorks)}" placeholder="Obbligatorio">
          </label>
          <h4 class="loadout-subheading">Già presenti sull’oggetto</h4>
          <div class="loadout-controls">
            <select data-base-enchantment aria-label="Incantesimo già presente su ${escapeHTML(item.name)}">
              <option value="">Scegli un incantesimo…</option>
              ${available.map((enchantment) => `<option value="${escapeHTML(enchantment.id)}">${escapeHTML(enchantment.name)}${enchantment.category === "custom" ? " · Custom" : ""}</option>`).join("")}
            </select>
            <select data-base-level aria-label="Livello incantesimo già presente" disabled><option value="">Livello</option></select>
            <button class="chip" type="button" data-add-base-enchantment>Aggiungi</button>
          </div>
          ${slot.targetEnchantments.length ? `<ul class="loadout-enchantments">${slot.targetEnchantments.map((entry) => {
            const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
            return `<li><span>${escapeHTML(enchantment.name)} ${escapeHTML(ROMAN[entry.level] || entry.level)}</span><button type="button" data-remove-base-enchantment="${escapeHTML(entry.id)}" aria-label="Rimuovi ${escapeHTML(enchantment.name)} dall’oggetto">Rimuovi</button></li>`;
          }).join("")}</ul>` : '<p class="loadout-cost">Nessun incantesimo preesistente.</p>'}
          <h4 class="loadout-subheading">Libri da applicare</h4>
          <div class="loadout-controls">
            <select data-enchantment aria-label="Scegli un incantesimo per ${escapeHTML(item.name)}">
              <option value="">Scegli un incantesimo…</option>
              ${available.map((enchantment) => `<option value="${escapeHTML(enchantment.id)}"${enchantment.customBook ? ' class="custom-book-option"' : ""}>${escapeHTML(enchantment.name)}${enchantment.category === "custom" ? " · Custom" : ""}</option>`).join("")}
            </select>
            <select data-level aria-label="Livello dell’incantesimo" disabled><option value="">Livello</option></select>
            <select data-book-group aria-label="Libro a cui aggiungere l’incantesimo">
              <option value="">Crea un nuovo libro</option>
              ${slot.books.map((book) => `<option value="${escapeHTML(book.key)}">Aggiungi a: ${escapeHTML(bookName(book))}</option>`).join("")}
            </select>
            <button class="chip" type="button" data-add-enchantment>Aggiungi</button>
          </div>
          ${slot.books.length ? `<div class="loadout-book-groups">${slot.books.map((book) => `
            <section class="loadout-book" data-book-key="${escapeHTML(book.key)}">
              <h5 class="loadout-book-title">Libro: ${escapeHTML(bookName(book))}</h5>
              <label>Lavorazioni pregresse
                <input data-book-works type="number" min="0" max="5" step="1" inputmode="numeric" value="${escapeHTML(book.works)}" placeholder="Obbligatorio">
              </label>
              <ul class="loadout-enchantments">${book.enchantments.map((entry) => {
                const enchantment = data.enchantments.find((candidate) => candidate.id === entry.id);
                return `<li><span>${escapeHTML(enchantment.name)} ${escapeHTML(ROMAN[entry.level] || entry.level)}</span><button type="button" data-remove-enchantment="${escapeHTML(entry.id)}" aria-label="Rimuovi ${escapeHTML(enchantment.name)} dal libro">Rimuovi</button></li>`;
              }).join("")}</ul>
              <button class="chip reset" type="button" data-remove-book>Rimuovi libro</button>
            </section>`).join("")}</div>` : '<p class="loadout-cost">Nessun libro aggiunto.</p>'}
          <button class="chip loadout-calculate" type="button" data-calculate-slot>Calcola sequenza</button>
          <p class="loadout-status" data-slot-status aria-live="polite"></p>
          <div class="anvil-result" data-slot-result aria-live="polite"></div>
        </article>`;
    }).join("") : '<div class="loadout-empty">Il loadout è vuoto. Aggiungi un oggetto per iniziare.</div>';
    $("#loadout-status").textContent = `${loadout.length} ${loadout.length === 1 ? "oggetto" : "oggetti"} nel loadout`;
  }

  $("#loadout-slots").addEventListener("change", (event) => {
    const slotElement = event.target.closest(".loadout-slot");
    if (!slotElement) return;
    if (event.target.matches("[data-target-works]")) {
      const slot = loadout.find((entry) => entry.key === slotElement.dataset.slotKey);
      slot.targetWorks = event.target.value;
      saveLoadout();
      return;
    }
    if (event.target.matches("[data-book-works]")) {
      const slot = loadout.find((entry) => entry.key === slotElement.dataset.slotKey);
      const book = slot.books.find((entry) => entry.key === event.target.closest("[data-book-key]").dataset.bookKey);
      if (book) {
        book.works = event.target.value;
        saveLoadout();
      }
      return;
    }
    if (!event.target.matches("[data-enchantment], [data-base-enchantment]")) return;
    const levelSelect = slotElement.querySelector("[data-level]");
    const targetLevel = event.target.matches("[data-base-enchantment]")
      ? slotElement.querySelector("[data-base-level]") : levelSelect;
    const enchantment = data.enchantments.find((entry) => entry.id === event.target.value);
    targetLevel.innerHTML = enchantment
      ? Array.from({ length: enchantment.maxLevel }, (_, index) =>
        `<option value="${index + 1}">${ROMAN[index + 1] || index + 1}</option>`
      ).join("")
      : "";
    targetLevel.disabled = !enchantment;
  });

  $("#loadout-slots").addEventListener("click", (event) => {
    const slotElement = event.target.closest(".loadout-slot");
    if (!slotElement) return;
    const slot = loadout.find((entry) => entry.key === slotElement.dataset.slotKey);
    if (event.target.closest("[data-remove-slot]")) {
      loadout.splice(loadout.indexOf(slot), 1);
      saveLoadout();
      renderLoadout();
      return;
    }
    const removeBase = event.target.closest("[data-remove-base-enchantment]");
    if (removeBase) {
      slot.targetEnchantments = slot.targetEnchantments.filter((entry) => entry.id !== removeBase.dataset.removeBaseEnchantment);
      saveLoadout();
      renderLoadout();
      return;
    }
    const removeBook = event.target.closest("[data-remove-book]");
    if (removeBook) {
      const key = removeBook.closest("[data-book-key]").dataset.bookKey;
      const removed = slot.books.find((book) => book.key === key);
      slot.enchantments = slot.enchantments.filter((entry) => entry.bookKey !== key);
      slot.books = slot.books.filter((book) => book.key !== key);
      if (removed) {
        saveLoadout();
        renderLoadout();
      }
      return;
    }
    const removeButton = event.target.closest("[data-remove-enchantment]");
    if (removeButton) {
      slot.enchantments = slot.enchantments.filter((entry) => entry.id !== removeButton.dataset.removeEnchantment);
      slot.books.forEach((book) => {
        book.enchantments = book.enchantments.filter((entry) => entry.id !== removeButton.dataset.removeEnchantment);
      });
      slot.books = slot.books.filter((book) => book.enchantments.length);
      saveLoadout();
      renderLoadout();
      return;
    }
    if (event.target.closest("[data-add-base-enchantment]")) {
      const select = slotElement.querySelector("[data-base-enchantment]");
      const enchantment = data.enchantments.find((entry) => entry.id === select.value);
      const level = Number(slotElement.querySelector("[data-base-level]").value);
      if (!enchantment || !Number.isInteger(level) || level < 1 || level > enchantment.maxLevel) {
        $("#loadout-status").textContent = "Scegli un incantesimo e un livello valido.";
        return;
      }
      const conflict = [...slot.targetEnchantments, ...slot.enchantments]
        .map((entry) => data.enchantments.find((candidate) => candidate.id === entry.id))
        .find((current) => findLoadoutConflict(enchantment, current));
      if (conflict) {
        $("#loadout-status").textContent = `${enchantment.name} è incompatibile con ${conflict.name} su questo oggetto.`;
        return;
      }
      if (slot.enchantments.length + slot.targetEnchantments.length >= 12) {
        $("#loadout-status").textContent = "Hai raggiunto il limite di 12 incantesimi per oggetto.";
        return;
      }
      slot.targetEnchantments.push({ id: enchantment.id, level });
      saveLoadout();
      renderLoadout();
      return;
    }
    if (event.target.closest("[data-calculate-slot]")) {
      const status = slotElement.querySelector("[data-slot-status]");
      const result = slotElement.querySelector("[data-slot-result]");
      status.textContent = "Calcolo della sequenza…";
      result.innerHTML = "";
      document.dispatchEvent(new CustomEvent("calculate-loadout", {
        detail: {
          slot: {
            itemId: slot.itemId,
            targetWorks: slot.targetWorks,
            targetEnchantments: slot.targetEnchantments,
            books: slot.books
          },
          status,
          result
        }
      }));
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
    const conflict = [...slot.targetEnchantments, ...slot.enchantments]
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
    if (slot.enchantments.length + slot.targetEnchantments.length >= 12) {
      $("#loadout-status").textContent = "Hai raggiunto il limite di 12 incantesimi per oggetto.";
      return;
    }
    const groupKey = slotElement.querySelector("[data-book-group]").value;
    let book = slot.books.find((entry) => entry.key === groupKey);
    if (!book) {
      book = { key: `loadout-book-${nextSlotId++}`, works: "0", enchantments: [] };
      slot.books.push(book);
    }
    const bookEntry = { id: enchantment.id, level };
    book.enchantments.push(bookEntry);
    slot.enchantments.push({ ...bookEntry, bookKey: book.key });
    saveLoadout();
    renderLoadout();
  });

  $("#loadout-add-item").addEventListener("click", () => {
    const itemId = $("#loadout-item-select").value;
    if (!itemsById.has(itemId)) {
      $("#loadout-status").textContent = "Scegli un oggetto valido.";
      return;
    }
    loadout.push({
      key: `slot-${nextSlotId++}`,
      itemId,
      enchantments: [],
      books: [],
      targetEnchantments: [],
      targetWorks: ""
    });
    saveLoadout();
    renderLoadout();
  });

  $("#loadout-reset").addEventListener("click", () => {
    loadout.splice(0, loadout.length);
    saveLoadout();
    renderLoadout();
  });

  $("#custom-book-add").addEventListener("click", () => {
    const nameField = $("#custom-book-name");
    const itemField = $("#custom-book-item");
    const emojiField = $("#custom-book-emoji");
    const costField = $("#custom-book-cost");
    try {
      createCustomBookEntry(nameField.value, itemField.value, emojiField.value, costField.value);
      nameField.value = "";
      emojiField.value = "📘";
      costField.value = "5";
      $("#loadout-status").textContent = "Libro custom salvato. È ora disponibile nel loadout.";
    } catch (error) {
      $("#loadout-status").textContent = error.message;
    }
  });

  $("#custom-book-list").addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-custom-book]");
    if (addButton) {
      addCustomBookToLoadout(addButton.dataset.addCustomBook);
      return;
    }
    const removeButton = event.target.closest("[data-remove-custom-book]");
    if (!removeButton) return;
    const customBookId = removeButton.dataset.removeCustomBook;
    const index = customBooks.findIndex((book) => book.id === customBookId);
    if (index !== -1) {
      customBooks.splice(index, 1);
      data.enchantments = data.enchantments.filter((entry) => entry.id !== customBookId);
      loadout.forEach((slot) => {
        slot.books = slot.books.filter((book) => book.customBookId !== customBookId);
        slot.enchantments = slot.enchantments.filter((entry) => entry.id !== customBookId);
      });
      saveCustomBooks();
      saveLoadout();
      renderCustomBooks();
      updateList();
      renderLoadout();
    }
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

  loadCustomBooks();
  loadLoadout();
  renderCustomBooks();
  updateList();
  renderLoadout();
}

async function start() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Impossibile caricare ${DATA_URL} (HTTP ${response.status}).`);
    const data = validateData(await response.json());
    render(data);
    document.dispatchEvent(new CustomEvent("enchantments-ready", { detail: data }));
  } catch (error) {
    console.error("Errore nel caricamento del catalogo:", error);
    $("#status").textContent = "Catalogo non disponibile.";
    $("#list").innerHTML = `<div class="error">Non è stato possibile caricare il catalogo JSON.<br>${escapeHTML(error.message)}<br>Avvia il server locale indicato nel README e ricarica la pagina.</div>`;
  }
}

start();
