// Generates docs/moodle/ready-deliverables/Zindeo-RSD-1.0.docx
// Usage: NODE_PATH=<dir containing node_modules with docx@9> node rsd-1.0.js <output.docx>
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, LevelFormat, PageBreak, Footer, PageNumber,
  TableOfContents, TabStopType,
} = require("docx");

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
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: true });
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
function cell(text, width, { header = false, fill } = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header ? { fill: "D9D9D9", type: ShadingType.CLEAR, color: "auto" } : fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text).split("\n").map((line) => new Paragraph({ children: runs(line, { size: 20, bold: header || undefined }) })),
  });
}
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, widths[i])) })),
    ],
  });
}
const caption = (text) => new Paragraph({ children: [new TextRun({ text, italics: true, size: 20 })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 } });
const gap = () => new Paragraph({ children: [], spacing: { after: 120 } });

// Requirement table: ID | Requirement | Priority
const RW = [1000, 7138, 1500];
const reqs = (rows) => [table(["ID", "Requirement", "Priority"], rows, RW), gap()];

// ---------- content ----------
const cover = [
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "COMP4910 Senior Design Project 1, Fall 2026", bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Advisor: Dr. Arman Savran", bold: true, size: 28 })] }),
  ...Array.from({ length: 9 }, () => new Paragraph({ children: [] })),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Zindeo: A Calorie Tracking App with On-Device Food Recognition", bold: true, size: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: "Requirements Specifications Document", bold: true, size: 36 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "30.10.2026", bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Revision 1.0", bold: true, size: 28 })] }),
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
  table(["Revision", "Date", "Explanation"], [["1.0", "30.10.2026", "Initial requirements, textual form"]], [1600, 1800, 6238]),
];

