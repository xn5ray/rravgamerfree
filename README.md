# Latarnia

Roguelike z talią kart, który działa w przeglądarce. Inspirowany gatunkiem Slay the Spire, ale z własnym światem, kartami i przeciwnikami: wspinasz się po zatopionej latarni aż do Serca Głębiny.

## Jak uruchomić

Otwórz `index.html` w przeglądarce. Nie trzeba niczego instalować ani budować. Na GitHub Pages wystarczy włączyć publikację z gałęzi `main` (Settings → Pages).

## Zasady

- Przejście ma 15 pięter. Na mapie wybierasz drogę: walka, elita, ognisko, sklep lub wydarzenie. Na szczycie czeka boss.
- Każda tura: 3 energii i 5 kart. Zagrywasz karty, a potem kończysz turę.
- Wrogowie pokazują, co zrobią w następnej turze (atak, pancerz, wzmocnienie, osłabienie).
- Po walce wybierasz 1 z 3 kart do talii. Elity dają relikty.
- Ognisko: lecz 30% HP albo ulepsz kartę. Sklep: karty, relikty, mikstury i usuwanie kart.
- Statusy: **Siła** (większe obrażenia), **Osłabienie** (−25% obrażeń), **Podatność** (+50% otrzymywanych obrażeń), **Kolce** (atakujący dostają obrażenia).
- Skrót klawiszowy: `E` kończy turę.

## Zawartość

- 20 kart (każda z ulepszeniem), 7 reliktów, 5 mikstur
- 7 zwykłych przeciwników, 2 elity, 1 boss
- 4 wydarzenia losowe

## Pliki

| Plik | Zawartość |
| --- | --- |
| `index.html` | strona |
| `style.css` | wygląd (układ działa też na telefonie) |
| `data.js` | karty, wrogowie, relikty, mikstury |
| `core.js` | wspólne narzędzia i interfejs |
| `combat.js` | silnik walki |
| `screens.js` | menu, mapa, nagrody, ognisko, sklep, wydarzenia |
| `main.js` | start gry |
