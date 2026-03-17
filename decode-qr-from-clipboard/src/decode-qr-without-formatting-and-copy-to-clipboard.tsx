import { Action, ActionPanel, Clipboard, Detail, Icon, Toast, showToast } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";

import { decodeFirstQrCodeFromClipboard } from "./qr-from-clipboard";

type ScanState =
  | { status: "loading" }
  | { status: "success"; decodedValue: string }
  | { status: "error"; message: string };

export default function Command() {
  const [scanState, setScanState] = useState<ScanState>({ status: "loading" });

  const runScan = useCallback(async () => {
    setScanState({ status: "loading" });

    try {
      const decodedValue = await decodeFirstQrCodeFromClipboard();

      await Clipboard.copy(decodedValue);
      await showToast({
        style: Toast.Style.Success,
        title: "QR code copied to clipboard",
      });

      setScanState({ status: "success", decodedValue });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";

      await showToast({
        style: Toast.Style.Failure,
        title: "Could not decode QR code",
        message,
      });

      setScanState({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const markdown = useMemo(() => renderMarkdown(scanState), [scanState]);

  return (
    <Detail
      isLoading={scanState.status === "loading"}
      markdown={markdown}
      actions={
        <ActionPanel>
          {scanState.status === "success" ? (
            <>
              <Action.CopyToClipboard title="Copy Result" content={scanState.decodedValue} />
              {isSupportedUrl(scanState.decodedValue) ? (
                <Action.OpenInBrowser title="Open Result in Browser" url={scanState.decodedValue} />
              ) : null}
            </>
          ) : null}
          <Action title="Scan Again" icon={Icon.ArrowClockwise} onAction={() => void runScan()} />
        </ActionPanel>
      }
    />
  );
}

function renderSuccessMarkdown(decodedValue: string): string {
  return `# QR Code Copied

The first QR code from the clipboard image was decoded and copied back as plain text.

## Result

${asBlockquote(decodedValue)}

## Next Step

- Press \`Enter\` to copy the value again.
- Use the action panel to open it in your browser when the result is a URL.
- Run the command again after copying a new image.`;
}

function renderErrorMarkdown(message: string): string {
  return `# Decode Failed

${asBlockquote(message)}

## What to Try

${renderRecoverySteps(message)}`;
}

function renderMarkdown(scanState: ScanState): string {
  switch (scanState.status) {
    case "loading":
      return `# Decode QR from Clipboard

Copy an image that contains a QR code, then wait while the command scans it.

The decoded text will be copied to the clipboard automatically when a QR code is found.`;
    case "success":
      return renderSuccessMarkdown(scanState.decodedValue);
    case "error":
      return renderErrorMarkdown(scanState.message);
  }
}

function asBlockquote(value: string): string {
  return value
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function renderRecoverySteps(message: string): string {
  if (message.includes("No image found")) {
    return [
      "- Copy an image to the clipboard.",
      "- Make sure the clipboard contains an image, not a file or plain text.",
      "- Run the command again.",
    ].join("\n");
  }

  if (message.includes("No QR code found")) {
    return [
      "- Make sure the image contains a visible QR code.",
      "- Try a sharper image with better contrast.",
      "- If there are multiple codes, crop the image down to the one you need and scan again.",
    ].join("\n");
  }

  return [
    "- Try copying the image again.",
    "- Run the command once more.",
    "- If the issue persists, test with a different QR image.",
  ].join("\n");
}

function isSupportedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
