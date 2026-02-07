# Add Your Custom Excalidraw Library

To use your own library elements instead of just rectangles and triangles:

## 1. Create or find an Excalidraw library

- Create a `.excalidrawlib` file (from [libraries.excalidraw.com](https://libraries.excalidraw.com))
- Or host your library on GitHub, jsdelivr, or unpkg

## 2. Add your library URL to env

In `.env.local` add:

```env
NEXT_PUBLIC_EXCALIDRAW_EXTRA_LIBRARY_URLS=https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main/your-library.excalidrawlib
```

For multiple libraries, use commas:

```env
NEXT_PUBLIC_EXCALIDRAW_EXTRA_LIBRARY_URLS=https://example.com/lib1.excalidrawlib,https://example.com/lib2.excalidrawlib
```

## 3. Allowed hosts

The app fetches libraries from: `raw.githubusercontent.com`, `api.libraries.excalidraw.com`, `cdn.jsdelivr.net`, `unpkg.com`, `github.com`.

## 4. Reset library cache

If you changed the URL, reset the Excalidraw library: open Excalidraw → click "Reset library" in the top-right. This clears the cached items and reloads (including your new URL).
