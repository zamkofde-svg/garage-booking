// Сценарий бронирования: гараж → срок → ячейка → контакты → оплата → код.
(function () {
  const S = window.Store;
  const DRAFT_KEY = 'garage-booking-draft';

  const screenEl = document.getElementById('screen');
  const topbar = document.getElementById('topbar');
  const backBtn = document.getElementById('backBtn');
  const stepLabel = document.getElementById('stepLabel');
  const progressFill = document.getElementById('progressFill');
  const bottombar = document.getElementById('bottombar');
  const mainBtn = document.getElementById('mainBtn');

  // Номер шага в шапке и экран, куда ведёт «Назад»
  const STEPS = {
    garage: { step: 1 },
    dates: { step: 2, back: 'garage' },
    cell: { step: 3, back: 'dates' },
    contacts: { step: 4, back: 'cell' },
    pay: { title: 'Оплата', back: 'contacts' },
    failed: { title: 'Оплата', back: 'contacts' },
    checking: { title: 'Оплата' },
    expired: { title: 'Оплата' },
    done: {},
    missing: {},
  };

  const screens = {};
  let current = 'garage';
  let timerId = null;
  let mainAction = null;

  // Выбор клиента живёт до закрытия вкладки, чтобы «Назад» и перезагрузка ничего не теряли
  const draft = loadDraft();
  function loadDraft() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {}; } catch (e) { return {}; } }
  function saveDraft() { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) {} }
  function clearDraft() { Object.keys(draft).forEach(k => delete draft[k]); saveDraft(); }

  function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function go(name, opts) {
    current = name;
    clearInterval(timerId);
    const cfg = STEPS[name];
    topbar.hidden = !cfg.step && !cfg.title;
    backBtn.hidden = !cfg.back;
    stepLabel.textContent = cfg.step ? `Шаг ${cfg.step} из 4` : (cfg.title || '');
    progressFill.style.width = cfg.step ? (cfg.step / 4 * 100) + '%' : '100%';
    setMain(null);
    screenEl.innerHTML = '';
    screens[name](screenEl, opts || {});
    window.scrollTo(0, 0);
    screenEl.focus({ preventScroll: true });
  }

  function setMain(label, action, disabled) {
    mainAction = action || null;
    bottombar.hidden = !label;
    if (label) {
      mainBtn.textContent = label;
      mainBtn.disabled = !!disabled;
    }
  }
  mainBtn.addEventListener('click', () => { if (mainAction) mainAction(); });
  backBtn.addEventListener('click', () => { const back = STEPS[current].back; if (back) go(back); });

  function garageById(id) { return window.APP_DATA.garages.find(g => g.id === id); }
  function cellsOf(state, garageId) { return state.cells.filter(c => c.garageId === garageId && c.active); }
  // Своя неоплаченная бронь не делает ячейку занятой для самого клиента
  function isFree(state, cell) { return S.isCellFree(state, cell.id, draft.from, draft.to, draft.bookingId); }
  function mapUrl(g) { return 'https://yandex.ru/maps/?text=' + encodeURIComponent(g.address); }
  function sizeText(c) { return c.size.join('×') + ' см'; }
  function period() { return S.daysBetween(draft.from, draft.to); }

  // Экран 1. Выбор гаража
  screens.garage = function (el) {
    const state = S.getState();
    const t = S.today();
    const cards = window.APP_DATA.garages.map(g => {
      const cells = cellsOf(state, g.id);
      const free = cells.filter(c => S.isCellFree(state, c.id, t, t, draft.bookingId)).length;
      const status = free > 0
        ? `<span class="pill">Свободно ${free} из ${cells.length}</span>`
        : `<span class="pill busy">Сегодня всё занято. Можно выбрать другие даты</span>`;
      const price = cells.length ? `<span class="price">от ${S.money(Math.min(...cells.map(c => c.priceDay)))} в день</span>` : '';
      return `<article class="card${draft.garageId === g.id ? ' selected' : ''}">
          <div>
            <div class="card-title">${esc(g.name)}</div>
            <div class="muted">${esc(g.address)}</div>
          </div>
          <div class="card-row">${status}${price}</div>
          <div class="card-actions">
            <a class="link" href="${mapUrl(g)}" target="_blank" rel="noopener">Как добраться</a>
            <button class="btn primary small" type="button" data-garage="${g.id}" ${cells.length ? '' : 'disabled'}>Выбрать</button>
          </div>
        </article>`;
    }).join('');

    el.innerHTML = `
      <div class="intro">
        <h1>Ячейки для хранения вещей</h1>
        <p class="lead">Три гаража: Восточка, Оборона и Центр. Аренда от 1 дня, доступ по коду круглосуточно.</p>
      </div>
      <div class="list">${cards}</div>`;

    el.querySelectorAll('[data-garage]').forEach(btn => btn.addEventListener('click', () => {
      if (draft.garageId !== btn.dataset.garage) draft.cellId = null;
      draft.garageId = btn.dataset.garage;
      saveDraft();
      go('dates');
    }));
  };

  // Экран 2. Срок аренды
  const PRESETS = [['1', '1 день'], ['7', 'Неделя'], ['30', 'Месяц'], ['90', '3 месяца'], ['custom', 'Свои даты']];

  screens.dates = function (el) {
    const t = S.today();
    if (!draft.from || draft.from < t) {
      draft.from = t;
      draft.to = S.addDays(t, 29);
      draft.preset = '30';
    }

    el.innerHTML = `
      <h1>На какой срок?</h1>
      <div class="chips" role="group" aria-label="Быстрый выбор срока">
        ${PRESETS.map(([value, text]) => `<button type="button" class="chip" data-preset="${value}" aria-pressed="false">${text}</button>`).join('')}
      </div>
      <div class="fields">
        <label class="field"><span>С</span><input type="date" id="from" min="${t}" value="${draft.from}"></label>
        <label class="field"><span>По</span><input type="date" id="to" min="${t}" value="${draft.to || ''}"></label>
      </div>
      <p class="error" id="dateError" role="alert" hidden></p>
      <div class="total-box">
        <div class="total" id="total"></div>
        <p class="hint">От 30 дней действует месячный тариф, так выгоднее.</p>
      </div>`;

    const fromEl = el.querySelector('#from');
    const toEl = el.querySelector('#to');
    const errorEl = el.querySelector('#dateError');
    const totalEl = el.querySelector('#total');

    function applyPreset() {
      if (draft.preset === 'custom') return;
      draft.to = S.addDays(draft.from, Number(draft.preset) - 1);
      toEl.value = draft.to;
    }

    function update() {
      el.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.preset === draft.preset)));
      let message = '';
      if (!draft.from || !draft.to) message = 'Выберите даты начала и окончания.';
      else if (draft.from < t) message = 'Дата начала не может быть раньше сегодняшней.';
      else if (draft.to < draft.from) message = 'Дата окончания не может быть раньше даты начала.';
      errorEl.hidden = !message;
      errorEl.textContent = message;
      toEl.setAttribute('aria-invalid', String(!!message && draft.to < draft.from));
      saveDraft();
      if (message) {
        totalEl.textContent = '—';
        setMain('Дальше', null, true);
        return;
      }
      const days = period();
      const state = S.getState();
      const cells = cellsOf(state, draft.garageId);
      const free = cells.filter(c => isFree(state, c));
      const pool = free.length ? free : cells;
      totalEl.textContent = `${days} дн. · от ${S.money(Math.min(...pool.map(c => S.priceFor(c, days))))}`;
      setMain('Дальше', () => go('cell'));
    }

    el.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
      draft.preset = chip.dataset.preset;
      if (draft.preset === 'custom') {
        fromEl.focus();
        try { fromEl.showPicker(); } catch (e) { /* старые браузеры: календарь откроется по нажатию */ }
      } else {
        if (!draft.from || draft.from < t) { draft.from = t; fromEl.value = t; }
        applyPreset();
      }
      update();
    }));
    // При смене даты начала быстрый вариант сдвигает и дату окончания
    fromEl.addEventListener('change', () => { draft.from = fromEl.value; if (draft.from) applyPreset(); update(); });
    toEl.addEventListener('change', () => { draft.to = toEl.value; draft.preset = 'custom'; update(); });
    update();
  };

  // Экран 3. Выбор ячейки
  screens.cell = function (el, opts) {
    const state = S.getState();
    const g = garageById(draft.garageId);
    const days = period();
    const cells = cellsOf(state, g.id);
    const free = cells.filter(c => isFree(state, c));
    if (draft.cellId && !free.some(c => c.id === draft.cellId)) draft.cellId = null;
    if (!draft.cellId && free.length === 1) draft.cellId = free[0].id;
    saveDraft();

    const head = `
      <div class="intro">
        <h1>Выберите ячейку</h1>
        <p class="muted">${esc(g.name)} · ${S.formatRange(draft.from, draft.to)}</p>
      </div>
      ${opts.taken ? '<p class="banner" role="alert">Эту ячейку только что забронировали. Выберите другую.</p>' : ''}`;

    if (!free.length) {
      el.innerHTML = head + `
        <div class="empty">
          <p>На эти даты в гараже «${esc(g.name)}» свободных ячеек нет. Попробуйте другие даты или другой гараж.</p>
          <div class="btn-row">
            <button class="btn secondary" type="button" data-go="dates">Изменить даты</button>
            <button class="btn secondary" type="button" data-go="garage">Другой гараж</button>
          </div>
        </div>`;
      el.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
      return;
    }

    const sorted = [...free, ...cells.filter(c => !free.includes(c))];
    el.innerHTML = head + `
      <div class="list" role="radiogroup" aria-label="Ячейки">
        ${sorted.map(c => {
          const open = free.includes(c);
          const selected = draft.cellId === c.id;
          return `<button type="button" class="card${selected ? ' selected' : ''}" role="radio" aria-checked="${selected}" data-cell="${c.id}" ${open ? '' : 'disabled'}>
              <span class="card-row">
                <span class="card-title">Ячейка №${c.number}</span>
                ${open ? `<span class="price">${S.money(S.priceFor(c, days))} за ${days} дн.</span>` : '<span class="pill busy">Занята на эти даты</span>'}
              </span>
              <span class="muted">${sizeText(c)}</span>
              <span>Поместится: ${esc(c.fits)}</span>
            </button>`;
        }).join('')}
      </div>`;

    el.querySelectorAll('[data-cell]:not([disabled])').forEach(btn => btn.addEventListener('click', () => {
      draft.cellId = btn.dataset.cell;
      saveDraft();
      el.querySelectorAll('[data-cell]').forEach(x => {
        x.classList.toggle('selected', x === btn);
        x.setAttribute('aria-checked', String(x === btn));
      });
      setMain('Дальше', () => go('contacts'));
    }));
    setMain('Дальше', () => go('contacts'), !draft.cellId);
  };

  // Запуск: ссылка из SMS открывает экран с кодом, иначе начинаем с выбора гаража
  const token = new URLSearchParams(location.search).get('b');
  if (token) {
    const booking = S.getState().bookings.find(b => b.token === token && b.status === 'paid');
    go(booking ? 'done' : 'missing', { booking });
  } else {
    go('garage');
  }
})();
