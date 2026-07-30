// 라우트 전환 중 DB 조회를 기다리는 동안 빈 화면 대신 표시 — Next.js가 각 라우트 렌더링을 자동으로 이 안에 감싼다.
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-32 rounded-sm bg-neutral-200" />
        <div className="h-4 w-64 rounded-sm bg-neutral-100" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 rounded-sm border border-border bg-surface" />
          ))}
        </div>
        <div className="h-64 rounded-sm border border-border bg-surface" />
      </div>
    </main>
  );
}
