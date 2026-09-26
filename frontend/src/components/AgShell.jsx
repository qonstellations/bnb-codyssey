import { useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import ParticleField from "./ParticleField.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import "../landing.css";

gsap.registerPlugin(ScrollTrigger, SplitText);

// Shared frame for landing + auth: particle field, nav, smooth scroll, and
// entrance motion. `.ag-split` headlines rise word by word, `.ag-reveal`
// elements fade up in order, `.ag-scroll` elements reveal on scroll.
export default function AgShell({ children, navRight }) {
  const root = useRef(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const lenis = new Lenis();
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      const splits = gsap.utils.toArray(".ag-split").map((el) =>
        SplitText.create(el, { type: "words", mask: "words" })
      );
      splits.forEach((split) => {
        tl.from(split.words, { yPercent: 110, duration: 1.2, stagger: 0.06 }, 0.1);
      });
      tl.from(".ag-reveal", { y: 24, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.45);

      const scrollTriggers = gsap.utils.toArray(".ag-scroll").map((el) =>
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          animation: gsap.from(el, {
            y: 48,
            autoAlpha: 0,
            duration: 1.1,
            ease: "expo.out",
            paused: true,
          }),
        })
      );

      return () => {
        scrollTriggers.forEach((st) => st.kill());
        splits.forEach((split) => split.revert());
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
      };
    },
    { scope: root }
  );

  return (
    <div className="ag" ref={root}>
      <ParticleField />
      <div className="ag-content">
        <nav className="ag-nav">
          <Link to="/" className="ag-brand">
            Codyssey
          </Link>
          <div className="ag-nav-right">
            <ThemeToggle />
            {navRight}
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}
