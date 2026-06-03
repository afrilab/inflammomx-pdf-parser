"use client";

import { useMemo, useState, type CSSProperties } from "react";

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

type SectionChunk = {
  name: string;
  pageStart: number;
  pageEnd: number;
  text: string;
};

type FigurePage = {
  page: number;
  image: string;
};

type EvidenceMapItem = {
  field: string;
  value: string;
  shortAnswer: string;
  section: string;
  page: string;
  evidence: string;
  rule: string;
  confidence: "high" | "medium" | "low";
  llmValidation?: string;
};

type ClusterItem = {
  cluster: string;
  fields: string[];
  evidenceCount: number;
  status: string;
};

type ExtractionRecord = Record<string, string>;

const MATRIX_NAME = "Evidence-Grounded Article Extraction Matrix";

const COLUMNS = [
  "Title",
  "Journal/Book",
  "Publication Year",
  "DOI",
  "Language",
  "Article database",
  "Disease",
  "Keyword List",
  "Medical Subject Heading MeSH terms",
  "Title Keywords",
  "Abstract",

  "Models (human, animal, in vitro model), if there is more than one model repeat line.",
  "Models - Short Answer",

  "Size of cohort or number or biological replicates",
  "Cohort Size - Short Answer",

  "Study design (comparisons) (add line if more than one",
  "Study Design - Short Answer",

  "Cohort Age",
  "Cohort Age - Short Answer",

  "Cohort Sex",
  "Cohort Sex - Short Answer",

  "Confounders",
  "Confounders - Short Answer",

  "Statistical analysis ... (Paring, non-paired)",
  "Statistical Analysis - Short Answer",

  "Tissue used in omics (add line if more than one tissue)",
  "Tissue - Short Answer",

  "Omics types (list) ... if more than one omics used, them make new line",
  "Omics Types - Short Answer",

  "Omics Methods protocol - sample preparation keuwords",
  "Sample Preparation - Short Answer",

  "Omics Methods protocol Equipment used (list)",
  "Equipment - Short Answer",

  "Omics Methods protocol other keywords (list)",
  "Other Methods - Short Answer",

  "Molecules (level, Up/Down) (list, gene, protein, metabolite, etc...)",
  "Molecules - Short Answer",

  "Blood Biomarkers of inflammation increased (list: biomarker/level)",
  "Blood Biomarkers - Short Answer",

  "Pathways",
  "Pathways - Short Answer",

  "Deposited Data Accession",
  "Data Accession - Short Answer",

  "Disease - Evidence Section",
  "Models - Evidence Section",
  "Cohort Size - Evidence Section",
  "Study Design - Evidence Section",
  "Cohort Age - Evidence Section",
  "Cohort Sex - Evidence Section",
  "Confounders - Evidence Section",
  "Statistical Analysis - Evidence Section",
  "Tissue - Evidence Section",
  "Omics Types - Evidence Section",
  "Sample Preparation - Evidence Section",
  "Equipment - Evidence Section",
  "Other Methods - Evidence Section",
  "Molecules - Evidence Section",
  "Blood Biomarkers - Evidence Section",
  "Pathways - Evidence Section",
  "Data Accession - Evidence Section",

  "LLM confidence",
  "LLM notes",
  "Full text source",
  "Full text length",
  "Full text status",
  "Detected sections",
];

const FIELD_RULES: Record<
  string,
  { keywords: string[]; preferred: string[]; out: string; short: string; evidence: string }
