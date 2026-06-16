import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Sign out after `minutes` of user inactivity. */
export function useIdleTimeout(minutes = 30, onTimeout?: () => void) {
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ms = minutes * 60 * 1000;

    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        toast.error("Session expired for security.");
        await supabase.auth.signOut();
        onTimeout?.();
      }, ms);
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [minutes, onTimeout]);
}
