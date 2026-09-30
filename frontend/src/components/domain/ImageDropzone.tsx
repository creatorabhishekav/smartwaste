import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { fileSize } from "../../lib/format";

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  maxMb?: number;
  previewUrl?: string | null;
  compact?: boolean;
};

/**
 * Image picker with client-side size/type validation matching the backend's
 * /uploads/config limits (5 MB, JPEG/PNG/WEBP).
 */
export default function ImageDropzone({
  file,
  onChange,
  label = "Upload photo",
  hint,
  maxMb = 5,
  previewUrl,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(previewUrl ?? null);

  const validate = (candidate: File): string | null => {
    if (!/^image\/(jpeg|png|webp|jpg)$/i.test(candidate.type)) {
      return "Only JPG, PNG or WEBP images are accepted.";
    }
    if (candidate.size > maxMb * 1024 * 1024) {
      return `Image is ${fileSize(candidate.size)} - the limit is ${maxMb} MB.`;
    }
    return null;
  };

  const accept = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = validate(candidate);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPreview((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return URL.createObjectURL(candidate);
    });
    onChange(candidate);
  };

  const clear = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const source = preview;

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-medium text-ink-700">
          {label} <span className="text-red-500">*</span>
        </p>
      )}

      {source ? (
        <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
          <img src={source} alt="Selected evidence" className={compact ? "h-32 w-full object-cover" : "h-48 w-full object-cover"} />
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900/70 text-white transition hover:bg-ink-900"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {file && (
            <p className="absolute bottom-2 left-2 rounded bg-ink-900/70 px-2 py-0.5 text-[10px] text-white">
              {file.name} · {fileSize(file.size)}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files?.[0]);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? "border-brand-400 bg-brand-50"
              : "border-ink-200 bg-ink-50/60 hover:border-brand-300 hover:bg-brand-50/40"
          }`}
        >
          {dragging ? (
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          ) : (
            <ImagePlus className="h-5 w-5 text-ink-400" />
          )}
          <span className="text-sm font-medium text-ink-700">
            {dragging ? "Drop to upload" : "Tap to choose or drag an image here"}
          </span>
          <span className="text-xs text-ink-400">JPG, PNG or WEBP · max {maxMb} MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={(event) => accept(event.target.files?.[0])}
      />

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