> = {
  Disease: {
    keywords: [
      "disease",
      "patients with",
      "diagnosed with",
      "parkinson",
      "alzheimer",
      "diabetes",
      "cancer",
      "inflammation",
      "inflammatory",
      "inflammaging",
    ],
    preferred: ["Title", "Abstract", "Introduction", "Results"],
    out: "Disease",
    short: "Disease",
    evidence: "Disease - Evidence Section",
  },
  Models: {
    keywords: [
      "human",
      "patients",
      "participants",
      "mouse",
      "mice",
      "rat",
      "animal",
      "cell line",
      "in vitro",
      "in vivo",
      "model",
    ],
    preferred: ["Abstract", "Methods", "Results"],
    out: "Models (human, animal, in vitro model), if there is more than one model repeat line.",
    short: "Models - Short Answer",
    evidence: "Models - Evidence Section",
  },
  "Cohort Size": {
    keywords: ["n =", "n=", "patients", "participants", "samples", "cohort", "replicates", "biological replicates"],
    preferred: ["Abstract", "Methods", "Results"],
    out: "Size of cohort or number or biological replicates",
    short: "Cohort Size - Short Answer",
    evidence: "Cohort Size - Evidence Section",
  },
  "Study Design": {
    keywords: [
      "randomized",
      "controlled",
      "trial",
      "case-control",
      "cross-sectional",
      "prospective",
      "retrospective",
      "compared with",
      "control group",
    ],
    preferred: ["Abstract", "Methods"],
    out: "Study design (comparisons) (add line if more than one",
    short: "Study Design - Short Answer",
    evidence: "Study Design - Evidence Section",
  },
  "Cohort Age": {
    keywords: ["age", "aged", "years old", "mean age", "median age"],
    preferred: ["Methods", "Results"],
    out: "Cohort Age",
    short: "Cohort Age - Short Answer",
    evidence: "Cohort Age - Evidence Section",
  },
  "Cohort Sex": {
    keywords: ["sex", "gender", "male", "female", "men", "women"],
    preferred: ["Methods", "Results"],
    out: "Cohort Sex",
    short: "Cohort Sex - Short Answer",
    evidence: "Cohort Sex - Evidence Section",
  },
  Confounders: {
    keywords: ["confounder", "adjusted for", "covariates", "age", "sex", "bmi", "smoking", "medication"],
    preferred: ["Methods"],
    out: "Confounders",
    short: "Confounders - Short Answer",
    evidence: "Confounders - Evidence Section",
  },
  "Statistical Analysis": {
    keywords: [
      "statistical analysis",
      "anova",
      "mann-whitney",
      "wilcoxon",
      "t-test",
      "linear regression",
      "fdr",
      "p value",
      "multiple testing",
    ],
    preferred: ["Methods"],
    out: "Statistical analysis ... (Paring, non-paired)",
    short: "Statistical Analysis - Short Answer",
    evidence: "Statistical Analysis - Evidence Section",
  },
  Tissue: {
    keywords: ["feces", "faeces", "blood", "serum", "plasma", "pbmc", "tissue", "biopsy", "colon", "brain", "liver"],
    preferred: ["Methods", "Results"],
    out: "Tissue used in omics (add line if more than one tissue)",
    short: "Tissue - Short Answer",
    evidence: "Tissue - Evidence Section",
  },
  "Omics Types": {
    keywords: [
      "metagenomics",
      "metabolomics",
      "proteomics",
      "transcriptomics",
      "genomics",
      "rna-seq",
      "multi-omics",
      "mass spectrometry",
    ],
    preferred: ["Abstract", "Methods", "Results"],
    out: "Omics types (list) ... if more than one omics used, them make new line",
    short: "Omics Types - Short Answer",
    evidence: "Omics Types - Evidence Section",
  },
  "Sample Preparation": {
    keywords: [
      "dna extraction",
      "rna extraction",
      "protein digestion",
      "metabolite extraction",
      "library preparation",
      "sample preparation",
      "extraction",
    ],
    preferred: ["Methods"],
    out: "Omics Methods protocol - sample preparation keuwords",
    short: "Sample Preparation - Short Answer",
    evidence: "Sample Preparation - Evidence Section",
  },
  Equipment: {
    keywords: [
      "lc-ms",
      "lc-ms/ms",
      "orbitrap",
      "illumina",
      "novaseq",
      "hiseq",
      "miseq",
      "sequencer",
      "mass spectrometer",
    ],
    preferred: ["Methods"],
    out: "Omics Methods protocol Equipment used (list)",
    short: "Equipment - Short Answer",
    evidence: "Equipment - Evidence Section",
  },
  "Other Methods": {
    keywords: [
      "normalization",
      "alignment",
      "quantification",
      "differential abundance",
      "differential expression",
      "pipeline",
      "software",
    ],
    preferred: ["Methods", "Results"],
    out: "Omics Methods protocol other keywords (list)",
    short: "Other Methods - Short Answer",
    evidence: "Other Methods - Evidence Section",
  },
  Molecules: {
    keywords: [
      "upregulated",
      "downregulated",
      "up-regulated",
      "down-regulated",
      "increased",
      "decreased",
      "gene",
      "protein",
      "metabolite",
      "fold change",
    ],
    preferred: ["Results"],
    out: "Molecules (level, Up/Down) (list, gene, protein, metabolite, etc...)",
    short: "Molecules - Short Answer",
    evidence: "Molecules - Evidence Section",
  },
  "Blood Biomarkers": {
    keywords: ["il-6", "il6", "tnf", "tnf-α", "crp", "c-reactive protein", "il-1β", "interleukin", "cytokine"],
    preferred: ["Abstract", "Results"],
    out: "Blood Biomarkers of inflammation increased (list: biomarker/level)",
    short: "Blood Biomarkers - Short Answer",
    evidence: "Blood Biomarkers - Evidence Section",
  },
  Pathways: {
    keywords: ["pathway", "kegg", "reactome", "go enrichment", "nf-kb", "nf-κb", "jak-stat", "signaling"],
    preferred: ["Results", "Discussion"],
    out: "Pathways",
    short: "Pathways - Short Answer",
    evidence: "Pathways - Evidence Section",
  },
  "Data Accession": {
    keywords: ["geo", "gse", "sra", "prjna", "arrayexpress", "ega", "accession", "deposited", "available"],
    preferred: ["Data Availability", "Methods"],
    out: "Deposited Data Accession",
    short: "Data Accession - Short Answer",
    evidence: "Data Accession - Evidence Section",
  },
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

function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  return clean(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function detectSectionTitle(line: string): string | null {
  const x = line.trim().replace(/^\d+\.?\s*/, "");

  const rules: Array<[RegExp, string]> = [
    [/^abstract$/i, "Abstract"],
    [/^keywords?$/i, "Keywords"],
    [/^introduction$/i, "Introduction"],
    [/^background$/i, "Background"],
    [/^materials? and methods$/i, "Methods"],
    [/^methods$/i, "Methods"],
    [/^study design$/i, "Methods"],
    [/^participants?$/i, "Methods"],
    [/^patients?$/i, "Methods"],
    [/^sample collection$/i, "Methods"],
    [/^statistical analysis$/i, "Methods"],
    [/^results$/i, "Results"],
    [/^discussion$/i, "Discussion"],
    [/^conclusions?$/i, "Conclusion"],
    [/^data availability/i, "Data Availability"],
    [/^references$/i, "References"],
  ];

  for (const [regex, name] of rules) {
    if (regex.test(x)) return name;
  }

  return null;
}

function firstPageLines(fullText: string) {
  const first = fullText.split("===== PAGE 2 =====")[0] || fullText;

  return first
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractDOI(fullText: string) {
  const m = fullText.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  return m ? m[0].replace(/[.,;]$/, "") : "Not reported";
}

function extractYear(fullText: string) {
  const years = fullText.match(/\b(20[0-3]\d|19[8-9]\d)\b/g);
  return years ? years[0] : "Not reported";
}

function extractKeywords(fullText: string) {
  const m = fullText.match(/Keywords?\s*[:\n]\s*([\s\S]{0,700}?)(?=\n\s*(Abstract|Introduction|1\.|Background)|$)/i);
  return m ? clean(m[1]) : "Not reported";
}

function extractAbstract(fullText: string) {
  const m = fullText.match(/Abstract\s+([\s\S]{100,3000}?)(?=\sKeywords?|\sIntroduction|\s1\.\sIntroduction)/i);
  return m ? clean(m[1]) : "Not reported";
}

function inferTitleAndJournal(fullText: string) {
  const lines = firstPageLines(fullText);
  const bad = /science direct|contents lists|journal homepage|article info|abstract|keywords|elsevier|copyright|available online|received|accepted/i;

  const candidates = lines.filter((l) => l.length > 20 && l.length < 260 && !bad.test(l));
  const title = candidates[0] || "Not reported";

  const journal =
    lines.find((l) => /brain|immunity|nature|science|cell|journal|frontiers|plos|bmc|elsevier|lancet|springer/i.test(l)) ||
    "Not reported";

  return { title, journal };
}

function titleKeywords(title: string) {
  if (!title || title === "Not reported") return "Not reported";

  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "through",
    "from",
    "into",
    "using",
    "study",
    "effect",
    "effects",
    "analysis",
    "article",
    "research",
    "of",
    "in",
    "on",
    "to",
    "a",
    "an",
  ]);

  return title
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w.toLowerCase()))
    .join("; ");
}

