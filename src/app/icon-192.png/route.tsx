import { ImageResponse } from "next/og";
import { PwaIcon } from "@/lib/pwa/pwa-icon";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<PwaIcon size={192} />, {
    width: 192,
    height: 192,
  });
}
