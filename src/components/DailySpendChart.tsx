import { useState } from 'react';
import type { DailySummaryPoint } from '../types/expense';
import { formatINR } from '../utils/analytics';

interface DailySpendChartProps {
  series: DailySummaryPoint[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
}

export function DailySpendChart({
  series,
  selectedDate,
  onSelectDate,
}: DailySpendChartProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const maxSpend = Math.max(
    500,
    ...series.map((d) => d.totalSpend),
  );
  // Round Y-axis ceiling to nearest clean 500
  const yCeiling = Math.ceil(maxSpend / 500) * 500;
  const ticks = [0, Math.round(yCeiling * 0.5), yCeiling];

  const activePoint =
    series.find((d) => d.dateStr === (hoveredDate ?? selectedDate)) ??
    series[series.length - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Daily Expenditure Summary
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Select any day bar to inspect Online vs. Cash breakdown and item receipts.
          </p>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-600 shrink-0">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-teal-700 inline-block" aria-hidden="true" />
            <span>Online (UPI / Card)</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" aria-hidden="true" />
            <span>Cash / COD</span>
          </span>
        </div>
      </div>

      {/* Live readout bar for hovered or selected day */}
      {activePoint && (
        <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 tabular-nums">
              {activePoint.dateStr}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {activePoint.count} {activePoint.count === 1 ? 'transaction' : 'transactions'}
            </span>
            {activePoint.topAppName && (
              <>
                <span aria-hidden="true">·</span>
                <span>Top: {activePoint.topAppName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 tabular-nums font-mono">
            <span className="text-teal-800">
              Online {formatINR(activePoint.onlineSpend)}
            </span>
            <span className="text-amber-800">
              Cash {formatINR(activePoint.cashSpend)}
            </span>
            <span className="font-semibold text-slate-900">
              Total {formatINR(activePoint.totalSpend)}
            </span>
          </div>
        </div>
      )}

      {/* Responsive interactive stacked bar chart */}
      <div className="mt-4 relative" data-testid="daily-spend-chart">
        <div className="flex items-stretch gap-3">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between text-right text-[11px] font-mono tabular-nums text-slate-400 pb-6 pr-1 select-none w-14 shrink-0">
            <span>{formatINR(ticks[2])}</span>
            <span>{formatINR(ticks[1])}</span>
            <span>{formatINR(ticks[0])}</span>
          </div>

          {/* Bars container */}
          <div className="flex-1 min-w-0">
            <div className="relative h-52 border-b border-slate-200 flex items-end gap-1 sm:gap-1.5">
              {/* Horizontal gridlines */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200/70 pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200/70 pointer-events-none"
              />

              {series.map((point) => {
                const onlineHeightPct =
                  yCeiling > 0 ? (point.onlineSpend / yCeiling) * 100 : 0;
                const cashHeightPct =
                  yCeiling > 0 ? (point.cashSpend / yCeiling) * 100 : 0;
                const isSelected = point.dateStr === selectedDate;
                const isHovered = point.dateStr === hoveredDate;

                return (
                  <button
                    key={point.dateStr}
                    type="button"
                    onClick={() => onSelectDate(point.dateStr)}
                    onMouseEnter={() => setHoveredDate(point.dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    aria-label={`${point.dateStr}: Total ${formatINR(point.totalSpend)}, Online ${formatINR(point.onlineSpend)}, Cash ${formatINR(point.cashSpend)}`}
                    aria-pressed={isSelected}
                    className={`group relative flex-1 h-full flex flex-col justify-end items-center rounded-t transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      isSelected
                        ? 'bg-teal-50/80 ring-1 ring-teal-700/30'
                        : isHovered
                          ? 'bg-slate-100/70'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-full max-w-[18px] h-full flex flex-col justify-end px-0.5">
                      {point.cashSpend > 0 && (
                        <div
                          className="w-full bg-amber-500 rounded-t-[2px] transition-opacity"
                          style={{
                            height: `${Math.max(3, cashHeightPct)}%`,
                          }}
                        />
                      )}
                      {point.onlineSpend > 0 && (
                        <div
                          className={`w-full bg-teal-700 transition-opacity ${
                            point.cashSpend === 0 ? 'rounded-t-[2px]' : ''
                          }`}
                          style={{
                            height: `${Math.max(3, onlineHeightPct)}%`,
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* X-axis day ticks */}
            <div className="flex items-center gap-1 sm:gap-1.5 pt-2">
              {series.map((point) => {
                const showLabel =
                  point.day === 1 ||
                  point.day % 5 === 0 ||
                  point.dateStr === selectedDate;
                return (
                  <div
                    key={point.dateStr}
                    className={`flex-1 text-center text-[10px] font-mono tabular-nums ${
                      point.dateStr === selectedDate
                        ? 'text-teal-800 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {showLabel ? point.day : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
