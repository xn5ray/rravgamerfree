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
- Skrót klawiszowy: `E` kończy turę (w co-op: przełącza gotowość).

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

### Co-op lokalny (2 graczy)

W menu wybierz **Co-op lokalny**, a potem postać dla każdego gracza. Gracze walczą razem przeciwko wrogom na jednym ekranie.

- Każdy gracz ma własną postać, talię, relikty, mikstury, HP, energię i rękę. Mapa i złoto są wspólne.
- Tura jest wspólna i gra się w niej jednocześnie: przełączasz widok na rękę wybranego gracza (klik w postać albo plakietkę gracza u góry, `Tab`, `1` / `2`) i zagrywasz jego karty w dowolnej kolejności.
- Gdy gracz skończy, naciska **Gotowy** (`E`). Można cofnąć gotowość. Tura wrogów zaczyna się, gdy wszyscy żywi gracze są gotowi.
- Każdy wróg wybiera cel i pokazuje go przy zapowiedzi (`→ 1` albo `→ 2`).
- Poległy gracz nie gra do końca walki, a po wygranej wstaje z 25% HP. Porażka następuje, gdy polegną obaj.
- Wrogowie mają więcej HP, a nagrody są większe. Po walce każdy wybiera własną kartę, w ognisku każdy po kolei odpoczywa albo ulepsza kartę, a w sklepie i wydarzeniach przełączasz, który gracz kupuje lub decyduje.
- Skalowanie ustawisz w `data.js`, w stałej `COOP` (`hpScale` dla HP wrogów, `goldScale` dla złota).

### Gra online (P2P, 2 graczy)

W menu wybierz **Online (P2P, 2 graczy)**. Gra jest współpracą jak w co-opie lokalnym, ale każdy gra na swoim urządzeniu. Nie potrzeba serwera: przeglądarki łączą się wprost (WebRTC), więc działa to także na GitHub Pages.

1. Jedno z was wybiera **Hostuję grę** i dostaje kod zaproszenia. Wysyła go drugiej osobie (komunikator, mail).
2. Druga osoba wybiera **Dołączam do gry**, wkleja kod i odsyła kod odpowiedzi.
3. Host wkleja odpowiedź i klika **Połącz**. Potem każdy wybiera swoją postać.

- Każdy widzi i zagrywa tylko swoją rękę. Kolejność kart w turze jest dowolna, a wrogowie ruszają, gdy obaj klikną **Gotowy**.
- Mapę wybiera ten, kto pierwszy kliknie węzeł. Nagrody po walce, ognisko i sklep (wspólne złoto) działają dla każdego osobno. W wydarzeniu decyduje ten, kto pierwszy wybierze.
- Obie przeglądarki liczą całą grę same, z tym samym seedem losowania, i wymieniają tylko akcje graczy. Po każdej akcji porównują skrót stanu, a gdy się rozjadą, gra to zgłasza.
- Do połączenia przez internet używany jest publiczny serwer STUN Google (tylko do ustalenia adresów). W bardzo restrykcyjnych sieciach (np. część sieci firmowych i mobilnych) połączenie bez serwera TURN może się nie udać.
- Gdy ktoś się rozłączy, sesja się kończy (nie ma wznawiania).

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
| `net.js` | gra online P2P (połączenie, lobby, synchronizacja akcji) |
| `main.js` | start gry |
