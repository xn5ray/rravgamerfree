'use strict';

/* ---------- Wydarzenia losowe ----------
   Każde wydarzenie: ikona, tytuł, opis i wybory { label, fn, pick?, can? }.
   - fn(done, inst): wykonuje efekt na graczu, który wybrał (G.* to jego dane) i woła done(tekst wyniku).
   - pick: 'up' (ulepsz), 'rm' (usuń) lub 'dup' (skopiuj): gracz wskazuje kartę, która trafia do fn jako inst.
     Wybór jest nieaktywny, gdy nie ma żadnej odpowiedniej karty.
   - can(): dodatkowy warunek, np. wystarczająco złota. Wybór jest nieaktywny, gdy zwraca false.
   Losowanie musi iść przez rand()/pick() (nie Math.random), bo tryb online liczy grę po obu stronach. */

const gainMax = n => { G.max += n; G.hp += n; };
const needGold = n => () => G.gold >= n;
function removeCard(inst) { G.deck.splice(G.deck.indexOf(inst), 1); }
function upgradeRandom() {
  const list = G.deck.filter(c => !c.up);
  if (!list.length) return null;
  const c = pick(list);
  c.up = true;
  return c;
}
function randomPotion() {
  if (G.potions.length >= 3) return null;
  const id = pick(Object.keys(POTIONS));
  G.potions.push(id);
  return id;
}
function loseRandomRelic() {
  if (!G.relics.length) return null;
  const id = pick(G.relics);
  G.relics.splice(G.relics.indexOf(id), 1);
  return id;
}
function loseRandomPotion() {
  if (!G.potions.length) return null;
  return G.potions.splice(rnd(0, G.potions.length - 1), 1)[0];
}
function addCard(rarity) {
  const id = pick(cardPool(rarity));
  G.deck.push({ id, up: false });
  return id;
}
/* Daje losowy relikt, a gdy już wszystkie są, 60 złota. Zwraca tekst o nagrodzie. */
function relicOrGold() {
  const r = randomRelic();
  if (r) { gainRelic(r); return `${RELICS[r].icon} ${RELICS[r].name}`; }
  G.gold += 60;
  return '60 złota (masz już wszystkie relikty)';
}
const potionText = id => (id ? `${POTIONS[id].icon} ${POTIONS[id].name}` : 'nic, bo masz komplet mikstur');

