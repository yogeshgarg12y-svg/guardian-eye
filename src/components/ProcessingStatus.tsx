import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ProcessingStatusProps {
  stage: "extracting" | "analyzing" | "idle";
  progress: number;
}

const stageLabels = {
  idle: "Ready",
  extracting: "Extracting frames…",
  analyzing: "AI analyzing video…",
};

export function ProcessingStatus({ stage, progress }: ProcessingStatusProps) {
  if (stage === "idle") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="w-full rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="font-mono text-sm text-primary">
          {stageLabels[stage]}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{ boxShadow: "0 0 10px hsl(185 100% 50% / 0.5)" }}
        />
      </div>
      <p className="mt-2 text-right font-mono text-xs text-muted-foreground">
        {Math.round(progress)}%
      </p>
    </motion.div>
  );
}
