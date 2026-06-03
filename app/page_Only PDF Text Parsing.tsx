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
  const [status, setStatus] = useState("Ready to upload a PDF article.");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setStatus("Reading PDF and extracting full text...");
      setText("");
      setFileName(file.name);
      setPageCount(0);
      setCharCount(0);

      const pdfjsLib = await loadPdfJs();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      let fullText = "";

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        setStatus(`Reading page ${pageNo} of ${pdf.numPages}...`);

        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) => item.str || "")
          .join(" ");

        fullText += `\n\n===== PAGE ${pageNo} =====\n\n${pageText}`;
      }

      setText(fullText);
      setPageCount(pdf.numPages);
      setCharCount(fullText.length);
      setStatus("PDF parsing completed successfully.");
    } catch (error: any) {
      console.error(error);
      setStatus(`PDF parsing failed: ${error?.message || String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function downloadTxt() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName || "parsed-pdf"}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f4f7fb 0%, #e8eef7 100%)",
        fontFamily:
          "Inter, Arial, Helvetica, sans-serif",
        color: "#1f2937",
        padding: "40px",
      }}
    >
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: "34px 38px",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
            border: "1px solid #e5e7eb",
            marginBottom: 28,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#2563eb",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontSize: 13,
            }}
          >
            COST Action INFLAMomx · CA24166
          </p>

          <h1
            style={{
              margin: "12px 0 8px",
              fontSize: 34,
              lineHeight: 1.2,
              color: "#0f172a",
            }}
          >
            Text Mining for Inflammaging Research:
            <br />
            Tools, Datasets, and Knowledge Hub
          </h1>

          <h2
            style={{
              margin: "10px 0 0",
              fontSize: 22,
              fontWeight: 600,
              color: "#334155",
            }}
          >
            Algorithmic Methods for Text Mining: PDF Parser
          </h2>

          <p
            style={{
              marginTop: 18,
              maxWidth: 850,
              lineHeight: 1.7,
              color: "#475569",
              fontSize: 15,
            }}
          >
            Upload a scientific PDF article to extract full text locally in the browser.
            The next stage will extend this parser into section-based evidence extraction
            for inflammaging, omics, biomarkers, pathways, and deposited data accessions.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 18,
            marginBottom: 28,
          }}
        >
          <div style={cardStyle}>
            <p style={labelStyle}>File</p>
            <p style={valueStyle}>{fileName || "No file uploaded"}</p>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Pages</p>
            <p style={valueStyle}>{pageCount || "-"}</p>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Extracted Characters</p>
            <p style={valueStyle}>{charCount || "-"}</p>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: 28,
            border: "1px solid #e5e7eb",
            boxShadow: "0 14px 35px rgba(15, 23, 42, 0.06)",
            marginBottom: 28,
          }}
        >
          <h3
            style={{
              marginTop: 0,
              color: "#0f172a",
              fontSize: 20,
            }}
          >
            Upload PDF Article
          </h3>

          <div
            style={{
              border: "2px dashed #cbd5e1",
              borderRadius: 16,
              padding: 28,
              background: "#f8fafc",
              textAlign: "center",
            }}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFile}
              disabled={isLoading}
              style={{
                padding: 12,
                background: "#ffffff",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                cursor: "pointer",
              }}
            />

            <p
              style={{
                marginTop: 16,
                color: isLoading ? "#2563eb" : "#475569",
                fontWeight: 600,
              }}
            >
              {status}
            </p>

            {text && (
              <button
                onClick={downloadTxt}
                style={{
                  marginTop: 12,
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Download Extracted Text
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: 28,
            border: "1px solid #e5e7eb",
            boxShadow: "0 14px 35px rgba(15, 23, 42, 0.06)",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 14,
              color: "#0f172a",
              fontSize: 20,
            }}
          >
            Extracted Full Text
          </h3>

          <textarea
            value={text}
            readOnly
            placeholder="The extracted PDF text will appear here..."
            style={{
              width: "100%",
              height: "560px",
              padding: 18,
              borderRadius: 14,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              color: "#111827",
              fontFamily: "Consolas, Menlo, monospace",
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 16,
  padding: "20px 22px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
};

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const valueStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 700,
  wordBreak: "break-word",
};