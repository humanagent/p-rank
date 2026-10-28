import Link from "next/link";
import { PoweredBy } from "@/components/brand/PoweredBy";
import { Crest } from "@/components/landing/Crest";
import { Hall } from "@/components/landing/Hall";
import s from "@/components/landing/landing.module.css";

const DRAWS = [
  { cat: "7th", level: "Beginner", text: "New to padel, learning the walls." },
  { cat: "6th", level: "Improver", text: "Rallies hold; the glass still surprises." },
  { cat: "5th", level: "Intermediate", text: "Steady from the back, first volleys." },
  { cat: "4th", level: "Club player", text: "Bandeja and lob on purpose." },
  { cat: "3rd", level: "Strong club", text: "Builds points, wins the net." },
  { cat: "2nd", level: "Advanced", text: "Vibora and smash on demand." },
];

const WHY = [
  ["No one sent home mid-tournament", "A player who entered below their real level is spotted at entry, not after three wins."],
  ["No more uneven matches", "Every draw is played at its level, so every match is a real one, all the way to the final."],
  ["Levels, not word of mouth", "A clip and a coach's call, instead of “someone said he’s good”."],
];

const STEPS = [
  ["I", "Upload a rally", "One clip of you playing a point, up to 30 seconds, filmed from behind the glass."],
  ["II", "Pick yourself", "Tap the player who is you, so P-Rank looks at the right person."],
  ["III", "P-Rank analyses your shots", "P-Rank, our AI, reads your shots and compares them with the category you claimed."],
  ["IV", "A coach confirms your spot", "A club coach reviews P-Rank's read and confirms your place in the draw."],
];

export default function Home() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <nav className={`${s.nav} ${s.navLeft}`} aria-label="Tournament">
          <a href="#draw">The draw</a>
          <a href="#prizes">Prizes</a>
        </nav>
        <Link href="/" className={s.crestLink} aria-label="Meridian Court Club, home">
          <Crest className={s.crest} />
        </Link>
        <nav className={`${s.nav} ${s.navRight}`} aria-label="Entry">
          <a href="#entry">How entry works</a>
          <Link href="/enter" className={s.pill}>
            Enter
          </Link>
        </nav>
      </header>

      <main>
        <section className={s.hall}>
          <Hall className={s.hallArt} />
        </section>

        <section className={s.hero} aria-labelledby="hero-title">
          <span className={s.eyebrow}>Meridian Court Club presents</span>
          <h1 id="hero-title" className={s.h1}>
            The Summer <i>Invitational</i>
          </h1>
          <p className={s.heroCopy}>
            Padel, one draw per category, 7th to 2nd. Grand prize, a trip to Japan. P-Rank helps our coaches place
            every player in the right draw; a coach confirms every entry.
          </p>
          <PoweredBy />
          <div className={s.stack}>
            <Link href="/enter" className="btn btn-primary">
              Enter the Invitational · upload your clip
            </Link>
          </div>
        </section>

        <section id="prizes" className={s.prizes} aria-label="Prizes">
          <Prize name="Grand prize" value="A trip to Japan" />
          <Prize name="Categories" value="7th to 2nd" />
          <Prize name="Your clip" value="Up to 30 s" />
        </section>

        <section id="draw" className={s.draw} aria-labelledby="draw-title">
          <h2 id="draw-title" className={s.sectionTitle}>
            One draw per level
          </h2>
          <p className={s.drawLead}>Claim the category you play. P-Rank checks it within one category either way.</p>
          <ul className={s.drawGrid}>
            {DRAWS.map((d) => (
              <li key={d.cat} className={s.drawCard}>
                <span className={s.drawName}>{d.cat}</span>
                <span className={s.drawLevel}>{d.level}</span>
                <span className={s.drawText}>{d.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <ul className={s.why} aria-label="Why entry is reviewed">
          {WHY.map(([title, body]) => (
            <li key={title}>
              <span className={s.whyTitle}>{title}</span>
              <p>{body}</p>
            </li>
          ))}
        </ul>

        <section id="entry" className={s.entry} aria-labelledby="entry-title">
          <div className={s.entryCopy}>
            <h2 id="entry-title" className={s.sectionTitle}>
              How entry works
            </h2>
            <ol className={s.steps}>
              {STEPS.map(([num, title, body]) => (
                <li key={num}>
                  <span className={s.num} aria-hidden="true">
                    {num}
                  </span>
                  <span className={s.stepBody}>
                    <b>{title}</b>
                    <span>{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className={s.honest}>P-Rank is in beta: it helps our coaches, and a coach confirms every entry.</p>
            <div className={`${s.stack} ${s.stackLeft}`}>
              <Link href="/enter" className="btn btn-primary">
                Enter the Invitational · upload your clip
              </Link>
            </div>
          </div>

          <div className={s.card} role="img" aria-label="A player's card for the 5th category draw, confirmed by the club">
            <div className={s.cardRow}>
              <span className={s.cardClub}>Meridian Court</span>
              <span className={s.cardM}>M</span>
            </div>
            <div className={s.cardMid}>
              <span className={s.cardCat}>5th category</span>
            </div>
            <div className={s.cardFoot}>
              <span>Summer Invitational</span>
              <span>Confirmed</span>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <span>
          Powered by <b>P-Rank</b> (beta), an AI helper for the club’s coaches. A coach confirms every entry.
        </span>
        <span>
          Meridian Court Club is fictional, built for a take-home.
        </span>
      </footer>
    </div>
  );
}

function Prize({ name, value }: { name: string; value: string }) {
  return (
    <div className={s.prize}>
      <span className={s.eyebrow}>{name}</span>
      <span className={s.prizeValue}>{value}</span>
    </div>
  );
}
