import { ImageResponse } from "next/og";
import { PwaIcon } from "@/lib/pwa-icon";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<PwaIcon size={512} />, {
    width: 512,
    height: 512,
  });
}
