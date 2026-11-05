import { useEffect, useState } from "react";
// Narrow viewport, not "has a touchscreen" — touch laptops and iPads in
// landscape must keep the desktop chrome.
const MOBILE_MQ = "(max-width: 767px)";

function computeIsMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_MQ).matches;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(computeIsMobile);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener("change", check);
    window.addEventListener("orientationchange", check);
    return () => {
      mq.removeEventListener("change", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  return isMobile;
}
