"use client";

import { useState } from "react";

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/pdf.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("pdf.min.js yüklenemedi"));
    document.body.appendChild(script);
  });

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  return window.pdfjsLib;
}

export default function Page() {
  const [status, setStatus] = useState("PDF yükleyin.");
  const [text, setText] = useState("");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus("PDF okunuyor...");
      setText("");

      const pdfjsLib = await loadPdfJs();
      const buffer = await file.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      let fullText = "";

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) => item.str || "")
          .join(" ");

        fullText += `\n\n===== PAGE ${pageNo} =====\n\n${pageText}`;
      }

      setText(fullText);
      setStatus(`Tamamlandı. ${pdf.numPages} sayfa okundu. ${fullText.length} karakter çıkarıldı.`);
    } catch (error: any) {
      console.error(error);
      setStatus(`PDF parsing failed: ${error?.message || String(error)}`);
    }
  }

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <h1>INFLAMomx PDF Reader</h1>

      <input type="file" accept="application/pdf" onChange={handleFile} />

      <p>
        <b>Status:</b> {status}
      </p>

      <textarea
        value={text}
        readOnly
        style={{
          width: "100%",
          height: "600px",
          marginTop: 20,
          padding: 12,
          fontFamily: "Consolas, monospace",
        }}
      />
    </main>
  );
}