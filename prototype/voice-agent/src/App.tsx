import { Navigate, Route, Routes } from "react-router-dom";
import Home from "@/features/home/Home";
import MobileChat from "@/features/chat/MobileChat";
import MobileStats from "@/features/stats/MobileStats";
import MobileSettings from "@/features/settings/MobileSettings";
import DesktopChat from "@/features/chat/DesktopChat";
import DesktopRuntime from "@/features/runtime/DesktopRuntime";
import DesktopTools from "@/features/tools/DesktopTools";
import DesktopStats from "@/features/stats/DesktopStats";
import TerminalConsole from "@/features/terminal/TerminalConsole";
import DemoPanel from "@/demo/panel";

export default function App() {
  return (
    <div className="min-h-full">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/m/chat" element={<MobileChat />} />
        <Route path="/m/stats" element={<MobileStats />} />
        <Route path="/m/settings" element={<MobileSettings />} />
        <Route path="/d/chat" element={<DesktopChat />} />
        <Route path="/d/runtime" element={<DesktopRuntime />} />
        <Route path="/d/tools" element={<DesktopTools />} />
        <Route path="/d/stats" element={<DesktopStats />} />
        <Route path="/t/console" element={<TerminalConsole />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DemoPanel />
    </div>
  );
}
