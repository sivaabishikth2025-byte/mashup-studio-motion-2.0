import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0714",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg,#e879f9,#8b5cf6,#22d3ee)",
            fontSize: 92,
            color: "#0b0714",
            fontWeight: 700,
          }}
        >
          ✦
        </div>
      </div>
    ),
    { ...size },
  );
}
