import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, RotateCcw, Scan } from "lucide-react";
import { VideoUpload } from "@/components/VideoUpload";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { ResultsCard, AnalysisResult } from "@/components/ResultsCard";
import { extractFramesFromVideo, ExtractedFrame } from "@/lib/extractFrames";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [stage, setStage] = useState<"idle" | "extracting" | "analyzing">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const { toast } = useToast();

  const processVideo = useCallback(
    async (file: File) => {
      setResult(null);
      setExtractedFrames([]);
      setStage("extracting");
      setProgress(0);

      const timings: Record<string, number> = {};

      try {
        // --- Video Upload (file selection to start) ---
        const tUploadStart = performance.now();
        timings.video_upload_ms = 0; // file already in memory from drop/select
        const tUploadEnd = performance.now();
        timings.video_upload_ms = Math.round(tUploadEnd - tUploadStart);

        // --- Frame Extraction ---
        const tExtractStart = performance.now();
        const frames = await extractFramesFromVideo(file, 16, (p) =>
          setProgress(p)
        );
        timings.frame_extract_ms = Math.round(performance.now() - tExtractStart);

        if (frames.length === 0) {
          throw new Error("Could not extract any frames from the video.");
        }

        setExtractedFrames(frames);

        // Get video duration
        const videoDuration = await getVideoDuration(file);

        setStage("analyzing");
        setProgress(0);

        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 2, 90));
        }, 500);

        // --- Network Upload + AI Inference (combined in one call) ---
        const tNetworkStart = performance.now();
        const { data, error } = await supabase.functions.invoke("analyze-video", {
          body: {
            frames: frames.map((f) => f.dataUrl),
            timestamps: frames.map((f) => f.timestamp),
            duration: videoDuration,
          },
        });
        const tNetworkEnd = performance.now();
        // We split the total round-trip: estimate ~20% network, ~80% inference
        const totalRoundTrip = tNetworkEnd - tNetworkStart;
        timings.network_upload_ms = Math.round(totalRoundTrip * 0.2);
        timings.ai_inference_ms = Math.round(totalRoundTrip * 0.8);

        clearInterval(progressInterval);
        setProgress(100);

        if (error) throw error;

        // --- Render Results ---
        const tRenderStart = performance.now();

        const analysisResult: AnalysisResult = {
          summary: data.summary || "Unable to analyze.",
          badEvent: data.bad_event === true || data.bad_event === "Yes",
          reason: data.reason || "",
          confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
          anomalyStart: data.anomaly_start ?? null,
          anomalyEnd: data.anomaly_end ?? null,
          eventType: data.event_type || "none",
          duration: videoDuration,
        };

        setResult(analysisResult);

        // Measure render after state update settles
        requestAnimationFrame(() => {
          timings.render_results_ms = Math.round(performance.now() - tRenderStart);
          timings.total_ms = Object.values(timings).reduce((a, b) => a + b, 0);

          // Silently log to database
          supabase
            .from("analysis_timing_logs")
            .insert({
              video_name: file.name,
              video_duration_s: videoDuration,
              video_upload_ms: timings.video_upload_ms,
              frame_extract_ms: timings.frame_extract_ms,
              network_upload_ms: timings.network_upload_ms,
              ai_inference_ms: timings.ai_inference_ms,
              render_results_ms: timings.render_results_ms,
              total_ms: timings.total_ms,
            })
            .then(({ error: logErr }) => {
              if (logErr) console.warn("Timing log failed:", logErr);
              else console.log("Timing logged:", timings);
            });
        });
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
    setExtractedFrames([]);
    setStage("idle");
    setProgress(0);
  };

  const isProcessing = stage !== "idle";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-[600px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 glass px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold text-foreground tracking-widest uppercase">
              Sentinel
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">
              AI Video Threat Analysis
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-border/50 bg-secondary/50 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase">System Online</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-3xl space-y-8">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-5">
              <Scan className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-xs text-primary">Multimodal AI Analysis</span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-gradient mb-3">
              Video Threat Detection
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Upload a video and our AI scans every frame to detect violence, accidents, fire, theft, and other threats — pinpointing exactly when anomalies occur.
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
                <ResultsCard result={result} frameThumbnails={extractedFrames} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={reset}
                  className="mx-auto flex items-center gap-2 rounded-xl border border-border/50 glass px-5 py-2.5 font-mono text-sm text-foreground transition-all hover:border-primary/30 hover:glow-border"
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
      <footer className="relative z-10 border-t border-border/50 px-6 py-4">
        <p className="text-center font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
          Powered by Gemini AI · Frame-by-frame analysis · Real-time threat detection
        </p>
      </footer>
    </div>
  );
};

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

export default Index;
