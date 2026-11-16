/* Konfiguracja Firebase dla gry online.
   Firebase Console → Ustawienia projektu → Twoje aplikacje → aplikacja Web → "Konfiguracja SDK".
   Te dane NIE są tajne (każda strona używająca Firebase je ujawnia), bezpieczeństwo zapewniają
   reguły bazy z pliku database.rules.json. */
window.FIREBASE_CONFIG = {
  apiKey: 'WKLEJ_API_KEY',
  authDomain: 'WKLEJ_PROJECT_ID.firebaseapp.com',
  databaseURL: 'https://WKLEJ_PROJECT_ID-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'WKLEJ_PROJECT_ID',
  appId: 'WKLEJ_APP_ID'
};
