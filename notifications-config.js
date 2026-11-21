/*
 * AlJoud notification settings.
 * Cafe coordinates and public Firebase Web configuration.
 * Never place Firebase service-account credentials or private keys here.
 */
window.ALJOUD_CAFE_LOCATION = {
  lat: 14.475609006112014,
  lng: 49.04512577450814
};

window.ALJOUD_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAMdmUshORZe4SO6kXhH2ZPa0bs4_ueXNU",
  authDomain: "aljoud-coffee.firebaseapp.com",
  projectId: "aljoud-coffee",
  storageBucket: "aljoud-coffee.firebasestorage.app",
  messagingSenderId: "501147188970",
  appId: "1:501147188970:web:51712e4471851b8c2da193",
  measurementId: "G-DVT5KK5TFL"
};

window.ALJOUD_VAPID_PUBLIC_KEY = "BNTM9S-vQEjifs7N4c475q0dcg-ZccrvsRSG5sjv_JXJvYvaIpCBpo3Xlwy6Hdk4vZVPCe3PggwCI5SNx_LFBUw";

// Separate VAPID key pair for the Cloudflare Web Push service (not Firebase FCM).
window.ALJOUD_WEB_PUSH_VAPID_PUBLIC_KEY = "BGAwllfek6gAqKlNWXGPZd5l8StuTPQpP6Vf95D1hRRQV9OpbPh6FJOag30qF8VKSU-Ct7yLqE5PFE8tPTvOBeQ";
