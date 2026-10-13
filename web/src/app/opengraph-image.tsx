import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";

export const alt = "Lunetta — keep watch over the drifting isles";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(180deg, #12142B 0%, #1C2052 60%, #2E3274 100%)",
          color: "#F3ECDC",
          position: "relative",
        }}
      >
        {/* crescent moon */}
        <div style={{ position: "absolute", right: 110, top: 90, width: 260, height: 260, borderRadius: 999, background: "#F3ECDC", display: "flex" }} />
        <div style={{ position: "absolute", right: 60, top: 60, width: 240, height: 240, borderRadius: 999, background: "#1C2052", display: "flex" }} />
        <div
          style={{
            position: "absolute",
            right: 120,
            bottom: 70,
            width: 380,
            height: 56,
            borderRadius: 999,
            background: "#5DCAA5",
            border: "5px solid #12142B",
            display: "flex",
          }}
        />
        {[
          [90, 70], [300, 120], [520, 60], [700, 150], [180, 520], [620, 540],
        ].map(([x, y], i) => (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 10, height: 10, borderRadius: 99, background: i % 2 ? "#F2C94C" : "#F3ECDC", display: "flex" }} />
        ))}
        <div style={{ display: "flex", fontSize: 30, color: "#F2C94C", fontWeight: 700 }}>A hand-drawn NFT adventure</div>
        <div style={{ display: "flex", fontSize: 128, fontWeight: 800, letterSpacing: -4, marginTop: 10 }}>Lunetta</div>
        <div style={{ display: "flex", fontSize: 44, maxWidth: 640, lineHeight: 1.2, marginTop: 10 }}>{siteConfig.tagline}</div>
      </div>
    ),
    size,
  );
}
