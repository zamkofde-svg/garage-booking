// Данные сервиса. Адреса, контакты, ячейки и цены меняются здесь.
// Цены, коды и контакты можно менять и в админке (admin.html): они сохранятся в этом браузере.
window.APP_DATA = {
  ownerPhone: '+7 900 000-00-00',
  telegram: 'https://t.me/your_garage',
  adminPin: '0000',
  holdMinutes: 15,

  // Адреса примерные, замените на настоящие
  garages: [
    { id: 'vostochka', name: 'Восточка', address: 'ул. Примерная, 12' },
    { id: 'oborona', name: 'Оборона', address: 'ул. Примерная, 34' },
    { id: 'center', name: 'Центр', address: 'ул. Примерная, 56' },
  ],

  // size: ширина × глубина × высота, см. Цены в рублях
  cells: [
    { id: 'c1', garageId: 'vostochka', number: 1, size: [60, 60, 60], fits: '2–3 коробки или чемодан', priceDay: 150, priceMonth: 2500, code: '4821' },
    { id: 'c2', garageId: 'vostochka', number: 2, size: [60, 60, 60], fits: '2–3 коробки или чемодан', priceDay: 150, priceMonth: 2500, code: '7314' },
    { id: 'c3', garageId: 'vostochka', number: 3, size: [100, 60, 100], fits: 'комплект шин или 6–8 коробок', priceDay: 250, priceMonth: 3900, code: '2950' },
    { id: 'c4', garageId: 'vostochka', number: 4, size: [150, 80, 200], fits: 'велосипед, самокат или коляска', priceDay: 350, priceMonth: 5500, code: '6083' },
    { id: 'c5', garageId: 'oborona', number: 5, size: [60, 60, 60], fits: '2–3 коробки или чемодан', priceDay: 150, priceMonth: 2500, code: '1597' },
    { id: 'c6', garageId: 'oborona', number: 6, size: [100, 60, 100], fits: 'комплект шин или 6–8 коробок', priceDay: 250, priceMonth: 3900, code: '8462' },
    { id: 'c7', garageId: 'oborona', number: 7, size: [150, 80, 200], fits: 'велосипед, самокат или коляска', priceDay: 350, priceMonth: 5500, code: '3176' },
    { id: 'c8', garageId: 'center', number: 8, size: [60, 60, 60], fits: '2–3 коробки или чемодан', priceDay: 170, priceMonth: 2900, code: '5208' },
    { id: 'c9', garageId: 'center', number: 9, size: [100, 60, 100], fits: 'комплект шин или 6–8 коробок', priceDay: 270, priceMonth: 4300, code: '9641' },
    { id: 'c10', garageId: 'center', number: 10, size: [100, 60, 100], fits: 'комплект шин или 6–8 коробок', priceDay: 270, priceMonth: 4300, code: '0735' },
  ],
};
