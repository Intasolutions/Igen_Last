import React from "react";
import Sidebar from "../components/Slidebar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 72, padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}
