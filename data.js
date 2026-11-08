'use strict';

const TYPE_PL = { attack: 'Atak', skill: 'Umiejętność', power: 'Moc' };
const ROWS = 15;

/* ---------- Karty ----------
   Pola: cost, type, rarity, icon, dmg, hits, aoe, block, vuln, weak, str, draw,
   energy, selfdmg, ritual, plating, thorns, exhaust. `up` nadpisuje pola po ulepszeniu. */
const CARDS = {
  cios:       { name: 'Cios',               type: 'attack', cost: 1, rarity: 'start',    icon: '🗡️', dmg: 6,  up: { dmg: 9 } },
  gard:       { name: 'Gard',               type: 'skill',  cost: 1, rarity: 'start',    icon: '🛡️', block: 5, up: { block: 8 } },
  uderzenie:  { name: 'Uderzenie latarnią', type: 'attack', cost: 2, rarity: 'start',    icon: '🔨', dmg: 8, vuln: 2, up: { dmg: 10, vuln: 3 } },

  podwojne:   { name: 'Podwójne cięcie',    type: 'attack', cost: 1, rarity: 'common',   icon: '⚔️', dmg: 5, hits: 2, up: { dmg: 7 } },
  wichura:    { name: 'Wichura',            type: 'attack', cost: 1, rarity: 'common',   icon: '🌪️', dmg: 8, aoe: true, up: { dmg: 11 } },
  harpun:     { name: 'Rzut harpunem',      type: 'attack', cost: 1, rarity: 'common',   icon: '🔱', dmg: 7, draw: 1, up: { dmg: 10 } },
  mgla:       { name: 'Mgła',               type: 'attack', cost: 2, rarity: 'common',   icon: '🌫️', dmg: 6, aoe: true, weak: 1, up: { dmg: 9, weak: 2 } },
  zwinnosc:   { name: 'Zwinność',           type: 'skill',  cost: 1, rarity: 'common',   icon: '🤸', block: 5, draw: 1, up: { block: 8 } },
  oddech:     { name: 'Głęboki oddech',     type: 'skill',  cost: 0, rarity: 'common',   icon: '🫁', draw: 2, up: { draw: 3 } },
  sygnal:     { name: 'Sygnał świetlny',    type: 'skill',  cost: 1, rarity: 'common',   icon: '🔦', vuln: 2, weak: 2, up: { vuln: 3, weak: 3 } },

  bastion:    { name: 'Bastion',            type: 'skill',  cost: 2, rarity: 'uncommon', icon: '🏰', block: 14, up: { block: 19 } },
  zelazna:    { name: 'Żelazna pięść',      type: 'attack', cost: 2, rarity: 'uncommon', icon: '👊', dmg: 14, up: { dmg: 19 } },
  seria:      { name: 'Seria',              type: 'attack', cost: 1, rarity: 'uncommon', icon: '💥', dmg: 3, hits: 4, up: { dmg: 4 } },
  przyplyw:   { name: 'Przypływ',           type: 'skill',  cost: 0, rarity: 'uncommon', icon: '🌊', energy: 2, exhaust: true, up: { energy: 3 } },
  ofiara:     { name: 'Ofiara',             type: 'skill',  cost: 0, rarity: 'uncommon', icon: '🩸', selfdmg: 3, energy: 2, up: { selfdmg: 2 } },
  wzmocnienie:{ name: 'Wzmocnienie',        type: 'skill',  cost: 1, rarity: 'uncommon', icon: '💪', str: 2, exhaust: true, up: { str: 3 } },

  rytual:     { name: 'Rytuał',             type: 'power',  cost: 1, rarity: 'rare',     icon: '🕯️', ritual: 1, up: { cost: 0 } },
  sol:        { name: 'Zbroja z soli',      type: 'power',  cost: 1, rarity: 'rare',     icon: '🧂', plating: 3, up: { plating: 5 } },
  ciernie:    { name: 'Rafa kolców',        type: 'power',  cost: 1, rarity: 'rare',     icon: '🪸', thorns: 3, up: { thorns: 5 } },
  fala:       { name: 'Fala przypływu',     type: 'attack', cost: 2, rarity: 'rare',     icon: '🌊', dmg: 18, aoe: true, exhaust: true, up: { dmg: 24 } }
};

/* ---------- Postacie ----------
   Nową postać dodasz, dopisując wpis poniżej. Pola:
   name, icon (emoji używane, gdy nie ma sprite'a), hp, gold, desc,
   relics (id z RELICS), deck (id kart z CARDS, mogą się powtarzać).
   Sprite postaci ustawiasz w sprites.js pod tym samym kluczem. */
