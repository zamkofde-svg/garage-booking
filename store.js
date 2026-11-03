// Общая логика сайта и админки: хранение, даты, цены, занятость ячеек.
// Данные лежат в памяти браузера (localStorage). С сервером их заменит база данных.
(function () {
  const KEY = 'garage-booking-v1';
  const D = window.APP_DATA;
  const DAY_MS = 86400000;
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  let memory = null;

  // Даты храним строками ГГГГ-ММ-ДД в местном времени
  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parts(iso) { return iso.split('-').map(Number); }
  function today() { return toISO(new Date()); }
  function addDays(iso, n) { const [y, m, d] = parts(iso); return toISO(new Date(y, m - 1, d + n)); }
  function dayNumber(iso) { const [y, m, d] = parts(iso); return Date.UTC(y, m - 1, d) / DAY_MS; }
  // Аренда считается с даты начала по дату окончания включительно
  function daysBetween(from, to) { return dayNumber(to) - dayNumber(from) + 1; }
  function formatDate(iso) { const [, m, d] = parts(iso); return d + ' ' + MONTHS[m - 1]; }
  function formatRange(from, to) { return from === to ? formatDate(from) : formatDate(from) + ' – ' + formatDate(to); }
  function money(n) { return n.toLocaleString('ru-RU') + ' ₽'; }

  // Месяц = 30 дней. Остаток дней никогда не стоит дороже полного месяца
  function priceFor(cell, days) {
    const months = Math.floor(days / 30);
    const rest = days % 30;
    return months * cell.priceMonth + Math.min(rest * cell.priceDay, cell.priceMonth);
  }

  function formatPhone(raw) {
    let d = String(raw).replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' ' + d.slice(1, 4);
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }
  function phoneValid(v) { return String(v).replace(/\D/g, '').length === 11; }

  function newId() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function newToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Демо-брони, чтобы сразу были видны занятые ячейки
  function seedBookings(cells) {
    const t = today();
    const make = (cellId, fromOff, toOff, name, phone, source) => {
      const cell = cells.find(c => c.id === cellId);
      const from = addDays(t, fromOff);
      const to = addDays(t, toOff);
      return {
        id: newId(), token: newToken(), cellId, from, to, name, phone, email: '',
        status: 'paid', source, sum: priceFor(cell, daysBetween(from, to)),
        createdAt: Date.now() - Math.max(1, 1 - fromOff) * DAY_MS, expiresAt: 0,
      };
    };
    return [
      make('c8', -3, 10, 'Анна', '+7 900 111-22-33', 'online'),
      make('c9', 0, 30, 'Игорь', '+7 900 222-33-44', 'online'),
      make('c10', -1, 40, 'Марина', '+7 900 333-44-55', 'manual'),
      make('c1', 0, 5, 'Олег', '+7 900 444-55-66', 'online'),
      make('c5', -20, -1, 'Дмитрий', '+7 900 555-66-77', 'manual'),
      make('c3', 3, 33, 'Светлана', '+7 900 666-77-88', 'online'),
    ];
  }

  function createState() {
    const cells = D.cells.map(c => ({ ...c, active: true, codeChangedAt: addDays(today(), -60) }));
    return { cells, bookings: seedBookings(cells), ownerPhone: D.ownerPhone, telegram: D.telegram };
  }

  function read() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function write(state) {
    memory = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* браузер не даёт хранить: работаем в памяти */ }
  }
  // Каждый раз читаем заново, чтобы сайт и админка в разных вкладках видели свежие данные
  function getState() {
    const s = read() || memory;
    if (s) return s;
    const fresh = createState();
    write(fresh);
    return fresh;
  }
  function update(fn) { const s = getState(); const result = fn(s); write(s); return result; }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} memory = null; return getState(); }

  // Ячейку держит оплаченная бронь или бронь, которая ещё ждёт оплаты
  function isHolding(b, now) { return b.status === 'paid' || (b.status === 'pending' && b.expiresAt > now); }

  function isCellFree(state, cellId, from, to, ignoreId) {
    const cell = state.cells.find(c => c.id === cellId);
    if (!cell || !cell.active) return false;
    const now = Date.now();
    return !state.bookings.some(b =>
      b.cellId === cellId && b.id !== ignoreId && isHolding(b, now) && b.from <= to && b.to >= from);
  }

  // Закрепляет ячейку на время оплаты. Повторный вызов обновляет ту же бронь, таймер не сбрасывается
  function holdCell(data) {
    return update(state => {
      const now = Date.now();
      let b = data.id && state.bookings.find(x => x.id === data.id && x.status === 'pending' && x.expiresAt > now);
      if (!isCellFree(state, data.cellId, data.from, data.to, b ? b.id : null)) return { ok: false };
      if (!b) {
        b = { id: newId(), token: newToken(), status: 'pending', source: 'online', createdAt: now, expiresAt: now + D.holdMinutes * 60000 };
        state.bookings.push(b);
      }
      const cell = state.cells.find(c => c.id === data.cellId);
      Object.assign(b, {
        cellId: data.cellId, from: data.from, to: data.to,
        name: data.name, phone: data.phone, email: data.email || '',
        sum: priceFor(cell, daysBetween(data.from, data.to)),
      });
      return { ok: true, booking: b };
    });
  }

  // В рабочей версии это сделает сервер по уведомлению от платёжного сервиса
  function markPaid(id) {
    return update(state => {
      const b = state.bookings.find(x => x.id === id && x.status === 'pending');
      if (!b) return null;
      if (b.expiresAt <= Date.now()) return 'expired';
      b.status = 'paid';
      b.paidAt = Date.now();
      return b;
    });
  }

  function createManual(data) {
    return update(state => {
      if (!isCellFree(state, data.cellId, data.from, data.to)) return { ok: false };
      const cell = state.cells.find(c => c.id === data.cellId);
      const b = {
        id: newId(), token: newToken(), cellId: data.cellId, from: data.from, to: data.to,
        name: data.name, phone: data.phone, email: '', status: 'paid', source: 'manual',
        sum: priceFor(cell, daysBetween(data.from, data.to)), createdAt: Date.now(), expiresAt: 0,
      };
      state.bookings.push(b);
      return { ok: true, booking: b };
    });
  }

  function cancel(id) {
    update(state => {
      const b = state.bookings.find(x => x.id === id);
      if (b) { b.status = 'cancelled'; b.cancelledAt = Date.now(); }
    });
  }

  function saveCell(id, fields) {
    update(state => {
      const cell = state.cells.find(c => c.id === id);
      if (!cell) return;
      if (fields.code !== cell.code) cell.codeChangedAt = today();
      Object.assign(cell, fields);
    });
  }

  function saveSettings(fields) { update(state => { Object.assign(state, fields); }); }

  function bookingStatus(b) {
    const t = today();
    if (b.status === 'cancelled') return { key: 'cancelled', label: 'Отменена' };
    if (b.status === 'pending') {
      return b.expiresAt > Date.now() ? { key: 'pending', label: 'Ждёт оплаты' } : { key: 'expired', label: 'Не оплачена' };
    }
    if (b.to < t) return { key: 'ended', label: 'Завершена' };
    if (b.from > t) return { key: 'future', label: 'Будущая' };
    return { key: 'active', label: 'Активная' };
  }

  // Аренда закончилась, а код на ячейке с тех пор не меняли
  function needsCodeChange(state, cell) {
    const t = today();
    return state.bookings.some(b =>
      b.cellId === cell.id && b.status === 'paid' && b.to < t && b.to >= cell.codeChangedAt);
  }

  window.Store = {
    today, addDays, daysBetween, formatDate, formatRange, money, priceFor, formatPhone, phoneValid,
    getState, update, reset, isCellFree, holdCell, markPaid, createManual, cancel, saveCell, saveSettings,
    bookingStatus, needsCodeChange,
  };
})();
