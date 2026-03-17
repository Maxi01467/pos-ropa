import type { CSSProperties } from "react";

const containerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, rgb(17,24,39) 0%, rgb(31,41,55) 45%, rgb(220,38,38) 100%)",
  color: "white",
  fontWeight: 800,
  letterSpacing: "-0.08em",
};

const badgeStyle: CSSProperties = {
  width: "76%",
  height: "76%",
  borderRadius: "22%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.12)",
  border: "6px solid rgba(255,255,255,0.2)",
  boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
};

export function PwaIcon({
  size,
  label = "POS",
}: {
  size: number;
  label?: string;
}) {
  return (
    <div style={{ ...containerStyle, fontSize: size * 0.32 }}>
      <div style={badgeStyle}>{label}</div>
    </div>
  );
}
