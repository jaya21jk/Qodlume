import Link from "next/link";

const games = [
  {
    title: "Reaction Time Challenge",
    description: "Test your reflexes! Click the button as soon as it appears and see how fast you can react.",
    href: "/games/reaction-time",
    theme: "reaction",
    illustration: (
      <div className="game-art reaction-art" aria-hidden="true">
        <span className="art-spark spark-a">✦</span>
        <span className="art-spark spark-b">ϟ</span>
        <div className="stopwatch">
          <span className="stopwatch-top" />
          <span className="clock-face"><span className="clock-hand" /></span>
        </div>
        <span className="reaction-button" />
        <span className="reaction-hand">👆</span>
      </div>
    ),
    features: ["5 attempts per game", "Track your best time", "Beat your personal record"],
  },
  {
    title: "Word Guess",
    description: "Guess the hidden word in limited attempts. Use the hints and test your vocabulary.",
    href: "/games/word-guess",
    theme: "word",
    illustration: (
      <div className="game-art word-art" aria-hidden="true">
        <span className="art-spark spark-a">✦</span>
        <span className="word-bulb">💡</span>
        <span className="letter-chip chip-h">H</span>
        <span className="letter-chip chip-g">G</span>
        <div className="word-row">
          <span>W</span><span>O</span><span className="letter-green">R</span><span>D</span>
        </div>
        <div className="word-row word-row-second">
          <span>G</span><span className="letter-green">U</span><span className="letter-green">E</span><span className="letter-green">S</span><span>S</span>
        </div>
      </div>
    ),
    features: ["6 attempts", "5-letter words", "Daily new challenge"],
  },
  {
    title: "Memory Match",
    description: "Flip the cards, find the matching pairs and complete the board in the fewest moves possible.",
    href: "/games/memory-match",
    theme: "memory",
    illustration: (
      <div className="game-art memory-art" aria-hidden="true">
        <span className="art-spark spark-a">✦</span>
        <span className="memory-card memory-star">★</span>
        <span className="memory-card memory-fruit">🍓</span>
        <span className="memory-card memory-face">🐻</span>
        <span className="memory-card memory-heart">♥</span>
        <span className="memory-card memory-blue">★</span>
        <span className="memory-card memory-orange">★</span>
      </div>
    ),
    features: ["3 difficulty levels", "Track your best time", "Improve your memory"],
  },
];

const featureIcons = ["◉", "✦", "◆"];

export default function GamesPage() {
  return (
    <main className="games-page">
      <header className="games-header">
        <Link href="/" className="games-brand" aria-label="Qodlume home">
          Qodlume
        </Link>
        <nav className="games-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/archive">Quizzes</Link>
          <Link href="/games" aria-current="page">Games</Link>
          <a href="#about">About</a>
        </nav>
        <Link className="sign-in-link" href="/admin">Sign In</Link>
        <details className="mobile-menu">
          <summary aria-label="Open navigation menu"><span /><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            <Link href="/archive">Quizzes</Link>
            <Link href="/games" aria-current="page">Games</Link>
            <a href="#about">About</a>
            <Link href="/admin">Sign In</Link>
          </nav>
        </details>
      </header>

      <section className="games-hero" aria-labelledby="games-heading">
        <span className="hero-decoration target-decoration" aria-hidden="true">🎯</span>
        <span className="hero-decoration brain-decoration" aria-hidden="true">🧠</span>
        <span className="hero-decoration trophy-decoration" aria-hidden="true">🏆</span>
        <div className="games-intro">
          <p className="games-eyebrow">Daily brain games</p>
          <h1 id="games-heading">Play. <span>Challenge.</span> <b>Improve.</b></h1>
          <p>Quick, engaging games to test your speed, memory and word skills.</p>
          <p>New daily challenges to keep your mind sharp!</p>
        </div>

        <div className="games-grid">
          {games.map((game, index) => (
            <article className={`game-card ${game.theme}`} key={game.title}>
              {game.illustration}
              <div className="game-card-body">
                <h2>{game.title}</h2>
                <p className="game-description">{game.description}</p>
                <ul>
                  {game.features.map((feature, featureIndex) => (
                    <li key={feature}>
                      <span className="feature-icon" aria-hidden="true">{featureIcons[featureIndex]}</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link className="play-game-link" href={game.href}>
                  Play Now <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <aside className="daily-banner">
          <span className="daily-trophy" aria-hidden="true">🏆</span>
          <div>
            <h2>New Challenges Every Day</h2>
            <p>Come back daily for fresh games and beat your personal bests!</p>
          </div>
          <div className="reset-time">
            <span aria-hidden="true">▣</span>
            <p>Daily challenges reset at<br /><strong>12:00 AM (Asia/Kolkata)</strong></p>
          </div>
        </aside>
      </section>

      <section className="games-about" id="about">
        <h2>Small games, sharper minds.</h2>
        <p>Take a quick break with a daily word puzzle, a memory challenge, or a test of your reflexes.</p>
      </section>
    </main>
  );
}
