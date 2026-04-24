import { ImageResponse } from "next/og";
import { PwaIcon } from "@/lib/pwa/pwa-icon";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<PwaIcon size={180} />, {
    width: 180,
    height: 180,
  });
}
