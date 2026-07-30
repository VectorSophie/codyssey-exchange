"use client";

// DB 연결 실패 등으로 서버 컴포넌트가 던진 에러를 잡아 원시 스택 화면 대신 보여준다.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center">
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        일시적으로 데이터를 불러오지 못했습니다
      </h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        데이터베이스 연결이 잠시 끊겼을 수 있습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-sm bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        다시 시도
      </button>
    </main>
  );
}
