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

### Automat i kule

Automat gra inaczej niż reszta postaci. Jego karty tworzą **kule**, które zajmują miejsca obok postaci (na start 3):

| Kula | Na koniec tury | Gdy zostanie uwolniona |
| --- | --- | --- |
| ⚡ Błysk | 3 obrażeń losowemu wrogowi | 8 obrażeń losowemu wrogowi |
| 🧊 Szron | 2 pancerza | 5 pancerza |
| 🌌 Mrok | rośnie o 6 | tyle obrażeń najsłabszemu wrogowi, ile urosła |
| 🔮 Plazma | +1 energii w następnej turze | +2 energii od razu |

- Gdy miejsca są pełne, nowa kula uwalnia najstarszą.
- **Skupienie** wzmacnia Błysk, Szron i Mrok. **Pętla** sprawia, że pierwsza kula działa dodatkowo na koniec tury.
- Kule nie korzystają z Siły, a wrogowie z Podatnością dostają od nich więcej obrażeń.
- Karty klasowe pojawiają się w nagrodach i sklepie tylko u Automatu.

## Zawartość

- 5 postaci do wyboru (każda ma własną talię, HP i startowy relikt)
- 37 kart (każda z ulepszeniem): 20 neutralnych i 17 klasowych Automatu, 8 reliktów, 5 mikstur
- 7 zwykłych przeciwników, 2 elity, 1 boss
- 4 wydarzenia losowe

## Dodawanie własnych sprite'ów

Gra domyślnie używa emoji. Własne obrazki dodajesz w pliku `sprites.js`, bez ruszania reszty kodu:

1. Wrzuć pliki (PNG, WebP, GIF lub SVG, najlepiej z przezroczystym tłem) do folderu `assets/`.
2. W `sprites.js` wpisz ścieżkę pod kluczem z `data.js`, np. `characters: { latarnik: 'assets/latarnik.png' }` albo `enemies: { krab: 'assets/krab.png' }`.

Można podmienić postacie, wrogów, ilustracje kart, relikty, mikstury, kule Automatu i ikony pól na mapie. Czego nie wpiszesz albo co się nie wczyta, zostaje emoji. Dla pixel artu ustaw `pixelArt: true`, wtedy obrazki nie są wygładzane. Pełna lista kluczy i zalecane rozmiary są w komentarzu na górze `sprites.js`.

## Dodawanie postaci

W `data.js`, w obiekcie `CHARACTERS`, dopisz wpis (nazwa, ikona, HP, złoto, opis, startowe relikty i talia z id kart). Pojawi się sam na ekranie wyboru, a jego sprite ustawisz w `sprites.js` pod tym samym kluczem. Karty tylko dla jednej postaci oznaczasz polem `char: 'id_postaci'` w `CARDS`.

## Pliki

| Plik | Zawartość |
| --- | --- |
| `index.html` | strona |
| `style.css` | wygląd (układ działa też na telefonie) |
| `data.js` | postacie, karty, wrogowie, relikty, mikstury |
| `sprites.js` | przypisanie własnych obrazków |
| `core.js` | wspólne narzędzia i interfejs |
| `combat.js` | silnik walki |
| `screens.js` | menu, mapa, nagrody, ognisko, sklep, wydarzenia |
| `main.js` | start gry |
