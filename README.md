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
- Karty klasowe pojawiają się w nagrodach i sklepie tylko u swojej postaci.

### Nekromantka i słudzy

Nekromantka walczy rękami **sług**. Karty przywołują ich na 4 miejsca obok postaci:

| Sługa | HP | Na koniec tury |
| --- | --- | --- |
| 💀 Szkielet | 7 | zadaje 3 obrażeń losowemu wrogowi |
| 👻 Widmo | 4 | daje Ci 3 pancerza |
| 🧟 Utopiony | 9 | zadaje 4 obrażeń losowemu wrogowi |
| 🦴 Kościany golem | 14 | zadaje 2 obrażeń losowemu wrogowi |

- **Wrogowie najpierw biją sługi:** każdy cios trafia pierwszego sługę z lewej (jest obrysowany na czerwono), a nadmiar obrażeń przechodzi na Ciebie. Pancerz nie chroni sług.
- Karty mogą przywoływać sługi, leczyć je, poświęcać dla energii i kart albo wysadzać (Eksplozja kości). **Moc nieumarłych** wzmacnia ich obrażenia i pancerz, a **Pan grobu** przywołuje Szkieleta co turę.
- Kartę przywołania lub poświęcenia da się zagrać tylko wtedy, gdy jest na to miejsce lub sługa (inaczej jest wyszarzona).

## Zawartość

- 6 postaci do wyboru (każda ma własną talię, HP i startowy relikt)
- 54 karty (każda z ulepszeniem): 20 neutralnych oraz po 17 klasowych Automatu i Nekromantki
- 22 relikty, 5 mikstur
- 15 zwykłych przeciwników, 4 elity, 1 boss
- 4 wydarzenia losowe

## Dodawanie własnych sprite'ów

Gra domyślnie używa emoji. Własne obrazki dodajesz w pliku `sprites.js`, bez ruszania reszty kodu:

1. Wrzuć pliki (PNG, WebP, GIF lub SVG, najlepiej z przezroczystym tłem) do folderu `assets/`.
2. W `sprites.js` wpisz ścieżkę pod kluczem z `data.js`, np. `characters: { latarnik: 'assets/latarnik.png' }` albo `enemies: { krab: 'assets/krab.png' }`.

Można podmienić postacie, wrogów, ilustracje kart, relikty, mikstury, kule Automatu, sługi Nekromantki i ikony pól na mapie. Czego nie wpiszesz albo co się nie wczyta, zostaje emoji. Dla pixel artu ustaw `pixelArt: true`, wtedy obrazki nie są wygładzane. Pełna lista kluczy i zalecane rozmiary są w komentarzu na górze `sprites.js`.

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
