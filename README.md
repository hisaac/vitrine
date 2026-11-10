# Vitrine

A quiet desktop art frame built with Tauri 2, Rust, and vanilla TypeScript. Choose a local folder and let its images cycle on a black background, fitted without cropping.

## Run

Install Node.js 22.18+ (or a newer supported release), pnpm, Rust, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). `mise.toml` provides the development tools if you use mise.

```sh
pnpm install
pnpm tauri dev
```

`pnpm dev` previews the interface in a browser; choosing a local folder requires the desktop app.

## Playback

- Choose a folder using the native picker. Vitrine remembers the folder, interval, and order on this computer and reopens it on launch.
- Images are fitted in full, preserving their aspect ratio. Toggle fullscreen with **F** or the toolbar; **Esc** exits fullscreen.
- The default interval is 30 seconds; choose any whole number from 1 to 3,600 seconds.
- Filename order sorts numbers naturally (`photo2` before `photo10`). Shuffle creates a random order that repeats after every image has appeared; selecting Shuffle again after switching to Filename creates a new order.
- **Space** pauses/resumes. **Left/Right** move between images. Keyboard input in settings fields retains its normal behavior.
- Controls and the cursor fade after three seconds without interaction during playback. Moving the pointer or using the keyboard brings them back; focused or hovered controls stay visible.
- JPEG, PNG, WebP, GIF, AVIF, and BMP files are included. Browser decoding support varies by operating system; unreadable files are skipped, with a count in the toolbar. GIFs may animate, using the same slideshow interval.
- Only files directly inside the selected folder are included. Hidden files, symlinks, and subfolders are excluded. Choose the folder again to refresh its contents.

Vitrine reads artwork without modifying it. Local asset access starts empty and is granted to the scanned image paths. Settings are stored locally in the app's webview storage; artwork is not uploaded.

## Checks and builds

```sh
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
pnpm tauri build
```

The JavaScript tests exercise ordering, shuffle, settings recovery, playback timing, keyboard controls, and bad-image handling. Rust tests exercise directory scanning. The UI tests simulate native IPC and image loading; they do not substitute for native platform checks.

Build on each target operating system. This first version has been built and manually exercised on macOS; Windows and Linux native validation is still outstanding. Distribution signing/notarization is not configured.

## Code map

- `src/main.ts`: viewer, image preloading, timers, controls, and saved settings.
- `src/playback.ts`: playlist ordering and settings validation.
- `src-tauri/src/album.rs`: local image discovery.
- `src-tauri/src/lib.rs`: native folder picker, commands, and image asset access.
- `index.html` / `src/styles.css`: interface and presentation.

Video, shaders, recursive folders, live folder watching, and keeping the display awake are outside this first version. Each is a possible next step; the playlist and image presentation are kept separate so playback can grow.