const EVENTS = [
  {
    icon: '🚢', title: 'Wrak statku',
    text: 'Z mielizny wystaje kadłub zatopionego statku. W ładowni coś błyszczy, ale pokład trzeszczy.',
    choices: [
      { label: 'Przeszukaj ładownię (+60 złota, −8 HP)', fn: done => { G.gold += 60; loseHpSafe(8); done('Znajdujesz mokrą sakiewkę. Deski kaleczą ci dłonie.'); } },
      { label: 'Odejdź', fn: done => done('Zostawiasz wrak falom.') }
    ]
  },
  {
    icon: '🧜', title: 'Syrena w grocie',
    text: 'Syrena zaprasza cię do wody. Obiecuje, że jej pieśń wyostrzy twój oręż. Za darmo nic nie dostaniesz.',
    choices: [
      { label: 'Oddaj krew (−7 HP, ulepsz kartę)', pick: 'up', fn: (done, inst) => {
        loseHpSafe(7);
        if (!inst) return done('Nie masz już czego ulepszać. Syrena śmieje się i znika.');
        inst.up = true; done('Karta lśni zimnym światłem.');
      } },
      { label: 'Zatkaj uszy i odejdź', fn: done => done('Pieśń cichnie za twoimi plecami.') }
    ]
  },
  {
    icon: '📦', title: 'Zardzewiała skrzynia',
    text: 'Skrzynia jest zamknięta na zardzewiały zamek. Może być pusta, a może pułapka.',
    choices: [
      { label: 'Otwórz (50%: relikt, 50%: −12 HP)', fn: done => {
        if (rand() < 0.5) {
          const r = randomRelic();
          if (r) { gainRelic(r); return done(`W środku leży ${RELICS[r].icon} ${RELICS[r].name}.`); }
          G.gold += 60; return done('W środku jest tylko 60 złota.');
        }
        loseHpSafe(12); done('Pułapka! Zardzewiałe ostrze rani ci ramię.');
      } },
      { label: 'Zostaw skrzynię', fn: done => done('Nie ryzykujesz.') }
    ]
  },
  {
    icon: '🕯️', title: 'Stara latarnia',
    text: 'Na półpiętrze pali się knot. Możesz odpocząć przy jego świetle albo przetopić coś ze swojej talii.',
    choices: [
      { label: 'Odpocznij (lecz 15 HP)', fn: done => { heal(15); done('Światło koi rany.'); } },
      { label: 'Pozbądź się karty (usuń kartę z talii)', pick: 'rm', fn: (done, inst) => {
        if (!inst) return done('Masz zbyt małą talię.');
        G.deck.splice(G.deck.indexOf(inst), 1); done('Karta znika w płomieniu.');
      } }
    ]
  },

  /* ---- wydarzenia z listy użytkownika ---- */
  {
    icon: '🌊', title: 'Ołtarz przypływu',
    text: 'W niszy na klatce schodowej stoi misa z kamienia, po brzegi wypełniona czarną, morską wodą.',
    choices: [
      { label: 'Zanurz dłonie (−6 HP, zyskaj losowy relikt)', fn: done => { loseHpSafe(6); done(`Woda pali zimnem. W misie leży: ${relicOrGold()}.`); } },
      { label: 'Wlej do misy 50 złota (−50 złota, zyskaj +6 maks. HP)', can: needGold(50), fn: done => { G.gold -= 50; gainMax(6); done('Woda cofa się, a ty czujesz się mocniejszy.'); } },
      { label: 'Odejdź', fn: done => done('Zostawiasz misę w spokoju.') }
    ]
  },
  {
    icon: '⛓️', title: 'Szkielet w klatce',
    text: 'Pod sufitem kołysze się żelazna klatka ze szczątkami dawnego strażnika. W jego dłoni tkwi zwój.',
    choices: [
      { label: 'Wyważ zamek (50%: ulepsz losową kartę, 50%: −10 HP)', fn: done => {
        if (rand() < 0.5) {
          const c = upgradeRandom();
          return done(c ? `Zwój ulepsza kartę: ${CARDS[c.id].name}.` : 'Zwój jest pusty, a ty nie masz już czego ulepszać.');
        }
        loseHpSafe(10); done('Zamek puszcza z hukiem, a klatka spada ci na plecy.');
      } },
      { label: 'Przeszukaj kieszenie (+35 złota)', fn: done => { G.gold += 35; done('Szkielet nie protestuje. Znajdujesz kilka monet.'); } },
      { label: 'Zostaw go w spokoju', fn: done => done('Klatka skrzypi za twoimi plecami.') }
    ]
  },
  {
    icon: '📯', title: 'Szept z rury głosowej',
    text: 'Z mosiężnej tuby dobiega czyjś głos z wyższych pięter. Brzmi znajomo, jakby był twój własny.',
    choices: [
      { label: 'Odpowiedz do tuby (usuń kartę z talii, −4 HP)', pick: 'rm', fn: (done, inst) => { loseHpSafe(4); removeCard(inst); done('Głos prosi o jedną rzecz. Oddajesz ją, a głos cichnie.'); } },
      { label: 'Zatkaj tubę (zyskaj 10 pancerza w następnej walce / lecz 8 HP)', fn: done => { G.nextBlock += 10; heal(8); done('Cisza koi. Czujesz się lepiej i jesteś gotów na cios.'); } },
      { label: 'Ignoruj głos', fn: done => done('Głos woła jeszcze długo.') }
    ]
  },
  {
    icon: '🧂', title: 'Kapliczka morskiej soli',
    text: 'Ściany korytarza pokrywa gruba skorupa białych kryształów, które cicho trzaskają pod palcami.',
    choices: [
      { label: 'Zeskrob kryształy (zyskaj losową miksturę)', fn: done => done(`Zeskrobujesz: ${potionText(randomPotion())}.`) },
      { label: 'Liźnij sól (lecz 12 HP, −25 złota)', can: needGold(25), fn: done => { G.gold -= 25; heal(12); done('Sól piecze, ale rany się zamykają. Kapliczka zabiera opłatę.'); } },
      { label: 'Idź dalej', fn: done => done('Kryształy trzaskają ci w uszach.') }
    ]
  },
  {
    icon: '🔧', title: 'Porzucony warsztat',
    text: 'Na stole leżą pęknięte soczewki, lutownica i notatki poprzedniego mechanika latarni.',
    choices: [
      { label: 'Napraw mechanizm (ulepsz wybraną kartę, −45 złota)', pick: 'up', can: needGold(45), fn: (done, inst) => { G.gold -= 45; inst.up = true; done(`Karta ${CARDS[inst.id].name} jest teraz lepsza, a część zapasów poszła na naprawę.`); } },
      { label: 'Zabierz części (+55 złota)', fn: done => { G.gold += 55; done('Sprzedasz je przy pierwszej okazji.'); } },
      { label: 'Nie ruszaj narzędzi', fn: done => done('Notatki mechanika zostają na stole.') }
    ]
  },
  {
    icon: '🦀', title: 'Krab w hełmie',
    text: 'Ogromny krab zagradza przejście. Na pancerzu nosi mosiężny hełm nurka wypchany błyskotkami.',
    choices: [
      { label: 'Rzuć mu coś do jedzenia (−5 HP, zyskaj losową kartę rzadką)', fn: done => { loseHpSafe(5); const id = addCard('rare'); done(`Krab chwyta przynętę i szczypce przy okazji. W hełmie znajdujesz kartę: ${CARDS[id].name}.`); } },
      { label: 'Przemknij bokiem (50%: +40 złota, 50%: −8 HP)', fn: done => {
        if (rand() < 0.5) { G.gold += 40; return done('Udaje ci się wyciągnąć błyskotki spod hełmu.'); }
        loseHpSafe(8); done('Krab zauważa cię w ostatniej chwili.');
      } },
      { label: 'Wycofaj się', fn: done => done('Krab wraca do swoich błyskotek.') }
    ]
  },
  {
    icon: '🧊', title: 'Zamarznięta sala',
    text: 'W jednym z pomieszczeń panuje nienaturalny mróz. Na środku stoi bryła lodu z czymś w środku.',
    choices: [
      { label: 'Rozbij lód (−9 HP, zyskaj losowy relikt)', fn: done => { loseHpSafe(9); done(`Lód pęka, kalecząc ci dłonie. W środku leży: ${relicOrGold()}.`); } },
      { label: 'Ogrzej dłonie przy lampie (lecz 10 HP)', fn: done => { heal(10); done('Ciepło lampy przywraca ci siły.'); } },
      { label: 'Omiń salę', fn: done => done('Mróz szczypie cię w plecy.') }
    ]
  },
  {
    icon: '📖', title: 'Dziennik pokładowy',
    text: 'Na pulpicie leży przemoczona księga z wpisami o Sercu Głębiny i słabościach potworów.',
    choices: [
      { label: 'Przeczytaj uważnie (−5 HP, zyskaj +5 maks. HP)', fn: done => { loseHpSafe(5); gainMax(5); done('Wpisy bolą, ale uczą hartu ducha.'); } },
      { label: 'Wyrwij strony z mapą (+45 złota)', fn: done => { G.gold += 45; done('Kupiec da za nie niezłą cenę.'); } },
      { label: 'Zamknij księgę', fn: done => done('Księga zostaje na pulpicie.') }
    ]
  },
  {
    icon: '🎭', title: 'Handlarz cieni',
    text: 'Z mroku wyłania się zakapturzona postać z workiem pełnym dziwnych przedmiotów.',
    choices: [
      { label: 'Wymień relikt na 120 złota (trać losowy relikt, +120 złota)', can: () => G.relics.length > 0, fn: done => { const r = loseRandomRelic(); G.gold += 120; done(`Handlarz zabiera: ${RELICS[r].icon} ${RELICS[r].name}. Dostajesz 120 złota.`); } },
      { label: 'Kup tajemniczą fiolkę (−35 złota, losowa mikstura)', can: needGold(35), fn: done => { G.gold -= 35; done(`W fiolce jest: ${potionText(randomPotion())}.`); } },
      { label: 'Odmów handlu', fn: done => done('Postać rozpływa się w mroku.') }
    ]
  },
  {
    icon: '💎', title: 'Pęknięta soczewka',
    text: 'Ogromne szkło z głównego reflektora leży rozbite na posadzce. W odłamkach odbija się dziwne światło.',
    choices: [
      { label: 'Wpatruj się w odłamki (ulepsz wybraną kartę, trać 1 losową miksturę)', pick: 'up', fn: (done, inst) => {
        inst.up = true;
        const p = loseRandomPotion();
        done(`Karta ${CARDS[inst.id].name} jest teraz lepsza.${p ? ` Światło wypala miksturę: ${POTIONS[p].name}.` : ''}`);
      } },
      { label: 'Zbierz srebrne oprawki (+50 złota)', fn: done => { G.gold += 50; done('Srebro brzęczy w twojej sakiewce.'); } },
      { label: 'Omiń szkło', fn: done => done('Odłamki skrzypią pod butami.') }
    ]
  },
  {
    icon: '🐚', title: 'Śpiewająca muszla',
    text: 'Na parapecie leży gigantyczna muszla. Wydobywa się z niej hipnotyzująca melodia głębin.',
    choices: [
      { label: 'Posłuchaj do końca (usuń wybraną kartę, −6 HP)', pick: 'rm', fn: (done, inst) => { loseHpSafe(6); removeCard(inst); done('Melodia kończy się, a razem z nią znika jedno wspomnienie.'); } },
      { label: 'Rozbij muszlę (50%: +70 złota, 50%: −10 HP)', fn: done => {
        if (rand() < 0.5) { G.gold += 70; return done('W środku tkwi perła wartości 70 złota.'); }
        loseHpSafe(10); done('Muszla pęka, a odłamki tną cię po twarzy.');
      } },
      { label: 'Zostaw ją', fn: done => done('Melodia cichnie za tobą.') }
    ]
  },
  {
    icon: '🍲', title: 'Kocioł z wrzątkiem',
    text: 'W dawnej kuchni bulgocze żeliwny kocioł. Ktoś niedawno dorzucił do paleniska.',
    choices: [
      { label: 'Wypij wywar (lecz 20 HP, −40 złota)', can: needGold(40), fn: done => { G.gold -= 40; heal(20); done('Wywar jest gorzki i drogi, ale stawia na nogi.'); } },
      { label: 'Wylej zawartość (zyskaj losową miksturę)', fn: done => done(`Na dnie kotła znajdujesz: ${potionText(randomPotion())}.`) },
      { label: 'Wyjdź z kuchni', fn: done => done('Kocioł bulgocze dalej.') }
    ]
  },
  {
    icon: '🐦', title: 'Uwięziona mewa',
    text: 'Ptak zaplątał się w stare sieci rybackie na balkonie latarni i rozpaczliwie trzepocze skrzydłami.',
    choices: [
      { label: 'Uwolnij ptaka (−3 HP, zyskaj losową kartę niepospolitą)', fn: done => { loseHpSafe(3); const id = addCard('uncommon'); done(`Mewa dziobie cię na pożegnanie, ale zostawia ci dar: ${CARDS[id].name}.`); } },
      { label: 'Zabierz liny i haczyki (+30 złota)', fn: done => { G.gold += 30; done('Ptak miota się dalej, ale sprzęt jest twój.'); } },
      { label: 'Zostaw ptaka', fn: done => done('Trzepot cichnie za zakrętem.') }
    ]
  },
  {
    icon: '🪞', title: 'Odbicie w lustrze',
    text: 'W zalanym korytarzu wisi nienaruszone lustro. Twoje odbicie porusza się o ułamek sekundy za późno.',
    choices: [
      { label: 'Dotknij tafli (duplikuj wybraną kartę w talii, −10 HP)', pick: 'dup', fn: (done, inst) => { loseHpSafe(10); G.deck.push({ ...inst }); done(`Odbicie oddaje ci kopię: ${CARDS[inst.id].name}.`); } },
      { label: 'Rozbij lustro (usuń wybraną kartę, −5 HP)', pick: 'rm', fn: (done, inst) => { loseHpSafe(5); removeCard(inst); done('Lustro pęka, a odbicie zabiera jedną kartę ze sobą.'); } },
      { label: 'Odwróć wzrok', fn: done => done('Odbicie jeszcze długo patrzy za tobą.') }
    ]
  },
  {
    icon: '⚓', title: 'Krwawa kotwica',
    text: 'W ścianę wbita jest wielka kotwica opleciona czerwonymi wodorostami, które pulsują jak żyły.',
    choices: [
      { label: 'Wyrwij kotwicę (−11 HP, zyskaj losowy relikt)', fn: done => { loseHpSafe(11); done(`Wodorosty puszczają krew, a pod kotwicą leży: ${relicOrGold()}.`); } },
      { label: 'Zetnij wodorosty (lecz 14 HP)', fn: done => { heal(14); done('Z pociętych wodorostów sączy się ciepły sok, który zasklepia rany.'); } },
      { label: 'Nie zbliżaj się', fn: done => done('Wodorosty pulsują w tle.') }
    ]
  },
  {
    icon: '🫙', title: 'Zatopiona spiżarnia',
    text: 'Woda sięga tu do kolan, ale na wyższych półkach wciąż stoją zapieczętowane beczki i słoje.',
    choices: [
      { label: 'Otwórz beczkę z grogiem (lecz 18 HP, −30 złota)', can: needGold(30), fn: done => { G.gold -= 30; heal(18); done('Grog pali gardło i rozgrzewa wnętrzności.'); } },
      { label: 'Otwórz skrzynkę z narzędziami (ulepsz losową kartę)', fn: done => { const c = upgradeRandom(); done(c ? `Narzędzia ulepszają kartę: ${CARDS[c.id].name}.` : 'Narzędzia są dobre, ale nie masz czego ulepszać.'); } },
      { label: 'Wróć na schody', fn: done => done('Woda chlupie ci w butach.') }
    ]
  },
  {
    icon: '🃏', title: 'Szuler z głębin',
    text: 'Przy beczce siedzi utopiec i tasuje mokre karty. Wskazuje na ciebie pustym oczodołem.',
    choices: [
      { label: 'Zagraj o stawkę (−40 złota: 50% na losowy relikt, 50% na nic)', can: needGold(40), fn: done => {
        G.gold -= 40;
        if (rand() < 0.5) return done(`Wygrywasz: ${relicOrGold()}.`);
        done('Utopiec zgarnia stawkę i śmieje się bezgłośnie.');
      } },
      { label: 'Oszukaj go (50%: +80 złota, 50%: −14 HP)', fn: done => {
        if (rand() < 0.5) { G.gold += 80; return done('Utopiec nie zauważa podmienionej karty. Zgarniasz 80 złota.'); }
        loseHpSafe(14); done('Utopiec łapie cię za rękę i łamie ci palce.');
      } },
      { label: 'Odejdź od stołu', fn: done => done('Mokre karty szeleszczą za tobą.') }
    ]
  },
  {
    icon: '🔔', title: 'Dzwon ostrzegawczy',
    text: 'Na podeście wisi pęknięty dzwon okrętowy. Na jego sercu wyryto ostrzeżenie przed ciszą.',
    choices: [
      { label: 'Uderz w dzwon (zyskaj +4 maks. HP, −4 HP)', fn: done => { gainMax(4); loseHpSafe(4); done('Dźwięk wstrząsa kośćmi, ale zostawia w tobie siłę.'); } },
      { label: 'Odetnij mosiężne serce (+45 złota)', fn: done => { G.gold += 45; done('Dzwon milknie na zawsze, a mosiądz zostaje u ciebie.'); } },
      { label: 'Przejdź cicho', fn: done => done('Dzwon kołysze się bezgłośnie.') }
    ]
  },
  {
    icon: '🩸', title: 'Gniazdo pijawek',
    text: 'Z sufitu zwisają grona czarnych pijawek morskich. Pod nimi leży porzucony plecak.',
    choices: [
      { label: 'Przebiegnij po plecak (−7 HP, +65 złota i losowa mikstura)', fn: done => { loseHpSafe(7); G.gold += 65; done(`Pijawki ssą, ale plecak jest twój: 65 złota i ${potionText(randomPotion())}.`); } },
      { label: 'Wypal gniazdo lampą (usuń wybraną kartę z talii)', pick: 'rm', fn: (done, inst) => { removeCard(inst); done('Płomień trawi gniazdo, a przy okazji jedną z twoich kart.'); } },
      { label: 'Wycofaj się', fn: done => done('Pijawki kapią za tobą.') }
    ]
  },
  {
    icon: '🕯️', title: 'Ostatni strażnik',
    text: 'Na krześle siedzi skamieniały latarnik, wciąż ściskający w dłoniach zapasowy knot.',
    choices: [
      { label: 'Zabierz knot (ulepsz wybraną kartę)', pick: 'up', fn: (done, inst) => { inst.up = true; done(`Knot płonie jasno. Karta ${CARDS[inst.id].name} jest teraz lepsza.`); } },
      { label: 'Złóż mu hołd (lecz 12 HP)', fn: done => { heal(12); done('Czujesz, jak spokój strażnika przechodzi na ciebie.'); } },
      { label: 'Idź na górę', fn: done => done('Latarnik siedzi dalej, wiecznie czujny.') }
    ]
  }
];
