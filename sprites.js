'use strict';

/* =====================================================================
   SPRITE'Y
   ---------------------------------------------------------------------
   Tu przypisujesz własne obrazki. Wystarczy wpisać ścieżkę do pliku.
   Czego nie wpiszesz (albo co się nie wczyta), gra pokazuje jako emoji.

   1. Wrzuć pliki do folderu `assets/` (PNG, WebP, GIF lub SVG).
      Najlepiej z przezroczystym tłem.
   2. Dopisz je poniżej: klucz to id z pliku data.js, wartość to ścieżka.

   Przykład:
     characters: { latarnik: 'assets/latarnik.png' },
     enemies:    { krab: 'assets/krab.png', serce: 'assets/serce.png' },
     cards:      { cios: 'assets/karta-cios.png' },

   Rozmiary (orientacyjnie, gra skaluje obrazek do pola):
     characters, enemies  postać, najlepiej ok. 256×256, pokazywana do ok. 130 px wysokości
     cards                ilustracja karty, ok. 256×256, kwadratowe pole
     relics, potions      ikona, ok. 64×64
     nodes                ikona pola na mapie, ok. 64×64

   Klucze `characters`: latarnik, harpunniczka, kotwiczny, szeptaczka, automat
   Klucze `orbs`:       blysk, szron, mrok, plazma (kule Automatu, ikona ok. 64×64)
   Klucze `enemies`:    krab, meduza, mewa, syrena, szkielet, osmiornica, rekin,
                        topielec, straznik, serce
   Klucze `cards`:      id kart z CARDS w data.js (np. cios, gard, uderzenie, ...)
   Klucze `relics`:     id reliktów z RELICS (np. pierscien, kotwica, ...)
   Klucze `potions`:    id mikstur z POTIONS (np. zdrowie, sila, ...)
   Klucze `nodes`:      fight, elite, rest, shop, event, boss

   pixelArt: true wyłącza wygładzanie, więc pixel art zostaje ostry.
   ===================================================================== */

const SPRITE_OPTIONS = {
  pixelArt: false
};

const SPRITES = {
  characters: {
    // latarnik: 'assets/latarnik.png',
  },
  enemies: {
    // krab: 'assets/krab.png',
  },
  cards: {
    // cios: 'assets/karta-cios.png',
  },
  relics: {
    // pierscien: 'assets/pierscien.png',
  },
  potions: {
    // zdrowie: 'assets/eliksir.png',
  },
  nodes: {
    // fight: 'assets/pole-walka.png',
  },
  orbs: {
    // blysk: 'assets/kula-blysk.png',
  }
};
