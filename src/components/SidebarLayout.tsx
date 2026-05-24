import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { useLang } from "../context/LanguageContext";

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const { isRtl } = useLang();

  return (
    <>
      <Sidebar />
      {/*
        Desktop (md+): push content 16rem away from the sidebar side.
        Mobile: no padding — sidebar is a drawer overlay, not a panel.
      */}
      <div
        className={`
          min-h-[calc(100vh-64px)]
          ${isRtl ? "md:pr-64" : "md:pl-64"}
        `}
      >
        {children}
      </div>
    </>
  );
}
