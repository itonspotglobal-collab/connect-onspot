import { Link } from "wouter";
import collaborationImage from "@/assets/join-onspot/collaboration.webp";
import challengesImage from "@/assets/join-onspot/business-challenges.webp";
import talentImage from "@/assets/join-onspot/global-talent.webp";
import communityImage from "@/assets/join-onspot/community.webp";
import "./Manifesto.css";

function Arrow() {
  return <span className="manifesto-arrow" aria-hidden="true">↗</span>;
}

export default function Manifesto() {
  return (
    <div className="manifesto-page">
      <main className="manifesto-wrap">
        <header className="manifesto-topbar">
          <Link href="/why-onspot/about" className="manifesto-about-link">
            <span aria-hidden="true">←</span> About OnSpot
          </Link>
          <span className="manifesto-edition">A better way to work, together</span>
        </header>

        <section className="manifesto-hero" aria-labelledby="join-title">
          <div className="manifesto-hero-copy">
            <p className="manifesto-eyebrow"><span /> Work without borders</p>
            <h1 className="manifesto-headline" id="join-title">
              <span>Join</span>
              <span className="manifesto-headline-accent">OnSpot</span>
            </h1>
            <p className="manifesto-hero-intro">
              A more human way for businesses and talented people to do meaningful work—wherever they are.
            </p>
            <Link href="/signup" className="manifesto-join-link manifesto-hero-cta">
              Join OnSpot <Arrow />
            </Link>
            <div className="manifesto-hero-note">
              <span className="manifesto-note-line" />
              Built for ambitious businesses and independent talent
            </div>
          </div>
          <figure className="manifesto-hero-art">
            <span className="manifesto-art-orbit" aria-hidden="true" />
            <img
              src={collaborationImage}
              alt="Remote colleagues collaborating together across a video call"
              width="495"
              height="670"
              loading="eager"
            />
            <figcaption><span className="manifesto-live-dot" /> Work, connected.</figcaption>
          </figure>
          <div className="manifesto-scroll-cue" aria-hidden="true"><span /> The story</div>
        </section>

        <section className="manifesto-founder">
          <div className="manifesto-founder-mark" aria-hidden="true">“</div>
          <div className="manifesto-founder-content">
            <p className="manifesto-section-kicker">A note from our founder</p>
            <p className="manifesto-lead">
              Hi, I’m Nur Laminero and I’m the Co-Founder and CEO of OnSpot. We’re the unified outsourcing system where businesses find, hire, pay, and manage vetted remote talent in one place — and talent earns more doing it.
            </p>
            <div className="manifesto-attribution">
              <span className="manifesto-founder-avatar" aria-label="Nur Laminero initials">NL</span>
              <span><strong>Nur Laminero</strong><small>Co-Founder &amp; CEO, OnSpot</small></span>
              <span className="manifesto-attribution-rule" />
            </div>
          </div>
        </section>

        <section className="manifesto-story manifesto-problem" aria-labelledby="problem-title">
          <div className="manifesto-story-copy">
            <p className="manifesto-section-kicker"><span>01</span> The problem</p>
            <h2 id="problem-title">The choice shouldn’t be this hard.</h2>
            <p className="manifesto-copy">
              We’re building a platform for small and medium businesses to solve the broken choice between freelance chaos and enterprise BPO overhead.
            </p>
            <p className="manifesto-copy">
              Today, businesses that need operational support have to either manage unreliable freelancers on their own or pay enterprise prices for BPO services that were never designed for them. Meanwhile talented professionals around the world spend their time searching for clients instead of doing the work they are great at — and earn a fraction of what they are worth.
            </p>
          </div>
          <figure className="manifesto-story-art manifesto-art-paper">
            <img
              src={challengesImage}
              alt="A balance scale comparing lower costs with full operational capacity"
              width="685"
              height="435"
              loading="lazy"
            />
            <figcaption>Two sides of the same broken system</figcaption>
          </figure>
        </section>

        <section className="manifesto-solution" aria-labelledby="solution-title">
          <div className="manifesto-solution-heading">
            <p className="manifesto-section-kicker"><span>02</span> A better way</p>
            <h2 id="solution-title">Make great work<br /><em>the easy part.</em></h2>
          </div>
          <div className="manifesto-solution-grid">
            <figure className="manifesto-story-art manifesto-talent-art">
              <img
                src={talentImage}
                alt="A plant growing from blocks representing productivity, innovation, stronger teams and business growth"
                width="592"
                height="770"
                loading="lazy"
              />
              <figcaption>Talent, on their terms</figcaption>
            </figure>
            <div className="manifesto-solution-copy">
              <p className="manifesto-copy">
                With OnSpot, businesses will be able to find, hire, and manage vetted global talent in as fast as 7 days — with the accountability of a managed service and none of the overhead — while talent sets their own rate, keeps every dollar, and builds a real international career.
              </p>
              <div className="manifesto-solution-detail">
                <span className="manifesto-detail-mark" aria-hidden="true">↗</span>
                <span>One place to find, hire, pay, and manage.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="manifesto-experience" aria-labelledby="experience-title">
          <div className="manifesto-experience-art">
            <img
              src={communityImage}
              alt="Gold coins with arrows pointing toward better talent, smarter systems, technology and stronger teams"
              width="515"
              height="790"
              loading="lazy"
            />
            <span className="manifesto-experience-stamp">Made from<br />experience</span>
          </div>
          <div className="manifesto-experience-copy">
            <p className="manifesto-section-kicker"><span>03</span> Built from experience</p>
            <h2 id="experience-title">We know the work behind the work.</h2>
            <p className="manifesto-copy">
              My co-founders Jake and Mark and I spent four years running a BPO before building this platform — which means we did not guess at the problem. We lived inside it, encoded everything we learned into the platform, and built OnSpot from operational truth rather than theory.
            </p>
          </div>
        </section>

        <section className="manifesto-audience" aria-labelledby="audience-title">
          <div className="manifesto-audience-heading">
            <p className="manifesto-section-kicker"><span>04</span> A place for you</p>
            <h2 id="audience-title">Whoever you are,<br /><em>there’s room here.</em></h2>
          </div>
          <p className="manifesto-copy manifesto-audience-intro">
            We built OnSpot for you. If you are a business owner tired of managing contractors who disappear — this is your platform. If you are a talented professional earning less than your work is worth — this is your platform. We are opening our doors and we want you to be part of what we are building together.
          </p>
          <div className="manifesto-audience-cards">
            <article className="manifesto-audience-card manifesto-business-card">
              <div className="manifesto-card-top">
                <span className="manifesto-card-symbol" aria-hidden="true">B</span>
                <span className="manifesto-card-index">01 / BUSINESS</span>
              </div>
              <h3>Build your team.</h3>
              <p>Find, hire, and manage the remote talent your business needs.</p>
              <Link href="/signup/client" className="manifesto-card-link">Hire Talent <Arrow /></Link>
            </article>
            <article className="manifesto-audience-card manifesto-talent-card">
              <div className="manifesto-card-top">
                <span className="manifesto-card-symbol" aria-hidden="true">T</span>
                <span className="manifesto-card-index">02 / TALENT</span>
              </div>
              <h3>Find your next thing.</h3>
              <p>Set your rate, keep every dollar, and build an international career.</p>
              <Link href="/signup/talent" className="manifesto-card-link">Find Work <Arrow /></Link>
            </article>
          </div>
        </section>

        <section className="manifesto-mission" aria-labelledby="mission-title">
          <p className="manifesto-section-kicker"><span>05</span> Our mission</p>
          <h2 id="mission-title">Meaningful work<br />has <em>no borders.</em></h2>
          <p className="manifesto-copy">
            Our mission is to liberate how the world does meaningful work — a world where anyone can work anywhere, and every company can hire anyone, without limits.
          </p>
          <div className="manifesto-mission-decoration" aria-hidden="true"><span /><span /><span /></div>
        </section>

        <section className="manifesto-final-cta">
          <div className="manifesto-cta-glint" aria-hidden="true" />
          <p className="manifesto-section-kicker">Come build what’s next</p>
          <h2>There’s a place<br />for you <em>on the team.</em></h2>
          <p className="manifesto-copy">
            Join us in this journey. Sign up for OnSpot today.
          </p>
          <div className="manifesto-final-actions">
            <Link href="/signup" className="manifesto-join-link manifesto-final-link">
              Join OnSpot <Arrow />
            </Link>
            <span>Choose the path that fits you.</span>
          </div>
          <div className="manifesto-cta-footer">
            <span className="manifesto-footer-mark">OnSpot</span>
            <span>Meaningful work, without borders.</span>
            <Link href="/why-onspot/about" className="manifesto-footer-about">About OnSpot <Arrow /></Link>
          </div>
        </section>
      </main>
    </div>
  );
}