function inferMeshFromKeywords(keywordText: string) {
  if (!keywordText || keywordText === "Not reported") return "Not reported";

  const k = keywordText.toLowerCase();
  const mesh: string[] = [];

  if (/parkinson/.test(k)) mesh.push("*Parkinson Disease");
  if (/alzheimer/.test(k)) mesh.push("*Alzheimer Disease");
  if (/microbiome|gut microbiome/.test(k)) mesh.push("*Gastrointestinal Microbiome");
  if (/inflammation|inflammatory/.test(k)) mesh.push("Inflammation");
  if (/metabolome|metabolomics/.test(k)) mesh.push("Metabolomics");
  if (/proteome|proteomics/.test(k)) mesh.push("Proteomics");
  if (/metagenome|metagenomics/.test(k)) mesh.push("Metagenomics");
  if (/transcriptome|transcriptomics|rna/.test(k)) mesh.push("Transcriptome");
  if (/resistant starch|starch/.test(k)) mesh.push("*Resistant Starch");
  if (/diet|dietary|nutrition/.test(k)) mesh.push("Diet Therapy");
  if (/biomarker/.test(k)) mesh.push("Biomarkers");
  if (/cytokine/.test(k)) mesh.push("Cytokines");
  if (/human|patient/.test(k)) mesh.push("Humans");

  return mesh.length ? Array.from(new Set(mesh)).join("; ") : "Not reported";
}

