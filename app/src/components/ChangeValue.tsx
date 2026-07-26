// 상승(개선)=빨강, 하락(악화)=파랑 — 한국 증권시장 색상 관습. 색만으로 전달하지 않고 부호/화살표 텍스트를 병기한다.
export function ChangeValue({ pct }: { pct: number }) {
  if (pct === 0) return <span className="tabular-nums text-neutral-500">0%</span>;
  const up = pct > 0;
  return (
    <span className={`tabular-nums font-medium ${up ? "text-red-600" : "text-blue-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}
