import { Clipboard, Detail, Toast, showToast } from "@raycast/api";
import { useEffect, useState } from "react";

import { decodeFirstQrCodeFromClipboard } from "./qr-from-clipboard";

const loadingMarkdown = `# Decode QR from Clipboard

Reading an image from the clipboard and scanning it for a QR code...`;

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [markdown, setMarkdown] = useState(loadingMarkdown);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      try {
        const decodedValue = await decodeFirstQrCodeFromClipboard();

        await Clipboard.copy(decodedValue);
        await showToast({
          style: Toast.Style.Success,
          title: "QR code copied to clipboard",
        });

        if (isMounted) {
          setMarkdown(renderSuccessMarkdown(decodedValue));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error.";

        await showToast({
          style: Toast.Style.Failure,
          title: "Could not decode QR code",
          message,
        });

        if (isMounted) {
          setMarkdown(renderErrorMarkdown(message));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, []);

  return <Detail isLoading={isLoading} markdown={markdown} />;
}

function renderSuccessMarkdown(decodedValue: string): string {
  return `# QR Code Copied

The decoded QR value was copied back to the clipboard as plain text.

## Result

${asBlockquote(decodedValue)}`;
}

function renderErrorMarkdown(message: string): string {
  return `# Decode Failed

${asBlockquote(message)}`;
}

function asBlockquote(value: string): string {
  return value
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}
