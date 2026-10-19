import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { BrumeMascot } from "@/components/BrumeMascot";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-calm-gradient flex items-center justify-center px-6">
      <div className="text-center space-y-4 max-w-sm">
        <BrumeMascot state="sleepy" size={88} className="mx-auto" />
        <h1 className="text-3xl font-bold tracking-tight">This page isn't here.</h1>
        <p className="text-muted-foreground">
          Tap how you feel. Brume picks the breath.
        </p>
        <Link
          to="/"
          className="inline-block font-medium text-primary hover:underline underline-offset-2"
        >
          Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