const toc = [
  new Paragraph({ children: [new TextRun({ text: "Contents", bold: true, size: 28 })], spacing: { after: 200 }, pageBreakBefore: true }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
];

// 1. Introduction
const s1 = [
  H1("1. Introduction"),
  H2("1.1. Purpose of This Document"),
  P("This Requirements Specifications Document (RSD) refines the problem definition given in the Project Assignment Form (PAF) of Zindeo. Revision 1.0 describes the requirements in textual form: the problem, the existing systems, the current practice of calorie tracking, the actors, and the functional, data, behavioral and non-functional requirements of the system. Revision 2.0 will model the same requirements in UML (use case, activity, class and state diagrams). The requirement identifiers introduced in this document (e.g. FR-5.4, NFR-3) will be kept unchanged in later revisions so that every UML model element can be traced back to a requirement."),
  H2("1.2. Problem Statement"),
  P("Calorie and nutrition tracking is one of the most effective self-management tools for people who want to lose, gain or maintain weight, and for people who exercise. However, most people who start tracking stop within a few weeks. Our analysis of existing applications and of the literature points to four main reasons:"),
  ...N([
    "**Logging is slow and tedious.** For every meal, the user has to search for the food, choose the right entry among many similar ones and guess the amount. Repeated three to five times a day, this effort makes users give up.",
    "**Turkish cuisine is poorly represented.** The food databases and AI models of global applications are built mainly around Western foods. Turkish home dishes such as karnıyarık, ezogelin soup or kuru fasulye are either missing or misrecognized. In our own test, a leading application recognized a photo of karnıyarık as “etli yufka”.",
    "**Portion size is left to the user.** Saying “one bowl” or “200 g” is a guess for most people, and portion error is the largest source of error in calorie tracking.",
    "**Photo-based recognition in existing applications depends on the cloud.** It does not work without an internet connection, the user's photo leaves the phone, and every recognition request has a server cost that is reflected to users as a high subscription price.",
  ]),
  H2("1.3. Project Goals"),
  P("Zindeo is a mobile calorie and nutrition tracking application for iOS and Android, targeting the Turkish market first. The goals of the project are:"),
  table(["ID", "Goal"], [
    ["G1", "**Fast logging:** a meal can be logged in less than 10 seconds, by taking a photo or by searching."],
    ["G2", "**Accurate recognition of Turkish dishes:** a food recognition model trained on a Turkish food dataset collected and labelled by the team, covering at least 100 dishes."],
    ["G3", "**Automatic portion estimation:** the weight of each food on a plate is estimated from a single photo, using the plate as a size reference, without a depth sensor or an extra reference object."],
    ["G4", "**Personalised and safe goals:** daily calorie and macronutrient targets calculated from the user's body data and goal, within medically reasonable safety limits."],
    ["G5", "**On-device AI:** the recognition models run on the phone, without an internet connection and without a per-request server cost."],
    ["G6", "**A real product:** the application is published on the App Store and Google Play with a sustainable freemium business model."],
  ], [1000, 8638]),
  gap(),
  H2("1.4. Scope and Project Outputs"),
  P("The project is carried out over two semesters (COMP 4910 and COMP 4920). The scope is divided into two phases:"),
  B("**Phase 1 (first semester and early second semester):** the complete tracking application (accounts, goal setting, food database and search, meal logging, dashboard, weight tracking, subscriptions, privacy) with photo-based recognition provided by a cloud vision-language model called through the Zindeo backend. In parallel, the team collects and labels the Turkish food dataset."),
  B("**Phase 2 (second semester):** Zindeo's own food recognition and portion estimation models trained with PyTorch replace the cloud service and run on the device. The fridge ingredient detection with recipe suggestions and the healthy restaurant map are added. The own models are compared with the Phase 1 cloud service on the same test set."),
  P("The outputs (deliverables) of the project are:"),
  ...N([
    "Zindeo mobile application for iOS and Android.",
    "Zindeo backend: database, authentication, file storage and server functions.",
    "Zindeo food catalogue: Turkish dishes, ingredients and packaged products with nutrition values and portion units.",
    "A labelled Turkish food image dataset, including a subset with weighed portions.",
    "Trained food recognition, portion estimation and ingredient detection models optimised for mobile devices, with an evaluation report.",
    "Project documentation: PAF, RSD, DSD, final reports, product manual.",
  ]),
  P("Out of scope: a web application, a dietitian panel, social features (friends, feeds), smartwatch applications and medical nutrition plans (e.g. for diabetes or kidney disease)."),
  H2("1.5. Target Users"),
  P("The primary users are smartphone users in Türkiye, aged 18–45, who track or want to track what they eat:"),
  B("**Weight loss users** who have a target weight and want to follow a daily calorie deficit."),
  B("**Sports and fitness users** who follow protein and macronutrient targets for muscle gain or body recomposition."),
  B("**Health-conscious users** who do not have a weight goal but want to see what they eat."),
  H2("1.6. Approach: Two-Phase Recognition Strategy"),
  P("Training an accurate recognition model requires a large labelled dataset, which takes time to collect. Instead of waiting for the model, Zindeo is developed so that the recognition engine can be replaced without changing the rest of the application:"),
  B("The application uses recognition through a single interface that receives a photo and returns, for each food on the plate, a list of candidate foods from the Zindeo catalogue with confidence scores and an estimated weight in grams."),
  B("In Phase 1, a cloud vision-language model implements this interface through the Zindeo backend. In Phase 2, Zindeo's own on-device model implements it, and the cloud model may remain as a fallback when the on-device model is not confident."),
  B("**Calories and nutrients are never taken from the recognition engine.** They are always calculated from the Zindeo food catalogue using the recognized food and its weight. This keeps photo, search and barcode logging consistent and prevents “invented” nutrition values."),
  B("Every photo that the user confirms or corrects becomes a labelled training example, if the user has given explicit consent. Phase 1 therefore also serves as a data collection phase for Phase 2."),
];

// 2. Existing Systems
const s2 = [
  H1("2. Existing Systems"),
  P("This section summarises the existing commercial applications and the academic work related to Zindeo. The full analysis, covering 10 applications and 32 papers, datasets and methods, is kept in the team's research spreadsheet [3]. Claims of companies (accuracy, number of downloads) are as published by the companies and have not been independently verified."),
  H2("2.1. Commercial Applications"),
  table(["Application", "Market", "Photo recognition and portion estimation", "Limitation with respect to Zindeo"], [
    ["FatSecret", "Global", "Photo is sent to the company's cloud API; dishes and portions are matched with a large nutrition database.", "Cloud only. In our test, karnıyarık was recognized as “etli yufka”."],
    ["MyFitnessPal (Meal Scan)", "Global", "Premium feature; recognizes multiple foods with the camera. Automatic weight estimation is reported as under development.", "Paid feature; no specific work on Turkish dishes."],
    ["Cal AI", "Global", "Uses the phone's depth sensor for volume; claims about 90% accuracy on visible foods.", "Requires a depth sensor for volume; model and data not disclosed."],
    ["SnapCalorie", "Global", "About 5,000 dishes photographed and weighed with a robotic setup; claims calorie error below 20%.", "Not focused on Turkish cuisine; uses depth sensors where available."],
    ["Foodvisor", "Global", "Estimates distance from camera autofocus data, then area and volume per food type.", "Not focused on Turkish cuisine."],
    ["Lose It! (Snap It)", "Global", "Estimates food and calories from a photo.", "Reported difficulty with photos containing multiple foods."],
    ["YAZIO", "Global", "Photo-based estimation in the PRO subscription.", "Database strong in European products; no Turkish dish focus."],
    ["Diyetkolik", "Türkiye", "Photo logging in beta; voice/text logging, barcode reader.", "Accuracy on Turkish dishes not published."],
    ["Neyedim", "Türkiye", "Focused on Turkish cuisine; user corrects the amount in grams or ml.", "iOS only; no automatic weight estimation method published; dataset and accuracy not published."],
    ["Kalorita", "Türkiye", "Trained with Turkish dishes; user places a finger next to the plate as a size reference.", "iOS and Turkish only; requires an extra reference object; dataset and accuracy not published."],
  ], [1700, 1000, 3638, 3300]),
  caption("Table 2.1. Existing commercial applications with photo-based food recognition"),
  P("Two observations are important for Zindeo. First, none of the examined applications states that its recognition model runs on the phone without an internet connection; in the known cases, the photo is sent to a server. Second, the applications focusing on Turkish food (Neyedim, Kalorita) are available only on iOS and do not publish their datasets or accuracy results."),
  H2("2.2. Academic Work and Datasets"),
  B("**Turkish food recognition.** The first Turkish food benchmark, TurkishFoods-15, contains 15 dishes and 7,411 images [4]. TurkishFoods-25 extends it to 25 dishes and about 11,500 images and was used in a mobile classification application with 93% accuracy, without portion estimation [5]. The closest recent work recognizes 40 Turkish dishes with 93.5% accuracy using a large model (EfficientNetV2-L) and falls back to a cloud model (Gemini) when uncertain, reporting a mean absolute portion weight error of 18.4 g [6]. Large general-purpose vision-language models reach only about 77% weighted F1 on the 25 Turkish dishes without training and do not fit on a phone [7]."),
  B("**General food datasets.** Food-101 (101 dishes, 101,000 images) is the most widely used benchmark [8]. Larger datasets such as Food2K and FoodX-251 are useful for pre-training and fine-grained classification [3]."),
  B("**Portion and calorie estimation.** Nutrition5k provides about 5,000 real dishes with weighed components and calorie labels [9]. Im2Calories proposed a mobile food diary with on-phone classification and volume estimation [10]. ECUSTFD uses a reference object in every image for calibration [11]. FoodSeg103 provides pixel-level food segmentation masks [12]."),
  B("**Application evaluation.** A comparative study of 18 nutrition applications found that AI-enabled applications have large errors on mixed and non-Western dishes, for example overestimating the energy of pho by 49% [13]. Turkish cuisine consists largely of mixed dishes (stews, dolma, casseroles), which supports the motivation of this project."),
  B("**Mobile deployment.** Mobile-friendly architectures (EfficientNet, MobileNetV3) [14], [15], confidence calibration with temperature scaling [16] and 8-bit quantization [17] are the main methods for an accurate, small and fast on-device model."),
  H2("2.3. Gap Analysis and Differentiation of Zindeo"),
  table(["Gap in existing systems", "Zindeo's approach"], [
    ["Recognition depends on the cloud", "Own model runs on the device; works offline; no per-request cost; photo stays on the phone (Phase 2)."],
    ["Turkish home dishes are poorly recognized", "Turkish food dataset of at least 100 dishes, trained and evaluated specifically on Turkish cuisine."],
    ["Portion estimation requires a depth sensor or an extra reference object", "The plate itself is used as the size reference; works on any phone."],
    ["Accuracy is claimed but not measured openly", "Accuracy and calorie error are measured on a fixed test set and reported."],
    ["Turkish-focused applications are iOS only", "iOS and Android from the first release."],
    ["The model is confidently wrong", "Calibrated confidence; when uncertain, the user is offered 2–3 alternatives."],
  ], [4300, 5338]),
  caption("Table 2.2. Gaps in existing systems and how Zindeo addresses them"),
];

// 3. Current practice
const s3 = [
  H1("3. Current Practice of Calorie Tracking"),
  P("This section describes how a typical user tracks calories today, without Zindeo, and where the process fails. It corresponds to the description of the current business activities in a classical RSD."),
  H2("3.1. Setting a Goal"),
  P("The user enters body data (sex, age, height, weight), an activity level and a goal into a calorie tracking application or an online calculator. The application calculates a daily calorie target, usually with a basal metabolic rate (BMR) equation multiplied by an activity factor. Many applications allow unrealistic targets, such as very low daily calories or very fast weight loss, without warning the user."),
  H2("3.2. Logging a Meal Manually"),
  ...N([
    "The user opens the application and selects the meal (breakfast, lunch, dinner or snack).",
    "The user types the name of the food. The search often returns many similar user-generated entries with different values, or no result for a Turkish dish; the user picks one or chooses a similar Western dish.",
    "The user estimates the amount. Units such as grams are hard to estimate; units such as “1 serving” are not defined clearly.",
    "The user repeats steps 2–3 for every item on the plate. A plate of rice, beans and cacık requires three separate searches.",
    "The application adds the calories and shows the remaining calories for the day.",
  ]),
  H2("3.3. Logging a Meal with a Photo in Existing Applications"),
  P("In applications that support photo logging, the user takes a photo, which is uploaded to the company's server. The server returns the recognized foods and estimated amounts; the user corrects them and saves. This is faster than manual logging, but requires an internet connection, is often limited to paid subscriptions, and is weak on Turkish dishes and on mixed dishes."),
  H2("3.4. Problems in the Current Practice"),
  table(["ID", "Problem"], [
    ["P1", "Manual logging takes too long; users stop tracking after a few weeks."],
    ["P2", "Turkish dishes are missing from databases or have inconsistent, user-generated values."],
    ["P3", "Portion sizes are guessed; this is the largest source of calorie error."],
    ["P4", "Photo recognition misidentifies Turkish and mixed dishes and does not show alternatives when it is uncertain."],
    ["P5", "Photo recognition needs an internet connection and sends personal photos to servers."],
    ["P6", "Unsafe goals (very low calorie targets, very fast weight loss) are possible."],
    ["P7", "Health data is processed without clear consent; users do not know how their photos are used."],
  ], [1000, 8638]),
  gap(),
  H2("3.5. The Proposed Zindeo Workflow"),
  ...N([
    "The user completes a short onboarding; Zindeo calculates safe daily calorie and macro targets (addresses P6).",
    "At a meal, the user takes one photo of the plate (addresses P1).",
    "Zindeo recognizes each dish on the plate and estimates the weight of each dish using the plate as a reference (addresses P3, P4).",
    "If Zindeo is not confident, it shows 2–3 likely alternatives instead of a single wrong answer (addresses P4).",
    "Calories and nutrients are calculated from Zindeo's curated catalogue of Turkish and other foods (addresses P2).",
    "The user confirms or corrects the result and saves it, usually in a few seconds. In Phase 2, all of this works on the phone, offline (addresses P5).",
    "The user decides explicitly whether the photo may be used to improve the model (addresses P7).",
  ]),
];

// 4. Actors
const s4 = [
  H1("4. Actors"),
  P("The following actors interact with Zindeo. The use cases of each actor will be modelled in RSD Revision 2.0."),
  table(["Actor", "Type", "Description"], [
    ["Guest", "Human", "A person who has installed the application but has not registered. Can view the introduction screens and register or sign in."],
    ["User (Free User)", "Human", "A registered user. Sets goals, logs meals by search, photo and barcode, tracks weight and progress, manages privacy settings. Has a limited number of photo recognitions per day."],
    ["Premium User", "Human", "A user with an active subscription. Has unlimited photo recognition and access to premium features. Specialisation of User."],
    ["Content Administrator", "Human", "A member of the Zindeo team who maintains the food catalogue (foods, nutrition values, portions, standard recipes) and reviews new entries."],
    ["Food Recognition Service", "System", "Recognizes foods and estimates weights from a photo. In Phase 1, a cloud vision-language model; in Phase 2, Zindeo's on-device model."],
    ["Identity Provider", "System", "Apple and Google sign-in services."],
    ["App Store / Google Play", "System", "Sell subscriptions, verify purchases and notify renewals, cancellations and refunds."],
    ["Open Food Facts", "System", "Open database of packaged products, queried by barcode."],
    ["Notification Service", "System", "Delivers push notifications to the user's device."],
    ["Scheduler (Time)", "System", "Triggers time-based events: reminders, daily quota reset, target recalculation on birthdays."],
  ], [2400, 1100, 6138]),
  caption("Table 4.1. Actors of Zindeo"),
];

// 5. Functional requirements
const s5 = [
  H1("5. Functional Requirements"),
  P("Functional requirements are grouped by subsystem. Each requirement has a unique identifier and a priority:"),
  B("**Must:** required for the first public release (end of Phase 1)."),
  B("**Should:** planned for the first release; may move to the next update if time does not allow."),
  B("**Could:** desirable; planned after the first release."),
  B("**Phase 2:** planned for the second semester."),
  P("In this document, “the system” refers to the Zindeo mobile application together with its backend."),

  H2("5.1. User Account Management"),
  ...reqs([
    ["FR-1.1", "The system shall allow a guest to register and sign in with an Apple ID (Sign in with Apple).", "Must"],
    ["FR-1.2", "The system shall allow a guest to register and sign in with a Google account.", "Must"],
    ["FR-1.3", "The system shall allow a guest to register with an e-mail address and password, including e-mail verification and password reset.", "Must"],
    ["FR-1.4", "The system shall keep the user signed in between sessions and allow the user to sign out.", "Must"],
    ["FR-1.5", "The system shall restore all of the user's data when the user signs in on a new device.", "Must"],
    ["FR-1.6", "The system shall allow the user to permanently delete the account and all associated data, including photos, from within the application.", "Must"],
  ]),

  H2("5.2. Profile and Goal Setting"),
  ...reqs([
    ["FR-2.1", "The system shall collect the user's sex (male, female or prefer not to say), date of birth, height, current weight and activity level (sedentary, light, moderate, active, very active).", "Must"],
    ["FR-2.2", "The system shall allow the user to select a goal: lose weight, maintain weight or gain weight.", "Must"],
    ["FR-2.3", "The system shall allow the user to select a target weight and a weekly rate (0.25, 0.5, 0.75 or 1.0 kg/week for weight loss; 0.25 or 0.5 kg/week for weight gain).", "Must"],
    ["FR-2.4", "The system shall calculate the daily calorie target from the basal metabolic rate (Mifflin-St Jeor equation [18]), multiplied by the activity factor, minus (or plus) the daily energy difference required by the weekly rate (7,700 kcal per kg).", "Must"],
    ["FR-2.5", "The system shall calculate daily macronutrient targets: protein according to the goal and body weight, fat as 30% of energy, and carbohydrate as the remaining energy.", "Must"],
    ["FR-2.6", "The system shall show the estimated date on which the user will reach the target weight.", "Must"],
    ["FR-2.7", "The system shall enforce safety limits: (a) the weekly weight loss rate shall not exceed 1% of body weight; (b) the daily calorie target shall not be lower than 1,200 kcal (female or not specified) or 1,500 kcal (male); (c) the target weight shall not correspond to a body mass index below 18.5; (d) users under 18 shall not be able to select weight loss; (e) users who state that they are pregnant or breastfeeding shall be warned and shall not be offered weight loss.", "Must"],
    ["FR-2.8", "When a limit in FR-2.7 changes the calorie target, the system shall recalculate the effective weekly rate and the estimated date and inform the user.", "Must"],
    ["FR-2.9", "The system shall recalculate the targets when the user enters a new weight, changes profile data or goal, or has a birthday, and shall keep the history of targets so that past days are evaluated with the targets valid on those days.", "Must"],
    ["FR-2.10", "The system shall allow the user to override the calculated targets manually.", "Should"],
    ["FR-2.11", "The system shall suggest switching to “maintain weight” when the target weight is reached.", "Should"],
  ]),

  H2("5.3. Food Catalogue and Search"),
  ...reqs([
    ["FR-3.1", "The system shall provide a food catalogue containing Turkish home dishes, basic ingredients, world cuisine and packaged products, with energy, protein, carbohydrate and fat values per 100 g.", "Must"],
    ["FR-3.2", "The system shall allow the user to search foods by Turkish or English name and by alternative names (e.g. regional names), and shall return results regardless of Turkish characters (e.g. “ispanak” finds “ıspanak”) and minor spelling mistakes.", "Must"],
    ["FR-3.3", "The system shall rank the user's recently and frequently logged foods higher in search results.", "Must"],
    ["FR-3.4", "The system shall offer food-specific portion units (e.g. bowl, plate, slice, piece, tablespoon, glass) with their gram equivalents, in addition to grams.", "Must"],
    ["FR-3.5", "The system shall calculate the nutrition values of home dishes from standard recipes (ingredients, raw amounts and cooking yield).", "Must"],
    ["FR-3.6", "The system shall allow the user to create custom foods, visible only to that user.", "Should"],
    ["FR-3.7", "The system shall show additional nutrients (fibre, sugar, saturated fat, sodium) where available.", "Should"],
    ["FR-3.8", "The system shall allow the user to create recipes from ingredients and log them as portions.", "Could"],
  ]),

  H2("5.4. Meal Logging"),
  ...reqs([
    ["FR-4.1", "The system shall allow the user to add a food to a meal (breakfast, lunch, dinner or snack) of a given date with a quantity and unit, and shall calculate the weight in grams, the energy and the macronutrients of the entry.", "Must"],
    ["FR-4.2", "The system shall allow the user to edit or delete an entry and to move it to another meal.", "Must"],
    ["FR-4.3", "The system shall allow the user to log entries for past dates.", "Must"],
    ["FR-4.4", "The system shall preselect the meal according to the time of day.", "Must"],
    ["FR-4.5", "The system shall store the nutrition values of an entry at the time of logging, so that later corrections in the catalogue do not change the totals of past days.", "Must"],
    ["FR-4.6", "The system shall allow the user to copy a meal from a previous day to the current day.", "Should"],
    ["FR-4.7", "The system shall allow the user to log water intake.", "Should"],
    ["FR-4.8", "The system shall allow the user to log meals without an internet connection and shall synchronise the entries when the connection is restored, without creating duplicates.", "Should"],
  ]),

  H2("5.5. Image-Based Food Recognition"),
  ...reqs([
    ["FR-5.1", "The system shall allow the user to take a photo of a meal with the camera and submit it for recognition.", "Must"],
    ["FR-5.2", "The system shall identify each food item in the photo, including several items on the same plate (e.g. rice, beans and cacık), as separate items.", "Must"],
    ["FR-5.3", "The recognition shall return only foods that exist in the Zindeo catalogue, each with a confidence score and an estimated weight. Energy and nutrients shall be calculated from the catalogue, never taken directly from the recognition service.", "Must"],
    ["FR-5.4", "When the confidence is below a threshold, or when the recognized food belongs to a group of visually similar dishes (e.g. lentil soup and ezogelin soup), the system shall present 2–3 alternatives instead of a single answer.", "Must"],
    ["FR-5.5", "The system shall show a result screen listing the recognized items, their estimated weights and the total energy, and shall allow the user to confirm, replace an item, remove an item, add a missing item or adjust the weight before saving to a meal.", "Must"],
    ["FR-5.6", "The system shall store the user's final confirmation or correction together with the recognition result, as a quality measure and, with consent (FR-11.2), as a labelled training example.", "Must"],
    ["FR-5.7", "The system shall limit the number of photo recognitions per day for free users; the limit shall be enforced by the server.", "Must"],
    ["FR-5.8", "When the recognition service is not available, the system shall inform the user and offer logging by search.", "Must"],
    ["FR-5.9", "In Phase 1, recognition shall be performed by a cloud vision-language model called through the Zindeo backend.", "Must"],
    ["FR-5.10", "The system shall allow the user to select a photo from the gallery for recognition.", "Should"],
    ["FR-5.11", "In Phase 2, recognition shall be performed by Zindeo's own model on the device without an internet connection; when the on-device model is not confident and a connection is available, the system may use the cloud service as a fallback.", "Phase 2"],
  ]),

  H2("5.6. Portion Size Estimation"),
  ...reqs([
    ["FR-6.1", "The system shall provide an estimated weight in grams for each recognized food item from a single photo. In Phase 1, the estimate is provided by the cloud recognition service.", "Must"],
    ["FR-6.2", "The user shall always be able to adjust the estimated weight with a slider or with portion units.", "Must"],
    ["FR-6.3", "The system shall detect the plate in the photo and use its known diameter (standard dinner plate, approximately 26 cm) as the scale reference to convert image measurements to real-world area.", "Phase 2"],
    ["FR-6.4", "The system shall segment the region of each food item on the plate and calculate its area.", "Phase 2"],
    ["FR-6.5", "The system shall convert the area of each food to weight using food-specific grams-per-area coefficients, which the team shall determine by photographing and weighing reference portions.", "Phase 2"],
    ["FR-6.6", "When the plate cannot be detected (e.g. bowls, packaged food, food without a plate), the system shall use the default portion of the food and inform the user.", "Phase 2"],
  ]),

  H2("5.7. Barcode Scanning"),
  ...reqs([
    ["FR-7.1", "The system shall allow the user to scan the barcode of a packaged product; the system shall search the product in the Zindeo catalogue and, if not found, in Open Food Facts, and shall add found products to the catalogue.", "Should"],
    ["FR-7.2", "When a product is not found, the system shall allow the user to add it by photographing its nutrition label.", "Could"],
  ]),

  H2("5.8. Dashboard and Progress Tracking"),
  ...reqs([
    ["FR-8.1", "The system shall show the energy consumed and remaining for the current day.", "Must"],
    ["FR-8.2", "The system shall show the progress towards the protein, carbohydrate and fat targets.", "Must"],
    ["FR-8.3", "The system shall list the entries of the day grouped by meal.", "Must"],
    ["FR-8.4", "The system shall show the weekly average energy intake and the adherence to the targets.", "Must"],
    ["FR-8.5", "The system shall allow the user to record body weight and shall show the weight history as a chart.", "Must"],
    ["FR-8.6", "The system shall show the number of consecutive days with at least one entry (logging streak).", "Should"],
    ["FR-8.7", "The system shall provide detailed monthly nutrition reports to Premium users.", "Could"],
    ["FR-8.8", "The system shall synchronise weight and activity data with Apple Health and Health Connect.", "Could"],
  ]),

  H2("5.9. Notifications"),
  ...reqs([
    ["FR-9.1", "The system shall send meal logging reminders at times chosen by the user.", "Should"],
    ["FR-9.2", "The system shall send weigh-in reminders.", "Could"],
  ]),

  H2("5.10. Subscription and Payment"),
  ...reqs([
    ["FR-10.1", "The system shall offer a free tier including all tracking features and a limited number of photo recognitions per day.", "Must"],
    ["FR-10.2", "The system shall offer a Premium subscription with unlimited photo recognitions and premium features.", "Must"],
    ["FR-10.3", "The system shall sell monthly and yearly subscriptions through App Store and Google Play in-app purchases.", "Must"],
    ["FR-10.4", "The system shall show the Premium offer when a free user reaches the daily recognition limit.", "Must"],
    ["FR-10.5", "The system shall verify purchases on the server; the client application shall not be able to grant Premium status by itself.", "Must"],
    ["FR-10.6", "The system shall allow the user to restore purchases on a new device.", "Must"],
    ["FR-10.7", "The system shall process renewal, cancellation, expiry and refund notifications from the stores.", "Must"],
    ["FR-10.8", "The system shall offer a free trial period for Premium.", "Should"],
  ]),

  H2("5.11. Privacy, Consent and Data Management"),
  ...reqs([
    ["FR-11.1", "Before collecting health-related data, the system shall present the information notice required by the Turkish Personal Data Protection Law (KVKK) [19] and obtain the user's explicit consent.", "Must"],
    ["FR-11.2", "The system shall ask separately and optionally for consent to use the user's meal photos for training Zindeo's models. Without this consent, photos shall not be stored after recognition.", "Must"],
    ["FR-11.3", "The system shall allow the user to withdraw any consent at any time from the settings.", "Must"],
    ["FR-11.4", "The system shall record each consent decision with its type, the version of the text shown and the time.", "Must"],
    ["FR-11.5", "The system shall show a health disclaimer stating that Zindeo does not provide medical advice.", "Must"],
    ["FR-11.6", "The system shall allow the user to export all personal data.", "Should"],
  ]),

  H2("5.12. Settings"),
  ...reqs([
    ["FR-12.1", "The system shall allow the user to update personal data and goals.", "Must"],
    ["FR-12.2", "The system shall support metric and imperial units.", "Should"],
    ["FR-12.3", "The system shall support Turkish and English user interface languages.", "Should"],
    ["FR-12.4", "The system shall support light and dark themes.", "Should"],
  ]),

  H2("5.13. Fridge Ingredient Detection and Recipe Suggestions"),
  ...reqs([
    ["FR-13.1", "The system shall allow the user to take a photo of the inside of a fridge and shall detect the ingredients in it (fresh produce and packaged products).", "Phase 2"],
    ["FR-13.2", "The system shall allow the user to confirm and edit the detected ingredient list.", "Phase 2"],
    ["FR-13.3", "The system shall suggest recipes that can be prepared with the ingredients and that fit the user's remaining daily energy and macronutrient targets.", "Phase 2"],
    ["FR-13.4", "The system shall allow the user to log a suggested recipe as a meal.", "Phase 2"],
  ]),

  H2("5.14. Healthy Restaurant Map"),
  ...reqs([
    ["FR-14.1", "With the user's permission to access location, the system shall show nearby restaurants on a map.", "Phase 2"],
    ["FR-14.2", "The system shall highlight restaurants that offer healthy options or dishes that fit the user's remaining daily targets.", "Phase 2"],
    ["FR-14.3", "The system shall show estimated energy values of restaurant dishes using the Zindeo catalogue.", "Phase 2"],
  ]),

  H2("5.15. Food Catalogue Administration"),
  ...reqs([
    ["FR-15.1", "The content administrator shall add and update foods, nutrition values, portion units and standard recipes through version-controlled catalogue files that are loaded into the database.", "Must"],
    ["FR-15.2", "A food shall be published only after validation (all required nutrients present; energy consistent with macronutrients within 15%) and review by a second team member. Unpublished foods shall not be visible to users.", "Must"],
    ["FR-15.3", "Foods shall never be deleted from the catalogue; a removed food shall be marked as deprecated and linked to the food that replaces it.", "Must"],
    ["FR-15.4", "Each food shall have a permanent, human-readable code that is also used as the label of the corresponding recognition class.", "Must"],
  ]),

  H2("5.16. Machine Learning Development"),
  P("These requirements describe the work needed to produce Zindeo's own models. They are project requirements rather than end-user features, but they define deliverables that will be evaluated."),
  ...reqs([
    ["FR-16.1", "The team shall build a labelled Turkish food image dataset covering at least 100 dishes, combining public datasets whose licences allow commercial use (e.g. TurkishFoods-25) with photos collected by the team and, with consent, by users. Datasets licensed for non-commercial research only shall be used for experiments only and shall not be used to train the product model.", "Must"],
    ["FR-16.2", "The team shall write a labelling guideline. Each image shall be labelled with catalogue codes; a subset shall include weighed portions (grams) for evaluating portion estimation.", "Must"],
    ["FR-16.3", "The team shall define a fixed, held-out test set of Turkish dishes, which shall not be used for training, and shall measure top-1 and top-3 accuracy and the energy estimation error on it.", "Must"],
    ["FR-16.4", "The team shall evaluate candidate cloud vision-language models on the test set and select the Phase 1 recognition service based on the results.", "Must"],
    ["FR-16.5", "The team shall train a food recognition model with PyTorch, using transfer learning from mobile-friendly architectures (e.g. EfficientNet, MobileNetV3).", "Phase 2"],
    ["FR-16.6", "The team shall calibrate the model's confidence scores (e.g. temperature scaling) so that the uncertainty threshold in FR-5.4 is meaningful.", "Phase 2"],
    ["FR-16.7", "The team shall train a model for plate detection and food segmentation for portion estimation (FR-6.3–FR-6.5).", "Phase 2"],
    ["FR-16.8", "The team shall train an ingredient detection model for the fridge feature (FR-13.1).", "Phase 2"],
    ["FR-16.9", "The team shall compress the models (e.g. 8-bit quantization) and convert them to a mobile runtime.", "Phase 2"],
    ["FR-16.10", "The team shall compare the own models with the Phase 1 cloud service on the same test set and report the results.", "Phase 2"],
  ]),
];

// 6. Data requirements
const s6 = [
  H1("6. Data Requirements"),
  P("This section describes the main information that Zindeo stores. These entities will be the basis of the class diagrams in RSD Revision 2.0."),
  table(["Entity", "Description", "Main attributes"], [
    ["User Profile", "Personal and body data of a registered user.", "sex, date of birth, height, activity level, goal, target weight, weekly rate, unit system, language, time zone"],
    ["Nutrition Target", "Daily targets valid from a given date; a new record is created at each recalculation.", "effective date, energy, protein, carbohydrate, fat, BMR, TDEE, calculation method version"],
    ["Food", "An item in the catalogue: home dish, ingredient, packaged product or user-defined food.", "code, kind, names (TR/EN), category, nutrition values per 100 g, barcode, brand, recognizable flag, status, data source"],
    ["Food Category", "Two-level hierarchy grouping foods (e.g. Soups › Lentil and legume soups).", "code, names, parent category"],
    ["Alternative Name", "Other names and spellings of a food, used in search.", "text, language"],
    ["Portion Unit", "A food-specific unit and its weight.", "unit (bowl, slice, piece…), grams, label, default flag"],
    ["Standard Recipe", "Ingredients of a home dish used to calculate its nutrition values.", "ingredient, raw amount, cooking yield factor"],
    ["Confusion Group", "A group of visually similar foods that are offered as alternatives.", "code, member foods"],
    ["Meal Entry", "A food logged by a user.", "date, meal, food, portion unit, quantity, grams, energy and macronutrients at logging time, source (search, photo, barcode, copy)"],
    ["Weight Entry", "A body weight measurement.", "date, weight"],
    ["Water Entry", "Water intake.", "date, amount (ml)"],
    ["Recognition (Scan)", "One photo recognition request.", "time, engine (cloud / on-device), model version, status, photo reference (only with consent), duration, cost"],
    ["Recognition Item", "One food detected in a recognition.", "candidates with confidence, estimated grams, final food and grams chosen by the user, corrected flag"],
    ["Daily Recognition Usage", "Number of recognitions used by a user on a day.", "date, count"],
    ["Subscription", "A store subscription of a user.", "platform, product, status, expiry date, original transaction ID"],
    ["Consent", "A consent decision of a user; records are only added, never changed.", "type (health data, training photos, marketing), text version, granted or withdrawn, time"],
  ], [2000, 3500, 4138]),
  caption("Table 6.1. Main data entities"),
  P("The following rules apply to the data:"),
  B("Nutrition values in the catalogue are stored per 100 g of edible portion. Energy (kcal), protein, carbohydrate and fat are mandatory."),
  B("The source of each nutrition value is recorded. The priority of sources is: TürKomp, the Turkish national food composition database [20]; USDA FoodData Central [21]; Zindeo standard recipes; product labels and Open Food Facts [22]; user input (only for the user's own foods)."),
  B("A user's data can be read and changed only by that user. Subscription status and recognition usage can be changed only by the server."),
  B("When a user deletes the account, all personal data and photos of the user are deleted."),
];

// 7. Behavioral requirements
const s7 = [
  H1("7. Behavioral Requirements"),
  P("This section describes the states of the main objects whose behavior depends on their history. They will be modelled as UML state diagrams in RSD Revision 2.0."),
  H2("7.1. Photo Recognition"),
  P("A recognition starts in the **Captured** state when the user takes a photo. It moves to **Uploading** (Phase 1) and **Recognizing**. If the user has no remaining free recognitions, it ends in **Quota Exceeded** and the Premium offer is shown. If the service fails or does not answer in time, it ends in **Failed**, the used quota is returned and logging by search is offered. Otherwise it moves to **Reviewing**, where the user confirms or corrects the items. From **Reviewing**, it ends in **Saved** when the items are added to a meal, or in **Discarded** if the user cancels."),
  H2("7.2. Subscription"),
  P("A user starts with **No Subscription**. A purchase moves the subscription to **Trial** (if a trial is offered) or **Active**. A successful renewal keeps it **Active**. A failed renewal moves it to **Grace Period**, where Premium features remain available for the period defined by the store; if the payment is not completed, it moves to **Expired**. When the user cancels, the subscription remains **Active** until the end of the paid period and then becomes **Expired**. A refund moves it immediately to **Refunded** and Premium features are removed."),
  H2("7.3. Meal Entry Synchronisation"),
  P("An entry created without a connection is in the **Pending Sync** state and is shown to the user immediately. When the connection is restored, it is sent to the server and moves to **Synced**. If sending fails, it stays in **Pending Sync** and is retried. Sending the same entry twice shall not create a duplicate."),
  H2("7.4. Weight Goal"),
  P("A goal is **Active** after onboarding. Each new weight entry recalculates the targets. When the target weight is reached, the goal moves to **Reached** and the user is offered to switch to the maintain goal. The user may change the goal at any time, which creates a new **Active** goal."),
];

// 8. Non-functional
const s8 = [
  H1("8. Non-Functional Requirements"),
  H2("8.1. Performance"),
  ...reqs([
    ["NFR-1", "The application shall be usable within 2 seconds after a cold start on a mid-range phone.", "Must"],
    ["NFR-2", "Search results shall appear within 300 ms after the user types.", "Must"],
    ["NFR-3", "The result of a photo recognition shall be shown within 3 seconds in Phase 1 (cloud, typical 4G connection) and within 1 second in Phase 2 (on-device).", "Must / Phase 2"],
    ["NFR-4", "Logging a meal by search shall require at most 4 taps from the home screen; logging a meal by photo shall take less than 10 seconds for a typical user.", "Must"],
  ]),
  H2("8.2. Accuracy"),
  ...reqs([
    ["NFR-5", "The on-device recognition model shall reach at least 80% top-1 accuracy over at least 100 Turkish dishes on the test set defined in FR-16.3.", "Phase 2"],
    ["NFR-6", "The mean absolute energy estimation error of a plate (recognition and portion estimation together) shall be below 25% on the weighed test subset.", "Phase 2"],
    ["NFR-7", "The accuracy of the Phase 1 cloud service shall be measured and reported on the same test set, as the baseline.", "Must"],
    ["NFR-8", "The calculation of targets and entry values shall exactly match the formulas in FR-2.4, FR-2.5 and FR-4.1; it shall be verified with unit tests on reference cases.", "Must"],
  ]),
  H2("8.3. Resource Usage on the Device"),
  ...reqs([
    ["NFR-9", "The total size of the on-device models shall not exceed 30 MB.", "Phase 2"],
    ["NFR-10", "Photos shall be resized and compressed on the device before upload to reduce data usage and response time.", "Must"],
  ]),
  H2("8.4. Usability and Accessibility"),
  ...reqs([
    ["NFR-11", "The application shall support dynamic text size and screen readers, and shall meet WCAG 2.1 AA colour contrast.", "Must"],
    ["NFR-12", "All user interface texts shall be stored in translation files; Turkish characters shall be handled correctly in search and sorting.", "Must"],
    ["NFR-13", "A first-time user shall be able to complete onboarding in less than 2 minutes.", "Should"],
  ]),
  H2("8.5. Reliability and Availability"),
  ...reqs([
    ["NFR-14", "The backend shall have a monthly availability of at least 99.5%.", "Must"],
    ["NFR-15", "When the recognition service is unavailable, all other features shall continue to work.", "Must"],
    ["NFR-16", "Production data shall be backed up daily.", "Must"],
  ]),
  H2("8.6. Security"),
  ...reqs([
    ["NFR-17", "All communication between the application and the backend shall be encrypted (TLS).", "Must"],
    ["NFR-18", "API keys of external services shall never be stored in the mobile application; external services shall be called only from the backend.", "Must"],
    ["NFR-19", "Access to user data shall be enforced at the database level, so that a user can access only his or her own records.", "Must"],
    ["NFR-20", "Recognition limits and subscription status shall be checked on the server.", "Must"],
    ["NFR-21", "Photos shall be stored in private storage and shall be accessible only through short-lived signed links.", "Must"],
    ["NFR-22", "Session tokens shall be stored in the secure storage of the operating system.", "Must"],
  ]),
  H2("8.7. Privacy and Legal Compliance"),
  ...reqs([
    ["NFR-23", "Body weight, height and nutrition records may be regarded as health data, which is special category personal data under KVKK [19]; they shall be processed only with explicit consent and with additional security measures.", "Must"],
    ["NFR-24", "Since the Phase 1 recognition service may be located outside Türkiye, the transfer of photos abroad shall be evaluated under KVKK and disclosed to the user.", "Must"],
    ["NFR-25", "Data deletion requests shall be completed within 30 days.", "Must"],
    ["NFR-26", "The application shall comply with the App Store Review Guidelines [23] and Google Play policies, including Sign in with Apple, in-app account deletion and in-app purchase for digital content.", "Must"],
    ["NFR-27", "The application shall provide a privacy policy, terms of use and a health disclaimer.", "Must"],
  ]),
  H2("8.8. Health, Safety and Ethics"),
  ...reqs([
    ["NFR-28", "The application shall not present itself as a medical device and shall not give medical advice.", "Must"],
    ["NFR-29", "The application shall not encourage unhealthy behavior: safety limits (FR-2.7) cannot be bypassed, and the user interface shall avoid language that shames the user for exceeding targets.", "Must"],
    ["NFR-30", "Datasets shall be used according to their licences; datasets licensed for non-commercial use only shall not be used in the product model.", "Must"],
  ]),
  H2("8.9. Platform and Environment"),
  ...reqs([
    ["NFR-31", "The application shall run on iOS 16 or later and Android 9 (API level 28) or later, from a single code base.", "Must"],
    ["NFR-32", "The application shall be developed with React Native (Expo) and TypeScript.", "Must"],
    ["NFR-33", "The backend shall be developed on Supabase (PostgreSQL database, authentication, file storage and server functions), hosted in the EU (Frankfurt) region.", "Must"],
    ["NFR-34", "The models shall be developed with PyTorch and deployed with a mobile inference runtime.", "Phase 2"],
  ]),
  H2("8.10. Maintainability and Cost"),
  ...reqs([
    ["NFR-35", "The recognition engine shall be accessed through a single interface, so that it can be replaced without changes in other parts of the application.", "Must"],
    ["NFR-36", "All database schema changes shall be made through version-controlled migration files.", "Must"],
    ["NFR-37", "The nutrition calculation method shall be versioned; the version used for each target shall be recorded.", "Must"],
    ["NFR-38", "The cost of each cloud recognition shall be recorded so that the cost per user can be monitored.", "Must"],
  ]),
];

// 9. Constraints and assumptions
const s9 = [
  H1("9. Constraints and Assumptions"),
  H2("9.1. Constraints"),
  B("**Time and team:** the project is developed by a team of three students over two semesters, in parallel with other courses."),
  B("**Knowledge:** the team has software development experience but no prior experience in deep learning; deep learning skills will be acquired during the project, with the guidance of the project advisor."),
  B("**Budget:** the project has a student budget. Development uses free tiers of services; paid plans (backend, developer accounts, cloud recognition) are needed only near the public release."),
  B("**Computing resources:** model training requires GPUs; free resources (e.g. Google Colab, Kaggle) and, if available, university resources will be used."),
  B("**Data licences:** only datasets with suitable licences can be used for the product. The commercial use of TürKomp data requires permission."),
  B("**Store policies:** App Store and Google Play rules on payments, account deletion and health claims must be followed."),
  B("**Device diversity:** the models must work on mid-range phones without depth sensors."),
  H2("9.2. Assumptions"),
  B("Permission to use TürKomp data can be obtained; otherwise, USDA data and Zindeo standard recipes will be used."),
  B("A cloud vision-language model with acceptable accuracy, cost and terms for Turkish dishes is available for Phase 1."),
  B("A sufficient number of users will give consent for the use of their photos for training."),
  B("Most meals in Türkiye are served on plates of standard sizes, which makes the plate a usable size reference."),
];

// 10. Glossary
const s10 = [
  H1("10. Glossary"),
  table(["Term", "Definition"], [
    ["BMR", "Basal Metabolic Rate: the energy the body uses at rest per day."],
    ["TDEE", "Total Daily Energy Expenditure: BMR multiplied by an activity factor."],
    ["BMI", "Body Mass Index: weight (kg) divided by the square of height (m)."],
    ["Macronutrients", "Protein, carbohydrate and fat; they provide 4, 4 and 9 kcal per gram respectively."],
    ["kcal", "Kilocalorie, the unit of food energy."],
    ["Food catalogue", "Zindeo's curated database of foods with nutrition values and portion units."],
    ["Portion unit", "A household measure (bowl, slice, piece…) with a food-specific weight in grams."],
    ["Standard recipe", "The reference recipe from which the nutrition values of a home dish are calculated."],
    ["Cooking yield factor", "Ratio of the cooked weight of a dish to the total raw weight of its ingredients."],
    ["Confusion group", "A group of visually similar foods with different nutrition values, offered as alternatives."],
    ["Confidence calibration", "Adjusting a model's confidence scores so that they reflect the real probability of being correct."],
    ["Top-1 / Top-3 accuracy", "The percentage of test images whose correct food is the first prediction / among the first three predictions."],
    ["Vision-language model", "A large AI model that processes images and text; used as the Phase 1 recognition service."],
    ["On-device inference", "Running an AI model on the phone instead of a server."],
    ["Quantization", "Representing model weights with fewer bits (e.g. 8-bit integers) to make a model smaller and faster."],
    ["Segmentation", "Finding which pixels of an image belong to each object."],
    ["Freemium", "Business model in which the basic product is free and advanced features require a subscription."],
    ["KVKK", "Kişisel Verilerin Korunması Kanunu, Turkish Personal Data Protection Law No. 6698."],
    ["Phase 1 / Phase 2", "The development phases of Zindeo, described in Section 1.4."],
  ], [2600, 7038]),
];

// 11. References
const refs = [
  "S. Bennett, S. McRobb and R. Farmer, *Object-Oriented Systems Analysis and Design Using UML*, 4th ed. McGraw-Hill, 2010.",
  "R. S. Pressman, *Software Engineering: A Practitioner's Approach*, 7th ed. McGraw-Hill, 2010.",
  "Zindeo Team, “Zindeo – Competitor Analysis, Literature, Datasets and Method Sources,” internal research document, Oct. 20, 2026.",
  "C. Güngör, F. Baltacı, A. Erdem and E. Erdem, “Turkish cuisine: A benchmark dataset with Turkish meals for food recognition,” in *Proc. 25th Signal Processing and Communications Applications Conf. (SIU)*, IEEE, 2017.",
  "Ş. Kayıkçı, Y. Başol and E. Dörter, “Classification of Turkish cuisine with deep learning on mobile platform,” in *Proc. 4th Int. Conf. on Computer Science and Engineering (UBMK)*, IEEE, 2019.",
  "F. Göz et al., “A confidence-aware hybrid vision–language framework for food recognition and nutritional monitoring,” *Nutrients*, vol. 18, no. 15, 2026, doi: 10.3390/nu18152449.",
  "Y. S. Bıçakçı, “Performance comparison of multimodal vision-language models in classifying Turkish dishes,” *Sakarya University Journal of Computer and Information Sciences*, vol. 9, no. 1, 2026.",
  "L. Bossard, M. Guillaumin and L. Van Gool, “Food-101 – Mining discriminative components with random forests,” in *Proc. European Conf. on Computer Vision (ECCV)*, 2014.",
  "Q. Thames et al., “Nutrition5k: Towards automatic nutritional understanding of generic food,” in *Proc. IEEE/CVF Conf. on Computer Vision and Pattern Recognition (CVPR)*, 2021.",
  "A. Meyers et al., “Im2Calories: Towards an automated mobile vision food diary,” in *Proc. IEEE Int. Conf. on Computer Vision (ICCV)*, 2015.",
  "Y. Liang and J. Li, “Computer vision-based food calorie estimation: Dataset, method, and experiment,” arXiv:1705.07632, 2017.",
  "X. Wu et al., “A large-scale benchmark for food image segmentation,” arXiv:2105.05409, 2021.",
  "J. Chen et al., “Evaluating the quality and comparative validity of manual food logging and artificial intelligence-enabled food image recognition in apps for nutrition care,” *Nutrients*, vol. 16, no. 15, p. 2573, 2024.",
  "M. Tan and Q. V. Le, “EfficientNet: Rethinking model scaling for convolutional neural networks,” in *Proc. Int. Conf. on Machine Learning (ICML)*, 2019.",
  "A. Howard et al., “Searching for MobileNetV3,” in *Proc. IEEE/CVF Int. Conf. on Computer Vision (ICCV)*, 2019.",
  "C. Guo, G. Pleiss, Y. Sun and K. Q. Weinberger, “On calibration of modern neural networks,” in *Proc. Int. Conf. on Machine Learning (ICML)*, 2017.",
  "B. Jacob et al., “Quantization and training of neural networks for efficient integer-arithmetic-only inference,” in *Proc. IEEE/CVF Conf. on Computer Vision and Pattern Recognition (CVPR)*, 2018.",
  "M. D. Mifflin, S. T. St Jeor, L. A. Hill, B. J. Scott, S. A. Daugherty and Y. O. Koh, “A new predictive equation for resting energy expenditure in healthy individuals,” *American Journal of Clinical Nutrition*, vol. 51, no. 2, pp. 241–247, 1990.",
  "Republic of Türkiye, Law No. 6698 on the Protection of Personal Data (KVKK), 2016.",
  "Republic of Türkiye Ministry of Agriculture and Forestry, TürKomp – National Food Composition Database. [Online]. Available: turkomp.tarimorman.gov.tr",
  "U.S. Department of Agriculture, FoodData Central. [Online]. Available: fdc.nal.usda.gov",
  "Open Food Facts. [Online]. Available: openfoodfacts.org",
  "Apple Inc., App Store Review Guidelines. [Online]. Available: developer.apple.com/app-store/review/guidelines",
];
const s11 = [
  H1("11. References"),
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
      new TextRun({ text: "Zindeo-RSD-1.0, Revision 1.0, 30.10.2026", size: 18 }),
      new TextRun({ text: "\t", size: 18 }),
      new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 18 }),
    ],
  })],
});

const doc = new Document({
  creator: "Zindeo Team",
  title: "Zindeo Requirements Specifications Document, Revision 1.0",
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
    children: [...cover, ...revision, ...toc, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8, ...s9, ...s10, ...s11],
  }],
});

const out = process.argv[2] || "Zindeo-RSD-1.0.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out); });
