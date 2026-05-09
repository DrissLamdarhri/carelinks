import { Outlet } from "react-router";

export function MobileShell() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "linear-gradient(145deg, #0a0a1a 0%, #0D0870 40%, #1a3a6e 100%)",
      }}
    >
      {/* Decorative glow */}
      <div
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(91,184,212,0.15) 0%, transparent 70%)",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
      <div
        className="relative flex flex-col"
        style={{
          width: 375,
          height: 812,
          borderRadius: 44,
          overflow: "hidden",
          border: "8px solid #1a1a1a",
          boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 20px 60px rgba(91,184,212,0.2)",
          background: "#EDE5CC",
        }}
      >
        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a]"
          style={{ width: 120, height: 28, borderRadius: "0 0 16px 16px" }}
        />
        {/* Content — fills full 812px */}
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}