function scoreSentence(sentence: string, keywords: string[], sectionName: string, preferred: string[]) {
  const lower = sentence.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) score += 1;
  }

  if (preferred.includes(sectionName)) score += 2;
  if (/\bn\s*=\s*\d+/i.test(sentence)) score += 2;
  if (/\b\d+\s*(patients|participants|subjects|samples|mice|rats)\b/i.test(sentence)) score += 2;
  if (/\b(GSE\d+|PRJNA\d+|SRP\d+|ERP\d+|E-MTAB-\d+|PXD\d+)\b/i.test(sentence)) score += 4;

  return score;
}

function makeShortAnswer(field: string, evidence: string) {
  if (!evidence || evidence === "Not reported") return "Not reported";

  if (field === "Models") {
    if (/patients|participants|human/i.test(evidence)) return "Human participants/patients";
    if (/mice|mouse|rat|animal/i.test(evidence)) return "Animal model";
    if (/cell line|in vitro/i.test(evidence)) return "In vitro model";
  }

  if (field === "Cohort Size") {
    const n =
      evidence.match(/\bn\s*=\s*\d+/i) ||
      evidence.match(/\b\d+\s+(patients|participants|samples|subjects|mice|rats)\b/i);
    return n ? n[0] : evidence;
  }

  if (field === "Study Design") {
    if (/randomized|trial|controlled/i.test(evidence)) return "Randomized/controlled trial";
    if (/cross-sectional/i.test(evidence)) return "Cross-sectional study";
    if (/retrospective/i.test(evidence)) return "Retrospective study";
    if (/prospective/i.test(evidence)) return "Prospective study";
  }

  if (field === "Omics Types") {
    const types = [];
    if (/metagenom/i.test(evidence)) types.push("metagenomics");
    if (/metabolom/i.test(evidence)) types.push("metabolomics");
    if (/proteom/i.test(evidence)) types.push("proteomics");
    if (/transcriptom|rna-seq/i.test(evidence)) types.push("transcriptomics");
    if (/genom/i.test(evidence)) types.push("genomics");
    return types.length ? types.join("; ") : evidence;
  }

  if (field === "Cohort Age") {
    const age =
      evidence.match(/\b\d+\s*[-–]\s*\d+\s*years\b/i) ||
      evidence.match(/\b(mean|median)\s+age[^.;]*/i);
    return age ? age[0] : evidence;
  }

  if (field === "Cohort Sex") {
    if (/male/i.test(evidence) && /female/i.test(evidence)) return "Male and female";
    if (/female/i.test(evidence)) return "Female";
    if (/male/i.test(evidence)) return "Male";
  }

  if (field === "Data Accession") {
    const acc = evidence.match(/\b(GSE\d+|PRJNA\d+|SRP\d+|ERP\d+|E-MTAB-\d+|PXD\d+)\b/g);
    return acc ? Array.from(new Set(acc)).join("; ") : "Not reported";
  }

  const firstSentence = splitSentences(evidence)[0];
  return firstSentence || evidence;
}

