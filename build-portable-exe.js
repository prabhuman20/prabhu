/**
 * Automatic Portable Windows .EXE Builder Generator for Prabhu's Banana
 *
 * Run: `node build-portable-exe.js`
 *
 * Generates:
 * 1. `Prabhus-Banana.html` & `public/Prabhus-Banana-SingleFile.html` (Standalone single-file HTML game)
 * 2. `Build-Prabhus-Banana-EXE.bat` & `public/Build-Prabhus-Banana-EXE.bat`
 *    A 100% self-contained Windows Batch + .NET C# compiler script that automatically builds
 *    a standalone single-file `Prabhus-Banana-Portable.exe` on any Windows 10/11 PC (using
 *    Windows' pre-installed `csc.exe`) with the entire 3D game & custom Banana icon embedded inside!
 */

import fs from 'fs';
import zlib from 'zlib';
import esbuild from 'esbuild';
import { execSync } from 'child_process';

function createIcoFromPng(pngBuffer) {
  // ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) + PNG payload
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image
  header.writeUInt8(192, 6);  // Width
  header.writeUInt8(192, 7);  // Height
  header.writeUInt8(0, 8);    // Color palette
  header.writeUInt8(0, 9);    // Reserved
  header.writeUInt16LE(1, 10); // Color planes
  header.writeUInt16LE(32, 12); // Bits per pixel
  header.writeUInt32LE(pngBuffer.length, 14); // Size of image data
  header.writeUInt32LE(22, 18); // Offset of image data
  return Buffer.concat([header, pngBuffer]);
}

