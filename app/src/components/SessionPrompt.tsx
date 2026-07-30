"use client";
import { useState } from "react";

// 방문자가 본인 JSESSIONID를 브라우저 쿠키에만 저장 — 서버(.env)의 CODYSSEY_SESSION은 로컬 개발용
// 기본값일 뿐, 공개 배포에서 방문자마다 자기 데이터를 보려면 이 쿠키가 있어야 한다.
// 서버는 이 값을 영구 저장하지 않는다 — 매 요청 Codyssey API 호출에만 그대로 전달한다(lib/codyssey-client.ts).
// 전면 팝업으로 강제하지 않는다 — 처음 온 방문자를 막아서지 않고, 원할 때만 누르는 조용한 링크로 둔다.
const COOKIE_NAME = "codyssey_session";

function setCookie(name: string, value: string, maxAgeDays: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeDays * 86400}; SameSite=Lax`;
}

export function SessionPrompt({ hasSessionCookie }: { hasSessionCookie: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function save() {
    if (!value.trim()) return;
    setCookie(COOKIE_NAME, value.trim(), 30);
    location.reload();
  }

  function clearSession() {
    setCookie(COOKIE_NAME, "", -1);
    location.reload();
  }

  if (hasSessionCookie) {
    return (
      <button
        onClick={clearSession}
        className="mt-1 text-[11px] text-neutral-400 underline hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        내 세션 지우기
      </button>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-[11px] text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        본인 JSESSIONID로 보기
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-sm border border-border bg-surface p-3 shadow-sm">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        usr.codyssey.kr 로그인 후 개발자도구(F12) → Application → Cookies → JSESSIONID 값을 붙여넣으면 본인
        데이터로 조회합니다. 이 값은 이 브라우저에만 쿠키로 저장되고, 서버에는 영구 저장되지 않습니다.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="JSESSIONID=..."
          autoFocus
          className="flex-1 rounded-sm border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500"
        />
        <button
          onClick={save}
          className="rounded-sm bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          저장
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-sm px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          취소
        </button>
      </div>
    </div>
  );
}
