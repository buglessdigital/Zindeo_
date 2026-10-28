// Generates docs/moodle/ready-deliverables/Zindeo-DSD-1.0.docx
// Usage: NODE_PATH=<dir containing node_modules with docx@9> node dsd-1.0.js <output.docx>
// UML figures: docs/course/src/figures/uml/dsd-*.puml (see figures/README.md)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, LevelFormat, Footer, PageNumber,
  TableOfContents, TabStopType, ImageRun,
} = require("docx");
const path = require("path");
const FIG_DIR = path.join(__dirname, "figures");

const FONT = "Times New Roman";
const CONTENT_WIDTH = 11906 - 2 * 1134; // A4 minus 2 cm margins (DXA)

// ---------- helpers ----------
// Inline markup: **bold**, *italic*
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (text, opts = {}) =>
  new Paragraph({ children: runs(text), alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 288 }, ...opts });
// Chapter tracking for automatic table and figure numbers
let chapter = 0, tableNo = 0, figNo = 0;
const H1 = (text) => {
  chapter = parseInt(text, 10);
  tableNo = 0;
  figNo = 0;
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: true });
};
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const H3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
const B = (text, level = 0) =>
  new Paragraph({ children: runs(text), numbering: { reference: "bullets", level }, spacing: { after: 60, line: 276 }, alignment: AlignmentType.JUSTIFIED });
let numInstance = 0;
// Numbered list; each call starts at 1
function N(items) {
  const inst = ++numInstance;
  return items.map((t) => new Paragraph({
    children: runs(t), numbering: { reference: "numbers", level: 0, instance: inst },
    spacing: { after: 60, line: 276 }, alignment: AlignmentType.JUSTIFIED,
  }));
}
const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(text, width, { header = false, fill, span, bold } = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    columnSpan: span,
    shading: header ? { fill: "D9D9D9", type: ShadingType.CLEAR, color: "auto" } : fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text).split("\n").map((line) => new Paragraph({ children: runs(line, { size: 20, bold: header || bold || undefined }) })),
  });
}
// Rows are arrays of cells, or { group: "text" } for a shaded row spanning all columns
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { header: true })) }),
      ...rows.map((r) => r.group
        ? new TableRow({ cantSplit: true, children: [cell(r.group, total, { fill: "F2F2F2", span: widths.length, bold: true })] })
        : new TableRow({ children: r.map((c, i) => cell(c, widths[i])) })),
    ],
  });
}
const caption = (text) => new Paragraph({ children: [new TextRun({ text, italics: true, size: 20 })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 } });
// Numbered table caption within the current chapter, e.g. "Table 4.3. ..."
const tcap = (text) => caption(`Table ${chapter}.${++tableNo}. ${text}`);

// UML figure from docs/course/src/figures/uml/<file> with a numbered caption. *num* is the number
// used in the text; it is checked against the automatic number so that references cannot drift.
// PNGs are rendered at 220 dpi; they are shown at most at 140% of their natural size and scaled
// down to fit maxW and maxH (px at 96 dpi; the text area is 642 x 970 px).
function uml(file, num, text, { maxW = 642, maxH = 900 } = {}) {
  const expected = `${chapter}.${++figNo}`;
  if (num !== expected) throw new Error(`Figure ${num} (${file}) is actually Figure ${expected}`);
  const data = fs.readFileSync(path.join(FIG_DIR, "uml", file));
  const w = data.readUInt32BE(16), h = data.readUInt32BE(20); // PNG IHDR
  const width = Math.min(((w * 96) / 220) * 1.4, maxW, (maxH * w) / h);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200 },
      children: [new ImageRun({ type: "png", data, transformation: { width: Math.round(width), height: Math.round((width * h) / w) }, altText: { title: text, description: text, name: file } })],
    }),
    caption(`Figure ${num}. ${text}`),
  ];
}

// Design decision: title, decision, alternatives, justification, requirements
const DECISIONS = [];
function decision(id, title, text, alternatives, why, reqs) {
  DECISIONS.push([id, title, reqs]);
  return [
    table(["Design decision", `${id} ${title}`], [
      ["**Decision**", text],
      ["**Alternatives**", alternatives],
      ["**Justification**", why],
      ["**Requirements**", reqs],
    ], [2100, 7538]),
    tcap(`Design decision ${id}`),
  ];
}

// ---------- content ----------
const DATE = "11.12.2026";
const cover = [
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "COMP4910 Senior Design Project 1, Fall 2026", bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Advisor: Dr. Arman Savran", bold: true, size: 28 })] }),
  ...Array.from({ length: 9 }, () => new Paragraph({ children: [] })),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Zindeo: A Calorie Tracking App with On-Device Food Recognition", bold: true, size: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "High Level Design", bold: true, size: 32 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: "Design Specifications Document", bold: true, size: 36 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Revision 1.0", bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: DATE, bold: true, size: 28 })] }),
  ...Array.from({ length: 9 }, () => new Paragraph({ children: [] })),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "By:", bold: true, size: 26 })] }),
  ...[
    "Taner Yıldırım, 22070001002",
    "Yavuz Tuğcan, 22070001044",
    "Ece Coşdur, 22070001050",
  ].map((t) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 26 })] })),
];

const revision = [
  new Paragraph({ children: [new TextRun({ text: "Revision History", bold: true, size: 28 })], spacing: { after: 200 }, pageBreakBefore: true }),
  table(["Revision", "Date", "Explanation"], [["1.0", DATE, "Initial high level design"]], [1600, 1800, 6238]),
];

