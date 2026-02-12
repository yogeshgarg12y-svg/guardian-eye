import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, RotateCcw } from "lucide-react";
import { VideoUpload } from "@/components/VideoUpload";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { ResultsCard, AnalysisResult } from "@/components/ResultsCard";
import { extractFramesFromVideo } from "@/lib/extractFrames";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [stage, setStage] = useState<"idle" | "extracting" | "analyzing">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const processVideo = useCallback(
    async (file: File) => {
      setResult(null);
      setStage("extracting");
      setProgress(0);

      try {
        // Extract frames
        const frames = await extractFramesFromVideo(file, 16, (p) =>
          setProgress(p)
        );

        if (frames.length === 0) {
          throw new Error("Could not extract any frames from the video.");
        }

        // Analyze via edge function
        setStage("analyzing");
        setProgress(0);

        // Simulate progress during analysis
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 2, 90));
        }, 500);

        const { data, error } = await supabase.functions.invoke("analyze-video", {
          body: {
            frames: frames.map((f) => f.dataUrl),
          },
        });

        clearInterval(progressInterval);
        setProgress(100);

        if (error) throw error;

        const analysisResult: AnalysisResult = {
          summary: data.summary || "Unable to analyze.",
          badEvent: data.bad_event === true || data.bad_event === "Yes",
          reason: data.reason || "",
          confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
        };

        setResult(analysisResult);
      } catch (err: any) {
        console.error("Processing error:", err);
        toast({
          title: "Analysis Failed",
          description: err.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      } finally {
        setStage("idle");
        setProgress(0);
      }
    },
    [toast]
  );

  const reset = () => {
    setResult(null);
    setStage("idle");
    setProgress(0);
  };

  const isProcessing = stage !== "idle";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-semibold text-foreground tracking-wide">
              SENTINEL
            </h1>
            <p className="text-xs text-muted-foreground">
              AI Video Safety Analysis
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-6">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold tracking-tight text-gradient mb-2">
              Video Threat Detection
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload a video and our AI will analyze it for violence, accidents, fire, theft, and other harmful events.
            </p>
          </motion.div>

          {/* Upload */}
          {!result && (
            <VideoUpload onFileSelect={processVideo} isProcessing={isProcessing} />
          )}

          {/* Processing */}
          <AnimatePresence>
            {isProcessing && (
              <ProcessingStatus stage={stage} progress={progress} />
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <ResultsCard result={result} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={reset}
                  className="mx-auto flex items-center gap-2 rounded-lg border border-border bg-secondary px-5 py-2.5 font-mono text-sm text-foreground transition-colors hover:bg-secondary/80"
                >
                  <RotateCcw className="h-4 w-4" />
                  Analyze Another Video
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4">
        <p className="text-center font-mono text-xs text-muted-foreground">
          Powered by AI · Frames analyzed in real-time
        </p>
      </footer>
    </div>
  );
};

export default Index;
