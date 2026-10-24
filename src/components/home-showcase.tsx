import Link from "next/link";

export function HomeShowcase({
  quiz,
  topics,
  topicLabels,
}: {
  quiz: { title: string; description: string; publicationDate: string } | null;
  topics: string[];
  topicLabels: Record<string, string>;
}) {
  return (
    <main className="home">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Qodlume home">
          Qodlume<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation" className="header-nav">
          <Link href="/archive">Quiz archive</Link>
          <Link href="/games">Games</Link>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">A brighter way to take a break</p>
          <h1 id="hero-title">Give your brain a quick workout.</h1>
          <p className="hero-subtitle">
            Daily quizzes, clever puzzles, and quick games made for curious minds.
          </p>
        </div>

        <div className="feature-grid" aria-label="Explore Qodlume">
          <Link href="/archive" className="feature-card quiz-card">
            <div className="illustration quiz-illustration" aria-hidden="true">
              <div className="quiz-sheet">
                <span className="sheet-line line-one" />
                <span className="sheet-line line-two" />
                <span className="sheet-line line-three" />
                <span className="sheet-check">✓</span>
              </div>
              <span className="quiz-spark spark-one">✦</span>
              <span className="quiz-spark spark-two">?</span>
              <span className="quiz-orb" />
            </div>
            <div className="feature-copy">
              <span className="feature-kicker">Think it through</span>
              <h2>Quizzes</h2>
              <p>Explore daily knowledge challenges, trivia, and brain teasers.</p>
              <span className="feature-cta">Explore Quizzes <span aria-hidden="true">↗</span></span>
            </div>
          </Link>

          <Link href="/games" className="feature-card games-card">
            <div className="illustration games-illustration" aria-hidden="true">
              <div className="word-tile tile-a">Q</div>
              <div className="word-tile tile-b">O</div>
              <div className="word-tile tile-c">D</div>
              <div className="memory-tile memory-a">✦</div>
              <div className="memory-tile memory-b">?</div>
              <span className="game-spark">✳</span>
            </div>
            <div className="feature-copy">
              <span className="feature-kicker">Play a little</span>
              <h2>Games</h2>
              <p>Try Word Guess, Memory Match, or test your reaction time.</p>
              <span className="feature-cta">Play Games <span aria-hidden="true">↗</span></span>
            </div>
          </Link>
        </div>
      </section>

      <section className="daily-section" aria-labelledby="daily-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fresh for curious minds</p>
            <h2 id="daily-heading">Today&apos;s quiz</h2>
          </div>
          {topics.length > 0 && (
            <div className="topic-list" aria-label="Quiz topics">
              {topics.slice(0, 4).map((topic) => (
                <span key={topic}>{topicLabels[topic] ?? topic}</span>
              ))}
            </div>
          )}
        </div>

        <article className="daily-card">
          {quiz ? (
            <>
              <div>
                <span className="date-pill">{quiz.publicationDate}</span>
                <h3>{quiz.title}</h3>
                <p>{quiz.description}</p>
              </div>
              <Link className="daily-cta" href={`/quiz/${quiz.publicationDate}`}>
                Start today&apos;s quiz <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <>
              <div>
                <h3>No quiz is available today</h3>
                <p>Browse published challenges and choose one to play.</p>
              </div>
              <Link className="daily-cta" href="/archive">
                Browse quizzes <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </article>
      </section>

      <footer className="site-footer">
        <Link href="/" className="brand">Qodlume<span className="brand-dot">.</span></Link>
        <span>Take a quick break. Leave a little sharper.</span>
        <Link href="/archive">Browse the quiz archive</Link>
      </footer>

    </main>
  );
}
