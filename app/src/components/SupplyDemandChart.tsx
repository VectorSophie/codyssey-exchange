// 순수 SVG 선그래프 — 외부 차트 라이브러리 없이 시간대별 수요/공급 교차를 그린다.
// 이 프로젝트의 출발점이 된 "수요와 공급" 개념을 가장 직접적으로 보여주는 메인 차트.
const WIDTH = 640;
const HEIGHT = 260;
const PAD_L = 32;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;

function xAt(hour: number) {
  return PAD_L + (hour / 23) * (WIDTH - PAD_L - PAD_R);
}
function yAt(value: number, max: number) {
  return HEIGHT - PAD_B - (value / max) * (HEIGHT - PAD_T - PAD_B);
}

export function SupplyDemandChart({ demand, supply }: { demand: number[]; supply: number[] }) {
  const max = Math.max(...demand, ...supply, 1);
  const demandPoints = demand.map((v, h) => `${xAt(h)},${yAt(v, max)}`).join(" ");
  const supplyPoints = supply.map((v, h) => `${xAt(h)},${yAt(v, max)}`).join(" ");

  const segments = demand.slice(0, -1).map((_, h) => {
    const x1 = xAt(h);
    const x2 = xAt(h + 1);
    const d1 = yAt(demand[h], max);
    const d2 = yAt(demand[h + 1], max);
    const s1 = yAt(supply[h], max);
    const s2 = yAt(supply[h + 1], max);
    const deficit = demand[h] + demand[h + 1] > supply[h] + supply[h + 1];
    return {
      key: h,
      points: `${x1},${d1} ${x2},${d2} ${x2},${s2} ${x1},${s1}`,
      fill: deficit ? "rgba(220,38,38,0.12)" : "rgba(37,99,235,0.10)",
    };
  });

  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="시간대별 수요/공급 추이">
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            x2={WIDTH - PAD_R}
            y1={yAt(t, max)}
            y2={yAt(t, max)}
            stroke="var(--grid-line)"
            strokeWidth={1}
          />
          <text x={4} y={yAt(t, max) + 3} fontSize={10} fill="var(--axis-text)">
            {t}
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((h) => (
        <text key={h} x={xAt(h)} y={HEIGHT - 8} fontSize={10} fill="var(--axis-text)" textAnchor="middle">
          {h}시
        </text>
      ))}
      {segments.map((s) => (
        <polygon key={s.key} points={s.points} fill={s.fill} />
      ))}
      <polyline points={supplyPoints} fill="none" stroke="#2563eb" strokeWidth={2} />
      <polyline points={demandPoints} fill="none" stroke="#dc2626" strokeWidth={2} />
    </svg>
  );
}
