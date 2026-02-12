import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";

export interface AnalysisResult {
  summary: string;
  badEvent: boolean;
  reason: string;
  confidence: number;
}

interface ResultsCardProps {
  result: AnalysisResult;
}

export function ResultsCard({ result }: ResultsCardProps) {
  const isBad = result.badEvent;
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`w-full rounded-lg border p-6 ${
        isBad
          ? "border-destructive/50 bg-destructive/5"
          : "border-success/50 bg-success/5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        {isBad ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15">
            <ShieldCheck className="h-6 w-6 text-success" />
          </div>
        )}
        <div>
          <h3 className="font-mono text-lg font-semibold text-foreground">
            {isBad ? "Harmful Event Detected" : "No Harmful Event"}
          </h3>
          <p className="text-xs text-muted-foreground font-mono">
            Confidence: {confidencePct}%
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Event Summary
          </label>
          <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
        </div>

        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Reason
          </label>
          <p className="text-sm text-foreground/90">{result.reason}</p>
        </div>

        {/* Confidence bar */}
        <div>
          <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Confidence Score
          </label>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidencePct}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                className={`h-full rounded-full ${isBad ? "bg-destructive" : "bg-success"}`}
              />
            </div>
            <span className="font-mono text-sm font-semibold text-foreground">
              {confidencePct}%
            </span>
          </div>
        </div>
      </div>

      {isBad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-5 flex items-center gap-2 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          This video may contain harmful or dangerous content. Review recommended.
        </motion.div>
      )}
    </motion.div>
  );
}
