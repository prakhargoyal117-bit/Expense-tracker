import { ArrowRight, PlusCircle } from 'lucide-react';
import type {
  AppId,
  AppSpendInsight,
  CategorySpendInsight,
  ConnectedApp,
} from '../types/expense';
import { formatINR } from '../utils/analytics';
import { AppBrandIcon } from './AppBrandIcon';

interface AppInsightsViewProps {
  appInsights: AppSpendInsight[];
  categoryInsights: CategorySpendInsight[];
  totalSpend: number;
  unconnectedApps: ConnectedApp[];
  onFilterByApp: (appId: AppId) => void;
  onRequestConnectApp: (app: ConnectedApp) => void;
}

export function AppInsightsView({
  appInsights,
  categoryInsights,
  totalSpend,
  unconnectedApps,
  onFilterByApp,
  onRequestConnectApp,
}: AppInsightsViewProps) {
  return (
    <div className="space-y-6">
      {/* App-by-App Leaderboard */}
      <section
        aria-label="Application Spend Breakdown"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              How Much You Spent Per App
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Breakdown across connected food, grocery, retail, mobility apps, and manual entries.
            </p>
          </div>
          <div className="text-sm font-mono tabular-nums text-slate-600">
            Total tracked:{' '}
            <span className="font-semibold text-slate-900">{formatINR(totalSpend)}</span>
          </div>
        </div>

        {appInsights.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Application</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Avg Order</th>
                  <th className="py-3 px-4 text-right">Online</th>
                  <th className="py-3 px-4 text-right">Cash</th>
                  <th className="py-3 px-4 text-right">Share</th>
                  <th className="py-3 px-6 text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {appInsights.map((insight) => (
                  <tr
                    key={insight.appId}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-6">
                      <button
                        type="button"
                        onClick={() => onFilterByApp(insight.appId)}
                        className="inline-flex items-center gap-3 font-medium text-slate-900 hover:text-teal-800 text-left"
                      >
                        <AppBrandIcon appId={insight.appId} size="sm" />
                        <span>{insight.appName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {insight.category}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {insight.count}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatINR(insight.avgOrder)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-teal-800">
                      {formatINR(insight.onlineSpend)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-800">
                      {formatINR(insight.cashSpend)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {insight.sharePct}%
                    </td>
                    <td className="py-3.5 px-6 text-right font-semibold font-mono tabular-nums text-slate-900">
                      {formatINR(insight.totalSpend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            No expenditures recorded in the selected month.
          </div>
        )}
      </section>

      {/* Category Split + Available Apps to Connect */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          aria-label="Category Comparison"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <h2 className="text-base font-semibold text-slate-900 pb-4 border-b border-slate-100">
            Spending by Category
          </h2>
          {categoryInsights.length > 0 ? (
            <div className="mt-4 space-y-4">
              {categoryInsights.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-800">{cat.category}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {formatINR(cat.totalSpend)}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({cat.sharePct}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    {cat.onlineSpend > 0 && (
                      <div
                        className="h-full bg-teal-700"
                        style={{
                          width: `${
                            cat.totalSpend > 0
                              ? Math.round((cat.onlineSpend / cat.totalSpend) * cat.sharePct)
                              : 0
                          }%`,
                        }}
                      />
                    )}
                    {cat.cashSpend > 0 && (
                      <div
                        className="h-full bg-amber-500"
                        style={{
                          width: `${
                            cat.totalSpend > 0
                              ? Math.round((cat.cashSpend / cat.totalSpend) * cat.sharePct)
                              : 0
                          }%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-sm text-slate-500 text-center">
              No category data available for this month.
            </p>
          )}
        </section>

        <section
          aria-label="More Shopping and Food Apps"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Connect More Apps
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Grant explicit account permission to include additional food or shopping apps in your insights.
            </p>
          </div>

          {unconnectedApps.length > 0 ? (
            <ul className="divide-y divide-slate-100 mt-2">
              {unconnectedApps.map((app) => (
                <li
                  key={app.id}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AppBrandIcon appId={app.id} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {app.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {app.category} · {app.shortDescription}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRequestConnectApp(app)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Connect</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-sm text-slate-600 text-center">
              All supported shopping, food, and commute apps are connected.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