function findEvidence(
  sections: SectionChunk[],
  field: string,
  keywords: string[],
  preferred: string[]
): EvidenceMapItem {
  let best: EvidenceMapItem & { score: number } = {
    field,
    value: "Not reported",
    shortAnswer: "Not reported",
    section: "Not reported",
    page: "Not reported",
    evidence: "Not reported",
    rule: keywords.join("; "),
    confidence: "low",
    score: 0,
  };

  for (const section of sections) {
    for (const sentence of splitSentences(section.text)) {
      const score = scoreSentence(sentence, keywords, section.name, preferred);

      if (score > best.score) {
        const evidence = clean(sentence);

        best = {
          field,
          value: evidence,
          shortAnswer: makeShortAnswer(field, evidence),
          section: section.name,
          page:
            section.pageStart === section.pageEnd
              ? String(section.pageStart)
              : `${section.pageStart}-${section.pageEnd}`,
          evidence,
          rule: keywords.join("; "),
          confidence: score >= 5 ? "high" : score >= 3 ? "medium" : "low",
          score,
        };
      }
    }
  }

  const { score, ...out } = best;
  return out;
}

function extractAccessions(fullText: string) {
  const m = fullText.match(/\b(GSE\d+|PRJNA\d+|SRP\d+|ERP\d+|E-MTAB-\d+|PXD\d+)\b/g);
  return m ? Array.from(new Set(m)).join("; ") : "";
}

function buildRecord(fileName: string, fullText: string, sections: SectionChunk[]) {
  const doi = extractDOI(fullText);
  const { title, journal } = inferTitleAndJournal(fullText);
  const keywords = extractKeywords(fullText);
  const abstract = extractAbstract(fullText);

  const evidenceMap = Object.entries(FIELD_RULES).map(([field, rule]) =>
    findEvidence(sections, field, rule.keywords, rule.preferred)
  );

  const record: ExtractionRecord = {};
  for (const c of COLUMNS) record[c] = "";

  record["Title"] = title;
  record["Journal/Book"] = journal;
  record["Publication Year"] = extractYear(fullText);
  record["DOI"] = doi;
  record["Language"] = "English";
  record["Article database"] = "Uploaded PDF; browser-based full-text extraction";
  record["Keyword List"] = keywords;
  record["Medical Subject Heading MeSH terms"] = inferMeshFromKeywords(keywords);
  record["Title Keywords"] = titleKeywords(title);
  record["Abstract"] = abstract;

  for (const item of evidenceMap) {
    const rule = FIELD_RULES[item.field];
    record[rule.out] = item.evidence;
    record[rule.short] = item.shortAnswer;
    record[rule.evidence] = `${item.section}; page ${item.page}`;
  }

  const accession = extractAccessions(fullText);

  if (accession) {
    record["Deposited Data Accession"] = accession;
    record["Data Accession - Short Answer"] = accession;
  }

  record["LLM confidence"] = "Not validated";
  record["LLM notes"] = "Rule-based full-text extraction; use optional local LLM validation below.";
  record["Full text source"] = `Uploaded PDF: ${fileName}`;
  record["Full text length"] = String(fullText.length);
  record["Full text status"] = "Full text uploaded and parsed locally in browser";
  record["Detected sections"] = sections.map((s) => `${s.name}: ${s.text.length} chars`).join("; ");

  return { record, evidenceMap };
}

function buildClusters(evidenceMap: EvidenceMapItem[]): ClusterItem[] {
  const clusters: Record<string, string[]> = {
    "Clinical / Biological Context": [
      "Disease",
      "Models",
      "Cohort Size",
      "Study Design",
      "Cohort Age",
      "Cohort Sex",
      "Confounders",
    ],
    "Methods / Omics Protocol": [
      "Statistical Analysis",
      "Tissue",
      "Omics Types",
      "Sample Preparation",
      "Equipment",
      "Other Methods",
    ],
    "Results / Biological Signals": ["Molecules", "Blood Biomarkers", "Pathways"],
    "Data Availability": ["Data Accession"],
  };

  return Object.entries(clusters).map(([cluster, fields]) => {
    const evidenceCount = evidenceMap.filter((e) => fields.includes(e.field) && e.value !== "Not reported").length;

    return {
      cluster,
      fields,
      evidenceCount,
      status: evidenceCount === 0 ? "No evidence found" : `${evidenceCount}/${fields.length} fields supported`,
    };
  });
}

