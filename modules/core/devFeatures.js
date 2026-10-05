// Fonctionnalités réservées au développement et aux previews QA.
//
// Certains visuels sont des essais (par exemple la vue V2 de la base) : ils doivent rester
// disponibles pour être testés, mais jamais dans la version publiée. La publication est
// pokegang.sterenna.fr et le build itch.io ; les previews QA sont sur lab.sterenna.fr
// (voir docs/preview-testing.md).
//
// On liste les hôtes de DÉVELOPPEMENT plutôt que ceux de production : un hôte inconnu
// (nouveau domaine, miroir, iframe itch…) retombe sur le comportement publié, ce qui est le
// côté sûr si un jour l'hébergement change.

const DEV_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost|lab\.sterenna\.fr)$/i;

/** Vrai pour un hôte de développement ou de preview QA. Fonction pure, testable. */
export function isDevHost(hostname) {
  return DEV_HOST_RE.test(String(hostname ?? '').trim());
}

/** Les fonctionnalités de développement sont-elles actives sur la page courante ? */
export function devFeaturesEnabled() {
  return isDevHost(globalThis.location?.hostname);
}
