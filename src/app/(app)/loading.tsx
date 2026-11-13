/** Shown instantly while the next page renders on the server: a quiet skeleton, no text. */
export default function Loading() {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <span className="sk sk-title" />
      <span className="sk sk-card" />
      <span className="sk sk-card short" />
    </div>
  );
}
