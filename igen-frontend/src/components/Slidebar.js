// src/components/Slidebar.js
import React, { useState, useMemo } from "react";
import {
  Drawer,
  List,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Collapse,
  ListItemButton,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  AccountBalance as AccountBalanceIcon,
  Category as CategoryIcon,
  ReceiptLong as ReceiptLongIcon,
  Logout as LogoutIcon,
  Assignment as AssignmentIcon,
  Apartment as ApartmentIcon,
  BusinessCenter as BusinessCenterIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Contacts as ContactsIcon,
  Store as StoreIcon,
  Gavel as GavelIcon,
  Assessment as AssessmentIcon,
  UploadFile as UploadFileIcon,
  Rule as RuleIcon,
  ExpandLess,
  ExpandMore,
  Settings as SettingsIcon,
  SwapHoriz as SwapHorizIcon,
  BarChart as BarChartIcon,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { perms, canList } from "../utils/perm";

// ---- helpers ----
const isPathActive = (current, path) =>
  current === path || current.startsWith(path + "/");

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const handleLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    navigate("/");
  };

  const toggleGroup = (header) =>
    setOpenGroups((prev) => ({ ...prev, [header]: !prev[header] }));

  // Build menu with permission checks (from utils/perm.js)
  const menuGroups = useMemo(
    () => [
      {
        header: "Setup",
        icon: <SettingsIcon />,
        items: [
          {
            text: "Dashboard",
            icon: <DashboardIcon />,
            path: "/dashboard",
            canShow: perms.viewDashboard(), // SU/CH/AC only
          },
          {
            text: "Users",
            icon: <PeopleIcon />,
            path: "/users",
            // users.list is SU-only in matrix — keep it hidden unless you want to expose it
            canShow: canList("users"),
          },
          {
            text: "Companies",
            icon: <BusinessIcon />,
            path: "/companies",
            canShow: perms.viewCompanies(), // SU/CH/AC
          },
          {
            text: "Banks",
            icon: <AccountBalanceIcon />,
            path: "/banks",
            // SU/AC/CH have list rights
            canShow: canList("banks"),
          },
          {
            text: "Cost Centres",
            icon: <CategoryIcon />,
            path: "/cost-centres",
            canShow: canList("cost_centres"),
          },
          {
            text: "Transaction Types",
            icon: <ReceiptLongIcon />,
            path: "/transaction-types",
            canShow: canList("transaction_types"),
          },
        ],
      },
      {
        header: "Master Data",
        icon: <BarChartIcon />,
        items: [
          {
            text: "Projects",
            icon: <AssignmentIcon />,
            path: "/projects",
            canShow: canList("projects"), // SU/CH/AC/PM
          },
          {
            text: "Properties",
            icon: <ApartmentIcon />,
            path: "/properties",
            canShow: canList("properties"),
          },
          {
            text: "Entities",
            icon: <BusinessCenterIcon />,
            path: "/entities",
            canShow: canList("entities"),
          },
          {
            text: "Assets",
            icon: <InventoryIcon />,
            path: "/assets",
            canShow: canList("assets"),
          },
          {
            text: "Contacts",
            icon: <ContactsIcon />,
            path: "/contacts",
            canShow: canList("contacts"),
          },
          {
            text: "Vendors",
            icon: <StoreIcon />,
            path: "/vendors",
            canShow: canList("vendors"),
          },
          {
            text: "Contracts",
            icon: <GavelIcon />,
            path: "/contracts",
            canShow: canList("contracts"),
          },
        ],
      },
      {
        header: "Transactions",
        icon: <SwapHorizIcon />,
        items: [
          {
            text: "Bank Uploads",
            icon: <UploadFileIcon />,
            path: "/bank-uploads",
            canShow: perms.viewBankUploads(), // SU/AC/CH
          },
          {
            text: "Review & Classify",
            icon: <RuleIcon />,
            path: "/tx-classify",
            canShow: perms.viewTxClassify(), // SU/AC/CH
          },
          {
            text: "Cash Ledger",
            icon: <ReceiptIcon />,
            path: "/cash-ledger",
            canShow: perms.viewCashLedger(), // SU/AC/CH/PM
          },
        ],
      },
      {
        header: "Reports",
        icon: <AssessmentIcon />,
        items: [
          {
            text: "Analytics",
            icon: <BarChartIcon />,
            path: "/analytics",
            canShow: perms.viewAnalytics(), // SU/AC/CH
          },
          {
            text: "Entity Report",
            icon: <AssessmentIcon />,
            path: "/entity-report",
            canShow: perms.viewEntityReport(), // SU/AC/CH
          },
        ],
      },
    ],
    []
  );

  return (
    <Drawer
      variant="permanent"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        width: hovered ? 240 : 72,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: hovered ? 240 : 72,
          boxSizing: "border-box",
          backgroundColor: "#1F2937",
          color: "#FFFFFF",
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.3s ease",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: 15 }}>
        {hovered && (
          <div style={{ marginLeft: 10, fontWeight: 600, fontSize: 24 }}>
            IGen Panel
          </div>
        )}
      </div>

      {menuGroups.map((group) => {
        const visibleItems = group.items.filter((i) => i.canShow);
        if (!visibleItems.length) return null;

        const containsActive = visibleItems.some((i) =>
          isPathActive(location.pathname, i.path)
        );
        const isOpen = openGroups[group.header] ?? containsActive;

        return (
          <List key={group.header} disablePadding>
            <ListItemButton
              onClick={() => toggleGroup(group.header)}
              sx={{
                px: 2,
                py: 1,
                "&:hover": { backgroundColor: "#374151" },
                borderRadius: "8px",
                mx: 1,
                mb: 0.5,
              }}
            >
              <ListItemIcon sx={{ color: "#9CA3AF", minWidth: 36 }}>
                {group.icon}
              </ListItemIcon>
              {hovered && (
                <ListItemText
                  primary={group.header}
                  primaryTypographyProps={{
                    sx: { fontSize: 13, fontWeight: 600, letterSpacing: 0.5 },
                  }}
                />
              )}
              {hovered &&
                (isOpen ? (
                  <ExpandLess sx={{ fontSize: 20, color: "#9CA3AF" }} />
                ) : (
                  <ExpandMore sx={{ fontSize: 20, color: "#9CA3AF" }} />
                ))}
            </ListItemButton>

            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              {visibleItems.map((item) => {
                const active = isPathActive(location.pathname, item.path);
                return (
                  <Tooltip
                    key={item.text}
                    title={!hovered ? item.text : ""}
                    placement="right"
                  >
                    <ListItemButton
                      onClick={() => navigate(item.path)}
                      sx={{
                        pl: hovered ? 4 : 2,
                        pr: 2,
                        py: 0.8,
                        mx: 1,
                        mb: 0.5,
                        borderRadius: "8px",
                        backgroundColor: active ? "#2563EB" : "transparent",
                        "&:hover": {
                          backgroundColor: "#2563EB",
                          transform: "scale(1.03)",
                        },
                        transition: "all 0.25s ease-in-out",
                      }}
                    >
                      <ListItemIcon sx={{ color: "#fff", minWidth: 36 }}>
                        {item.icon}
                      </ListItemIcon>
                      {hovered && <ListItemText primary={item.text} />}
                    </ListItemButton>
                  </Tooltip>
                );
              })}
            </Collapse>
          </List>
        );
      })}

      <div style={{ flexGrow: 1 }} />

      <List>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            mx: 1,
            mb: 2,
            borderRadius: "12px",
            py: 1,
            "&:hover": {
              backgroundColor: "#EF4444",
              transform: "scale(1.02)",
            },
            transition: "all 0.25s ease-in-out",
          }}
        >
          <ListItemIcon sx={{ color: "#fff", minWidth: 36 }}>
            <LogoutIcon />
          </ListItemIcon>
          {hovered && <ListItemText primary="Logout" />}
        </ListItemButton>
      </List>
    </Drawer>
  );
}
