import { Link } from "react-router-dom";
import { BrumeMascot } from "@/components/BrumeMascot";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-calm-gradient flex items-center justify-center px-6">
      <div className="text-center space-y-4 max-w-sm">
        <BrumeMascot state="sleepy" size={88} className="mx-auto" layoutId="brume-companion" />
        <h1 className="text-3xl font-bold tracking-tight">This page isn't here.</h1>
        <p className="text-muted-foreground">
          Nothing is lost. Brume is back this way.
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
