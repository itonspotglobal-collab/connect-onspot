import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Recording stays local until the user submits; failures do not discard the file. */
export function ApplicationVideoRecorder({ onFile, disabled = false }: {
  onFile: (file: File) => void; disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const previewUrl = useRef("");
  const mounted = useRef(true);
  const busy = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();
  const release = () => {
    clearTimeout(stopTimer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (liveVideo.current) liveVideo.current.srcObject = null;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  const start = async () => {
    if (busy.current || disabled) return;
    busy.current = true;
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Recording is not supported by this browser. Please upload a video file.");
      }
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        .find(value => MediaRecorder.isTypeSupported(value));
      if (!type) throw new Error("This browser cannot record a supported format. Please upload a video file.");
      const current = new MediaRecorder(media, { mimeType: type });
      recorder.current = current;
      const chunks: Blob[] = [];
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      current.onerror = () => {
        release();
        if (mounted.current) { setError("Recording failed. Please record again or upload a file."); setRecording(false); }
      };
      current.onstop = () => {
        release();
        if (!mounted.current) return;
        setRecording(false);
        const mime = current.mimeType.split(";")[0];
        const file = new File(chunks, `application-introduction.${mime === "video/mp4" ? "mp4" : "webm"}`, { type: mime });
        if (!file.size) { setError("The recording was empty. Please try again."); return; }
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = URL.createObjectURL(file);
        setPreview(previewUrl.current);
        onFile(file);
      };
      current.start(1000);
      setRecording(true);
      stopTimer.current = setTimeout(() => { if (current.state === "recording") current.stop(); }, 120000);
      if (liveVideo.current) liveVideo.current.srcObject = media;
    } catch (cause: any) {
      release();
      if (mounted.current) setError(cause.message || "Camera or microphone access failed. Please upload a video file.");
    } finally { busy.current = false; }
  };
  return <div className="mt-3 space-y-2">
    <video ref={liveVideo} autoPlay muted playsInline hidden={!recording} className="w-full rounded-lg" aria-label="Live recording preview" />
    {!recording && preview && <video src={preview} controls playsInline className="w-full rounded-lg" aria-label="Recorded introduction preview" />}
    <Button type="button" variant="outline" disabled={disabled}
      onClick={() => recording ? recorder.current?.stop() : void start()}>
      {recording ? "Stop recording" : preview ? "Record again" : "Record a video introduction"}
    </Button>
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
  </div>;
}
