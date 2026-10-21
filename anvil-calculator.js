(() => {
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const TEXTURE_URL = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.10/assets/minecraft/textures/item/";
  const MAX_OPERATION_COST = 39;
  const MAX_BOOKS = 12;
  const VANILLA_BOOK_MULTIPLIERS = {
    protection: 1, fire_protection: 1, feather_falling: 1, blast_protection: 1,
    projectile_protection: 1, respiration: 1, aqua_affinity: 2, thorns: 4,
    depth_strider: 2, frost_walker: 2, binding_curse: 4, soul_speed: 4,
    swift_sneak: 4, sharpness: 1, smite: 1, bane_of_arthropods: 1,
    knockback: 1, fire_aspect: 2, looting: 2, sweeping_edge: 2,
    efficiency: 1, silk_touch: 2, unbreaking: 1, fortune: 2, mending: 2,
    power: 1, punch: 1, flame: 2, infinity: 4, luck_of_the_sea: 1,
    lure: 1, loyalty: 1, impaling: 2, riptide: 2, channeling: 4,
    multishot: 2, piercing: 1, quick_charge: 1, density: 1, breach: 2,
    wind_burst: 4, vanishing_curse: 4
  };
  const VANILLA_CONFLICTS = [
    ["sharpness", "smite", "bane_of_arthropods", "density", "breach"],
    ["protection", "fire_protection", "blast_protection", "projectile_protection"],
    ["fortune", "silk_touch"],
    ["infinity", "mending"],
    ["multishot", "piercing"],
    ["loyalty", "riptide"],
    ["riptide", "channeling"],
    ["depth_strider", "frost_walker"]
  ];
  const ALIASES = {
    "aqua affinity": "aqua_affinity",
    "bane of arthropods": "bane_of_arthropods",
    "blast protection": "blast_protection",
    "depth strider": "depth_strider",
    "fire aspect": "fire_aspect",
    "fire protection": "fire_protection",
    fortune: "fortune",
    infinity: "infinity",
    looting: "looting",
    loyalty: "loyalty",
    mending: "mending",
    multishot: "multishot",
    piercing: "piercing",
    power: "power",
    "projectile protection": "projectile_protection",
    punch: "punch",
    riptide: "riptide",
    sharpness: "sharpness",
    "silk touch": "silk_touch",
    smite: "smite",
    thorns: "thorns"
  };
  const PENALTY = Array.from({ length: 32 }, (_, work) => 2 ** work - 1);
  const popcount = (value) => {
    let count = 0;
    for (let bits = value; bits; bits &= bits - 1) count++;
    return count;
  };

  function init(data) {
    const itemsById = new Map(data.items.map((item) => [item.id, item]));
    const enchantmentsById = new Map(data.enchantments.map((entry) => [entry.id, entry]));
    const nameToId = new Map(data.enchantments.map((entry) => [normalize(entry.name), entry.id]));
    const model = { itemId: "", targetWorks: "", targetEnchantments: [], books: [], nextBookId: 1 };
    const itemSelect = $("#anvil-item");
    const targetWorks = $("#anvil-target-works");
    const targetList = $("[data-target-enchantments]");
    const booksContainer = $("#anvil-books");
    const result = $("#anvil-result");
    const status = $("#anvil-status");

    itemSelect.innerHTML = `<option value="">Seleziona un oggetto…</option>${data.items.map((item) =>
      `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`
    ).join("")}`;
    model.itemId = itemSelect.value;

    function canonicalConflictId(name) {
      const normalized = normalize(name);
      return ALIASES[normalized] || nameToId.get(normalized) || normalized.replace(/\s+/g, "_");
    }

    function conflicts(first, second) {
      const firstEntry = enchantmentsById.get(first.id);
      const secondEntry = enchantmentsById.get(second.id);
      const firstConflicts = (firstEntry.conflicts || []).map(canonicalConflictId);
      const secondConflicts = (secondEntry.conflicts || []).map(canonicalConflictId);
      if (firstConflicts.includes(second.id) || secondConflicts.includes(first.id) ||
          firstConflicts.includes("tutti_gli_altri_incantesimi") ||
          secondConflicts.includes("tutti_gli_altri_incantesimi")) return true;
      return VANILLA_CONFLICTS.some((group) => group.includes(first.id) && group.includes(second.id));
    }

    function allEnchantments() {
      return [
        ...model.targetEnchantments,
        ...model.books.flatMap((book) => book.enchantments)
      ];
    }

    function renderEnchantmentPicker(container, mode, book = null) {
      const select = $("[data-enchantment]", container);
      const level = $("[data-level]", container);
      const selectedIds = new Set(allEnchantments().map((entry) => entry.id));
      const compatible = data.enchantments.filter((entry) =>
        entry.applicableTo.includes(model.itemId) && !selectedIds.has(entry.id)
      );
      select.innerHTML = `<option value="">Scegli un incantesimo…</option>${compatible.map((entry) =>
        `<option value="${escapeHTML(entry.id)}">${escapeHTML(entry.name)}${entry.category === "custom" ? " · Custom" : ""}</option>`
      ).join("")}`;
      select.value = "";
      level.innerHTML = '<option value="">Livello</option>';
      level.disabled = true;
      container.dataset.mode = mode;
      if (book) container.dataset.bookKey = book.key;
    }

    function enchantmentListHTML(entries, removeAttribute) {
      return entries.map((entry) => {
        const enchantment = enchantmentsById.get(entry.id);
        return `<li><span>${escapeHTML(enchantment.name)} ${escapeHTML(ROMAN[entry.level] || entry.level)}</span><button type="button" ${removeAttribute}="${escapeHTML(entry.id)}" aria-label="Rimuovi ${escapeHTML(enchantment.name)}">Rimuovi</button></li>`;
      }).join("");
    }

    function renderTarget() {
      const item = itemsById.get(model.itemId);
      targetList.innerHTML = enchantmentListHTML(model.targetEnchantments, "data-remove-target-enchantment");
      const targetPicker = $("[data-target-controls]");
      renderEnchantmentPicker(targetPicker, "target");
      if (!item) {
        targetList.innerHTML = "";
        targetPicker.querySelectorAll("select, button").forEach((control) => { control.disabled = true; });
      } else {
        targetPicker.querySelectorAll("select, button").forEach((control) => { control.disabled = false; });
      }
    }

    function renderBooks() {
      booksContainer.innerHTML = model.books.length ? model.books.map((book, index) => `
        <article class="anvil-book" data-book-key="${escapeHTML(book.key)}">
          <div class="anvil-book-heading">
            <h4>Libro: ${escapeHTML(book.enchantments.length
              ? book.enchantments.map((entry) => `${enchantmentsById.get(entry.id).name} ${ROMAN[entry.level] || entry.level}`).join(" + ")
              : "Nuovo libro")}</h4>
            <button class="chip reset" type="button" data-remove-book>Rimuovi libro</button>
          </div>
          <label>Lavorazioni pregresse del libro
            <input data-book-works type="number" min="0" max="5" step="1" inputmode="numeric" value="${escapeHTML(book.works)}" placeholder="Obbligatorio">
          </label>
          <div class="anvil-enchantment-controls" data-book-controls>
            <select data-enchantment aria-label="Scegli un incantesimo per il libro"></select>
            <select data-level aria-label="Livello dell’incantesimo nel libro" disabled><option value="">Livello</option></select>
            <button class="chip" type="button" data-add-enchantment>Aggiungi</button>
          </div>
          <ul class="anvil-enchantments">${enchantmentListHTML(book.enchantments, "data-remove-book-enchantment")}</ul>
          ${book.enchantments.length ? `<p class="loadout-cost">${book.enchantments.map((entry) => {
            const enchantment = enchantmentsById.get(entry.id);
            const cost = enchantmentCost(enchantment, entry.level);
            return `${escapeHTML(enchantment.name)}: ${cost === null ? "costo non disponibile" : `+${cost} livelli`}`;
          }).join(" · ")}</p>` : '<p class="loadout-cost">Nessun incantesimo aggiunto.</p>'}
        </article>
      `).join("") : '<p class="loadout-cost">Aggiungi i libri che vuoi combinare.</p>';
      for (const book of model.books) {
        const controls = $(`[data-book-key="${CSS.escape(book.key)}"] [data-book-controls]`, booksContainer);
        renderEnchantmentPicker(controls, "book", book);
      }
    }

    function render() {
      renderTarget();
      renderBooks();
    }

    function enchantmentCost(enchantment, level) {
      if (enchantment.category === "vanilla") {
        const multiplier = VANILLA_BOOK_MULTIPLIERS[enchantment.id];
        if (multiplier === undefined) return null;
        return multiplier * level;
      }
      return typeof enchantment.anvilCost === "number" ? enchantment.anvilCost : null;
    }

    function setStatus(message, error = false) {
      status.textContent = message;
      status.classList.toggle("warning", error);
    }

    function addEnchantment(container) {
      const id = $("[data-enchantment]", container).value;
      const level = Number($("[data-level]", container).value);
      const enchantment = enchantmentsById.get(id);
      if (!enchantment) {
        setStatus("Scegli un incantesimo prima di aggiungerlo.", true);
        return;
      }
      if (!Number.isInteger(level) || level < 1 || level > enchantment.maxLevel) {
        setStatus("Scegli un livello valido per l’incantesimo.", true);
        return;
      }
      const conflict = allEnchantments().find((entry) => conflicts(entry, { id, level }));
      if (conflict) {
        setStatus(`${enchantment.name} è incompatibile con ${enchantmentsById.get(conflict.id).name}.`, true);
        return;
      }
      const uniqueCount = allEnchantments().filter((entry) =>
        enchantmentsById.get(entry.id).unique
      ).length;
      if (enchantment.unique &&
          uniqueCount >= (data.itemLimits?.maxUniqueEnchantmentsPerItem ?? 1)) {
        setStatus("Hai già raggiunto il limite di incantesimi unici per questo oggetto.", true);
        return;
      }
      if (allEnchantments().some((entry) => entry.id === id)) {
        setStatus("Per ora inserisci una sola copia di ogni incantesimo: libri duplicati dello stesso incantesimo richiedono regole di fusione aggiuntive.", true);
        return;
      }
      const mode = container.dataset.mode;
      const entry = { id, level };
      if (mode === "target") {
        model.targetEnchantments.push(entry);
      } else {
        const book = model.books.find((candidate) => candidate.key === container.dataset.bookKey);
        if (!book) return;
        book.enchantments.push(entry);
      }
      result.innerHTML = "";
      setStatus("");
      render();
    }

    function priorPenalty(workCount) {
      return PENALTY[workCount] ?? Number.POSITIVE_INFINITY;
    }

    function insertPareto(list, candidate, primary, secondary) {
      if (list.some((current) => current[primary] <= candidate[primary] &&
          current[secondary] <= candidate[secondary])) return;
      for (let index = list.length - 1; index >= 0; index--) {
        if (candidate[primary] <= list[index][primary] &&
            candidate[secondary] <= list[index][secondary]) list.splice(index, 1);
      }
      list.push(candidate);
    }

    function optimize(books, targetWorkCount) {
      const count = books.length;
      const stateCount = 1 << count;
      const fullMask = stateCount - 1;
      const enchantmentCosts = books.map((book) => book.enchantments.reduce((sum, entry) => {
        return sum + enchantmentCost(enchantmentsById.get(entry.id), entry.level);
      }, 0));
      const costsByMask = Array(stateCount).fill(0);
      for (let mask = 1; mask < stateCount; mask++) {
        const bit = mask & -mask;
        const index = 31 - Math.clz32(bit);
        costsByMask[mask] = costsByMask[mask ^ bit] + enchantmentCosts[index];
      }

      const builds = Array.from({ length: stateCount }, () => new Map());
      for (let index = 0; index < count; index++) {
        const mask = 1 << index;
        builds[mask].set(books[index].works, [{
          work: books[index].works, total: 0, peak: 0, steps: []
        }]);
      }

      for (let size = 2; size <= count; size++) {
        for (let mask = 1; mask < stateCount; mask++) {
          if (popcount(mask) !== size) continue;
          for (let leftMask = (mask - 1) & mask; leftMask; leftMask = (leftMask - 1) & mask) {
            const rightMask = mask ^ leftMask;
            if (!rightMask || leftMask > rightMask) continue;
            const orientations = leftMask === rightMask
              ? [[leftMask, rightMask]]
              : [[leftMask, rightMask], [rightMask, leftMask]];
            for (const [targetMask, sacrificeMask] of orientations) {
              for (const [leftWork, leftCandidates] of builds[targetMask]) {
                for (const [rightWork, rightCandidates] of builds[sacrificeMask]) {
                  const cost = costsByMask[sacrificeMask] +
                    priorPenalty(leftWork) + priorPenalty(rightWork);
                  if (cost > MAX_OPERATION_COST) continue;
                  const resultWork = Math.max(leftWork, rightWork) + 1;
                  let candidates = builds[mask].get(resultWork);
                  if (!candidates) {
                    candidates = [];
                    builds[mask].set(resultWork, candidates);
                  }
                  for (const left of leftCandidates) {
                    for (const right of rightCandidates) {
                      insertPareto(candidates, {
                        work: resultWork,
                        total: left.total + right.total + cost,
                        peak: Math.max(left.peak, right.peak, cost),
                        steps: [...left.steps, ...right.steps, {
                          type: "book",
                          leftMask: targetMask,
                          rightMask: sacrificeMask,
                          resultMask: mask,
                          leftWork,
                          rightWork,
                          resultWork,
                          transferCost: costsByMask[sacrificeMask],
                          cost
                        }]
                      }, "total", "peak");
                    }
                  }
                }
              }
            }
          }
        }
      }

      const states = Array.from({ length: stateCount }, () => new Map());
      states[fullMask].set(targetWorkCount, [{ total: 0, peak: 0, steps: [] }]);
      for (let size = count; size >= 1; size--) {
        for (let remaining = 1; remaining < stateCount; remaining++) {
          if (popcount(remaining) !== size) continue;
          for (const [targetWork, prefixes] of states[remaining]) {
            for (let group = remaining; group; group = (group - 1) & remaining) {
              for (const [bookWork, bookCandidates] of builds[group]) {
                const cost = costsByMask[group] + priorPenalty(targetWork) + priorPenalty(bookWork);
                if (cost > MAX_OPERATION_COST) continue;
                const nextWork = Math.max(targetWork, bookWork) + 1;
                const nextMask = remaining ^ group;
                let candidates = states[nextMask].get(nextWork);
                if (!candidates) {
                  candidates = [];
                  states[nextMask].set(nextWork, candidates);
                }
                for (const prefix of prefixes) {
                  for (const bookCandidate of bookCandidates) {
                    insertPareto(candidates, {
                      total: prefix.total + bookCandidate.total + cost,
                      peak: Math.max(prefix.peak, bookCandidate.peak, cost),
                      steps: [
                        ...prefix.steps,
                        ...bookCandidate.steps,
                        {
                          type: "apply",
                          groupMask: group,
                          targetWork,
                          bookWork,
                          resultWork: nextWork,
                          transferCost: costsByMask[group],
                          cost
                        }
                      ]
                    }, "peak", "total");
                  }
                }
              }
            }
          }
        }
      }
      const solutions = [...states[0].values()].flat();
      const finalWorks = (solution) =>
        solution.steps.slice().reverse().find((step) => step.type === "apply")?.resultWork ?? targetWorkCount;
      solutions.sort((first, second) =>
        first.peak - second.peak || first.total - second.total ||
        finalWorks(first) - finalWorks(second) ||
        first.steps.filter((step) => step.type === "apply").length -
        second.steps.filter((step) => step.type === "apply").length
      );
      return solutions[0] || null;
    }

    function buildBookLabel(mask, books) {
      return books.flatMap((book, index) => (mask & (1 << index)) ? book.enchantments : [])
        .map((entry) => `${enchantmentsById.get(entry.id).name} ${ROMAN[entry.level] || entry.level}`)
        .join(" + ");
    }

    function renderAnvilIcon(type, item) {
      const isBook = type === "book";
      const texture = isBook ? "enchanted_book" : item.texture;
      const emoji = isBook ? "📘" : item.emoji || "📦";
      const label = isBook ? "Libro incantato" : item.name;
      return texture
        ? `<img class="anvil-item-icon" src="${TEXTURE_URL}${encodeURIComponent(texture)}.png" data-emoji="${escapeHTML(emoji)}" alt="${escapeHTML(label)}" loading="lazy">`
        : `<span class="anvil-item-icon fb" aria-hidden="true">${escapeHTML(emoji)}</span>`;
    }

    function renderSlotCell(type, label, item) {
      const slotLabel = type === "book" ? `Libro: ${label}` : label;
      return `<span class="anvil-slot-item">${renderAnvilIcon(type, item)}<span>${escapeHTML(slotLabel)}</span></span>`;
    }

    function renderSolution(solution, books) {
      const enchantmentNames = (entries) => entries.map((entry) =>
        `${enchantmentsById.get(entry.id).name} ${ROMAN[entry.level] || entry.level}`
      ).join(", ");
      const targetItem = itemsById.get(model.itemId);
      let targetContents = model.targetEnchantments.slice();
      let targetVersion = 1;
      const rows = solution.steps.map((step, index) => {
        let left;
        let right;
        let contents;
        if (step.type === "book") {
          left = buildBookLabel(step.leftMask, books);
          right = buildBookLabel(step.rightMask, books);
          contents = buildBookLabel(step.resultMask, books);
        } else {
          left = `Oggetto ${targetVersion++}`;
          right = buildBookLabel(step.groupMask, books);
          targetContents = [
            ...targetContents,
            ...books.flatMap((book, bookIndex) =>
              (step.groupMask & (1 << bookIndex)) ? book.enchantments : [])
          ];
          contents = enchantmentNames(targetContents);
        }
        const leftCell = step.type === "book"
          ? renderSlotCell("book", left, targetItem)
          : renderSlotCell("item", left, targetItem);
        const rightCell = renderSlotCell("book", right, targetItem);
        const resultLabel = step.type === "book"
          ? `Libro: ${contents}`
          : `Oggetto ${targetVersion}`;
        const resultCell = `${renderSlotCell(step.type === "book" ? "book" : "item", resultLabel, targetItem)}<br><small>${escapeHTML(contents)}</small>`;
        return `<tr>
          <td>${index + 1}</td>
          <td>${leftCell}</td>
          <td>${rightCell}</td>
          <td>${step.cost} livelli<br><small>${step.transferCost} + ${priorPenalty(step.leftWork ?? step.targetWork)} + ${priorPenalty(step.rightWork ?? step.bookWork)}</small></td>
          <td>${resultCell}</td>
          <td>${step.resultWork}</td>
          <td>+${priorPenalty(step.resultWork)}</td>
        </tr>`;
      }).join("");
      const finalTargetWorks = solution.steps.filter((step) => step.type === "apply").at(-1)?.resultWork ?? model.targetWorks;
      return `<div class="anvil-summary">
        <strong>Sequenza trovata</strong>
        <span>Costo totale: ${solution.total} livelli</span>
        <span>Massimo per operazione: ${solution.peak} / 39</span>
        <span>Lavorazioni finali dell’oggetto: ${finalTargetWorks}</span>
        <span>Enchantment finali: ${escapeHTML(enchantmentNames(targetContents))}</span>
      </div>
      <div class="anvil-table-wrap"><table class="anvil-table">
        <thead><tr><th>#</th><th>Slot sinistro</th><th>Slot destro</th><th>Costo</th><th>Risultato e contenuto</th><th>Lavorazioni</th><th>Penalità</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="loadout-note">Costo di ogni passaggio = costo degli incantesimi trasferiti + penalità dello slot sinistro + penalità dello slot destro. La ricerca confronta gli orientamenti dei libri e le partizioni dei libri da applicare all’oggetto.</p>`;
    }

    function calculate() {
      result.innerHTML = "";
      const targetWorkCount = Number(targetWorks.value);
      if (!Number.isInteger(targetWorkCount) || targetWorkCount < 0 || targetWorkCount > 5) {
        setStatus("Inserisci il numero noto di lavorazioni dell’oggetto, da 0 a 5.", true);
        targetWorks.focus();
        return;
      }
      if (!model.itemId) {
        setStatus("Seleziona l’oggetto da incantare.", true);
        return;
      }
      if (!model.books.length) {
        setStatus("Aggiungi almeno un libro.", true);
        return;
      }
      if (model.books.length > MAX_BOOKS) {
        setStatus(`Il calcolatore supporta al massimo ${MAX_BOOKS} libri per ricerca.`, true);
        return;
      }
      if (model.books.some((book) => !Number.isInteger(Number(book.works)) ||
          Number(book.works) < 0 || Number(book.works) > 5)) {
        setStatus("Inserisci le lavorazioni note (da 0 a 5) per ogni libro.", true);
        return;
      }
      const enchantmentCount = model.targetEnchantments.length +
        model.books.reduce((sum, book) => sum + book.enchantments.length, 0);
      if (enchantmentCount > (data.itemLimits?.maxEnchantmentsPerItem || 12)) {
        setStatus("Il numero totale di incantesimi supera il limite per oggetto.", true);
        return;
      }
      const allEntries = allEnchantments();
      const uniqueCount = allEntries.filter((entry) => enchantmentsById.get(entry.id).unique).length;
      if (uniqueCount > (data.itemLimits?.maxUniqueEnchantmentsPerItem ?? 1)) {
        setStatus("Il numero di incantesimi unici supera il limite previsto per l’oggetto.", true);
        return;
      }
      if (new Set(allEntries.map((entry) => entry.id)).size !== allEntries.length) {
        setStatus("Lo stesso incantesimo non può essere aggiunto più di una volta nel calcolo.", true);
        return;
      }
      if (model.books.some((book) => !book.enchantments.length)) {
        setStatus("Aggiungi almeno un incantesimo a ogni libro oppure rimuovi i libri vuoti.", true);
        return;
      }
      const unavailable = allEntries.find((entry) =>
        enchantmentCost(enchantmentsById.get(entry.id), entry.level) === null
      );
      if (unavailable) {
        setStatus(`Costo non disponibile per ${enchantmentsById.get(unavailable.id).name}; il calcolo è stato interrotto.`, true);
        return;
      }
      const target = itemsById.get(model.itemId);
      const inapplicableTarget = model.targetEnchantments.find((entry) =>
        !enchantmentsById.get(entry.id).applicableTo.includes(target.id)
      );
      if (inapplicableTarget) {
        setStatus(`${enchantmentsById.get(inapplicableTarget.id).name} non è applicabile a ${target.name}.`, true);
        return;
      }
      const inapplicable = model.books.flatMap((book) => book.enchantments)
        .find((entry) => !enchantmentsById.get(entry.id).applicableTo.includes(target.id));
      if (inapplicable) {
        setStatus(`${enchantmentsById.get(inapplicable.id).name} non è applicabile a ${target.name}.`, true);
        return;
      }
      const books = model.books.map((book) => ({ ...book, works: Number(book.works) }));
      setStatus("Ricerca della sequenza…");
      const solution = optimize(books, targetWorkCount);
      if (!solution) {
        setStatus("Nessuna sequenza valida trovata entro il limite di 39 livelli. Verifica dati, compatibilità e lavorazioni pregresse.", true);
        return;
      }
      result.innerHTML = renderSolution(solution, books);
      setStatus("Sequenza calcolata. Verifica ogni costo nell’anteprima dell’incudine prima di confermare.");
    }

    itemSelect.addEventListener("change", () => {
      model.itemId = itemSelect.value;
      result.innerHTML = "";
      render();
    });
    targetWorks.addEventListener("input", () => { model.targetWorks = targetWorks.value; });
    $(".anvil-calculator").addEventListener("change", (event) => {
      if (!event.target.matches("[data-enchantment]")) return;
      const container = event.target.closest("[data-target-controls], [data-book-controls]");
      if (!container) return;
      const level = $("[data-level]", container);
      const enchantment = enchantmentsById.get(event.target.value);
      level.innerHTML = enchantment
        ? `<option value="">Livello</option>${Array.from({ length: enchantment.maxLevel }, (_, index) =>
          `<option value="${index + 1}">${ROMAN[index + 1] || index + 1}</option>`
        ).join("")}`
        : '<option value="">Livello</option>';
      level.disabled = !enchantment;
    });
    $(".anvil-calculator").addEventListener("input", (event) => {
      const bookElement = event.target.closest("[data-book-key]");
      if (event.target.matches("[data-book-works]") && bookElement) {
        const book = model.books.find((candidate) => candidate.key === bookElement.dataset.bookKey);
        if (book) book.works = event.target.value;
      }
    });
    $(".anvil-calculator").addEventListener("click", (event) => {
      const add = event.target.closest("[data-add-enchantment]");
      if (add) {
        const container = add.closest("[data-target-controls], [data-book-controls]");
        if (container) addEnchantment(container);
        return;
      }
      const removeTarget = event.target.closest("[data-remove-target-enchantment]");
      if (removeTarget) {
        model.targetEnchantments = model.targetEnchantments.filter((entry) => entry.id !== removeTarget.dataset.removeTargetEnchantment);
        result.innerHTML = "";
        render();
        return;
      }
      const removeBookEnchantment = event.target.closest("[data-remove-book-enchantment]");
      if (removeBookEnchantment) {
        const book = model.books.find((candidate) => candidate.key === removeBookEnchantment.closest("[data-book-key]").dataset.bookKey);
        if (book) book.enchantments = book.enchantments.filter((entry) => entry.id !== removeBookEnchantment.dataset.removeBookEnchantment);
        result.innerHTML = "";
        render();
        return;
      }
      const removeBook = event.target.closest("[data-remove-book]");
      if (removeBook) {
        const key = removeBook.closest("[data-book-key]").dataset.bookKey;
        model.books = model.books.filter((book) => book.key !== key);
        result.innerHTML = "";
        render();
        return;
      }
      if (event.target.closest("#anvil-add-book")) {
        if (model.books.length >= MAX_BOOKS) {
          setStatus(`Il calcolatore supporta al massimo ${MAX_BOOKS} libri per ricerca.`, true);
          return;
        }
        model.books.push({ key: `book-${model.nextBookId++}`, works: "", enchantments: [] });
        result.innerHTML = "";
        setStatus("");
        renderBooks();
        return;
      }
      if (event.target.closest("#anvil-calculate")) calculate();
    });
    document.addEventListener("calculate-loadout", (event) => {
      const { slot, status: slotStatus, result: slotResult } = event.detail;
      model.itemId = slot.itemId;
      model.targetWorks = String(slot.targetWorks);
      model.targetEnchantments = slot.targetEnchantments.map((entry) => ({ ...entry }));
      model.books = slot.books.map((book) => ({
        key: book.key,
        works: String(book.works),
        enchantments: book.enchantments.map((entry) => ({ id: entry.id, level: entry.level }))
      }));
      itemSelect.value = slot.itemId;
      targetWorks.value = model.targetWorks;
      result.innerHTML = "";
      setStatus("");
      render();
      calculate();
      slotStatus.textContent = status.textContent;
      slotStatus.classList.toggle("warning", status.classList.contains("warning"));
      slotResult.innerHTML = result.innerHTML;
    });
    render();
  }

  document.addEventListener("enchantments-ready", (event) => {
    try {
      init(event.detail);
    } catch (error) {
      console.error("Errore nell’inizializzazione del calcolatore dell’incudine:", error);
      $("#anvil-status").textContent = `Il calcolatore non è disponibile: ${error.message}`;
    }
  }, { once: true });
})();