async function main() {
  console.log("1. Building production assets via Vite...");
  execSync("npx vite build", { stdio: "inherit" });

  const distFiles = fs.readdirSync("dist/assets");
  const jsFile = distFiles.find((f) => f.endsWith(".js"));
  const cssFile = distFiles.find((f) => f.endsWith(".css"));
  const fullJsCode = fs.readFileSync("dist/assets/" + jsFile, "utf8");
  const cssCode = cssFile ? fs.readFileSync("dist/assets/" + cssFile, "utf8") : "";
  const iconSvg = fs.readFileSync("public/icon.svg", "utf8");
  const iconDataUri = "data:image/svg+xml;base64," + Buffer.from(iconSvg).toString("base64");

  // 2. Build readable single-file HTML (Prabhus-Banana.html)
  const readableBundle = await esbuild.build({
    entryPoints: ["src/main.tsx"],
    bundle: true,
    format: "esm",
    write: false,
    external: [
      "react",
      "react-dom/client",
      "three",
      "three/examples/jsm/environments/RoomEnvironment.js",
    ],
    loader: { ".css": "empty" },
  });
  const readableJs = readableBundle.outputFiles[0].text.replace(/<\/script>/gi, "<\\/script>");

  const readableHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover" />
    <title>Prabhu's Banana: Tropical Watercolor Splat (Single-File Edition)</title>
    <meta name="description" content="Prabhu's Banana — Complete Single-File 3D First-Person Tropical Watercolor Fruit Shooter." />
    <meta name="theme-color" content="#092218" />
    <link rel="icon" type="image/svg+xml" href="${iconDataUri}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>${cssCode}</style>
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.0.1",
          "react-dom/client": "https://esm.sh/react-dom@19.0.1/client",
          "three": "https://esm.sh/three@0.183.2",
          "three/examples/jsm/environments/RoomEnvironment.js": "https://esm.sh/three@0.183.2/examples/jsm/environments/RoomEnvironment.js"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${readableJs}
    </script>
  </body>
</html>`;

  fs.writeFileSync("Prabhus-Banana.html", readableHtml, "utf8");
  fs.writeFileSync("public/Prabhus-Banana.html", readableHtml, "utf8");

  // 3. Build 100% offline self-contained single-file HTML (public/Prabhus-Banana-SingleFile.html)
  const safeFullJs = fullJsCode.replace(/<\/script>/gi, "<\\/script>");
  const offlineSingleHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover" />
    <title>Prabhu's Banana: Tropical Watercolor Splat (Portable Desktop Edition)</title>
    <meta name="description" content="Prabhu's Banana — 100% Self-Contained Offline Single-File 3D First-Person Tropical Watercolor Fruit Shooter." />
    <meta name="theme-color" content="#092218" />
    <link rel="icon" type="image/svg+xml" href="${iconDataUri}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>${cssCode}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">${safeFullJs}</script>
  </body>
</html>`;

  fs.writeFileSync("public/Prabhus-Banana-SingleFile.html", offlineSingleHtml, "utf8");

  // 4. Create self-contained Windows Portable .EXE Builder Script (`Build-Prabhus-Banana-EXE.bat`)
  // Gzip-compress the offline single-file HTML so the embedded binary is only ~300 KB
  const gzippedGame = zlib.gzipSync(Buffer.from(offlineSingleHtml, "utf8"), { level: 9 });
  const gameGzBase64 = gzippedGame.toString("base64");

  const png192 = fs.readFileSync("public/pwa-192x192.png");
  const icoBuffer = createIcoFromPng(png192);
  const icoBase64 = icoBuffer.toString("base64");

  const batScript = `@echo off
setlocal EnableDelayedExpansion
title Prabhu's Banana - Automatic Portable .EXE Builder
color 0A

echo ============================================================================
echo   PRABHU'S BANANA: TROPICAL WATERCOLOR SPLAT
echo   Automatic Standalone Portable .EXE Builder (Personal Edition)
echo ============================================================================
echo.
echo [1/3] Extracting embedded 3D game engine and custom Banana icon...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lines = Get-Content -LiteralPath '%~f0'; " ^
  "$gzLine = ($lines | Where-Object { $_.StartsWith('::GAME_GZ_B64:') })[0].Substring(14); " ^
  "$icoLine = ($lines | Where-Object { $_.StartsWith('::ICON_ICO_B64:') })[0].Substring(15); " ^
  "[IO.File]::WriteAllBytes('game_payload.gz', [Convert]::FromBase64String($gzLine)); " ^
  "[IO.File]::WriteAllBytes('banana_app.ico', [Convert]::FromBase64String($icoLine));"

if not exist "game_payload.gz" (
  echo [ERROR] Could not extract game payload.
  pause
  exit /b 1
)

echo [2/3] Generating native Windows Portable Launcher C# source...

(
echo using System;
echo using System.Diagnostics;
echo using System.IO;
echo using System.IO.Compression;
echo using System.Net;
echo using System.Net.Sockets;
echo using System.Reflection;
echo using System.Threading;
echo using System.Windows.Forms;
echo.
echo [assembly: AssemblyTitle("Prabhu's Banana: Tropical Watercolor Splat")]
echo [assembly: AssemblyProduct("Prabhu's Banana Portable")]
echo [assembly: AssemblyVersion("1.0.0.0")]
echo.
echo class PrabhusBananaPortable {
echo     [STAThread]
echo     static void Main^(^) {
echo         try {
echo             byte[] htmlBytes;
echo             using ^(Stream res = Assembly.GetExecutingAssembly^(^).GetManifestResourceStream^("game_payload.gz"^)^)
echo             using ^(GZipStream gz = new GZipStream^(res, CompressionMode.Decompress^)^)
echo             using ^(MemoryStream ms = new MemoryStream^(^)^) {
echo                 gz.CopyTo^(ms^);
echo                 htmlBytes = ms.ToArray^(^);
echo             }
echo.
echo             // Start lightweight local loopback server on 127.0.0.1 so WebGL, PointerLock & Audio have full origin permissions
echo             TcpListener listener = new TcpListener^(IPAddress.Loopback, 0^);
echo             listener.Start^(^);
echo             int port = ^(^((IPEndPoint^)listener.LocalEndpoint^)^).Port;
echo             string url = "http://127.0.0.1:" + port + "/";
echo.
echo             Thread serverThread = new Thread^(() =^> {
echo                 while ^(true^) {
echo                     try {
echo                         using ^(TcpClient client = listener.AcceptTcpClient^(^)^)
echo                         using ^(NetworkStream stream = client.GetStream^(^)^) {
echo                             byte[] reqBuf = new byte[1024];
echo                             stream.Read^(reqBuf, 0, reqBuf.Length^);
echo                             string header = "HTTP/1.1 200 OK\\r\\nContent-Type: text/html; charset=utf-8\\r\\nContent-Length: " + htmlBytes.Length + "\\r\\nCache-Control: no-cache\\r\\nConnection: close\\r\\n\\r\\n";
echo                             byte[] headerBytes = System.Text.Encoding.UTF8.GetBytes^(header^);
echo                             stream.Write^(headerBytes, 0, headerBytes.Length^);
echo                             stream.Write^(htmlBytes, 0, htmlBytes.Length^);
echo                         }
echo                     } catch { break; }
echo                 }
echo             }^);
echo             serverThread.IsBackground = true;
echo             serverThread.Start^(^);
echo.
echo             // Launch dedicated chromeless app window via Edge or Chrome
echo             string[] browsers = new string[] {
echo                 Path.Combine^(Environment.GetFolderPath^(Environment.SpecialFolder.ProgramFilesX86^), "Microsoft\\Edge\\Application\\msedge.exe"^),
echo                 Path.Combine^(Environment.GetFolderPath^(Environment.SpecialFolder.ProgramFiles^), "Microsoft\\Edge\\Application\\msedge.exe"^),
echo                 Path.Combine^(Environment.GetFolderPath^(Environment.SpecialFolder.ProgramFiles^), "Google\\Chrome\\Application\\chrome.exe"^),
echo                 Path.Combine^(Environment.GetFolderPath^(Environment.SpecialFolder.ProgramFilesX86^), "Google\\Chrome\\Application\\chrome.exe"^)
echo             };
echo.
echo             string browserExe = null;
echo             foreach ^(string candidate in browsers^) {
echo                 if ^(File.Exists^(candidate^)^) { browserExe = candidate; break; }
echo             }
echo.
echo             if ^(browserExe != null^) {
echo                 string profileDir = Path.Combine^(Path.GetTempPath^(^), "PrabhusBananaPortableProfile"^);
echo                 ProcessStartInfo psi = new ProcessStartInfo^(browserExe, "--app=" + url + " --window-size=1366,840 --user-data-dir=\\"" + profileDir + "\\" --no-first-run --disable-extensions"^);
echo                 psi.UseShellExecute = false;
echo                 Process proc = Process.Start^(psi^);
echo                 if ^(proc != null^) proc.WaitForExit^(^);
echo             } else {
echo                 Process.Start^(url^);
echo                 Thread.Sleep^(600000^);
echo             }
echo             listener.Stop^(^);
echo         } catch ^(Exception ex^) {
echo             MessageBox.Show^("Error launching Prabhu's Banana: " + ex.Message, "Prabhu's Banana Portable", MessageBoxButtons.OK, MessageBoxIcon.Error^);
echo         }
echo     }
echo }
) > Launcher.cs

echo [3/3] Compiling standalone Prabhus-Banana-Portable.exe using built-in Windows .NET compiler...

set "CSC_PATH=%SystemRoot%\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
if not exist "%CSC_PATH%" set "CSC_PATH=%SystemRoot%\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"

"%CSC_PATH%" /nologo /target:winexe /optimize+ /out:"Prabhus-Banana-Portable.exe" /win32icon:"banana_app.ico" /resource:"game_payload.gz,game_payload.gz" Launcher.cs

del /q Launcher.cs game_payload.gz banana_app.ico >nul 2>&1

if exist "Prabhus-Banana-Portable.exe" (
  echo.
  echo ============================================================================
  echo   SUCCESS! Created standalone portable executable:
  echo   --^> %CD%\\Prabhus-Banana-Portable.exe
  echo.
  echo   You can copy Prabhus-Banana-Portable.exe anywhere ^(Desktop, USB drive^)
  echo   and double-click it to play offline! Launching game now...
  echo ============================================================================
  start "" "Prabhus-Banana-Portable.exe"
) else (
  echo [ERROR] Compilation failed.
  pause
)
exit /b 0

::ICON_ICO_B64:${icoBase64}
::GAME_GZ_B64:${gameGzBase64}
`;

  // Convert LF to CRLF for Windows .bat compatibility
  const batCrlf = batScript.replace(/\r?\n/g, "\r\n");
  fs.writeFileSync("Build-Prabhus-Banana-EXE.bat", batCrlf, "utf8");
  fs.writeFileSync("public/Build-Prabhus-Banana-EXE.bat", batCrlf, "utf8");

  console.log(
    "Successfully generated Build-Prabhus-Banana-EXE.bat (" +
      Math.round(batCrlf.length / 1024) +
      " KB)!"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
