import { reducedMotion } from "@/lib/motion";

/** A one-off burst of sparks at a screen point; `launch` adds a streak shooting upward. */
export function sparkBurst(x: number, y: number, { launch = false, count = 12 } = {}) {
  if (reducedMotion()) return;
  const host = document.createElement("div");
  host.className = "ng-burst";
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement("i");
    spark.style.setProperty("--a", `${(360 / count) * i + Math.random() * 20}deg`);
    spark.style.setProperty("--d", `${48 + Math.random() * 56}px`);
    host.append(spark);
  }
  if (launch) host.append(document.createElement("b"));
  document.body.append(host);
  window.setTimeout(() => host.remove(), 1300);
}
