// src/modules/analytics/analyticsManagement.js
import React, { useState } from "react";
import { Tab } from "./components/analyticsCommon";

import OwnerRentalTab from "./components/OwnerRentalTab";
import MI from "./components/MI";
import EntityStatement from "./components/EntityStatement";
import ProjectProfitability from "./components/ProjectProfitability";
import FinancialDashboard from "./components/FinancialDashboard";

export default function AnalyticsManagement() {
  // Owner first (default)
  const [tab, setTab] = useState("owner"); // owner | mi | entity | project | pivot

  const TAB_COMPONENTS = {
    mi: MI,
    entity: EntityStatement,
    owner: OwnerRentalTab,
    project: ProjectProfitability,
    pivot: FinancialDashboard,
  };

  const Active = TAB_COMPONENTS[tab] || OwnerRentalTab;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Insights</div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        </div>
      </div>

      <nav className="flex gap-2 flex-wrap">
        {[ 
          ["owner", "Owner Dashboard"],
          ["mi", "M&I (YTD)"],
          ["entity", "Entity Statement"],
          ["project", "Project Profitability"],
          ["pivot", "Financial Dashboard"],
        ].map(([k, label]) => (
          <Tab key={k} active={tab === k} onClick={() => setTab(k)}>
            {label}
          </Tab>
        ))}
      </nav>

      <Active />
    </div>
  );
}
