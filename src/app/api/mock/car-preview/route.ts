import { NextResponse } from "next/server";

/**
 * Dev-only preview of the car marker, both themes side by side, so the
 * artwork can be checked without a GPS fix. Open /api/mock/car-preview.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { createDriverCarIcon } = await import("@/components/trips/driverCarIcon");
  const light = createDriverCarIcon({ heading: 35, night: false }).options.html as string;
  const dark = createDriverCarIcon({ heading: 35, night: true }).options.html as string;

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Car marker preview</title>
<link rel="stylesheet" href="/_next/static/css/app/layout.css">
<style>body{margin:0;display:grid;grid-template-columns:1fr 1fr;min-height:100vh;font-family:system-ui}
.cell{display:flex;align-items:center;justify-content:center;position:relative}
.light{background:#e9eef3}.dark{background:#0d1117}
.car-marker{position:relative;width:96px;height:96px;transform:scale(2.4)}</style></head>
<body><div class="cell light"><div class="car-marker">${light}</div></div>
<div class="cell dark"><div class="car-marker car-marker--night">${dark}</div></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
