"use client";

import { useEffect, useState } from "react";

/**
 * The footer's time tile. The server cannot know the minute the page is read, so the time arrives
 * on the client; until then the tile shows the zone only, which is true either way.
 */
export function LocalTime() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const read = () =>
      setTime(
        new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }).format(new Date())
      );
    read();
    const timer = window.setInterval(read, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return <p className="num lead">{time ? `${time} WIB` : "WIB"}</p>;
}
