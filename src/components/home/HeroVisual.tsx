import fs from "node:fs";
import path from "node:path";

const VIDEO_PUBLIC_PATH = "/videos/hero-tech.mp4";

/**
 * Visuel animé du hero — l'orbe de lumière Mwinda.
 *
 * Deux modes, résolus au build (composant serveur, page SSG) :
 * 1. Si `public/videos/hero-tech.mp4` existe (vidéo générée via Higgsfield),
 *    elle est lue en boucle, muette, responsive.
 * 2. Sinon, fallback : scène 3D CSS — orbe pulsant + deux anneaux orbitaux
 *    (ambre et cyan) en rotation dans l'espace, particules flottantes.
 */
export default function HeroVisual() {
  const hasVideo = fs.existsSync(
    path.join(process.cwd(), "public", VIDEO_PUBLIC_PATH),
  );

  if (hasVideo) {
    return (
      <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-night-border shadow-[0_0_60px_rgba(245,166,35,0.15)]">
        <video
          src={VIDEO_PUBLIC_PATH}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          className="h-auto w-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/40 to-transparent" />
      </div>
    );
  }

  return (
    <div aria-hidden className="orb-scene mx-auto">
      {/* Halo ambiant */}
      <div className="orb-halo" />
      {/* Cœur lumineux */}
      <div className="orb-core" />
      {/* Anneaux orbitaux 3D */}
      <div className="orb-ring orb-ring-amber">
        <span className="orb-satellite orb-satellite-amber" />
      </div>
      <div className="orb-ring orb-ring-cyan">
        <span className="orb-satellite orb-satellite-cyan" />
      </div>
      <div className="orb-ring orb-ring-faint" />
      {/* Particules flottantes */}
      <span className="orb-particle orb-particle-1" />
      <span className="orb-particle orb-particle-2" />
      <span className="orb-particle orb-particle-3" />
      <span className="orb-particle orb-particle-4" />
    </div>
  );
}
