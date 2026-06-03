"use client";

import { useState } from "react";

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

type FigurePage = {
  page: number;
  image: string;
};

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/pdf.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("pdf.min.js could not be loaded."));
    document.body.appendChild(script);
  });

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  return window.pdfjsLib;
}

export default function Page() {
  const [status, setStatus] = useState("Ready to upload a PDF article.");
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [figurePages, setFigurePages] = useState<FigurePage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  function resetAll() {
    setStatus("Ready to upload a PDF article.");
    setFileName("");
    setText("");
    setPageCount(0);
    setCharCount(0);
    setFigurePages([]);
    setIsLoading(false);
  }

  async function renderPageAsImage(page: any): Promise<string> {
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return "";

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    return canvas.toDataURL("image/png");
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setStatus("Reading PDF and detecting pages containing figures...");
      setFileName(file.name);
      setText("");
      setPageCount(0);
      setCharCount(0);
      setFigurePages([]);

      const pdfjsLib = await loadPdfJs();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      let fullText = "";
      const detectedFigurePages: FigurePage[] = [];

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        setStatus(`Processing page ${pageNo} of ${pdf.numPages}...`);

        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();

        const pageText = (content.items as any[])
          .map((item: any) => item.str || "")
          .join(" ");

        fullText += `\n\n===== PAGE ${pageNo} =====\n\n${pageText}`;

        const hasFigure =
          /\b(Figure|Fig\.)\s*[0-9]+[A-Za-z]?\b/i.test(pageText);

        if (hasFigure) {
          const image = await renderPageAsImage(page);

          if (image) {
            detectedFigurePages.push({
              page: pageNo,
              image,
            });
          }
        }
      }

      setText(fullText);
      setPageCount(pdf.numPages);
      setCharCount(fullText.length);
      setFigurePages(detectedFigurePages);

      setStatus(
        `Completed. ${pdf.numPages} pages processed. ${detectedFigurePages.length} figure-related pages found.`
      );
    } catch (error: any) {
      console.error(error);
      setStatus(`PDF parsing failed: ${error?.message || String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function downloadText() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName || "parsed-pdf"}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main style={mainStyle}>
      <section style={containerStyle}>
        <header style={heroStyle}>
          <p style={eyebrowStyle}>COST Action INFLAMomx · CA24166</p>

          <h1 style={titleStyle}>
            Text Mining for Inflammaging Research:
            <br />
            Tools, Datasets, and Knowledge Hub
          </h1>

          <h2 style={subtitleStyle}>
            Algorithmic Methods for Text Mining: PDF Parser
          </h2>

          <p style={descriptionStyle}>
            Upload a scientific PDF article to extract full text and display only
            the pages that contain labelled figures.
          </p>

          <div style={buttonRowStyle}>
            <label style={uploadButtonStyle}>
              Upload PDF Article
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFile}
                disabled={isLoading}
                style={{ display: "none" }}
              />
            </label>

            <button onClick={resetAll} disabled={isLoading} style={resetButtonStyle}>
              Reset
            </button>
          </div>
        </header>

        <section style={statsGridStyle}>
          <div style={cardStyle}>
            <p style={labelStyle}>File</p>
            <p style={valueStyle}>{fileName || "No file uploaded"}</p>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Pages</p>
            <p style={valueStyle}>{pageCount || "-"}</p>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Characters</p>
            <p style={valueStyle}>{charCount || "-"}</p>
          </div>

          <div style={cardStyle}>
            <p style={labelStyle}>Figure Pages</p>
            <p style={valueStyle}>{figurePages.length || "-"}</p>
          </div>
        </section>

        <section style={panelStyle}>
          <p
            style={{
              margin: 0,
              fontWeight: 800,
              color: isLoading ? "#2563eb" : "#334155",
            }}
          >
            Status: {status}
          </p>

          {text && (
            <div style={buttonRowStyle}>
              <button onClick={downloadText} style={primaryButtonStyle}>
                Download Extracted Text
              </button>
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Figure Pages</h3>

          {figurePages.length === 0 ? (
            <p style={{ color: "#64748b" }}>
              No pages containing Figure/Fig. labels found yet.
            </p>
          ) : (
            <div style={figureGridStyle}>
              {figurePages.map((item) => (
                <div key={item.page} style={figureCardStyle}>
                  <p style={figureMetaStyle}>Figure-related page: {item.page}</p>

                  <img
                    src={item.image}
                    alt={`Figure-related page ${item.page}`}
                    style={figureImageStyle}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Extracted Full Text</h3>

          <textarea
            value={text}
            readOnly
            placeholder="The extracted PDF text will appear here..."
            style={textareaStyle}
          />
        </section>
      </section>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #f4f7fb 0%, #e8eef7 100%)",
  fontFamily: "Inter, Arial, Helvetica, sans-serif",
  color: "#1f2937",
  padding: "40px",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
};

const heroStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 22,
  padding: "36px 40px",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  border: "1px solid #e5e7eb",
  marginBottom: 28,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontWeight: 800,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  fontSize: 13,
};

const titleStyle: React.CSSProperties = {
  margin: "12px 0 8px",
  fontSize: 34,
  lineHeight: 1.2,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 22,
  fontWeight: 650,
  color: "#334155",
};

const descriptionStyle: React.CSSProperties = {
  marginTop: 18,
  maxWidth: 900,
  lineHeight: 1.7,
  color: "#475569",
  fontSize: 15,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 22,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 18,
  marginBottom: 28,
};

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
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const valueStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 800,
  wordBreak: "break-word",
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  padding: 28,
  border: "1px solid #e5e7eb",
  boxShadow: "0 14px 35px rgba(15, 23, 42, 0.06)",
  marginBottom: 28,
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  color: "#0f172a",
  fontSize: 20,
};

const uploadButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const resetButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const figureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
  gap: 18,
};

const figureCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#f8fafc",
};

const figureMetaStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontWeight: 800,
  color: "#2563eb",
};

const figureImageStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: 780,
  objectFit: "contain",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  height: "520px",
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
};