const CHARACTERS = {
  latarnik: {
    name: 'Latarnik', icon: '🧑‍✈️', hp: 70, gold: 99, relics: ['pierscien'],
    desc: 'Zrównoważony. Po każdej walce leczy 6 HP.',
    deck: ['cios', 'cios', 'cios', 'cios', 'cios', 'gard', 'gard', 'gard', 'gard', 'uderzenie']
  },
  harpunniczka: {
    name: 'Harpunniczka', icon: '🤺', hp: 62, gold: 99, relics: ['zab'],
    desc: 'Szybkie ataki. Zaczyna każdą walkę z 1 Siły.',
    deck: ['cios', 'cios', 'cios', 'gard', 'gard', 'gard', 'gard', 'harpun', 'podwojne', 'seria']
  },
  kotwiczny: {
    name: 'Kotwiczny', icon: '🧔', hp: 82, gold: 99, relics: ['kotwica'],
    desc: 'Wytrzymały. Zaczyna każdą walkę z 10 pancerza.',
    deck: ['cios', 'cios', 'cios', 'gard', 'gard', 'gard', 'gard', 'gard', 'uderzenie', 'bastion']
  },
  szeptaczka: {
    name: 'Szeptaczka', icon: '🧙‍♀️', hp: 58, gold: 99, relics: ['muszla'],
    desc: 'Krucha, ale dobiera o 1 kartę więcej i osłabia wrogów.',
    deck: ['cios', 'cios', 'cios', 'cios', 'gard', 'gard', 'gard', 'sygnal', 'oddech', 'rytual']
  }
};
const CARD_PRICE = { common: 50, uncommon: 75, rare: 150 };

/* ---------- Wrogowie ---------- */
const ENEMIES = {
  krab:      { name: 'Krab pustelnik',    icon: '🦀', hp: [20, 24], moves: [{ dmg: 7 }, { block: 8 }, { dmg: 9 }] },
  meduza:    { name: 'Meduza',            icon: '🪼', hp: [12, 16], moves: [{ dmg: 4, weak: 1 }, { dmg: 6 }] },
  mewa:      { name: 'Mewa',              icon: '🐦', hp: [9, 12],  moves: [{ dmg: 5 }, { dmg: 3, hits: 2 }] },
  syrena:    { name: 'Syrena',            icon: '🧜', hp: [26, 30], moves: [{ vuln: 2, weak: 1 }, { dmg: 8 }, { dmg: 11 }] },
  szkielet:  { name: 'Marynarz widmo',    icon: '💀', hp: [38, 44], moves: [{ dmg: 10 }, { block: 9 }, { dmg: 5, hits: 2 }] },
  osmiornica:{ name: 'Ośmiornica',        icon: '🐙', hp: [32, 36], moves: [{ dmg: 4, hits: 3 }, { weak: 2, vuln: 1 }, { dmg: 12 }] },
  rekin:     { name: 'Rekin',             icon: '🦈', hp: [28, 32], moves: [{ str: 2 }, { dmg: 9 }, { dmg: 9 }] },
  topielec:  { name: 'Kapitan Topielec',  icon: '☠️', hp: [68, 74], fixed: true, moves: [{ str: 3, block: 8 }, { dmg: 14 }, { dmg: 7, hits: 2 }, { dmg: 14 }] },
  straznik:  { name: 'Kamienny Strażnik', icon: '🗿', hp: [78, 84], fixed: true, moves: [{ block: 14 }, { dmg: 18 }, { dmg: 6, weak: 2, vuln: 2 }] },
  krewetka:  { name: 'Krewetka bojowa',   icon: '🦐', hp: [9, 12],  moves: [{ dmg: 3 }, { str: 1 }, { dmg: 5 }] },
  rozgwiazda:{ name: 'Rozgwiazda',        icon: '⭐', hp: [16, 20], moves: [{ dmg: 5 }, { heal: 4 }, { dmg: 7 }] },
  pirania:   { name: 'Pirania',           icon: '🐟', hp: [10, 13], moves: [{ dmg: 2, hits: 3 }, { dmg: 5 }] },
  waz:       { name: 'Wąż morski',        icon: '🐍', hp: [18, 22], moves: [{ dmg: 4, weak: 1 }, { dmg: 7 }] },
  homar:     { name: 'Homar',             icon: '🦞', hp: [30, 35], moves: [{ dmg: 8, vuln: 1 }, { block: 8 }, { dmg: 13 }] },
  zolw:      { name: 'Żółw pancerny',     icon: '🐢', hp: [34, 38], moves: [{ block: 12 }, { dmg: 8 }, { block: 6, dmg: 6 }, { dmg: 11 }] },
  utopiec:   { name: 'Utopiec',           icon: '🧟', hp: [40, 46], moves: [{ dmg: 9 }, { dmg: 5, weak: 1 }, { heal: 6 }, { dmg: 12 }] },
  wegorz:    { name: 'Węgorz elektryczny',icon: '⚡', hp: [26, 30], moves: [{ dmg: 5, weak: 1 }, { dmg: 11 }, { str: 1 }] },
  kraken:    { name: 'Kraken',            icon: '🦑', hp: [84, 90], fixed: true, moves: [{ dmg: 5, hits: 3 }, { weak: 2, vuln: 2, block: 8 }, { dmg: 16 }] },
  wieloryb:  { name: 'Biały Wieloryb',    icon: '🐋', hp: [92, 100], fixed: true, moves: [{ block: 12 }, { dmg: 16 }, { dmg: 8, vuln: 1 }, { str: 2, heal: 6 }, { dmg: 20 }] },
  serce:     { name: 'Serce Głębiny',     icon: '🫀', hp: [150, 150], fixed: true, moves: [{ dmg: 12 }, { str: 3, block: 12 }, { dmg: 5, hits: 4 }, { dmg: 8, weak: 2, vuln: 2 }] }
};