const toc = [
  new Paragraph({ children: [new TextRun({ text: "Table of Contents", bold: true, size: 28 })], spacing: { after: 200 }, pageBreakBefore: true }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
];

// 1. Introduction
const s1 = [
  H1("1. Introduction"),
  H2("1.1. Purpose of This Document"),
  P("This Design Specifications Document (DSD) gives the high level design of Zindeo, a mobile calorie and nutrition tracking application for iOS and Android with photo-based recognition of Turkish dishes. It describes how the system specified in the Requirements Specifications Document (RSD) Revision 2.0 [1] will be built: the subsystems and their interfaces, the software architecture, the structure of each subsystem, the hardware and software environment, and the approach to testing."),
  P("The main functions of the system, specified in [1] as 40 use cases, are:"),
  B("registration, sign-in and account deletion (use case package UC-1);"),
  B("onboarding with explicit consent and calculation of safe daily energy and macronutrient targets (UC-2);"),
  B("search in a curated food catalogue of Turkish and other foods (UC-3);"),
  B("meal logging by search, by photo with automatic food recognition and portion estimation, and by barcode, also without an internet connection (UC-4);"),
  B("a daily dashboard, progress reports and weight tracking (UC-5);"),
  B("a freemium Premium subscription sold through the App Store and Google Play (UC-6);"),
  B("consent management and data export under the Turkish Personal Data Protection Law (KVKK) (UC-7);"),
  B("settings and reminders (UC-8), smart assistance features in Phase 2 (UC-9), and catalogue administration by the team (UC-10)."),
  H2("1.2. Design Basis and Notation"),
  P("The design is based on RSD Revision 2.0 [1]; requirement and use case identifiers (e.g. FR-5.4, NFR-18, UC-4.2) refer to that document. The design approach follows the object-oriented analysis and design method of [2] and the design principles of [3]. The notation is UML 2.5.1 [4]: component, package, class, sequence and deployment diagrams. Each design decision is stated with the alternatives that were considered and its justification, and is traced to the requirements that motivate it."),
  H2("1.3. Scope of This Revision"),
  P("Revision 1.0 is the high level design. It fixes the architecture, the decomposition into subsystems and modules, the interfaces between them, the data design and the environment. The detailed design of every class and method, including the user interface screens, will be given in the detailed design in COMP 4920 (Section 6). Zindeo runs on commodity smartphones and cloud services and includes no hardware development; therefore this document contains no hardware subsystem design."),
  H2("1.4. Design Goals"),
  P("The requirements in [1] lead to six design goals, which are used to evaluate the design decisions in the following sections:"),
  table(["Goal", "Description", "Main requirements"], [
    ["DG1 Replaceable recognition", "The recognition engine changes from a cloud model (Phase 1) to an on-device model (Phase 2) without changes elsewhere.", "NFR-35, FR-5.9, FR-5.11"],
    ["DG2 Consistent nutrition", "Energy and nutrients are always calculated from the catalogue with one implementation of the formulas.", "FR-5.3, FR-4.5, NFR-8"],
    ["DG3 Security by default", "Secrets never reach the device; every user can access only his or her own data; limits and Premium status are enforced on the server.", "NFR-17–NFR-22"],
    ["DG4 Fast and offline-tolerant", "Logging is immediate on the device; network calls never block the user interface; entries can be made offline.", "NFR-1–NFR-4, FR-4.8"],
    ["DG5 Privacy and compliance", "Health data and photos are processed only with recorded consent and can be exported and deleted.", "NFR-23–NFR-27, FR-11"],
    ["DG6 Small-team operability", "Few services, managed infrastructure, everything in version control, one programming language where possible.", "NFR-31–NFR-36, Constraints in [1]"],
  ], [2400, 5038, 2200]),
  tcap("Design goals"),
  H2("1.5. Document Overview"),
  P("Section 2 decomposes Zindeo into subsystems and defines their interfaces. Section 3 specifies the software architecture. Section 4 describes the structure of each subsystem, the data design and the realisation of the key use cases. Section 5 specifies the environment, with platforms, languages, versions and tools. Section 6 describes the scope of the detailed design in COMP 4920, Section 7 the testing design, and Section 8 traces the design to the requirements."),
];

// 2. System design
const s2 = [
  H1("2. Zindeo System Design"),
  P("Zindeo consists of four subsystems, shown with their interfaces in Figure 2.1. All four are software; the system runs on users' smartphones and on managed cloud services."),
  B("**Zindeo Mobile Application:** the application used by guests and users on iOS and Android. It contains the whole user interface, the nutrition calculations, the local store for offline use and, in Phase 2, the on-device recognition models."),
  B("**Zindeo Backend:** authentication, the database with the food catalogue and all user data, server functions that hold the secrets and talk to external services, and private file storage."),
  B("**Catalogue Content Pipeline:** the version-controlled catalogue files maintained by content administrators, and the validation and loading steps that publish them to the database (UC-10)."),
  B("**Machine Learning Pipeline (Phase 2):** data preparation, labelling, training, evaluation and export of Zindeo's own models (FR-16)."),
  ...uml("dsd-system.png", "2.1", "Subsystems of Zindeo and their interfaces (UML component diagram)"),
  P("Table 2.1 defines the interfaces between the subsystems and to the external systems. The mobile application never communicates with an external service directly, except with the operating system's sign-in and in-app purchase dialogues; all other external calls go through the backend (NFR-18)."),
  table(["Interface", "Provider → consumer", "Content and protocol"], [
    ["Auth API", "Backend → Mobile App", "Sign-up, sign-in with an Apple or Google identity token or e-mail and password, token refresh, password reset. HTTPS/JSON; returns a JSON Web Token (JWT) session."],
    ["Data API", "Backend → Mobile App", "Create, read, update and delete on user tables, catalogue reads, and remote procedure calls (RPC) to database functions. HTTPS/JSON with the user's JWT; access controlled by row-level security."],
    ["Server Functions API", "Backend → Mobile App", "Operations that need secrets or must not be trusted to the client: scan, scan feedback, barcode lookup, purchase verification, account deletion, data export (Section 4.4)."],
    ["Catalogue files", "Catalogue Pipeline → Backend", "Foods, names, portions, recipes and confusion groups as CSV/YAML files in the repository; loaded as SQL by the pipeline after validation and review."],
    ["Labelled training data", "Backend → ML Pipeline", "Photos of consenting users and the foods and weights they confirmed (scan items), exported with catalogue codes as labels."],
    ["Model artifacts", "ML Pipeline → Mobile App", "Quantized model files, the label list (catalogue codes) and the calibration temperature; shipped with the application or downloaded from storage (Phase 2)."],
    ["Food Recognition Service", "External → Backend", "Cloud vision-language model API (Phase 1). Input: photo, list of recognizable catalogue codes and a JSON schema; output: items with codes, confidences and grams."],
    ["App Store / Google Play", "External ↔ Backend", "Purchase verification APIs and server-to-server notifications about renewals, cancellations and refunds."],
    ["Identity providers", "External → Backend", "Verification of Apple and Google identity tokens."],
    ["Open Food Facts", "External → Backend", "Product lookup by barcode (REST/JSON) [12]."],
  ], [2100, 2300, 5238]),
  tcap("Interfaces between subsystems and to external systems"),
];

// 3. Architecture
const s3 = [
  H1("3. Software System Architecture"),
  H2("3.1. Overall Architecture"),
  P("Zindeo has a **client–server architecture with a thin, managed server (Backend-as-a-Service) and a layered client**. The client is the mobile application, which holds the user interface and the application logic and keeps a local copy of the data it needs. The server is a managed platform (Supabase [10]) that provides authentication, a relational database whose access rules are enforced by the database itself, a small set of server functions, and file storage. There is no application server between the client and the database for ordinary data access: the client reads and writes its own data through the Data API, and the database row-level security policies decide what each user may access."),
  P("In Phase 2 the architecture gains an element of **edge computing**: the recognition model runs on the client, and the server is used only as a fallback when the on-device model is not confident."),
  H2("3.2. Architecture of the Subsystems"),
  B("**Mobile application: layered architecture.** Four layers, Presentation, Feature, Core and Platform (Section 4.1). A layer uses only the layer directly below it. Features are vertical slices that do not depend on each other, so that a feature can be changed or removed without affecting the others."),
  B("**Backend: two-layer architecture.** An API layer (Auth, Data API, Edge Functions) on top of a data layer (PostgreSQL with RPC functions and row-level security, and Storage) (Section 4.4)."),
  B("**Catalogue Content Pipeline and Machine Learning Pipeline: pipe-and-filter architecture.** Each stage reads the output of the previous one and writes a versioned output; a stage can be re-run independently."),
  H2("3.3. Justification"),
  ...decision("DD-1", "Client–server with a managed backend", "A thin managed backend (Supabase) with the application logic in the mobile client; server code only where secrets or trust are required.",
    "(a) Own application server (e.g. Node.js or Python) with a database; (b) another managed platform (Firebase); (c) a general cloud provider (AWS).",
    "A team of three cannot operate authentication, a database, backups and an API server in addition to the application and the models. A managed backend provides these with security features (row-level security) that directly implement NFR-19. PostgreSQL is relational, which suits the catalogue, the target history and reporting, and is portable if the provider must be changed. The decision and the comparison are recorded in the team's architecture decision record ADR-0003 [13].",
    "DG3, DG6; NFR-14, NFR-16, NFR-19, NFR-33"),
  ...decision("DD-2", "Single cross-platform client", "One mobile application for iOS and Android in TypeScript with React Native and Expo, using development builds so that native modules can be added.",
    "(a) Two native applications (Swift and Kotlin); (b) Flutter; (c) React Native without Expo.",
    "One code base halves the user interface work and lets the backend functions and the client share one language (TypeScript). Expo provides camera, secure storage, SQLite, notifications and the build and store submission services; development builds still allow the native module needed for on-device inference in Phase 2 (ADR-0002 [13]).",
    "DG6; NFR-31, NFR-32"),
  ...decision("DD-3", "Layered client with feature modules", "Four layers with feature modules in the Feature layer; shared logic in the Core layer; platform access only through the Platform layer.",
    "(a) Organisation by technical type (all screens, all hooks, all services); (b) no explicit structure.",
    "Grouping by feature keeps the code of one use case package together and lets three developers work in parallel with few conflicts. Placing the formulas (core/nutrition) and the recognition interface (core/recognition) in the Core layer gives one implementation of each, which is required by DG1 and DG2.",
    "DG1, DG2; NFR-8, NFR-35"),
];

// 4. Structure
const s4 = [
  H1("4. Software System Structure"),
  H2("4.1. Mobile Application"),
  P("Figure 4.1 shows the layers of the mobile application and Table 4.1 their responsibilities. The source code follows the same structure: *app/* contains the screens, *src/features/* the feature modules and *src/core/* the shared modules."),
  ...uml("dsd-app-layers.png", "4.1", "Layers of the mobile application (UML package diagram)", { maxW: 600 }),
  table(["Layer", "Responsibility", "May use"], [
    ["Presentation", "Screens and navigation (file-based routing with Expo Router). Displays data and forwards user actions; contains no business rules.", "Feature, Core ui and i18n"],
    ["Feature", "One module per area: state of its screens, data queries and mutations, validation of user input. Implements the use cases of one package.", "Core"],
    ["Core", "Shared, feature-independent logic: nutrition formulas, recognition interface, offline store and synchronisation, typed API client, translations, user interface components.", "Platform"],
    ["Platform", "Device capabilities provided by Expo and React Native modules: camera, image processing, SQLite, secure storage, notifications, in-app purchases, sign-in, on-device inference runtime.", "Operating system"],
  ], [1700, 5938, 2000]),
  tcap("Layers of the mobile application"),
  P("Table 4.2 maps the feature modules to the use case packages of [1]."),
  table(["Feature module", "Use cases", "Main Core modules used"], [
    ["auth", "UC-1.1–UC-1.4", "api"],
    ["onboarding", "UC-2.1, UC-2.2, UC-7.1", "nutrition, api"],
    ["food-search", "UC-3.1–UC-3.4", "api, offline"],
    ["logging", "UC-4.1, UC-4.5–UC-4.7", "nutrition, offline, api"],
    ["scan", "UC-4.2", "recognition, nutrition, offline"],
    ["barcode", "UC-4.3, UC-4.4", "api, nutrition"],
    ["dashboard", "UC-5.1–UC-5.3", "nutrition, api"],
    ["weight", "UC-5.4, UC-5.5, UC-2.5", "nutrition, api"],
    ["subscription", "UC-6.1, UC-6.2", "api"],
    ["privacy", "UC-7.2, UC-7.3", "api"],
    ["settings", "UC-2.3, UC-2.4, UC-8.1, UC-8.2", "api, i18n"],
    ["(Phase 2) fridge, restaurants", "UC-9.1–UC-9.3", "recognition, nutrition"],
  ], [2400, 3600, 3638]),
  tcap("Feature modules and the use cases they implement"),
  H3("4.1.1. Application State"),
  P("Two kinds of state are kept separately. **Server state** (profile, targets, entries, catalogue results) is fetched and cached with a query cache library (TanStack Query); changes are applied to the screen immediately (optimistic update) and confirmed by the server afterwards. **Local user interface state** (e.g. the items of a scan being edited) is kept in small stores (Zustand) within the feature. This keeps network calls from blocking the user interface (DG4)."),
  H3("4.1.2. Recognition Component"),
  P("Figure 4.2 shows the design that makes the recognition engine replaceable. The scan feature depends only on the interface *FoodRecognizer*. In Phase 1 the factory returns a *CloudRecognizer*, which calls the backend scan function. In Phase 2 it returns a *HybridRecognizer*, which first runs the *OnDeviceRecognizer* and calls the cloud only when the calibrated confidence is below the threshold and a connection is available (FR-5.11). The result contains only catalogue codes, confidences and grams, never energy values (FR-5.3)."),
  ...uml("dsd-recognition.png", "4.2", "Design of the recognition component (UML class diagram)"),
  ...decision("DD-4", "Recognition behind an interface", "The interface FoodRecognizer with interchangeable implementations created by a factory (strategy pattern [3]).",
    "(a) Call the cloud service directly from the scan feature and rewrite it in Phase 2; (b) always recognize on the server, also in Phase 2.",
    "The engine is planned to change during the project; the interface confines the change to core/recognition. Recognizing on the device in Phase 2 removes the per-request cost and keeps the photo on the phone, which is a goal of the project (G5 in [1]); the hybrid implementation keeps the cloud as a quality fallback.",
    "DG1; NFR-35, FR-5.9, FR-5.11"),
  H3("4.1.3. Nutrition and Offline Modules"),
  P("Figure 4.3 shows the main classes of *core/nutrition* and *core/offline*. *core/nutrition* consists of pure functions without side effects that implement the formulas of FR-2.4–FR-2.8 and FR-4.1; every target and every meal entry in the application is calculated by these functions, and their results are versioned (*nutrition-v1*, NFR-37). *core/offline* keeps writes made without a connection in a local SQLite queue and sends them when the connection returns; because every entry has an identifier generated on the device, sending it twice updates the same row instead of creating a duplicate (FR-4.8)."),
  ...uml("dsd-core.png", "4.3", "Main classes of the nutrition, offline and API modules (UML class diagram)"),
  ...decision("DD-5", "Nutrition calculated on the client from catalogue values", "Targets and entry values are calculated in core/nutrition on the device and stored with the method version; meal entries store a snapshot of their values.",
    "(a) Calculate on the server in database functions; (b) take energy values from the recognition service.",
    "Calculating on the device gives an immediate response and works offline (DG4). The functions are pure and covered by the reference test vectors, so the same results are guaranteed everywhere (NFR-8). Values from a recognition model may be invented; taking them only from the curated catalogue keeps photo, search and barcode logging consistent (FR-5.3). The snapshot keeps past days unchanged when the catalogue is corrected (FR-4.5).",
    "DG2, DG4; FR-4.5, FR-5.3, NFR-8, NFR-37"),
  ...decision("DD-6", "Offline writes through a client-side queue", "A write queue in SQLite with client-generated UUIDs and upserts; the server is the source of truth.",
    "(a) A full offline database synchronisation library; (b) no offline support.",
    "Only a few kinds of writes are needed offline (meal, water and weight entries). A simple queue is easy to test and has no extra service; client-generated identifiers make retries idempotent. A synchronisation library can still be introduced later behind core/offline.",
    "DG4; FR-4.8"),
  H2("4.2. Catalogue Content Pipeline"),
  P("Catalogue content (foods, names, portion units, standard recipes, confusion groups) is kept as files in the repository, one file per category, and changed through pull requests. A continuous integration job validates every change: required nutrients present, energy within 15% of the energy calculated from the macronutrients, valid portion weights, unique and unchanged food codes. A second team member reviews and approves the pull request; after the merge the job converts the files into SQL and loads them into the database, marking the foods as verified (UC-10.1–UC-10.3, FR-15.1–FR-15.4). Food codes are permanent because they are also the labels of the recognition classes."),
  ...decision("DD-7", "Catalogue as code", "Catalogue data in version-controlled files with automated validation and pull-request review, loaded into the database by CI.",
    "(a) An administration web panel writing directly to the database; (b) editing the database by hand.",
    "Version control provides the history, the review by a second person and the possibility to restore any previous state without building an administration application. The content administrators are team members who use the repository daily.",
    "DG6; FR-15.1–FR-15.4, NFR-36"),
  H2("4.3. Machine Learning Pipeline (Phase 2)"),
  P("Figure 4.4 shows the stages of the machine learning pipeline, located in the *ml/* directory of the repository and written in Python with PyTorch. The data stage downloads the public datasets, records their licences and creates the splits, with the fixed test set of FR-16.3 frozen once. The training stage trains the food classifier, the plate detector and food segmenter for portion estimation, and the ingredient detector. A model is exported only if it meets NFR-5, NFR-6 and NFR-9 on the fixed test set. The export contains the quantized model, the list of catalogue codes in class order and the calibration temperature. Model architectures and training procedures will be designed in the detailed design."),
  ...uml("dsd-ml.png", "4.4", "Stages of the machine learning pipeline (UML package diagram)", { maxH: 560 }),
  H2("4.4. Backend"),
  P("Figure 4.5 shows the structure of the backend. Ordinary reads and writes of a user's own data go through the Data API and are checked by row-level security. Operations that combine several tables atomically are database functions called through RPC. Operations that need a secret, an external service or must not be trusted to the client are Edge Functions; they use a service role that bypasses row-level security, so each function checks the caller's identity itself."),
  ...uml("dsd-backend.png", "4.5", "Structure of the backend (UML component diagram)"),
  P("Tables 4.7 and 4.8 list the server functions and the database functions."),
  table(["Edge Function", "Called by", "Responsibility", "Use cases"], [
    ["scan", "Mobile App", "Consume quota; store the photo if consent is granted; call the recognition service with the list of recognizable codes and a JSON schema; discard unknown codes; record the recognition; return the result. Returns the quota if the service fails.", "UC-4.2"],
    ["scan-feedback", "Mobile App", "Store the foods and grams confirmed by the user and the correction flags for a recognition.", "UC-4.2"],
    ["barcode-lookup", "Mobile App", "Find a barcode in the catalogue, otherwise in Open Food Facts; add a found product to the catalogue.", "UC-4.3"],
    ["subscription-verify", "Mobile App", "Verify a purchase or restore with the store and write the subscription.", "UC-6.1, UC-6.2"],
    ["store-webhook", "App Store, Google Play", "Verify and apply subscription notifications; ignore duplicates.", "UC-6.3"],
    ["account-delete", "Mobile App", "Delete photos, training copies and the account with all its rows.", "UC-1.4"],
    ["data-export", "Mobile App", "Build an export file of all personal data and return a short-lived signed link.", "UC-7.3"],
    ["send-reminders", "Scheduler (cron)", "Send due meal and weigh-in reminders through the push service, skipping meals already logged.", "UC-8.3"],
  ], [1800, 1500, 4838, 1500]),
  tcap("Server functions (Edge Functions)"),
  table(["Database function", "Responsibility", "Use cases"], [
    ["search_foods(query, limit)", "Normalise the query (Turkish characters, case), search names and alternative names with trigram similarity, rank by similarity and the user's logging frequency.", "UC-3.1"],
    ["consume_scan_quota(date)", "Atomically increase the user's daily recognition count if it is below the limit and the user has no active Premium subscription; return whether the recognition is allowed.", "UC-4.2"],
    ["refund_scan_quota(scan_id)", "Return the quota of a failed recognition.", "UC-4.2"],
    ["copy_meal(from, to, meal)", "Copy the entries of a meal to another day in one transaction with current catalogue values.", "UC-4.6"],
    ["current_targets(date)", "Return the nutrition target valid on a date.", "UC-5.1, UC-5.2"],
  ], [2600, 5538, 1500]),
  tcap("Database functions (RPC)"),
  ...decision("DD-8", "Server-side enforcement of limits and Premium", "Quota and subscription state are written only by server code; the quota is consumed by one atomic database statement before the recognition service is called.",
    "(a) Count recognitions on the client; (b) check the quota after the recognition.",
    "A client can be modified, so any limit checked only on the client can be bypassed. Consuming the quota atomically before the expensive call also prevents parallel requests from exceeding the limit.",
    "DG3; FR-5.7, FR-10.5, NFR-20"),
  H2("4.5. Data Design"),
  P("The database schema implements the domain model of [1], Section 5. Table 4.10 maps the domain classes to tables. Schema changes are made only through migration files in *supabase/migrations/* (NFR-36); the detailed table definitions are in the team's data model document [13]."),
  table(["Domain class [1]", "Table", "Notes"], [
    ["UserAccount", "auth.users (managed)", "All user tables reference it with on delete cascade, which implements account deletion (FR-1.6)."],
    ["UserProfile, ReminderSetting", "profiles", "One row per user; reminder settings as a JSON column."],
    ["NutritionTarget", "nutrition_targets", "Insert-only; the target of a day is the latest row with effective_from ≤ day."],
    ["MealEntry", "meal_logs", "Client-generated UUID primary key; nutrition snapshot columns; index (user_id, log_date)."],
    ["WeightEntry, WaterEntry", "weight_logs, water_logs", "Unique (user_id, measured_on) for weight."],
    ["Food, FoodCategory, AlternativeName, PortionUnit, NutrientValue, StandardRecipe, RecipeIngredient, ConfusionGroup", "foods, food_categories, food_aliases, food_portions, food_nutrients, recipe_ingredients, confusion_groups", "Shared catalogue; unique food code and barcode; a search table with a trigram index on normalised names."],
    ["Recognition, RecognitionItem, Candidate", "scans, scan_items", "Candidates stored as a JSON array in scan_items; created only by the scan function."],
    ["DailyRecognitionUsage", "scan_usage", "Primary key (user_id, usage_date); changed only by the quota functions."],
    ["Subscription", "subscriptions", "Unique original transaction ID; written only by server functions."],
    ["Consent", "consents", "Insert-only; the current decision is the latest row of each type."],
  ], [3000, 3100, 3538]),
  tcap("Mapping of domain classes to database tables"),
  P("Every table has row-level security enabled with the default “no access”. Catalogue tables can be read by every signed-in user for verified foods and the user's own foods. User tables can be read and written only by their owner. Recognition, quota and subscription tables can be read by their owner and written only by server code. Photos are stored in a private bucket under a path that starts with the user's identifier and are accessed only through signed links valid for a few minutes (NFR-21)."),
  H2("4.6. Security Design"),
  P("Table 4.11 shows how the security requirements of [1] are met by the structure described above."),
  table(["Requirement", "Design element"], [
    ["NFR-17 Encrypted communication", "All APIs are HTTPS only (TLS 1.2 or later)."],
    ["NFR-18 No secrets on the device", "Keys of the recognition service, the stores and Open Food Facts exist only as Edge Function secrets; the client has only the public project key and the user's JWT."],
    ["NFR-19 Database-level access control", "Row-level security on every table (Section 4.5)."],
    ["NFR-20 Server-side limits", "DD-8."],
    ["NFR-21 Private photos", "Private bucket, per-user paths, short-lived signed links."],
    ["NFR-22 Secure session storage", "Session tokens in expo-secure-store (iOS Keychain, Android Keystore)."],
    ["NFR-23, FR-11.2 Consent", "Server functions read the latest consent row before processing health data or storing a photo."],
  ], [3200, 6438]),
  tcap("Security requirements and the design elements that meet them"),
  H2("4.7. Realisation of a Key Use Case"),
  P("Figure 4.6 shows how the design elements of this section realise UC-4.2 Log Meal by Photo in Phase 1, the most complex use case of [1]. It refines the analysis-level sequence diagram of [1] (Figure 4.5) with the classes and functions of the design. Saving the confirmed items afterwards uses the logging feature and the offline queue as in UC-4.1."),
  ...uml("dsd-sd-scan.png", "4.6", "Design-level sequence diagram of UC-4.2 Log Meal by Photo, Phase 1"),
];

// 5. Environment
const s5 = [
  H1("5. Software System Environment"),
  H2("5.1. Hardware and Operating Systems"),
  B("**User devices:** smartphones with iOS 16 or later and Android 9 (API level 28) or later (NFR-31), with a camera. No depth sensor or other special hardware is required. The reference device for performance requirements is a mid-range phone released in 2023 or later."),
  B("**Backend:** the managed Supabase platform in the EU Frankfurt region (eu-central-1) (NFR-33). No servers are operated by the team."),
  B("**Development:** macOS computers (required for iOS builds and the iOS simulator) and Android emulators; physical iPhone and Android test devices."),
  B("**Model training (Phase 2):** GPU environments such as Google Colab or Kaggle, and university resources if available."),
  H2("5.2. Programming Languages and Platforms"),
  P("Table 5.1 specifies the languages, platforms and versions. Versions are fixed at the start of the implementation and recorded in the lock files of the repository; the Expo SDK determines compatible versions of React Native and its modules."),
  table(["Part", "Language / platform", "Version"], [
    ["Mobile application", "TypeScript", "6.0"],
    ["", "React Native with React", "0.88 with React 19.3"],
    ["", "Expo SDK, Expo Router", "SDK 58"],
    ["", "JavaScript engine", "Hermes (default of React Native)"],
    ["", "Local database", "SQLite through expo-sqlite"],
    ["", "State and data fetching", "TanStack Query 5, Zustand 5"],
    ["", "Backend client", "supabase-js 2"],
    ["Backend", "Database", "PostgreSQL 17 (Supabase) with the extensions pg_trgm and unaccent"],
    ["", "Database functions and migrations", "SQL, PL/pgSQL"],
    ["", "Edge Functions", "TypeScript on the Supabase Edge Runtime (Deno 2)"],
    ["Machine learning (Phase 2)", "Python with PyTorch", "Python 3.12, PyTorch 2 (minor version fixed at the start of Phase 2)"],
    ["", "On-device inference runtime", "To be selected in Phase 2 between ExecuTorch and LiteRT"],
    ["Catalogue pipeline", "TypeScript (Node.js) scripts", "Node.js 24 LTS"],
  ], [2600, 3800, 3238]),
  tcap("Languages, platforms and versions"),
  H2("5.3. Development and Operation Tools"),
  table(["Purpose", "Tool"], [
    ["Version control and code review", "Git, GitHub (pull requests with at least one reviewer)"],
    ["Continuous integration", "GitHub Actions: type checking, linting, unit tests, catalogue validation, database tests"],
    ["Local backend", "Supabase CLI (local database, migrations, function serving, database tests)"],
    ["Mobile builds and store submission", "Expo Application Services: EAS Build, EAS Submit, EAS Update for over-the-air updates"],
    ["Testing", "Jest with jest-expo and React Native Testing Library; Deno test for Edge Functions; pgTAP for database tests; Maestro for end-to-end tests on devices"],
    ["Code quality", "ESLint, Prettier, TypeScript strict mode"],
    ["Design and modelling", "Figma (user interface), PlantUML (UML diagrams)"],
    ["Project management", "GitHub Issues and Projects"],
  ], [3000, 6638]),
  tcap("Development and operation tools"),
  H2("5.4. Environments"),
  table(["Environment", "Backend", "Mobile build", "Use"], [
    ["Local", "Supabase CLI on the developer's computer", "Development build", "Development and automated tests"],
    ["Staging", "Supabase cloud project (free plan)", "Preview build (TestFlight, internal testing)", "Team and beta testing"],
    ["Production", "Supabase cloud project (Pro plan, daily backups)", "Production build (App Store, Google Play)", "Real users"],
  ], [1600, 3200, 2800, 2038]),
  tcap("Environments"),
  H2("5.5. Deployment"),
  P("Figure 5.1 shows the deployment of Zindeo. The mobile application is built by EAS from the repository and distributed through the stores; JavaScript-only changes can be delivered as over-the-air updates. Database migrations and Edge Functions are deployed to Supabase by the CI pipeline. Compared with the deployment diagram of [1] (Figure 8.1), this diagram adds the build and delivery path and the versions of the runtime environments."),
  ...uml("dsd-deployment.png", "5.1", "Deployment of Zindeo (UML deployment diagram)"),
];

// 6. Detailed design
const s6 = [
  H1("6. Software System Detailed Design"),
  P("The detailed design will be carried out in the context of the COMP 4920 course in the next semester and will be given in Revision 2.0 of this document. Following the structure of Section 4, it will contain for each subsystem:"),
  B("**Mobile application:** the classes, hooks and methods of each feature module and Core module with their parameters and logic (UML class and activity diagrams), and the detailed design of every user interface screen, including layouts, navigation, states (loading, empty, error, offline) and accessibility."),
  B("**Backend:** the complete database schema with constraints, indexes and row-level security policies; the request and response formats and error codes of every Edge Function and RPC function."),
  B("**Catalogue Content Pipeline:** the file formats and the validation rules."),
  B("**Machine Learning Pipeline:** the model architectures, training procedures, calibration and quantization steps, and the evaluation protocol."),
];

// 7. Testing design
const s7 = [
  H1("7. Testing Design"),
  P("Testing is organised in levels that follow the structure of Section 4. Table 7.1 lists the levels; Table 7.2 lists the acceptance tests of the requirements in [1] that need a specific test setup."),
  table(["Level", "Scope", "Tool", "When"], [
    ["Unit", "core/nutrition with the reference test vectors of the team's nutrition specification [13] (NFR-8); recognizers with recorded responses; offline queue; utility functions.", "Jest", "Every pull request"],
    ["Database", "Row-level security of every table with two test users (NFR-19); quota functions under concurrent calls; search with Turkish characters (FR-3.2).", "pgTAP, Supabase CLI", "Every pull request"],
    ["Function", "Edge Functions with the external services replaced by test doubles: quota exceeded, service failure, unknown codes, duplicate store notifications.", "Deno test", "Every pull request"],
    ["Catalogue", "Validation of every catalogue change (FR-15.2).", "CI script", "Every pull request"],
    ["End-to-end", "Main flows on real devices: registration and onboarding, logging by search and by photo, offline logging, purchase in the store sandbox, account deletion.", "Maestro, store sandboxes", "Before each release"],
    ["Model evaluation", "Recognition accuracy and energy error on the fixed test set (FR-16.3).", "ml/evaluate", "Phase 1 selection; each model version"],
  ], [1500, 4638, 1800, 1700]),
  tcap("Test levels"),
  table(["Requirement", "Acceptance test"], [
    ["NFR-1, NFR-3 Performance", "Cold start and photo result time measured on the reference device over a typical 4G connection; 90th percentile below the limit."],
    ["NFR-4 Logging effort", "Count of taps and time for a set of typical meals by test users who have not seen the application before."],
    ["NFR-5–NFR-7 Accuracy", "Evaluation report on the fixed test set and its weighed subset; Phase 1 service as the baseline."],
    ["NFR-11 Accessibility", "Screen reader walkthrough of the main flows on iOS and Android; contrast check of the design system colours."],
    ["NFR-25, FR-1.6 Deletion", "After account deletion, no rows or files of the test user remain in the database, storage or training data."],
  ], [3000, 6638]),
  tcap("Acceptance tests that need a specific setup"),
];

// 8. Traceability
const s8 = [
  H1("8. Design Traceability"),
  P("Table 8.1 summarises the design decisions of this document and the requirements of [1] that motivate them. Table 8.2 shows where each use case package of [1] is implemented."),
  table(["Decision", "Title", "Requirements and design goals"], DECISIONS, [1200, 4200, 4238]),
  tcap("Design decisions"),
  table(["Use case package [1]", "Mobile application", "Backend"], [
    ["UC-1 Account Management", "auth", "Auth, account-delete"],
    ["UC-2 Profile and Goals", "onboarding, settings, weight; core/nutrition", "profiles, nutrition_targets"],
    ["UC-3 Food Catalogue", "food-search", "search_foods, catalogue tables"],
    ["UC-4 Meal Logging", "logging, scan, barcode; core/recognition, core/offline", "scan, scan-feedback, barcode-lookup, consume_scan_quota, copy_meal"],
    ["UC-5 Progress Tracking", "dashboard, weight", "current_targets, meal_logs, weight_logs"],
    ["UC-6 Subscription", "subscription", "subscription-verify, store-webhook"],
    ["UC-7 Privacy and Consent", "onboarding, privacy", "consents, data-export"],
    ["UC-8 Settings and Notifications", "settings", "send-reminders"],
    ["UC-9 Smart Assistance (Phase 2)", "fridge, restaurants; core/recognition", "To be designed in COMP 4920"],
    ["UC-10 Catalogue Administration", "—", "Catalogue Content Pipeline"],
  ], [3000, 3600, 3038]),
  tcap("Implementation of the use case packages"),
];

// References
const refs = [
  "Zindeo Team, “Zindeo: Requirements Specifications Document, Revision 2.0,” COMP 4910 Senior Design Project 1, Nov. 20, 2026.",
  "S. Bennett, S. McRobb and R. Farmer, *Object-Oriented Systems Analysis and Design Using UML*, 4th ed. McGraw-Hill, 2010.",
  "R. S. Pressman, *Software Engineering: A Practitioner's Approach*, 7th ed. McGraw-Hill, 2010.",
  "Object Management Group, *OMG Unified Modeling Language (OMG UML)*, Version 2.5.1, formal/17-12-05, Dec. 2017.",
  "L. Bass, P. Clements and R. Kazman, *Software Architecture in Practice*, 4th ed. Addison-Wesley, 2021.",
  "E. Gamma, R. Helm, R. Johnson and J. Vlissides, *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley, 1994.",
  "Meta Platforms, React Native documentation. [Online]. Available: reactnative.dev",
  "Expo, Expo documentation. [Online]. Available: docs.expo.dev",
  "PostgreSQL Global Development Group, PostgreSQL 17 documentation: Row Security Policies. [Online]. Available: postgresql.org/docs/17/ddl-rowsecurity.html",
  "Supabase, Supabase documentation. [Online]. Available: supabase.com/docs",
  "PyTorch Foundation, PyTorch documentation. [Online]. Available: pytorch.org/docs",
  "Open Food Facts, API documentation. [Online]. Available: openfoodfacts.github.io/openfoodfacts-server/api",
  "Zindeo Team, internal engineering documentation: architecture document, architecture decision records ADR-0001–ADR-0003, data model, nutrition calculation specification, Oct. 2026.",
];
const s9 = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("References")], pageBreakBefore: true }),
  ...refs.map((r, i) => new Paragraph({
    children: [new TextRun(`[${i + 1}]`), new TextRun({ text: "\t" }), ...runs(r)],
    tabStops: [{ type: TabStopType.LEFT, position: 600 }],
    indent: { left: 600, hanging: 600 },
    spacing: { after: 100 },
  })),
];

// ---------- document ----------
const footer = new Footer({
  children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "808080", space: 4 } },
    children: [
      new TextRun({ text: `Zindeo-DSD-1.0, Revision 1.0, ${DATE}`, size: 18 }),
      new TextRun({ text: "\t", size: 18 }),
      new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 18 }),
    ],
  })],
});

const doc = new Document({
  creator: "Zindeo Team",
  title: "Zindeo Design Specifications Document, Revision 1.0",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: "000000" }, paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: "000000" }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: "000000" }, paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ] },
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
      titlePage: true,
    },
    footers: { default: footer, first: new Footer({ children: [new Paragraph({ children: [] })] }) },
    children: [...cover, ...revision, ...toc, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8, ...s9],
  }],
});

const out = process.argv[2] || "Zindeo-DSD-1.0.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out); });
