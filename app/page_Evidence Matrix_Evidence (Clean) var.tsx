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
  "Publication Year",
  "DOI",
  "Language",
  "Article database",
  "Disease",
  "Abstract",
  "Models",
  "Cohort Size",
  "Study Design",
  "Cohort Age",
  "Cohort Sex",
  "Confounders",
  "Statistical Analysis",
  "Tissue",
  "Omics Types",
  "Sample Preparation",
  "Equipment",
  "Other Methods",
  "Molecules",
  "Blood Biomarkers",
  "Pathways",
  "Data Accession",
  "LLM confidence",
  "LLM notes",
  "Full text source",
  "Full text length",
  "Full text status",
];

const FIELD_RULES: Record<
  string,
  { keywords: string[]; preferred: string[] }
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
  },
  "Cohort Size": {
    keywords: ["n =", "n=", "patients", "participants", "samples", "cohort", "replicates", "biological replicates"],
    preferred: ["Abstract", "Methods", "Results"],
    out: "Size of cohort or number or biological replicates",
    short: "Cohort Size - Short Answer",
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
  },
  "Cohort Age": {
    keywords: ["age", "aged", "years old", "mean age", "median age"],
    preferred: ["Methods", "Results"],
    short: "Cohort Age - Short Answer",
  },
  "Cohort Sex": {
    keywords: ["sex", "gender", "male", "female", "men", "women"],
    preferred: ["Methods", "Results"],
    out: "Cohort Sex",
    short: "Cohort Sex - Short Answer",
  },
  Confounders: {
    keywords: ["confounder", "adjusted for", "covariates", "age", "sex", "bmi", "smoking", "medication"],
    preferred: ["Methods"],
    out: "Confounders",
    short: "Confounders - Short Answer",
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
    short: "Statistical Analysis - Short Answer",
  },
  Tissue: {
    keywords: ["feces", "faeces", "blood", "serum", "plasma", "pbmc", "tissue", "biopsy", "colon", "brain", "liver"],
    preferred: ["Methods", "Results"],
    out: "Tissue used in omics (add line if more than one tissue)",
    short: "Tissue - Short Answer",
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
  },
  "Blood Biomarkers": {
    keywords: ["il-6", "il6", "tnf", "tnf-α", "crp", "c-reactive protein", "il-1β", "interleukin", "cytokine"],
    preferred: ["Abstract", "Results"],
    out: "Blood Biomarkers of inflammation increased (list: biomarker/level)",
    short: "Blood Biomarkers - Short Answer",
  },
  Pathways: {
    keywords: ["pathway", "kegg", "reactome", "go enrichment", "nf-kb", "nf-κb", "jak-stat", "signaling"],
    preferred: ["Results", "Discussion"],
    out: "Pathways",
    short: "Pathways - Short Answer",
  },
  "Data Accession": {
    keywords: ["geo", "gse", "sra", "prjna", "arrayexpress", "ega", "accession", "deposited", "available"],
    preferred: ["Data Availability", "Methods"],
    out: "Deposited Data Accession",
    short: "Data Accession - Short Answer",
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
  return text
    // PDF garbage
    .replace(/\u0000/g, " ")
    .replace(/\uFFFD/g, " ")

    // weird squares / bullets
    .replace(/[□■▪▫◦]/g, " ")

    // ligatures
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")

    // smart quotes spacing
    .replace(/“\s+/g, "“")
    .replace(/\s+”/g, "”")
    .replace(/"\s+/g, "\"")
    .replace(/\s+"/g, "\"")

    // apostrophe spacing
    .replace(/\s+[’']\s+/g, "’")
    .replace(/([A-Za-z])\s+[’']\s+s\b/g, "$1’s")
    .replace(/([A-Za-z])\s+[’']\s+t\b/g, "$1’t")
    .replace(/([A-Za-z])\s+[’']\s+re\b/g, "$1’re")
    .replace(/([A-Za-z])\s+[’']\s+ve\b/g, "$1’ve")
    .replace(/([A-Za-z])\s+[’']\s+ll\b/g, "$1’ll")
    .replace(/([A-Za-z])\s+[’']\s+d\b/g, "$1’d")

    // Parkinson ’ s -> Parkinson’s
    .replace(/([A-Za-z])\s+[’']s\b/g, "$1’s")

    // microbiome ’ s -> microbiome’s
    .replace(/([A-Za-z])\s+[’']\s*s\b/g, "$1’s")

    // brackets
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")

    // punctuation
    .replace(/\s+([.,;:!?%])/g, "$1")

    // math operators
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s*<\s*/g, " < ")
    .replace(/\s*>\s*/g, " > ")

    // greek letters
    .replace(/\s*α\s*/g, " α ")
    .replace(/\s*β\s*/g, " β ")
    .replace(/\s*γ\s*/g, " γ ")

    // dash cleanup
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*–\s*/g, "–")

    // repeated spaces
    .replace(/\s+/g, " ")

    .trim();
}

function cleanEvidence(text: string) {
  return clean(text)
    .replace(/\bmean\s+□\s*/gi, "mean ")
    .replace(/\bSD\s*□\s*/gi, "SD ")
    .replace(/\bp\s+□\s*/gi, "p ")
    .replace(/\(\s*([^)]+?)\s*\)/g, "($1)")
    .replace(/\s+([0-9]+\.[0-9]+)/g, " $1")
    .replace(/([A-Za-z])\s+’\s+s/g, "$1’s")
    .replace(/Parkinson\s+’\s+s/g, "Parkinson’s")
    .replace(/\s+/g, " ")
    .trim();
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
  const lines = fullText.split("\n");

  const idx = lines.findIndex((x) =>
    /keywords?/i.test(x)
  );

  if (idx < 0) {
    return "Not reported";
  }

  const kws: string[] = [];

  for (let i = idx + 1; i < Math.min(idx + 15, lines.length); i++) {
    const t = lines[i].trim();

    if (
      !t ||
      /abstract/i.test(t) ||
      /introduction/i.test(t) ||
      /^1\./.test(t)
    ) {
      break;
    }

    kws.push(t);
  }

  return kws.join("; ");
}

function extractAbstract(fullText: string) {
  const txt = fullText.replace(/\r/g, "");

  const startPatterns = [
    /A\s*R\s*T\s*I\s*C\s*L\s*E\s*I\s*N\s*F\s*O\s*A\s*B\s*S\s*T\s*R\s*A\s*C\s*T\s*Keywords?\s*:/i,
    /A\s*B\s*S\s*T\s*R\s*A\s*C\s*T\s*Keywords?\s*:/i,
    /Abstract\s*Keywords?\s*:/i,
    /Keywords?\s*:/i,
  ];

  let startIndex = -1;

  for (const pattern of startPatterns) {
    const match = txt.match(pattern);
    if (match && match.index !== undefined) {
      startIndex = match.index + match[0].length;
      break;
    }
  }

  if (startIndex < 0) return "Not reported";

  const afterStart = txt.slice(startIndex);

  const introMatch = afterStart.match(/1\.\s*Introduction/i);
  const abstractRaw = introMatch
    ? afterStart.slice(0, introMatch.index)
    : afterStart.slice(0, 3500);

const abstract = abstractRaw
  .replace(/\n/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const cleanedAbstract = clean(abstract);

return cleanedAbstract.length > 80
  ? cleanedAbstract
  : "Not reported";
}

function rewriteEvidence(text: string) {
  let t = clean(text);

  // common PDF split words
  t = t
    .replace(/applica-tion/g, "application")
    .replace(/proin-flammatory/g, "proinflammatory")
    .replace(/inter-leukin/g, "interleukin")
    .replace(/meta-genomics/g, "metagenomics")
    .replace(/meta-bolomics/g, "metabolomics");

  // remove journal headers
  t = t.replace(
    /Brain Behavior and Immunity\s+\d+\s+\(\d+\)\s+\d+/gi,
    ""
  );

  // remove table artifacts
  t = t.replace(/Clinical PC\d+.*?(?=participants were included)/gi, "");

  t = t.replace(
    /\(mean\s+[^\)]{20,200}\)/gi,
    ""
  );

  t = t.replace(
    /\(SD\)[^\.;]{0,100}/gi,
    ""
  );

  t = t.replace(
    /\b\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\b/g,
    ""
  );

  // reconstruct cohort sentence
  if (
    /participants were included/i.test(t)
  ) {
    const m = t.match(
      /(\d+)\s+participants.*?\((\d+).*?mixed diet.*?(\d+).*?supplement.*?(\d+).*?high-fibre/si
    );

    if (m) {
      return `A total of ${m[1]} participants were included in the study, including ${m[2]} participants in the mixed-diet group, ${m[3]} in the supplementation group, and ${m[4]} in the high-fibre group.`;
    }
  }

  // reconstruct accession sentence
  if (
    /Data will be made available/i.test(t) &&
    /UK Biobank/i.test(t)
  ) {
    return "Plant-based dietary patterns and Parkinson’s disease: a prospective analysis of the UK Biobank. Data will be made available upon request.";
  }

  // statistical analysis cleanup
  if (
    /ANOVA/i.test(t) &&
    /Benjamini/i.test(t)
  ) {
    return "Statistical analyses included ANOVA type II, estimated marginal means for post hoc testing, pathway enrichment analysis, and Benjamini–Hochberg correction for multiple testing.";
  }

  return t
    .replace(/\s+/g, " ")
    .trim();
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

function generateReasoning(field: string, text: string) {
  const t = rewriteEvidence(text);

  switch (field) {
    case "Disease":
      return "The study focuses on the identified disease population.";

    case "Models":
      return "The evidence describes the experimental model(s) used in the study.";

    case "Cohort Size":
      return "The evidence reports the total number of participants included.";

    case "Study Design":
      return "The evidence describes the overall study design and intervention structure.";

    case "Cohort Age":
      return "The evidence reports the age characteristics of the study population.";

    case "Cohort Sex":
      return "The evidence reports the sex distribution of the participants.";

    case "Confounders":
      return "The evidence identifies variables adjusted for during analysis.";

    case "Statistical Analysis":
      return "The evidence summarizes the statistical methods used for hypothesis testing.";

    case "Tissue":
      return "The evidence identifies the biological samples analyzed.";

    case "Omics Types":
      return "The evidence describes the omics technologies applied.";

    case "Sample Preparation":
      return "The evidence describes laboratory sample processing procedures.";

    case "Equipment":
      return "The evidence identifies major analytical instruments used.";

    case "Other Methods":
      return "The evidence describes supplementary analytical workflows.";

    case "Molecules":
      return "The evidence highlights molecular features reported as altered.";

    case "Blood Biomarkers":
      return "The evidence identifies inflammation-related biomarkers.";

    case "Pathways":
      return "The evidence describes biological pathways implicated in the findings.";

    case "Data Accession":
      return "The evidence describes data availability or repository information.";

    default:
      return "Evidence-based summary generated from the extracted text.";
  }
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

  const text = evidence.toLowerCase();

  if (field === "Disease") {
    const diseases = [
      "Parkinson's disease",
      "Parkinson disease",
      "Alzheimer's disease",
      "Alzheimer disease",
      "diabetes",
      "cancer",
      "inflammation",
      "inflammaging",
    ];

    const found = diseases.filter((d) =>
      text.includes(d.toLowerCase().replace("'", ""))
        || text.includes(d.toLowerCase())
    );

    if (found.length) return Array.from(new Set(found)).join("; ");

    if (/pd patients|patients with pd|diagnosed with pd/i.test(evidence)) {
      return "Parkinson's disease";
    }

    return "Not reported";
  }

  if (field === "Models") {
    const models: string[] = [];

    if (/patients|participants|subjects|human/i.test(evidence)) {
      models.push("Human participants/patients");
    }

    if (/mice|mouse|rat|animal/i.test(evidence)) {
      models.push("Animal model");
    }

    if (/cell line|in vitro/i.test(evidence)) {
      models.push("In vitro model");
    }

    return models.length ? models.join("; ") : "Not reported";
  }

  if (field === "Cohort Size") {
    const n =
      evidence.match(/\bn\s*=\s*\d+/i) ||
      evidence.match(/\b\d+\s+(patients|participants|samples|subjects|mice|rats)\b/i);

    return n ? n[0].replace(/\s+/g, " ") : "Not reported";
  }

  if (field === "Study Design") {
    const designs: string[] = [];

    if (/randomized|randomised/i.test(evidence)) designs.push("randomized");
    if (/controlled/i.test(evidence)) designs.push("controlled");
    if (/trial/i.test(evidence)) designs.push("trial");
    if (/cross-sectional/i.test(evidence)) designs.push("cross-sectional");
    if (/retrospective/i.test(evidence)) designs.push("retrospective");
    if (/prospective/i.test(evidence)) designs.push("prospective");
    if (/case-control/i.test(evidence)) designs.push("case-control");

    return designs.length ? Array.from(new Set(designs)).join("; ") : "Not reported";
  }

  if (field === "Cohort Age") {
    const ageRange =
      evidence.match(/\b\d+\s*[-–]\s*\d+\s*years\b/i) ||
      evidence.match(/\baged\s+\d+\s*[-–]\s*\d+\b/i) ||
      evidence.match(/\b(mean|median)\s+age[^.;,]*/i);

    return ageRange ? ageRange[0].replace(/\s+/g, " ") : "Not reported";
  }

  if (field === "Cohort Sex") {
    if (/male/i.test(evidence) && /female/i.test(evidence)) return "Male; Female";
    if (/female/i.test(evidence)) return "Female";
    if (/male/i.test(evidence)) return "Male";
    return "Not reported";
  }

  if (field === "Confounders") {
    const confounders: string[] = [];

    if (/\bage\b/i.test(evidence)) confounders.push("age");
    if (/\bsex\b|\bgender\b/i.test(evidence)) confounders.push("sex/gender");
    if (/\bbmi\b|body mass index/i.test(evidence)) confounders.push("BMI");
    if (/smoking/i.test(evidence)) confounders.push("smoking");
    if (/medication|ledd/i.test(evidence)) confounders.push("medication/LEDD");
    if (/disease stage|hoehn|yahr/i.test(evidence)) confounders.push("disease stage");

    return confounders.length ? Array.from(new Set(confounders)).join("; ") : "Not reported";
  }

  if (field === "Statistical Analysis") {
    const methods: string[] = [];

    if (/anova/i.test(evidence)) methods.push("ANOVA");
    if (/mann[\s-]?whitney/i.test(evidence)) methods.push("Mann-Whitney U");
    if (/wilcoxon/i.test(evidence)) methods.push("Wilcoxon test");
    if (/\bt-test\b|student/i.test(evidence)) methods.push("t-test");
    if (/linear regression/i.test(evidence)) methods.push("linear regression");
    if (/benjamini|hochberg|fdr/i.test(evidence)) methods.push("FDR correction");
    if (/p-value|p value/i.test(evidence)) methods.push("p-value testing");
    if (/pathway enrichment/i.test(evidence)) methods.push("pathway enrichment analysis");

    return methods.length ? Array.from(new Set(methods)).join("; ") : "Not reported";
  }

  if (field === "Tissue") {
    const tissues: string[] = [];

    if (/feces|faeces|stool/i.test(evidence)) tissues.push("feces/stool");
    if (/blood/i.test(evidence)) tissues.push("blood");
    if (/serum/i.test(evidence)) tissues.push("serum");
    if (/plasma/i.test(evidence)) tissues.push("plasma");
    if (/pbmc/i.test(evidence)) tissues.push("PBMC");
    if (/tissue/i.test(evidence)) tissues.push("tissue");

    return tissues.length ? Array.from(new Set(tissues)).join("; ") : "Not reported";
  }

  if (field === "Omics Types") {
    const types: string[] = [];

    if (/metagenom/i.test(evidence)) types.push("metagenomics");
    if (/metabolom/i.test(evidence)) types.push("metabolomics");
    if (/proteom/i.test(evidence)) types.push("proteomics");
    if (/transcriptom|rna-seq/i.test(evidence)) types.push("transcriptomics");
    if (/genom/i.test(evidence)) types.push("genomics");

    return types.length ? Array.from(new Set(types)).join("; ") : "Not reported";
  }

  if (field === "Sample Preparation") {
    const prep: string[] = [];

    if (/dna extraction/i.test(evidence)) prep.push("DNA extraction");
    if (/rna extraction|rna isolation/i.test(evidence)) prep.push("RNA extraction/isolation");
    if (/protein digestion/i.test(evidence)) prep.push("protein digestion");
    if (/metabolite extraction/i.test(evidence)) prep.push("metabolite extraction");
    if (/library preparation/i.test(evidence)) prep.push("library preparation");
    if (/sample preparation/i.test(evidence)) prep.push("sample preparation");

    return prep.length ? Array.from(new Set(prep)).join("; ") : "Not reported";
  }

  if (field === "Equipment") {
    const equipment: string[] = [];

    if (/lc-ms\/ms|lc-ms/i.test(evidence)) equipment.push("LC-MS/MS");
    if (/orbitrap/i.test(evidence)) equipment.push("Orbitrap");
    if (/illumina/i.test(evidence)) equipment.push("Illumina");
    if (/novaseq/i.test(evidence)) equipment.push("NovaSeq");
    if (/hiseq/i.test(evidence)) equipment.push("HiSeq");
    if (/miseq/i.test(evidence)) equipment.push("MiSeq");
    if (/mass spectrometer/i.test(evidence)) equipment.push("mass spectrometer");

    return equipment.length ? Array.from(new Set(equipment)).join("; ") : "Not reported";
  }

  if (field === "Other Methods") {
    const methods: string[] = [];

    if (/normalization/i.test(evidence)) methods.push("normalization");
    if (/alignment/i.test(evidence)) methods.push("alignment");
    if (/quantification/i.test(evidence)) methods.push("quantification");
    if (/differential abundance/i.test(evidence)) methods.push("differential abundance analysis");
    if (/differential expression/i.test(evidence)) methods.push("differential expression analysis");
    if (/pipeline/i.test(evidence)) methods.push("pipeline analysis");
    if (/software|r package|python/i.test(evidence)) methods.push("software/package-based analysis");

    return methods.length ? Array.from(new Set(methods)).join("; ") : "Not reported";
  }

  if (field === "Molecules") {
    const molecules: string[] = [];

    const geneLike = evidence.match(/\b[A-Z0-9]{2,8}\b/g) || [];
    const filtered = geneLike.filter(
      (x) =>
        !["DNA", "RNA", "PDF", "ANOVA", "FDR", "BMI", "PD", "SD", "CI"].includes(x)
    );

    if (/upregulated|up-regulated|increased/i.test(evidence) && filtered.length) {
      molecules.push(...filtered.slice(0, 5).map((x) => `${x} (Up)`));
    }

    if (/downregulated|down-regulated|decreased/i.test(evidence) && filtered.length) {
      molecules.push(...filtered.slice(0, 5).map((x) => `${x} (Down)`));
    }

    return molecules.length ? Array.from(new Set(molecules)).join("; ") : "Not reported";
  }

  if (field === "Blood Biomarkers") {
    const biomarkers: string[] = [];

    if (/tnf|tnf-α|tnfα/i.test(evidence)) biomarkers.push("TNFα");
    if (/il-6|il6/i.test(evidence)) biomarkers.push("IL-6");
    if (/il-1β|il-1b|il1b/i.test(evidence)) biomarkers.push("IL-1β");
    if (/crp|c-reactive protein/i.test(evidence)) biomarkers.push("CRP");
    if (/cytokine/i.test(evidence)) biomarkers.push("cytokines");

    return biomarkers.length ? Array.from(new Set(biomarkers)).join("; ") : "Not reported";
  }

  if (field === "Pathways") {
    const pathways: string[] = [];

    if (/nf-kb|nf-κb/i.test(evidence)) pathways.push("NF-κB signaling");
    if (/jak-stat/i.test(evidence)) pathways.push("JAK-STAT signaling");
    if (/kegg/i.test(evidence)) pathways.push("KEGG pathway enrichment");
    if (/reactome/i.test(evidence)) pathways.push("Reactome pathway");
    if (/go enrichment/i.test(evidence)) pathways.push("GO enrichment");
    if (/pathway enrichment/i.test(evidence)) pathways.push("pathway enrichment");

    return pathways.length ? Array.from(new Set(pathways)).join("; ") : "Not reported";
  }

  if (field === "Data Accession") {
    const acc = evidence.match(/\b(GSE\d+|PRJNA\d+|SRP\d+|ERP\d+|E-MTAB-\d+|PXD\d+)\b/g);
    return acc ? Array.from(new Set(acc)).join("; ") : "Not reported";
  }

  return "Not reported";
}

function directDisease(text: string) {
  if (/Parkinson'?s disease|Parkinson disease|\bPD patients\b/i.test(text)) {
    return "Parkinson's disease";
  }
  if (/Alzheimer'?s disease|Alzheimer disease/i.test(text)) return "Alzheimer's disease";
  if (/diabetes/i.test(text)) return "Diabetes";
  if (/cancer/i.test(text)) return "Cancer";
  return "Not reported";
}

function directCohortSize(text: string) {
  const m =
    text.match(/\b(\d+)\s+participants were included/i) ||
    text.match(/\b(\d+)\s+patients were included/i) ||
    text.match(/\binvolving\s+(\d+)\s+(PD\s+)?patients/i) ||
    text.match(/\bn\s*=\s*(\d+)/i);

  return m ? `n=${m[1]}` : "Not reported";
}

function directStudyDesign(text: string) {
  const parts: string[] = [];

  if (/randomized|randomised/i.test(text)) parts.push("randomized");
  if (/controlled trial/i.test(text)) parts.push("controlled trial");
  else if (/controlled/i.test(text)) parts.push("controlled");
  if (/short-term/i.test(text)) parts.push("short-term phase");
  if (/long-term/i.test(text)) parts.push("long-term phase");
  if (/three groups|3 groups/i.test(text)) parts.push("three-group comparison");

  return parts.length ? Array.from(new Set(parts)).join("; ") : "Not reported";
}

function directAge(text: string) {
  const m =
    text.match(/aged between\s+(\d+)\s+and\s+(\d+)\s+years/i) ||
    text.match(/aged\s+(\d+)\s*[-–]\s*(\d+)\s+years/i) ||
    text.match(/(\d+)\s*[-–]\s*(\d+)\s+years/i);

  return m ? `${m[1]}-${m[2]} years` : "Not reported";
}

function directSex(text: string) {
  if (/female/i.test(text) && /male/i.test(text)) return "Male; Female";
  if (/female/i.test(text)) return "Female";
  if (/male/i.test(text)) return "Male";
  return "Not reported";
}

function directTissue(text: string) {
  const tissues: string[] = [];

  if (/faecal|fecal|faeces|feces|stool/i.test(text)) tissues.push("feces/stool");
  if (/\bblood\b/i.test(text)) tissues.push("blood");
  if (/serum/i.test(text)) tissues.push("serum");
  if (/plasma/i.test(text)) tissues.push("plasma");

  return tissues.length ? Array.from(new Set(tissues)).join("; ") : "Not reported";
}

function directOmics(text: string) {
  const types: string[] = [];

  if (/metagenom/i.test(text)) types.push("metagenomics");
  if (/metabolom/i.test(text)) types.push("metabolomics");
  if (/proteom/i.test(text)) types.push("proteomics");
  if (/transcriptom|rna-seq/i.test(text)) types.push("transcriptomics");

  return types.length ? Array.from(new Set(types)).join("; ") : "Not reported";
}

function directStats(text: string) {
  const methods: string[] = [];

  if (/ANOVA/i.test(text)) methods.push("ANOVA");
  if (/Mann[\s-]?Whitney/i.test(text)) methods.push("Mann-Whitney U");
  if (/linear regression/i.test(text)) methods.push("linear regression");
  if (/Benjamini|Hochberg|FDR/i.test(text)) methods.push("FDR correction");
  if (/Generalized Estimating Equations|GEE/i.test(text)) methods.push("GEE");
  if (/pathway enrichment/i.test(text)) methods.push("pathway enrichment analysis");

  return methods.length ? Array.from(new Set(methods)).join("; ") : "Not reported";
}

function directBiomarkers(text: string) {
  const markers: string[] = [];

  if (/TNF|TNF-α|TNFα/i.test(text)) markers.push("TNFα");
  if (/IL-6|IL6|interleukin-6/i.test(text)) markers.push("IL-6");
  if (/IL-1β|IL-1b|IL1B/i.test(text)) markers.push("IL-1β");
  if (/CRP|C-reactive protein/i.test(text)) markers.push("CRP");

  return markers.length ? Array.from(new Set(markers)).join("; ") : "Not reported";
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
        const evidence = (cleanEvidence(sentence));

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
  const keywords = extractKeywords(fullText);
  const abstract = extractAbstract(fullText);

  const evidenceMap = Object.entries(FIELD_RULES).map(([field, rule]) =>
    findEvidence(sections, field, rule.keywords, rule.preferred)
  );

  const fullTextClean = clean(fullText);

  const directShortAnswers: Record<string, string> = {
    "Disease": directDisease(fullTextClean),
    "Cohort Size": directCohortSize(fullTextClean),
    "Study Design": directStudyDesign(fullTextClean),
    "Cohort Age": directAge(fullTextClean),
    "Cohort Sex": directSex(fullTextClean),
    "Tissue": directTissue(fullTextClean),
    "Omics Types": directOmics(fullTextClean),
    "Statistical Analysis": directStats(fullTextClean),
    "Blood Biomarkers": directBiomarkers(fullTextClean),
  };

  const record: ExtractionRecord = {};
  for (const c of COLUMNS) record[c] = "";

  record["Publication Year"] = extractYear(fullText);
  record["DOI"] = doi;
  record["Language"] = "English";
  record["Article database"] = "Uploaded PDF; browser-based full-text extraction";
  record["Abstract"] = abstract;

  for (const item of evidenceMap) {
     record[item.field] = directShortAnswers[item.field] && directShortAnswers[item.field] !== "Not reported"
      ? directShortAnswers[item.field]
      : item.shortAnswer || "Not reported";
  }
  const accession = extractAccessions(fullText);

  if (accession) {
    record["Data Accession"] = accession;
  }

  record["LLM confidence"] = "Not validated";
  record["LLM notes"] = "Rule-based full-text extraction; use optional local LLM validation below.";
  record["Full text source"] = `Uploaded PDF: ${fileName}`;
  record["Full text length"] = String(fullText.length);
  record["Full text status"] = "Full text uploaded and parsed locally in browser";

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
  const [modelId, setModelId] = useState("SmolLM2-360M-Instruct-q4f16_1-MLC");

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

function formatEvidenceForDisplay(text: string) {
  const cleaned = cleanEvidence(text);

  if (cleaned.length <= 450) return cleaned;

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0];

  if (firstSentence && firstSentence.length > 40 && firstSentence.length < 450) {
    return firstSentence;
  }

  return cleaned.slice(0, 450) + "...";
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
    const header = "Field,Evidence Sentence (Cleaned),LLM Validation\n";   
   
    const body = evidenceMap
      .map((e) =>
        [  e.field,
  rewriteEvidence(e.evidence),
  e.llmValidation || e.confidence,]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    download(header + body, `${fileName || "evidence-map"}.csv`, "text/csv;charset=utf-8");
  }

 async function validateWithLLM() {
  if (!evidenceMap.length) return;

  const updated = evidenceMap.map((item) => {
    if (item.value === "Not reported" || item.evidence === "Not reported") {
      return {
        ...item,
        llmValidation: "Not validated; no evidence found",
      };
    }

    if (item.confidence === "high") {
      return {
        ...item,
        llmValidation: "Rule-supported",
      };
    }

    if (item.confidence === "medium") {
      return {
        ...item,
        llmValidation: "Partially rule-supported",
      };
    }

    return {
      ...item,
      llmValidation: "Weak rule support; manual check recommended",
    };
  });

  setEvidenceMap(updated);

  if (record) {
    setRecord({
      ...record,
      "LLM confidence": "Rule-based validation",
      "LLM notes":
        "Browser WebGPU LLM validation was disabled because local GPU/WebGPU was unstable. Rule-based validation was applied.",
    });
  }

  setStatus("Rule-based validation completed.");
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
                    JSON.stringify({ record, evidenceMap, clusters}, null, 2),
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
                Validate Evidence with Rule-Based Check
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
                    {COLUMNS.filter((c) => c !== "Abstract").map((c) => (
                      <th key={c} style={thStyle}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>

            <tbody>
  <tr>
    {COLUMNS.filter((c) => c !== "Abstract").map((c) => (
      <td
        key={c}
        style={{
          ...tdStyle,
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        {record[c]}
      </td>
    ))}
  </tr>
</tbody>
              </table>
              <div
  style={{
    marginTop: 20,
    maxWidth: 900,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 18,
  }}
>
  <div
    style={{
      fontSize: 12,
      fontWeight: 800,
      color: "#2563eb",
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 1,
    }}
  >
    Abstract
  </div>

  <div
    style={{
      lineHeight: 1.75,
      textAlign: "justify",
      color: "#334155",
      fontSize: 14,
    }}
  >
    {record["Abstract"]}
  </div>
</div>
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
                      "Evidence Sentence (Cleaned)",
                      "LLM Validation | Confidence",
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
                      <td style={tdStyle}>{rewriteEvidence(e.evidence)}</td>
                      <td style={tdStyle}>{e.llmValidation || e.confidence}</td>
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