const ENC_EASY = [['krab'], ['meduza', 'meduza'], ['mewa', 'mewa', 'mewa'], ['meduza', 'krab'],
  ['krewetka', 'krewetka'], ['rozgwiazda'], ['pirania', 'pirania'], ['waz', 'mewa'], ['krewetka', 'rozgwiazda']];
const ENC_HARD = [['syrena'], ['szkielet'], ['osmiornica'], ['rekin', 'meduza'], ['syrena', 'mewa'], ['krab', 'krab', 'mewa'], ['szkielet', 'meduza'],
  ['homar'], ['zolw'], ['utopiec'], ['wegorz', 'krewetka'], ['homar', 'pirania'], ['zolw', 'mewa'], ['waz', 'wegorz'], ['utopiec', 'meduza']];
const ELITES = ['topielec', 'straznik', 'kraken', 'wieloryb'];

/* ---------- Relikty ---------- */
const RELICS = {
  pierscien: { name: 'Pierścień latarnika', icon: '💍', desc: 'Po każdej walce lecz 6 HP.', rarity: 'start' },
  kotwica:   { name: 'Kotwica',             icon: '⚓', desc: 'Zaczynasz każdą walkę z 10 pancerza.' },
  zab:       { name: 'Ząb rekina',          icon: '🦷', desc: 'Zaczynasz każdą walkę z 1 Siły.' },
  muszla:    { name: 'Muszla',              icon: '🐚', desc: 'Dobierasz o 1 kartę więcej na turę.' },
  sakiewka:  { name: 'Sakiewka',            icon: '👛', desc: 'Dostajesz o 10 złota więcej za każdą walkę.' },
  perla:     { name: 'Czarna perła',        icon: '⚫', desc: 'Zyskujesz 10 maks. HP.' },
  lampa:     { name: 'Lampa sztormowa',     icon: '🏮', desc: 'Zyskujesz 1 energii na turę.' },
  kompas:    { name: 'Kompas okrętowy',     icon: '🧭', desc: 'W pierwszej turze każdej walki dobierasz o 2 karty więcej.' },
  siec:      { name: 'Sieć rybacka',        icon: '🕸️', desc: 'Na koniec tury zyskujesz 1 pancerza za każdą kartę w ręce.' },
  rum:       { name: 'Butelka rumu',        icon: '🍾', desc: 'Zaczynasz każdą walkę z 2 Siły, ale tracisz 3 HP.' },
  zegar:     { name: 'Zegar okrętowy',      icon: '🕰️', desc: 'W każdej 3. turze walki zyskujesz 1 energii więcej.' },
  beczka:    { name: 'Beczka soli',         icon: '🛢️', desc: 'Zaczynasz każdą walkę z 2 Kolców.' },
  lancuch:   { name: 'Łańcuch kotwiczny',   icon: '🔗', desc: 'Za każdy zagrany Atak zyskujesz 1 pancerza.' },
  soczewka:  { name: 'Soczewka Fresnela',   icon: '🔍', desc: 'Karty nakładające Podatność nakładają o 1 więcej.' },
  zagiel:    { name: 'Żagiel',              icon: '⛵', desc: 'Jeśli kończysz turę z co najmniej 2 energii, zyskujesz 8 pancerza.' },
  kufer:     { name: 'Kufer skarbów',       icon: '💰', desc: 'Natychmiast zyskujesz 60 złota.' },
  dzwon:     { name: 'Dzwon alarmowy',      icon: '🔔', desc: 'Na początku walki nakładasz 1 Osłabienia i 1 Podatności na wszystkich wrogów.' },
  lza:       { name: 'Łza syreny',          icon: '💎', desc: 'Po każdej walce zyskujesz 2 maks. HP.' },
  mapa:      { name: 'Pognieciona mapa',    icon: '🗺️', desc: 'Po walce masz o 25% większą szansę na miksturę.' },
  pas:       { name: 'Pas ratunkowy',       icon: '🆘', desc: 'Raz na przebieg: gdy twoje HP spadnie do 0, wstajesz z 15 HP.' }
};

/* ---------- Mikstury ---------- */
const POTIONS = {
  zdrowie: { name: 'Eliksir zdrowia',   icon: '🧪', desc: 'Lecz 15 HP.' },
  sila:    { name: 'Fiolka siły',       icon: '💪', desc: 'Zyskaj 2 Siły do końca walki.' },
  tarcza:  { name: 'Mikstura tarczy',   icon: '🛡️', desc: 'Zyskaj 12 pancerza.' },
  energia: { name: 'Tonik energii',     icon: '⚡', desc: 'Zyskaj 2 energii.' },
  ogien:   { name: 'Butelka ognia',     icon: '🔥', desc: 'Zadaj 12 obrażeń wszystkim wrogom.' }
};