export default function Page() {
  const [status, setStatus] = useState("Ready to upload a PDF article.");
  const [fileName, setFileName] = useState("");
  const [fullText, setFullText] = useState("");
  const [sections, setSections] = useState<SectionChunk[]>([]);
  const [record, setRecord] = useState<ExtractionRecord | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<EvidenceMapItem[]>([]);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [figurePages, setFigurePages] = useState<FigurePage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelId, setModelId] = useState("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");

  const csv = useMemo(() => {
    if (!record) return "";

    const header = COLUMNS.map((c) => `"${c.replaceAll('"', '""')}"`).join(",");
    const row = COLUMNS.map((c) => `"${String(record[c] || "").replaceAll('"', '""')}"`).join(",");

    return `${header}\n${row}`;
  }, [record]);

  function resetAll() {
    setStatus("Ready to upload a PDF article.");
    setFileName("");
    setFullText("");
    setSections([]);
    setRecord(null);
    setEvidenceMap([]);
    setClusters([]);
    setFigurePages([]);
    setIsLoading(false);
  }

  async function renderPageAsImage(page: any) {
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return "";

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    return canvas.toDataURL("image/png");
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    resetAll();

    try {
      setIsLoading(true);
      setFileName(file.name);
      setStatus("Reading full text and building evidence-grounded matrix...");

      const pdfjsLib = await loadPdfJs();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

      let text = "";
      const pageTexts: { page: number; text: string }[] = [];
      const figPages: FigurePage[] = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        setStatus(`Processing page ${p} of ${pdf.numPages}...`);

        const page = await pdf.getPage(p);
        const content = await page.getTextContent();

        const items = (content.items as any[])
          .map((item: any) => ({
            text: item.str || "",
            x: Math.round(item.transform?.[4] || 0),
            y: Math.round(item.transform?.[5] || 0),
          }))
          .filter((item: any) => item.text.trim())
          .sort((a: any, b: any) => b.y - a.y || a.x - b.x);

        let pageText = "";
        let currentY: number | null = null;
        let line: string[] = [];

        for (const item of items) {
          if (currentY === null || Math.abs(item.y - currentY) <= 3) {
            line.push(item.text);
            currentY = item.y;
          } else {
            pageText += line.join(" ") + "\n";
            line = [item.text];
            currentY = item.y;
          }
        }

        if (line.length) pageText += line.join(" ") + "\n";

        pageTexts.push({ page: p, text: pageText });
        text += `\n\n===== PAGE ${p} =====\n\n${pageText}`;

        if (/\b(Figure|Fig\.)\s*[0-9]+[A-Za-z]?\b/i.test(pageText)) {
          const img = await renderPageAsImage(page);
          if (img) figPages.push({ page: p, image: img });
        }
      }

      const chunks: SectionChunk[] = [];
      let current: SectionChunk = {
        name: "Full text / Front matter",
        pageStart: 1,
        pageEnd: 1,
        text: "",
      };

      for (const pg of pageTexts) {
        for (const line of pg.text.split("\n")) {
          const sec = detectSectionTitle(line);

          if (sec && current.text.trim()) {
            chunks.push(current);
            current = {
              name: sec,
              pageStart: pg.page,
              pageEnd: pg.page,
              text: "",
            };
          } else {
            current.text += line + "\n";
            current.pageEnd = pg.page;
          }
        }
      }

      if (current.text.trim()) chunks.push(current);

      const cleanedSections = chunks.map((s) => ({
        ...s,
        text: clean(s.text),
      }));

      const { record, evidenceMap } = buildRecord(file.name, text, cleanedSections);
      const clusterMap = buildClusters(evidenceMap);

      setFullText(text);
      setSections(cleanedSections);
      setRecord(record);
      setEvidenceMap(evidenceMap);
      setClusters(clusterMap);
      setFigurePages(figPages);

      setStatus(`Completed. ${MATRIX_NAME} generated from full text.`);
    } catch (err: any) {
      setStatus(`PDF parsing failed: ${err?.message || String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function download(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  function downloadEvidenceCsv() {
    const header = "Field,Value,Short Answer,Section,Page,Evidence Sentence,Rule,Confidence,LLM Validation\n";

    const body = evidenceMap
      .map((e) =>
        [e.field, e.value, e.shortAnswer, e.section, e.page, e.evidence, e.rule, e.confidence, e.llmValidation || ""]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    download(header + body, `${fileName || "evidence-map"}.csv`, "text/csv;charset=utf-8");
  }

  async function validateWithLLM() {
    if (!evidenceMap.length) return;

    try {
      setIsLoading(true);
      setStatus("Loading local LLM...");

      const webllm = await import("@mlc-ai/web-llm");

      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (p: any) => setStatus(`Local LLM loading: ${p.text || ""}`),
      });

      const updated: EvidenceMapItem[] = [];

      for (let i = 0; i < evidenceMap.length; i++) {
        const item = evidenceMap[i];

        if (item.value === "Not reported") {
          updated.push({ ...item, llmValidation: "Not validated; no evidence found" });
          continue;
        }

        setStatus(`Validating evidence ${i + 1}/${evidenceMap.length}...`);

        const prompt = `Validate if the extracted value is supported by the evidence sentence.
Field: ${item.field}
Extracted value: ${item.value}
Short answer: ${item.shortAnswer}
Evidence sentence: ${item.evidence}
Return only: Supported, Partially supported, or Not supported.`;

        const res = await engine.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        });

        updated.push({
          ...item,
          llmValidation: res.choices?.[0]?.message?.content?.trim() || "No output",
        });
      }

      setEvidenceMap(updated);

      if (record) {
        setRecord({
          ...record,
          "LLM confidence": "Validated locally",
          "LLM notes": "Evidence map validated using browser-local WebLLM.",
        });
      }

      setStatus("Local LLM validation completed.");
    } catch (err: any) {
      setStatus(`LLM validation failed: ${err?.message || String(err)}`);
    } finally {
      setIsLoading(false);
    }
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

          <h2 style={subtitleStyle}>{MATRIX_NAME}</h2>

          <p style={descriptionStyle}>
            Full-text PDF parsing with structured extraction, sentence-level evidence mapping,
            figure-page visualization, clustering map, heatmap matrix, CSV/JSON export, and optional local LLM validation.
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

        <section style={panelStyle}>
          <b style={{ color: isLoading ? "#2563eb" : "#334155" }}>Status: {status}</b>

          {record && (
            <div style={buttonRowStyle}>
              <button
                style={primaryButtonStyle}
                onClick={() => download(csv, `${fileName}.wide-matrix.csv`, "text/csv;charset=utf-8")}
              >
                Download Wide Matrix CSV
              </button>

              <button style={secondaryButtonStyle} onClick={downloadEvidenceCsv}>
                Download Evidence Map CSV
              </button>

              <button
                style={secondaryButtonStyle}
                onClick={() =>
                  download(
                    JSON.stringify({ record, evidenceMap, clusters, sections }, null, 2),
                    `${fileName}.json`,
                    "application/json;charset=utf-8"
                  )
                }
              >
                Download JSON
              </button>

              <button
                style={secondaryButtonStyle}
                onClick={() => download(fullText, `${fileName}.full-text.txt`, "text/plain;charset=utf-8")}
              >
                Download Full Text
              </button>
            </div>
          )}

          {record && (
            <div style={{ marginTop: 18 }}>
              <label style={smallLabel}>Local LLM model ID</label>

              <input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                style={inputStyle}
              />

              <button style={primaryButtonStyle} onClick={validateWithLLM} disabled={isLoading}>
                Validate Evidence with Local LLM
              </button>
            </div>
          )}
        </section>

        {record && (
          <section style={panelStyle}>
            <h3 style={sectionTitleStyle}>{MATRIX_NAME}</h3>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th key={c} style={thStyle}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    {COLUMNS.map((c) => (
                      <td
                        key={c}
                        style={{
                          ...tdStyle,
                          fontWeight: c.includes("Short Answer") ? 800 : 400,
                          color: c.includes("Short Answer") ? "#0f172a" : "#334155",
                        }}
                      >
                        {record[c]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Evidence Sentence Map</h3>

          {evidenceMap.length === 0 ? (
            <p>No evidence map yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "Field",
                      "Value",
                      "Short Answer",
                      "Section",
                      "Page",
                      "Evidence Sentence",
                      "Confidence",
                      "LLM Validation",
                    ].map((h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {evidenceMap.map((e, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{e.field}</td>
                      <td style={tdStyle}>{e.value}</td>
                      <td style={{ ...tdStyle, fontWeight: 800 }}>{e.shortAnswer}</td>
                      <td style={tdStyle}>{e.section}</td>
                      <td style={tdStyle}>{e.page}</td>
                      <td style={tdStyle}>{e.evidence}</td>
                      <td style={tdStyle}>{e.confidence}</td>
                      <td style={tdStyle}>{e.llmValidation || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Clustering Map</h3>

          <div style={clusterGridStyle}>
            {clusters.map((c) => (
              <div key={c.cluster} style={clusterCardStyle}>
                <b style={blueMetaStyle}>{c.cluster}</b>
                <p>{c.status}</p>

                <div style={chipRowStyle}>
                  {c.fields.map((f) => (
                    <span key={f} style={chipStyle}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Evidence-Grounded Article Extraction Matrix Heatmap</h3>

          {evidenceMap.length === 0 ? (
            <p>No heatmap yet.</p>
          ) : (
            <div style={heatmapGridStyle}>
              {evidenceMap.map((e) => (
                <div
                  key={e.field}
                  style={{
                    ...heatmapCellStyle,
                    background:
                      e.confidence === "high"
                        ? "#dcfce7"
                        : e.confidence === "medium"
                        ? "#fef9c3"
                        : "#fee2e2",
                    borderColor:
                      e.confidence === "high"
                        ? "#22c55e"
                        : e.confidence === "medium"
                        ? "#eab308"
                        : "#ef4444",
                  }}
                >
                  <b>{e.field}</b>
                  <span>{e.confidence}</span>
                  <small>{e.section}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Detected Sections</h3>

          {sections.length === 0 ? (
            <p>No detected sections yet.</p>
          ) : (
            <div style={clusterGridStyle}>
              {sections.map((s, i) => (
                <div key={i} style={clusterCardStyle}>
                  <b style={blueMetaStyle}>
                    {s.name} · pages {s.pageStart}-{s.pageEnd}
                  </b>

                  <p style={smallTextStyle}>{s.text.slice(0, 500)}...</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Figure Pages</h3>

          {figurePages.length === 0 ? (
            <p>No figure pages found.</p>
          ) : (
            <div style={figureGridStyle}>
              {figurePages.map((f) => (
                <div key={f.page} style={clusterCardStyle}>
                  <b style={blueMetaStyle}>Figure-related page: {f.page}</b>

                  <img src={f.image} alt={`Figure page ${f.page}`} style={figureImageStyle} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h3 style={sectionTitleStyle}>Extracted Full Text</h3>

          <textarea
            value={fullText}
            readOnly
            placeholder="The extracted PDF full text will appear here..."
            style={textareaStyle}
          />
        </section>
      </section>
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#f4f7fb,#e8eef7)",
  fontFamily: "Inter, Arial, sans-serif",
  padding: 40,
  color: "#1f2937",
};

const containerStyle: CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
};

const heroStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 22,
  padding: "36px 40px",
  boxShadow: "0 20px 45px rgba(15,23,42,.08)",
  border: "1px solid #e5e7eb",
  marginBottom: 28,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontWeight: 800,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  fontSize: 13,
};

const titleStyle: CSSProperties = {
  margin: "12px 0 8px",
  fontSize: 34,
  lineHeight: 1.2,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: "10px 0 0",
  fontSize: 22,
  fontWeight: 700,
  color: "#334155",
};

const descriptionStyle: CSSProperties = {
  marginTop: 18,
  maxWidth: 980,
  lineHeight: 1.7,
  color: "#475569",
  fontSize: 15,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 22,
};

const panelStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: 28,
  border: "1px solid #e5e7eb",
  boxShadow: "0 14px 35px rgba(15,23,42,.06)",
  marginBottom: 28,
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  color: "#0f172a",
  fontSize: 20,
};

const uploadButtonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const resetButtonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
};

const tableStyle: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: 12,
};

const thStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: 10,
  background: "#f1f5f9",
  textAlign: "left",
  minWidth: 190,
  verticalAlign: "top",
};

const tdStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: 10,
  verticalAlign: "top",
  minWidth: 190,
  maxWidth: 520,
  whiteSpace: "normal",
};

const clusterGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 16,
};

const clusterCardStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#f8fafc",
};

const blueMetaStyle: CSSProperties = {
  color: "#2563eb",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle: CSSProperties = {
  background: "#e0ecff",
  color: "#1e40af",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 700,
};

const smallTextStyle: CSSProperties = {
  color: "#475569",
  lineHeight: 1.6,
  fontSize: 13,
};

const smallLabel: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 520,
  margin: "8px 0 12px",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
};

const figureGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))",
  gap: 18,
};

const figureImageStyle: CSSProperties = {
  width: "100%",
  maxHeight: 780,
  objectFit: "contain",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  marginTop: 12,
};

const heatmapGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
};

const heatmapCellStyle: CSSProperties = {
  border: "2px solid",
  borderRadius: 14,
  padding: 14,
  minHeight: 96,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  justifyContent: "space-between",
  color: "#0f172a",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  height: "620px",
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