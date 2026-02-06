/**
 * Upload a file to the API with progress tracking.
 * Uses XMLHttpRequest for upload progress (fetch does not support it).
 */

export type UploadProgressResult =
  | { ok: true; url: string; key?: string }
  | { ok: false; error: string };

export function uploadWithProgress(
  file: File,
  url: string,
  folder: string,
  onProgress: (loaded: number, total: number) => void
): Promise<UploadProgressResult> {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded, e.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url?: string; key?: string };
          resolve({ ok: true, url: data.url ?? "", key: data.key });
        } catch {
          resolve({ ok: false, error: "Invalid response" });
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          resolve({ ok: false, error: data.error ?? "Upload failed" });
        } catch {
          resolve({ ok: false, error: `Upload failed (${xhr.status})` });
        }
      }
    };

    xhr.onerror = () => resolve({ ok: false, error: "Network error" });
    xhr.ontimeout = () => resolve({ ok: false, error: "Upload timed out" });

    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.timeout = 120000; // 2 min for large files
    xhr.send(formData);
  });
}
