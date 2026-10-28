// Generates docs/moodle/ready-deliverables/Zindeo-RSD-2.0.docx
// Usage: NODE_PATH=<dir containing node_modules with docx@9> node rsd-2.0.js <output.docx>
// UML figures: docs/course/src/figures/uml/*.puml (see figures/README.md)
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
// Chapter / section tracking for automatic table and figure numbers
let chapter = 0, tableNo = 0, figNo = 0, sectionTitle = "";
const H1 = (text) => {
  chapter = parseInt(text, 10);
  tableNo = 0;
  figNo = 0;
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: true });
};
const H2 = (text) => {
  sectionTitle = text.replace(/^[\d.]+\s*/, "");
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
};
const H3 = (text, opts = {}) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)], ...opts });
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
// Numbered table caption within the current chapter, e.g. "Table 5.3. ..."
const tcap = (text) => caption(`Table ${chapter}.${++tableNo}. ${text}`);

// Figure from docs/course/src/figures/<file> with a numbered caption. `num` is the number used
// in the text; it is checked against the automatic number so that references cannot drift.
// UML PNGs are rendered at 220 dpi; they are shown at most at 140% of their natural size and
// scaled down to fit maxW and maxH (px at 96 dpi; the text area is 642 x 970 px).
function figure(file, num, text, { maxW = 642, maxH = 900, dpi = 220, width: fixedW } = {}) {
  const expected = `${chapter}.${++figNo}`;
  if (num !== expected) throw new Error(`Figure ${num} (${file}) is actually Figure ${expected}`);
  const data = fs.readFileSync(path.join(FIG_DIR, file));
  const w = data.readUInt32BE(16), h = data.readUInt32BE(20); // PNG IHDR
  const natural = (w * 96) / dpi;
  const width = fixedW || Math.min(natural * 1.4, maxW, (maxH * w) / h);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200 },
      children: [new ImageRun({ type: "png", data, transformation: { width: Math.round(width), height: Math.round((width * h) / w) }, altText: { title: text, description: text, name: file } })],
    }),
    caption(`Figure ${num}. ${text}`),
  ];
}
const uml = (file, num, text, opts) => figure(`uml/${file}`, num, text, opts);

// Requirement table: ID | Requirement | Priority, captioned with the current section title
const RW = [1000, 7138, 1500];
const reqs = (rows) => [table(["ID", "Requirement", "Priority"], rows, RW), tcap(`${sectionTitle} requirements`)];

// ---------- requirement identifiers of RSD Revision 1.0 ----------
// Number of functional requirements in each group FR-1 ... FR-16 (unchanged from Revision 1.0)
const FR_COUNTS = [6, 11, 8, 8, 11, 6, 2, 8, 2, 8, 6, 4, 4, 3, 4, 10];
const ALL_FR = FR_COUNTS.flatMap((n, g) => Array.from({ length: n }, (_, i) => `FR-${g + 1}.${i + 1}`));
// "FR-5.1-5.4" -> ["FR-5.1", ..., "FR-5.4"]; "FR-2.7" -> ["FR-2.7"]
function expand(spec) {
  const m = /^FR-(\d+)\.(\d+)(?:-\1\.(\d+))?$/.exec(spec);
  if (!m) throw new Error(`Bad requirement reference ${spec}`);
  const [g, a, b = a] = [m[1], +m[2], +(m[3] || m[2])];
  return Array.from({ length: b - a + 1 }, (_, i) => `FR-${g}.${a + i}`);
}
const fmtRefs = (specs) => specs.map((s) => s.replace(/(\.\d+)-(\d+\.\d+)$/, "$1–$2")).join(", ");

// ---------- use case model ----------
// Each use case: id, name, short (Requirements List), priority, actors, traces (FR specs),
// desc, pre, main, alt, post, quality, rel, and optional figs (figures shown after the description).
const PACKAGES = [];
const pkg = (id, name, intro, ucs) => PACKAGES.push({ id, name, intro, ucs });

pkg("UC-1", "Account Management", "Registration, sign-in and deletion of user accounts.", [
  {
    id: "UC-1.1", name: "Register Account", priority: "Must",
    short: "A guest creates an account with Apple, Google or e-mail.",
    actors: "Primary: Guest. Secondary: Identity Provider.",
    traces: ["FR-1.1-1.3"],
    desc: "A person who has installed the application creates a Zindeo account. Sign in with Apple and Google sign-in create the account from the identity returned by the provider; e-mail registration requires a verified e-mail address.",
    pre: ["The application is installed and the guest is not signed in.", "For e-mail registration, the device is connected to the internet."],
    main: [
      "The guest selects “Continue with Apple”, “Continue with Google” or “Register with e-mail”.",
      "For Apple or Google: the system opens the provider's native sign-in dialogue; the guest authenticates; the provider returns an identity token (Figure 4.1).",
      "For e-mail: the guest enters an e-mail address and a password; the system checks the password rules and sends a verification link; the guest opens the link.",
      "The system creates the account and a session, and stores the session in the secure storage of the operating system.",
      "The system starts the onboarding (include UC-2.1).",
    ],
    alt: [
      "2a. The guest cancels the provider dialogue: the system returns to the welcome screen; no account is created.",
      "2b. An account already exists for this identity: the system signs the guest in (UC-1.2) instead of creating a second account.",
      "3a. The e-mail address is already registered: the system offers to sign in or to reset the password (UC-1.3).",
      "3b. The verification link is not opened within 24 hours: the link expires and the guest can request a new one.",
    ],
    post: ["A user account exists and the user is signed in.", "Onboarding has started; no health data is stored until consent is given (UC-7.1)."],
    quality: ["NFR-17, NFR-22: encrypted communication; tokens in secure storage.", "NFR-26: Sign in with Apple is offered together with Google sign-in."],
    rel: "Includes UC-2.1 Complete Onboarding.",
  },
  {
    id: "UC-1.2", name: "Sign In", priority: "Must",
    short: "A registered user signs in, also on a new device, and the data is restored.",
    actors: "Primary: Guest (a person with an account). Secondary: Identity Provider.",
    traces: ["FR-1.1-1.5"],
    desc: "A person with an existing account signs in. The session is kept between application starts, and all data of the user is restored when the user signs in on a new device. Figure 4.1 shows the interaction with an identity provider.",
    pre: ["The person has a Zindeo account and is not signed in on this device."],
    main: [
      "The guest selects the sign-in method used for the account.",
      "The guest authenticates with Apple, Google, or e-mail and password.",
      "The system verifies the credentials and creates a session.",
      "The system stores the session in the secure storage of the operating system.",
      "The system loads the profile, targets, meal entries, weight entries and subscription status of the user.",
      "The system shows the daily dashboard (UC-5.1).",
    ],
    alt: [
      "2a. The e-mail or password is wrong: the system shows an error without telling which one is wrong; after five failed attempts sign-in is delayed.",
      "2b. The guest has forgotten the password: extension point *forgotten password*, UC-1.3.",
      "3a. The account has no completed onboarding: the system continues with UC-2.1.",
      "5a. There is no internet connection: the system shows a connection error; data cannot be restored offline.",
    ],
    post: ["The user is signed in and sees his or her own data.", "The session remains valid on later starts until the user signs out (UC-8.1) or the session is revoked."],
    quality: ["NFR-1: the dashboard is usable within 2 s after a cold start.", "NFR-19, NFR-22: data access limited to the user's own records; tokens in secure storage."],
    rel: "Extended by UC-1.3 Reset Password at the extension point *forgotten password*.",
    figs: [["sd-signin.png", "4.1", "Sequence diagram of UC-1.2 Sign In with an identity provider"]],
  },
  {
    id: "UC-1.3", name: "Reset Password", priority: "Must",
    short: "A user with an e-mail account sets a new password through a link.",
    actors: "Primary: Guest.",
    traces: ["FR-1.3"],
    desc: "A person who registered with e-mail and has forgotten the password sets a new one.",
    pre: ["The person is on the sign-in screen (UC-1.2) and selected “Forgot password”."],
    main: [
      "The guest enters the e-mail address.",
      "The system sends a single-use password reset link if an account exists for the address, and shows the same message in both cases.",
      "The guest opens the link and enters a new password twice.",
      "The system checks the password rules, saves the new password and ends all other sessions of the account.",
      "The system signs the user in and continues with step 5 of UC-1.2.",
    ],
    alt: ["3a. The link has expired (after 1 hour) or was already used: the system asks the guest to request a new link.", "4a. The new password does not meet the rules: the system explains the rules and asks again."],
    post: ["The account has the new password; old sessions are no longer valid."],
    quality: ["NFR-17: the link is sent and opened over encrypted connections.", "The response does not reveal whether an e-mail address is registered."],
    rel: "Extends UC-1.2 Sign In.",
  },
  {
    id: "UC-1.4", name: "Delete Account", priority: "Must",
    short: "The user permanently deletes the account and all personal data.",
    actors: "Primary: User.",
    traces: ["FR-1.6"],
    desc: "The user deletes the account from within the application. All personal data, including photos and any copies of the user's photos in the training dataset, is deleted.",
    pre: ["The user is signed in."],
    main: [
      "The user selects “Delete account” in the settings.",
      "The system explains what will be deleted and that an active store subscription must be cancelled in the store.",
      "The user confirms by re-authenticating (Apple, Google or password).",
      "The system deletes the user's photos from private storage and from the training dataset.",
      "The system deletes the account and all records that belong to it.",
      "The system signs the user out and shows the welcome screen.",
    ],
    alt: ["3a. The user cancels: nothing is deleted.", "4a. Deletion fails because of a server error: the request is kept and retried; the user is informed that deletion will be completed within 30 days."],
    post: ["No personal data of the user remains in the system; anonymous aggregate statistics are not affected."],
    quality: ["NFR-25: deletion is completed within 30 days.", "NFR-26: account deletion is available in the application (store policy)."],
    rel: "—",
  },
]);

pkg("UC-2", "Profile and Goals", "Collection of body data and goals, and calculation of daily nutrition targets.", [
  {
    id: "UC-2.1", name: "Complete Onboarding", priority: "Must",
    short: "A new user gives consent, enters body data and a goal, and receives targets.",
    actors: "Primary: User.",
    traces: ["FR-2.1-2.3", "FR-2.6-2.8", "FR-11.1", "FR-11.5"],
    desc: "After registration, the user gives consent for the processing of health data, enters body data and selects a goal. The system calculates safe daily targets. Figure 4.2 shows the flow, including the safety limits.",
    pre: ["The user has registered (UC-1.1) and has not completed onboarding."],
    main: [
      "The system shows the KVKK information notice and the health disclaimer, and the user gives explicit consent (include UC-7.1).",
      "The user enters sex (male, female or prefer not to say), date of birth, height and current weight.",
      "The user selects an activity level (sedentary, light, moderate, active, very active).",
      "The system offers the goals allowed for the user (lose, maintain, gain) and the user selects one.",
      "For lose or gain, the user selects a target weight and a weekly rate; rates above 1% of body weight per week are disabled.",
      "The system calculates the nutrition targets (include UC-2.2).",
      "The system shows the daily energy, protein, carbohydrate and fat targets and the estimated date of reaching the target weight.",
      "The user confirms; the system saves the profile and the targets and opens the daily dashboard.",
    ],
    alt: [
      "1a. The user does not give consent: the system explains that tracking requires it and does not store health data; the user may give consent later.",
      "4a. The user is under 18, or states pregnancy or breastfeeding: the system shows a warning and does not offer “lose weight”.",
      "5a. The target weight corresponds to a BMI below 18.5: the system rejects it and shows the minimum target weight.",
      "6a. The calorie target is limited by the minimum (FR-2.7 b): the system shows the effective weekly rate and the new estimated date (FR-2.8).",
      "*a. The user leaves the application: the entered values are kept and onboarding continues at the same step on the next start.",
    ],
    post: ["The user profile, a consent record and the first nutrition target exist.", "The weight goal is in the state Active (Figure 6.4)."],
    quality: ["NFR-13: onboarding can be completed in less than 2 minutes.", "NFR-29: the safety limits cannot be bypassed."],
    rel: "Included by UC-1.1. Includes UC-2.2 and UC-7.1.",
    figs: [["ad-onboarding.png", "4.2", "Activity diagram of UC-2.1 Complete Onboarding"]],
  },
  {
    id: "UC-2.2", name: "Calculate Nutrition Targets", priority: "Must",
    short: "The system calculates energy and macro targets within safety limits.",
    actors: "Primary: Scheduler (Time) on the user's birthday; otherwise included by UC-2.1, UC-2.3 and UC-5.4.",
    traces: ["FR-2.4-2.9"],
    desc: "The system calculates the daily energy and macronutrient targets from the latest body data and goal and saves them as a new nutrition target. The algorithm is given in Figure 4.3; its formulas are the requirements FR-2.4, FR-2.5 and FR-2.7.",
    pre: ["The profile contains sex, date of birth, height, activity level and goal, and at least one weight entry exists."],
    main: [
      "The system reads the profile and the latest weight entry and calculates the age.",
      "The system calculates the basal metabolic rate with the Mifflin-St Jeor equation [7] and multiplies it by the activity factor (TDEE).",
      "The system subtracts (lose) or adds (gain) the daily energy difference required by the weekly rate (7,700 kcal per kg).",
      "The system applies the minimum calorie target (1,200 kcal female or not specified, 1,500 kcal male) and recalculates the effective weekly rate if the minimum applies.",
      "The system calculates protein, fat and carbohydrate targets and rounds the values.",
      "The system calculates the estimated date of reaching the target weight.",
      "The system saves a new nutrition target valid from today, with the calculation method version.",
    ],
    alt: ["1a. The user has overridden the targets manually (UC-2.4): the system does not recalculate and offers “apply suggested targets”.", "4a. The minimum applied: the user is informed that the target will be reached at a slower, safer rate (FR-2.8)."],
    post: ["A new nutrition target exists; past days keep the targets that were valid on those days."],
    quality: ["NFR-8: results exactly match the formulas; verified with unit tests on reference cases.", "NFR-37: the method version is recorded."],
    rel: "Included by UC-2.1, UC-2.3 and UC-5.4.",
    figs: [["ad-targets.png", "4.3", "Activity diagram of UC-2.2 Calculate Nutrition Targets"]],
  },
  {
    id: "UC-2.3", name: "Update Profile and Goal", priority: "Must",
    short: "The user changes body data, activity level, goal or rate.",
    actors: "Primary: User.",
    traces: ["FR-2.9", "FR-12.1"],
    desc: "The user changes personal data or the goal; the targets are recalculated from the change onwards.",
    pre: ["The user has completed onboarding."],
    main: [
      "The user opens the profile and goal settings.",
      "The user changes one or more of: height, date of birth, sex, activity level, goal, target weight, weekly rate.",
      "The system validates the values with the same limits as in UC-2.1.",
      "The system recalculates the targets (include UC-2.2) and shows the old and new targets.",
      "The user confirms and the system saves the changes.",
    ],
    alt: ["3a. A value is outside the allowed range or violates a safety limit: the system explains the limit and does not save.", "4a. The user wants to set the targets by hand: extension UC-2.4."],
    post: ["The profile is updated; a new nutrition target is valid from today; a goal change creates a new Active goal (Figure 6.4)."],
    quality: ["NFR-29: safety limits cannot be bypassed."],
    rel: "Includes UC-2.2. Extended by UC-2.4.",
  },
  {
    id: "UC-2.4", name: "Override Targets Manually", priority: "Should",
    short: "The user enters own energy and macro targets.",
    actors: "Primary: User.",
    traces: ["FR-2.10"],
    desc: "A user who follows a plan from a dietitian or coach enters own daily targets instead of the calculated ones.",
    pre: ["The user is in UC-2.3."],
    main: [
      "The user selects “Set targets manually”.",
      "The user enters the energy target and either macronutrient grams or percentages.",
      "The system checks that the energy target is not below the minimum of FR-2.7 and that the macronutrients are consistent with the energy within 5%.",
      "The system saves the targets as manual and stops automatic recalculation.",
    ],
    alt: ["3a. The energy target is below the minimum: the system rejects it and shows the minimum.", "*a. The user selects “Apply suggested targets”: automatic calculation is resumed (UC-2.2)."],
    post: ["Manual targets are valid from today."],
    quality: ["NFR-29: the minimum energy limit also applies to manual targets."],
    rel: "Extends UC-2.3.",
  },
  {
    id: "UC-2.5", name: "Switch to Maintenance Goal", priority: "Should",
    short: "When the target weight is reached, the user is offered “maintain weight”.",
    actors: "Primary: User.",
    traces: ["FR-2.11"],
    desc: "When a recorded weight reaches the target weight, the system congratulates the user and offers switching to the maintain goal.",
    pre: ["The user records a weight (UC-5.4) that reaches or passes the target weight of an Active lose or gain goal."],
    main: [
      "The system marks the goal as Reached and shows the offer.",
      "The user accepts.",
      "The system sets the goal to “maintain” and recalculates the targets (UC-2.2).",
    ],
    alt: ["2a. The user declines: the goal stays Reached and the user may set a new target weight (UC-2.3)."],
    post: ["The user has a new Active maintain goal, or keeps the reached goal."],
    quality: ["NFR-29: the message does not use language that shames or pressures the user."],
    rel: "Extends UC-5.4 at the extension point *target weight reached*.",
  },
]);

pkg("UC-3", "Food Catalogue", "Search and display of the Zindeo food catalogue, and user-defined foods.", [
  {
    id: "UC-3.1", name: "Search Food", priority: "Must",
    short: "The user finds a food by name, tolerant to Turkish characters and typos.",
    actors: "Primary: User.",
    traces: ["FR-3.1-3.3"],
    desc: "The user searches the catalogue by Turkish or English name or by an alternative name. Results are ranked with the user's recent and frequent foods first.",
    pre: ["The user is signed in."],
    main: [
      "The user opens the search (from a meal, or from the food catalogue).",
      "The system shows the user's recent and frequent foods.",
      "The user types at least two characters.",
      "The system normalises the query (Turkish characters, case, extra spaces) and searches names and alternative names, tolerating minor spelling mistakes.",
      "The system shows the results ranked by match quality and by how often the user logged each food, with energy per default portion.",
      "The user selects a result.",
    ],
    alt: ["4a. There is no connection: the system searches the locally stored recent and frequent foods.", "5a. No result: the system suggests creating a custom food (UC-3.3) or scanning a barcode (UC-4.3)."],
    post: ["A food has been selected and is returned to the calling use case."],
    quality: ["NFR-2: results appear within 300 ms.", "NFR-12: Turkish characters are handled correctly (“ispanak” finds “ıspanak”)."],
    rel: "Included by UC-4.1 and UC-3.4. Extended by UC-3.2.",
  },
  {
    id: "UC-3.2", name: "View Food Details", priority: "Must",
    short: "The user sees nutrition values and portion units of a food.",
    actors: "Primary: User.",
    traces: ["FR-3.4", "FR-3.5", "FR-3.7"],
    desc: "The user opens a food to see its nutrition values and portion units before logging it.",
    pre: ["A food has been selected in UC-3.1 or in a meal entry."],
    main: [
      "The system shows the name, category and data source of the food.",
      "The system shows energy, protein, carbohydrate and fat per 100 g and per default portion; fibre, sugar, saturated fat and sodium are shown when available.",
      "The system lists the food-specific portion units with their gram equivalents (e.g. 1 bowl = 250 g).",
      "For home dishes, the system shows that the values are calculated from the Zindeo standard recipe.",
      "The user changes the portion unit and quantity; the system recalculates the values.",
    ],
    alt: ["5a. The user adds the food to a meal: the flow continues in UC-4.1 from step 4."],
    post: ["No data is changed."],
    quality: ["The values shown are exactly those used when the food is logged (NFR-8)."],
    rel: "Extends UC-3.1 at the extension point *result selected*.",
  },
  {
    id: "UC-3.3", name: "Create Custom Food", priority: "Should",
    short: "The user adds a private food with own nutrition values.",
    actors: "Primary: User.",
    traces: ["FR-3.6"],
    desc: "The user creates a food that is missing from the catalogue. The food is visible only to this user.",
    pre: ["The user is signed in."],
    main: [
      "The user selects “Create food”.",
      "The user enters the name, the energy, protein, carbohydrate and fat per 100 g (or per serving with the serving weight) and optionally portion units.",
      "The system checks that the values are complete and that the energy is consistent with the macronutrients within 15%.",
      "The system saves the food as user-defined and owned by the user.",
    ],
    alt: ["3a. The values are inconsistent: the system shows a warning; the user corrects them or confirms them."],
    post: ["The food appears in the user's search results only."],
    quality: ["NFR-19: other users cannot read the food."],
    rel: "—",
  },
  {
    id: "UC-3.4", name: "Create Recipe", priority: "Could",
    short: "The user builds a recipe from ingredients and logs portions of it.",
    actors: "Primary: User.",
    traces: ["FR-3.8"],
    desc: "The user creates an own recipe from catalogue ingredients, and later logs portions of it.",
    pre: ["The user is signed in."],
    main: [
      "The user selects “Create recipe” and enters a name and the number of portions.",
      "The user adds ingredients with amounts (include UC-3.1 for each ingredient).",
      "The system calculates the total and the per-portion nutrition values.",
      "The user saves the recipe; the system stores it as a user-defined food with a portion unit.",
    ],
    alt: ["2a. An ingredient is not found: the user creates it (UC-3.3)."],
    post: ["The recipe can be logged like any other food."],
    quality: ["NFR-8: per-portion values equal the sum of ingredient values divided by the number of portions."],
    rel: "Includes UC-3.1.",
  },
]);

pkg("UC-4", "Meal Logging", "Recording what the user eats: by search, by photo, by barcode, by copying, and water.", [
  {
    id: "UC-4.1", name: "Log Meal by Search", priority: "Must",
    short: "The user finds a food, selects an amount and adds it to a meal.",
    actors: "Primary: User.",
    traces: ["FR-4.1", "FR-4.3-4.5", "FR-4.8"],
    desc: "The main logging flow. The user adds a food to breakfast, lunch, dinner or a snack of a given day; the system calculates the grams and nutrition values of the entry and stores them.",
    pre: ["The user has completed onboarding."],
    main: [
      "The user selects “Add food”; the system preselects the meal according to the time of day and the date shown on the dashboard.",
      "The user searches and selects a food (include UC-3.1).",
      "The system shows the portion units of the food with the default unit selected.",
      "The user selects a unit and a quantity, and changes the meal or date if needed.",
      "The system calculates the weight in grams and the energy and macronutrients from the values per 100 g.",
      "The user confirms; the system stores the entry with a copy (snapshot) of the calculated values and updates the dashboard immediately.",
    ],
    alt: [
      "4a. The user logs for a past date: the entry is evaluated with the targets valid on that date.",
      "6a. There is no connection: the entry is stored locally in the state Pending Sync and synchronised later without duplicates (Figure 6.3).",
    ],
    post: ["A meal entry exists for the selected date and meal; the totals of the day include it."],
    quality: ["NFR-4: at most 4 taps from the home screen.", "FR-4.5: later catalogue corrections do not change this entry."],
    rel: "Includes UC-3.1.",
  },
  {
    id: "UC-4.2", name: "Log Meal by Photo", priority: "Must",
    short: "The user photographs a plate; foods and grams are recognized, confirmed and saved.",
    actors: "Primary: User. Secondary: Food Recognition Service.",
    traces: ["FR-4.1", "FR-4.5", "FR-5.1-5.11", "FR-6.1-6.6", "FR-10.4"],
    desc: "The key use case of Zindeo. The user takes one photo of a meal; each food on the plate is recognized with an estimated weight; the user confirms or corrects the result and saves it to a meal. Energy and nutrients are always calculated from the catalogue. Figure 4.4 shows the activity flow and Figure 4.5 the interaction in Phase 1.",
    pre: ["The user has completed onboarding and allowed camera access."],
    main: [
      "The user opens the camera from the dashboard or from a meal, and takes a photo of the plate.",
      "The system resizes and compresses the photo and checks the user's daily recognition quota on the server.",
      "If training-photo consent is given (UC-7.2), the system stores the photo in private storage.",
      "The system sends the photo with the list of recognizable catalogue foods to the Food Recognition Service.",
      "The Food Recognition Service returns, for each food item on the plate, candidate catalogue foods with confidence scores and an estimated weight in grams.",
      "The system keeps only foods that exist in the catalogue and calculates energy and macronutrients from the catalogue values.",
      "The system shows the result: each item with its weight and energy, and the total. Items with low confidence or in a confusion group (e.g. lentil soup and ezogelin soup) are shown with 2–3 alternatives.",
      "The user confirms the items, or replaces, removes or adds items and adjusts weights with a slider or portion units; the system recalculates the totals after each change.",
      "The user selects the meal and saves.",
      "The system creates one meal entry per item with a nutrition snapshot, and stores the final foods and weights with the recognition as a quality measure and, with consent, as a labelled training example.",
    ],
    alt: [
      "1a. The user selects a photo from the gallery instead of the camera (FR-5.10).",
      "2a. The free user has no recognitions left today: extension point *quota exceeded*; the system shows the Premium offer (UC-6.1). Premium users have no daily limit.",
      "5a. The service fails or does not answer in time: the quota is returned; the system informs the user and offers logging by search (UC-4.1).",
      "5b. No food is detected: the system asks the user to retake the photo or to log by search.",
      "5c. Phase 2: the on-device model recognizes the foods without an internet connection; if it is not confident and a connection is available, the cloud service may be used as a fallback (FR-5.11).",
      "5d. Phase 2: the weight is estimated from the plate (diameter approx. 26 cm) and the segmented area of each food; if no plate is detected, the default portion is used and the user is informed (FR-6.3–FR-6.6).",
      "9a. The user cancels: the recognition is discarded; no meal entry is created.",
    ],
    post: ["Meal entries exist for the confirmed items, or nothing is saved.", "A recognition record with engine, model version, duration, cost and the user's corrections exists."],
    quality: ["NFR-3: the result is shown within 3 s in Phase 1 and 1 s in Phase 2.", "NFR-4: a typical photo log takes less than 10 s.", "NFR-10, NFR-18, NFR-20, NFR-21: compression on the device; external API keys and quota checks only on the server; photos in private storage."],
    rel: "Extended by UC-6.1 Purchase Premium Subscription at the extension point *quota exceeded*.",
    figs: [
      ["ad-photo.png", "4.4", "Activity diagram of UC-4.2 Log Meal by Photo"],
      ["sd-photo.png", "4.5", "Sequence diagram of UC-4.2 Log Meal by Photo (Phase 1, cloud recognition)"],
    ],
  },
  {
    id: "UC-4.3", name: "Log Meal by Barcode", priority: "Should",
    short: "The user scans a packaged product's barcode and logs it.",
    actors: "Primary: User. Secondary: Open Food Facts.",
    traces: ["FR-7.1"],
    desc: "The user logs a packaged product by scanning its barcode. Products not yet in the catalogue are looked up in Open Food Facts and added to the catalogue (Figure 4.6).",
    pre: ["The user has allowed camera access."],
    main: [
      "The user opens the barcode scanner and scans a barcode.",
      "The system searches the barcode in the Zindeo catalogue.",
      "If the product is not in the catalogue, the system looks it up in Open Food Facts and, if it has energy and macronutrient values, adds it to the catalogue with Open Food Facts as the data source.",
      "The system shows the product with its portion units.",
      "The user selects quantity, unit and meal; the flow continues as in UC-4.1 from step 5, with the source “barcode”.",
    ],
    alt: ["3a. The product is not found or has incomplete values: extension point *product not found*; the system offers adding it from its nutrition label (UC-4.4) or logging by search (UC-4.1).", "3b. There is no connection: only barcodes of products already stored on the device can be found."],
    post: ["A meal entry for the product exists; a newly found product is in the catalogue."],
    quality: ["NFR-18: Open Food Facts is called only from the backend."],
    rel: "Extended by UC-4.4.",
    figs: [["ad-barcode.png", "4.6", "Activity diagram of UC-4.3 Log Meal by Barcode"]],
  },
  {
    id: "UC-4.4", name: "Add Product from Nutrition Label", priority: "Could",
    short: "The user adds an unknown product by photographing its nutrition label.",
    actors: "Primary: User.",
    traces: ["FR-7.2"],
    desc: "When a scanned product is not found, the user photographs the nutrition label; the values are read from the photo and confirmed by the user.",
    pre: ["UC-4.3 reached the extension point *product not found*."],
    main: [
      "The user photographs the nutrition facts table of the package.",
      "The system reads the energy, protein, carbohydrate and fat per 100 g and the serving size from the photo.",
      "The user checks and corrects the values and enters the product name.",
      "The system saves the product as a user-defined food linked to the barcode, and the flow returns to UC-4.3 step 4.",
    ],
    alt: ["2a. The label cannot be read: the user enters the values manually (as in UC-3.3)."],
    post: ["The product can be found by its barcode by this user."],
    quality: ["The energy is checked against the macronutrients as in UC-3.3."],
    rel: "Extends UC-4.3 at the extension point *product not found*.",
  },
  {
    id: "UC-4.5", name: "Edit Meal Entry", priority: "Must",
    short: "The user changes the amount of an entry, moves it to another meal or deletes it.",
    actors: "Primary: User.",
    traces: ["FR-4.2"],
    desc: "The user corrects an entry that was logged before.",
    pre: ["The entry exists and belongs to the user."],
    main: [
      "The user selects an entry on the dashboard.",
      "The user changes the unit or quantity, or selects another meal or date.",
      "The system recalculates the grams and values from the current catalogue values and saves a new snapshot.",
      "The system updates the totals of the affected days.",
    ],
    alt: ["2a. The user deletes the entry: the system asks for confirmation, deletes it and updates the totals.", "3a. There is no connection: the change is stored locally and synchronised later (Figure 6.3)."],
    post: ["The entry is changed or deleted."],
    quality: ["NFR-19: a user can change only his or her own entries."],
    rel: "—",
  },
  {
    id: "UC-4.6", name: "Copy Previous Meal", priority: "Should",
    short: "The user copies a meal of a previous day to today.",
    actors: "Primary: User.",
    traces: ["FR-4.6"],
    desc: "Many users eat the same breakfast every day. The user copies all entries of a meal from a previous day.",
    pre: ["The selected previous meal has at least one entry."],
    main: [
      "The user selects “Copy from another day” for a meal.",
      "The system lists the recent days on which this meal has entries, with their totals.",
      "The user selects a day.",
      "The system creates copies of the entries for the current day and meal with the source “copy”, using the current catalogue values.",
    ],
    alt: ["3a. The user deselects some entries before copying: only the selected entries are copied."],
    post: ["The entries exist for the current day."],
    quality: ["NFR-4: copying a meal takes at most 3 taps."],
    rel: "—",
  },
  {
    id: "UC-4.7", name: "Log Water Intake", priority: "Should",
    short: "The user records glasses of water.",
    actors: "Primary: User.",
    traces: ["FR-4.7"],
    desc: "The user records water intake for the day.",
    pre: ["The user is signed in."],
    main: ["The user taps the water card on the dashboard and adds a glass (default 200 ml) or enters an amount.", "The system adds a water entry and shows the total for the day."],
    alt: ["1a. The user removes the last glass: the system deletes the last water entry."],
    post: ["The water total of the day is updated."],
    quality: ["One tap for a standard glass."],
    rel: "—",
  },
]);

pkg("UC-5", "Progress Tracking", "The daily dashboard, reports, body weight and health platform synchronisation.", [
  {
    id: "UC-5.1", name: "View Daily Dashboard", priority: "Must",
    short: "The user sees consumed and remaining energy, macros and entries of a day.",
    actors: "Primary: User.",
    traces: ["FR-8.1-8.3", "FR-8.6"],
    desc: "The home screen of the application. It summarises the selected day against the targets valid on that day.",
    pre: ["The user has completed onboarding."],
    main: [
      "The user opens the application or selects the dashboard.",
      "The system shows consumed and remaining energy for today.",
      "The system shows progress towards the protein, carbohydrate and fat targets.",
      "The system lists the entries grouped by breakfast, lunch, dinner and snacks, with the total of each meal.",
      "The system shows the water total and the logging streak.",
    ],
    alt: ["1a. The user selects another date: the system shows that day with the targets valid on it.", "2a. Energy exceeds the target: the system shows the difference neutrally, without shaming language (NFR-29)."],
    post: ["No data is changed."],
    quality: ["NFR-1: usable within 2 s after a cold start.", "NFR-11: dynamic text size, screen reader labels, WCAG 2.1 AA contrast."],
    rel: "—",
  },
  {
    id: "UC-5.2", name: "View Progress Reports", priority: "Must",
    short: "The user sees weekly averages and adherence to targets.",
    actors: "Primary: User.",
    traces: ["FR-8.4"],
    desc: "The user reviews the last weeks: average energy intake, average macronutrients and on how many days the targets were met.",
    pre: ["The user has entries in the selected period."],
    main: [
      "The user opens the progress screen.",
      "The system shows the weekly average energy intake against the average target of the week.",
      "The system shows the number of days within ±10% of the energy target and the average macronutrient distribution.",
      "The user moves to previous weeks.",
    ],
    alt: ["1a. A Premium user selects the monthly report: extension UC-5.3.", "2a. A week has no entries: the system shows that the week has no data instead of zero values."],
    post: ["No data is changed."],
    quality: ["Each day is evaluated with the target valid on that day (FR-2.9)."],
    rel: "Extended by UC-5.3.",
  },
  {
    id: "UC-5.3", name: "View Monthly Nutrition Report", priority: "Could",
    short: "A Premium user sees a detailed monthly nutrition report.",
    actors: "Primary: Premium User.",
    traces: ["FR-8.7"],
    desc: "A detailed monthly report for Premium users: daily energy chart, macronutrient distribution, most frequent foods and weight change in the month.",
    pre: ["The user has an active Premium subscription (Trial, Active, Grace Period or Cancelled before expiry)."],
    main: ["The user selects a month.", "The system shows the daily energy chart against the targets, the macronutrient distribution, the 10 most frequently logged foods and the weight change."],
    alt: ["*a. A free user selects the report: the system shows the Premium offer (UC-6.1)."],
    post: ["No data is changed."],
    quality: ["NFR-20: Premium status is checked on the server."],
    rel: "Extends UC-5.2 at the extension point *Premium user*.",
  },
  {
    id: "UC-5.4", name: "Record Body Weight", priority: "Must",
    short: "The user records weight; targets are recalculated; the history is charted.",
    actors: "Primary: User.",
    traces: ["FR-8.5", "FR-2.9"],
    desc: "The user records body weight. The new weight recalculates the targets and is added to the weight chart.",
    pre: ["The user has completed onboarding."],
    main: [
      "The user selects “Record weight” and enters the weight (date defaults to today).",
      "The system validates the value (35–300 kg) and saves it; a second entry on the same day replaces the first one.",
      "The system recalculates the targets (include UC-2.2).",
      "The system shows the weight chart and the change since the start of the goal.",
    ],
    alt: ["2a. The change since the last entry is more than 3 kg per week: the system asks for confirmation.", "3a. The target weight is reached: extension point *target weight reached*, UC-2.5."],
    post: ["The weight entry exists; a new nutrition target may be valid from today."],
    quality: ["NFR-8: the recalculation follows FR-2.4 and FR-2.5 exactly."],
    rel: "Includes UC-2.2. Extended by UC-2.5.",
  },
  {
    id: "UC-5.5", name: "Synchronise with Health Platform", priority: "Could",
    short: "Weight and activity data are synchronised with Apple Health / Health Connect.",
    actors: "Primary: User. Secondary: Health Platform.",
    traces: ["FR-8.8"],
    desc: "With the user's permission, Zindeo reads weight entries from and writes them to Apple Health (iOS) or Health Connect (Android).",
    pre: ["The device supports the health platform."],
    main: [
      "The user enables synchronisation in the settings.",
      "The system requests read and write permission for weight from the Health Platform.",
      "The system imports weight entries not yet in Zindeo and exports Zindeo weight entries.",
      "Later weight entries are synchronised automatically when the application is opened.",
    ],
    alt: ["2a. The user denies the permission: synchronisation stays disabled."],
    post: ["Weight data is consistent between Zindeo and the health platform."],
    quality: ["NFR-23: health data is transferred only with the user's permission."],
    rel: "—",
  },
]);

pkg("UC-6", "Subscription", "Selling and maintaining the Premium subscription through the stores.", [
  {
    id: "UC-6.1", name: "Purchase Premium Subscription", priority: "Must",
    short: "The user buys a monthly or yearly Premium subscription through the store.",
    actors: "Primary: User. Secondary: App Store / Google Play.",
    traces: ["FR-10.1-10.5", "FR-10.8"],
    desc: "The user subscribes to Premium with an in-app purchase. The purchase is verified on the server before Premium is granted (Figure 4.7).",
    pre: ["The user is signed in and has no active subscription."],
    main: [
      "The user opens the Premium offer from the settings, or the offer is shown when the daily recognition quota is exhausted (extension of UC-4.2).",
      "The system loads the monthly and yearly products and prices from the store and shows the Premium features and the free trial, if the user is eligible.",
      "The user selects a plan; the store shows its payment dialogue and the user confirms.",
      "The store returns the transaction to the application.",
      "The system sends the transaction to the backend, which validates it with the store and records the subscription (Trial or Active) with its expiry date.",
      "The system unlocks the Premium features and finishes the transaction.",
    ],
    alt: ["3a. The user cancels the payment: nothing changes.", "5a. Validation fails or the backend is unreachable: Premium is not granted; the transaction is kept and validation is retried on the next start."],
    post: ["The subscription is in the state Trial or Active (Figure 6.2); Premium features are available."],
    quality: ["NFR-20: the client cannot grant Premium by itself.", "NFR-26: digital content is sold only through in-app purchase."],
    rel: "Extends UC-4.2 at the extension point *quota exceeded*.",
    figs: [["sd-purchase.png", "4.7", "Sequence diagram of UC-6.1 Purchase Premium Subscription and UC-6.3"]],
  },
  {
    id: "UC-6.2", name: "Restore Purchases", priority: "Must",
    short: "The user restores an existing subscription on a new device.",
    actors: "Primary: User. Secondary: App Store / Google Play.",
    traces: ["FR-10.6"],
    desc: "A user who bought Premium on another device, or reinstalled the application, restores the subscription.",
    pre: ["The user is signed in."],
    main: ["The user selects “Restore purchases”.", "The system requests the user's purchases from the store.", "The backend validates them and links the active subscription to the user's account.", "The system unlocks Premium."],
    alt: ["2a. No purchase is found: the system informs the user.", "3a. The subscription is already linked to another Zindeo account: the system informs the user and does not move it."],
    post: ["An active subscription is linked to the account."],
    quality: ["NFR-20."],
    rel: "—",
  },
  {
    id: "UC-6.3", name: "Process Store Notification", priority: "Must",
    short: "The system updates the subscription after renewal, cancellation, expiry or refund.",
    actors: "Primary: App Store / Google Play.",
    traces: ["FR-10.7"],
    desc: "The stores send server notifications when a subscription changes. The backend updates the subscription status according to the state machine in Figure 6.2.",
    pre: ["A subscription exists in the system."],
    main: [
      "The store sends a server notification to the backend.",
      "The backend verifies that the notification is authentic and identifies the subscription by its original transaction ID.",
      "The backend updates the status and expiry date (renewed, renewal failed, cancelled, expired, refunded).",
      "The application reads the new status on its next request.",
    ],
    alt: ["2a. The notification cannot be verified: it is rejected and logged.", "2b. The same notification is received twice: it is processed only once."],
    post: ["The subscription status matches the store."],
    quality: ["NFR-14: the endpoint is available 99.5% of the month; the stores retry failed deliveries."],
    rel: "—",
  },
]);

pkg("UC-7", "Privacy and Consent", "Consent for special category personal data, consent management and data export.", [
  {
    id: "UC-7.1", name: "Give Health Data Consent", priority: "Must",
    short: "The user reads the KVKK notice and gives explicit consent.",
    actors: "Primary: User (through UC-2.1).",
    traces: ["FR-11.1", "FR-11.4", "FR-11.5"],
    desc: "Before any health-related data is collected, the user reads the information notice and the health disclaimer and gives explicit consent.",
    pre: ["The user has registered and no health data has been stored."],
    main: [
      "The system shows the KVKK information notice (purpose, data, transfer abroad, rights) and the health disclaimer.",
      "The user gives explicit consent for the processing of health data.",
      "The system records the consent with its type, the version of the text and the time.",
    ],
    alt: ["2a. The user refuses: the system records the decision and does not collect health data (Figure 6.6)."],
    post: ["A consent record of type health data exists."],
    quality: ["NFR-23, NFR-24: explicit consent; transfer abroad disclosed."],
    rel: "Included by UC-2.1.",
  },
  {
    id: "UC-7.2", name: "Manage Consents", priority: "Must",
    short: "The user grants or withdraws consents, including use of photos for training.",
    actors: "Primary: User.",
    traces: ["FR-11.2-11.4"],
    desc: "The user views and changes all consent decisions. Consent to use meal photos for training Zindeo's models is optional and separate.",
    pre: ["The user is signed in."],
    main: [
      "The user opens the privacy settings.",
      "The system shows each consent type (health data, training photos, marketing) with the current decision and its date.",
      "The user changes a decision.",
      "The system records the new decision as a new consent record with the text version and time.",
    ],
    alt: [
      "3a. The user withdraws training-photo consent: new photos are no longer stored; the user may also request deletion of photos already collected.",
      "3b. The user withdraws health data consent: the system explains that tracking stops and offers account deletion (UC-1.4) or data export (UC-7.3).",
      "*a. A new version of a consent text is published: the system asks the user again (Figure 6.6).",
    ],
    post: ["The latest consent record of each type reflects the user's decision."],
    quality: ["Consent records are only added, never changed (audit trail)."],
    rel: "—",
  },
  {
    id: "UC-7.3", name: "Export Personal Data", priority: "Should",
    short: "The user downloads all personal data.",
    actors: "Primary: User.",
    traces: ["FR-11.6"],
    desc: "The user exercises the right of access by downloading all personal data in a machine-readable format.",
    pre: ["The user is signed in."],
    main: ["The user selects “Export my data”.", "The system prepares a file with the profile, targets, meal, weight and water entries, consents and subscription history (JSON and CSV), and photos if stored.", "The system offers the file through the share dialogue of the operating system."],
    alt: ["2a. Preparing the file takes long: the system notifies the user when it is ready."],
    post: ["The user has a copy of the data."],
    quality: ["NFR-21: photos are delivered through short-lived signed links."],
    rel: "—",
  },
]);

pkg("UC-8", "Settings and Notifications", "Application preferences and reminders.", [
  {
    id: "UC-8.1", name: "Manage App Settings", priority: "Should",
    short: "The user changes units, language, theme, or signs out.",
    actors: "Primary: User.",
    traces: ["FR-12.2-12.4", "FR-1.4"],
    desc: "The user changes preferences that do not affect the targets, and can sign out.",
    pre: ["The user is signed in."],
    main: ["The user opens the settings.", "The user changes the unit system (metric or imperial), the language (Turkish or English) or the theme (light, dark, system).", "The system applies the change immediately and saves it to the profile."],
    alt: ["2a. The user selects “Sign out”: the system asks for confirmation; pending offline entries are synchronised first if possible; the session is removed and the welcome screen is shown."],
    post: ["The preferences are saved and restored on other devices."],
    quality: ["NFR-12: all texts come from translation files."],
    rel: "—",
  },
  {
    id: "UC-8.2", name: "Configure Reminders", priority: "Should",
    short: "The user chooses meal and weigh-in reminder times.",
    actors: "Primary: User.",
    traces: ["FR-9.1", "FR-9.2"],
    desc: "The user enables reminders for meals and weigh-ins and selects their times.",
    pre: ["The user is signed in."],
    main: ["The user opens the reminder settings.", "The system asks for notification permission if not yet granted.", "The user enables meal reminders and selects times for each meal, and optionally a weekly weigh-in reminder.", "The system saves the reminder settings."],
    alt: ["2a. The user denies the permission: reminders cannot be enabled; the system explains how to enable them later."],
    post: ["Reminder settings are saved."],
    quality: ["Reminders use the user's time zone."],
    rel: "—",
  },
  {
    id: "UC-8.3", name: "Send Reminder", priority: "Should",
    short: "At the chosen time, a reminder notification is delivered.",
    actors: "Primary: Scheduler (Time). Secondary: Notification Service.",
    traces: ["FR-9.1", "FR-9.2"],
    desc: "At a reminder time, the system sends a notification, unless the reminder is no longer needed.",
    pre: ["A reminder is enabled for the current time."],
    main: ["The Scheduler triggers the reminder.", "The system checks whether the meal has already been logged (or the weight recorded).", "If not, the system sends the reminder through the Notification Service.", "The user opens the notification and the application opens the corresponding logging screen."],
    alt: ["2a. The meal is already logged: no notification is sent."],
    post: ["The user has been reminded at most once per reminder."],
    quality: ["Notifications are neutral and do not shame the user (NFR-29)."],
    rel: "—",
  },
]);

pkg("UC-9", "Smart Assistance (Phase 2)", "Features planned for the second semester.", [
  {
    id: "UC-9.1", name: "Get Recipe Suggestions from Fridge Photo", priority: "Phase 2",
    short: "Ingredients in a fridge photo are detected and fitting recipes suggested.",
    actors: "Primary: User. Secondary: Food Recognition Service.",
    traces: ["FR-13.1-13.3"],
    desc: "The user photographs the inside of the fridge. The system detects the ingredients and suggests recipes that can be prepared with them and fit the remaining targets of the day.",
    pre: ["The user has completed onboarding and allowed camera access."],
    main: [
      "The user takes a photo of the inside of the fridge.",
      "The Food Recognition Service detects fresh produce and packaged products.",
      "The system shows the detected ingredients; the user confirms, removes or adds ingredients.",
      "The system selects recipes that use mainly these ingredients and calculates a portion that fits the remaining energy and macronutrients of the day.",
      "The system shows the suggestions with energy and macronutrients per portion.",
    ],
    alt: ["2a. No ingredient is detected: the user enters ingredients manually.", "4a. No recipe fits: the system shows the closest recipes and the amount by which they exceed the remaining targets."],
    post: ["No data is changed unless the user logs a recipe (UC-9.2)."],
    quality: ["NFR-9: the ingredient model fits within the on-device model size limit."],
    rel: "Extended by UC-9.2.",
  },
  {
    id: "UC-9.2", name: "Log Suggested Recipe", priority: "Phase 2",
    short: "The user logs a suggested recipe as a meal.",
    actors: "Primary: User.",
    traces: ["FR-13.4"],
    desc: "The user selects a suggested recipe and logs the suggested portion.",
    pre: ["UC-9.1 shows at least one suggestion."],
    main: ["The user selects a recipe and a portion.", "The flow continues as in UC-4.1 from step 4, with the source “recipe”."],
    alt: [],
    post: ["A meal entry for the recipe exists."],
    quality: ["As in UC-4.1."],
    rel: "Extends UC-9.1 at the extension point *recipe selected*.",
  },
  {
    id: "UC-9.3", name: "Find Healthy Restaurants Nearby", priority: "Phase 2",
    short: "The user sees nearby restaurants with dishes that fit the remaining targets.",
    actors: "Primary: User. Secondary: Location and Map Service.",
    traces: ["FR-14.1-14.3"],
    desc: "With location permission, the system shows nearby restaurants on a map and highlights those that offer dishes fitting the user's remaining targets.",
    pre: ["The user has allowed location access."],
    main: [
      "The user opens the restaurant map.",
      "The system obtains nearby restaurants from the Location and Map Service.",
      "The system matches the restaurants' dishes with catalogue foods and estimates their energy values.",
      "The system highlights restaurants with healthy options or dishes that fit the remaining targets.",
      "The user selects a restaurant and sees the estimated values of its dishes.",
    ],
    alt: ["1a. Location permission is denied: the user can search by district name.", "3a. Dish information is not available: the restaurant is shown without estimates."],
    post: ["No data is changed."],
    quality: ["The location is not stored."],
    rel: "—",
  },
]);

pkg("UC-10", "Catalogue Administration", "Maintenance of the food catalogue by the Zindeo team.", [
  {
    id: "UC-10.1", name: "Edit Catalogue Food", priority: "Must",
    short: "An administrator adds or updates a food, its values, portions or recipe.",
    actors: "Primary: Content Administrator.",
    traces: ["FR-15.1", "FR-15.4", "FR-3.5"],
    desc: "Catalogue content is maintained in version-controlled catalogue files that are loaded into the database. Every change goes through validation and review (Figure 4.8).",
    pre: ["The administrator has write access to the catalogue repository."],
    main: [
      "The administrator adds or changes a food in the catalogue files: permanent code, names, category, nutrition values per 100 g with source, portion units, alternative names and, for home dishes, the standard recipe with cooking yield.",
      "For a home dish, the system calculates the values per 100 g from the recipe ingredients and the yield.",
      "The administrator submits the change for review (UC-10.2).",
    ],
    alt: ["1a. The code of an existing food would change: not allowed; codes are permanent because they are also recognition class labels (FR-15.4)."],
    post: ["The change exists in the state Draft or In Review (Figure 6.5); users do not see it yet."],
    quality: ["NFR-36: changes are version-controlled."],
    rel: "—",
    figs: [["ad-catalogue.png", "4.8", "Activity diagram of catalogue changes (UC-10.1 and UC-10.2)"]],
  },
  {
    id: "UC-10.2", name: "Review and Publish Food", priority: "Must",
    short: "A second team member reviews a validated change; it is then published.",
    actors: "Primary: Content Administrator (reviewer, not the author).",
    traces: ["FR-15.2"],
    desc: "A change is published only after automatic validation and a review by a team member other than the author.",
    pre: ["A change has been submitted (UC-10.1)."],
    main: [
      "The system validates the change: required nutrients are present and the energy is within 15% of the energy calculated from the macronutrients.",
      "The reviewer checks the sources, portion weights and values.",
      "The reviewer approves.",
      "The system loads the change into the database and marks the food as verified.",
      "The food becomes visible in search and, if it is recognizable, in recognition.",
    ],
    alt: ["1a. Validation fails: the change returns to the author with the errors.", "3a. The reviewer requests changes: the change returns to the author."],
    post: ["The food is in the state Verified."],
    quality: ["The author cannot approve his or her own change."],
    rel: "—",
  },
  {
    id: "UC-10.3", name: "Deprecate Food", priority: "Must",
    short: "An administrator retires a food and links its replacement.",
    actors: "Primary: Content Administrator.",
    traces: ["FR-15.3"],
    desc: "Foods are never deleted, because meal entries and training labels refer to them. A wrong or duplicate food is deprecated instead.",
    pre: ["The food is Verified."],
    main: ["The administrator marks the food as deprecated and selects the food that replaces it, if any.", "After review (as in UC-10.2), the system hides the food from search and recognition.", "Existing meal entries keep their values; editing such an entry offers the replacing food."],
    alt: [],
    post: ["The food is in the state Deprecated."],
    quality: ["Past totals do not change (FR-4.5)."],
    rel: "—",
  },
]);

const ALL_UCS = PACKAGES.flatMap((p) => p.ucs);
// Requirements realised by other model elements than use cases
const OTHER_TRACES = {
  "FR-4.8": "State machine, Figure 6.3",
  "FR-5.4": "State machine, Figure 6.1",
  "FR-10.7": "State machine, Figure 6.2",
  "FR-11.3": "State machine, Figure 6.6",
  "FR-15.2": "State machine, Figure 6.5",
  "FR-2.11": "State machine, Figure 6.4",
};
for (const fr of ALL_FR.filter((f) => f.startsWith("FR-16."))) OTHER_TRACES[fr] = "Section 7, Figure 7.1";

// Traceability: every FR of Revision 1.0 must be covered by a use case or another model element
const traceMap = Object.fromEntries(ALL_FR.map((f) => [f, []]));
for (const uc of ALL_UCS) for (const spec of uc.traces) for (const fr of expand(spec)) {
  if (!traceMap[fr]) throw new Error(`${uc.id} traces unknown ${fr}`);
  traceMap[fr].push(uc.id);
}
const uncovered = ALL_FR.filter((f) => !traceMap[f].length && !OTHER_TRACES[f]);
if (uncovered.length) throw new Error(`Requirements without a model element: ${uncovered.join(", ")}`);

// ---------- content ----------
const DATE = "20.11.2026";
const cover = [
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "COMP4910 Senior Design Project 1, Fall 2026", bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Advisor: Dr. Arman Savran", bold: true, size: 28 })] }),
  ...Array.from({ length: 9 }, () => new Paragraph({ children: [] })),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Zindeo: A Calorie Tracking App with On-Device Food Recognition", bold: true, size: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: "Requirements Specifications Document", bold: true, size: 36 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: DATE, bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Revision 2.0", bold: true, size: 28 })] }),
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
  table(["Revision", "Date", "Explanation"], [
    ["1.0", "30.10.2026", "Initial requirements, textual form"],
    ["2.0", DATE, "Requirements model in UML: use case, activity, sequence, class, state machine and deployment diagrams; use case descriptions; requirements traceability"],
  ], [1600, 1800, 6238]),
];

const toc = [
  new Paragraph({ children: [new TextRun({ text: "Contents", bold: true, size: 28 })], spacing: { after: 200 }, pageBreakBefore: true }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }),
];

// 1. Introduction
const s1 = [
  H1("1. Introduction"),
  H2("1.1. Purpose of This Document"),
  P("This Requirements Specifications Document (RSD) defines what Zindeo shall do. Revision 1.0 [5] stated the requirements in textual form. Revision 2.0 models the same requirements in the Unified Modeling Language (UML) [3], following the object-oriented requirements modelling approach of [1] and the requirements engineering practices of [2]: the functional requirements are organised as use cases, complex flows are described with activity and sequence diagrams, the information the system keeps is described with class diagrams, and objects whose behaviour depends on their history are described with state machine diagrams."),
  P("The requirement identifiers of Revision 1.0 (e.g. FR-5.4, NFR-3) are unchanged. Every use case lists the requirements it realises, and Section 9 shows the complete traceability from each functional requirement to the model elements."),
  H2("1.2. Problem Statement"),
  P("Calorie tracking is an effective self-management tool for weight control and sports nutrition, but most people stop tracking within a few weeks. Revision 1.0 identified four reasons:"),
  ...N([
    "**Logging is slow:** every food must be searched, selected among many similar entries and its amount guessed, several times a day.",
    "**Turkish cuisine is poorly represented:** global food databases and recognition models are built around Western foods; Turkish home dishes are missing or misrecognized.",
    "**Portion size is guessed:** portion error is the largest source of error in calorie tracking.",
    "**Photo recognition depends on the cloud:** it does not work offline, the photo leaves the phone, and every request has a server cost that is reflected in the subscription price.",
  ]),
  H2("1.3. Project Goals"),
  P("Zindeo is a mobile calorie and nutrition tracking application for iOS and Android, targeting the Turkish market first. Its goals are listed in Table 1.1; Figure 1.1 gives an overview of the system and the external services it uses."),
  table(["ID", "Goal"], [
    ["G1", "**Fast logging:** a meal can be logged in less than 10 seconds, by taking a photo or by searching."],
    ["G2", "**Accurate recognition of Turkish dishes:** a food recognition model trained on a Turkish food dataset of at least 100 dishes collected and labelled by the team."],
    ["G3", "**Automatic portion estimation:** the weight of each food is estimated from a single photo, using the plate as a size reference."],
    ["G4", "**Personalised and safe goals:** daily calorie and macronutrient targets within medically reasonable safety limits."],
    ["G5", "**On-device AI:** the recognition models run on the phone, without an internet connection and without a per-request server cost."],
    ["G6", "**A real product:** the application is published on the App Store and Google Play with a sustainable freemium business model."],
  ], [1000, 8638]),
  tcap("Goals of the project"),
  ...figure("fig-1-1-overview.png", "1.1", "Overview of Zindeo and the external services it uses", { width: 640 }),
  H2("1.4. Scope"),
  P("The project is carried out over two semesters (COMP 4910 and COMP 4920) in two phases:"),
  B("**Phase 1:** the complete tracking application (use case packages UC-1 to UC-8 and UC-10) with photo recognition provided by a cloud vision-language model called through the Zindeo backend. In parallel, the team collects and labels the Turkish food dataset."),
  B("**Phase 2:** Zindeo's own recognition and portion estimation models replace the cloud service and run on the device; the smart assistance features of package UC-9 are added. Requirements and model elements of this phase are marked with «Phase 2»."),
  P("Out of scope: a web application, a dietitian panel, social features, smartwatch applications and medical nutrition plans."),
  H2("1.5. Two-Phase Recognition Strategy"),
  P("The recognition engine is accessed through a single interface that receives a photo and returns, for each food on the plate, candidate catalogue foods with confidence scores and an estimated weight. In the use case model this interface is the system actor **Food Recognition Service**, which is a cloud model in Phase 1 and Zindeo's on-device model in Phase 2. Calories and nutrients are never taken from the recognition engine; they are always calculated from the Zindeo food catalogue. Every photo that the user confirms or corrects becomes a labelled training example if the user has given consent (Figure 1.2)."),
  ...figure("fig-1-2-two-phase.png", "1.2", "Two-phase recognition strategy and the data collection loop", { width: 640 }),
  H2("1.6. Existing Systems and Current Practice"),
  P("Revision 1.0 analysed ten commercial applications and the academic work on food recognition and portion estimation [5], [6]. None of the examined applications states that its recognition runs on the phone; the applications focused on Turkish food are available only on iOS and do not publish their datasets or accuracy. In the current practice, the user logs each item of a plate separately by search and guesses its amount, or uses cloud photo recognition that is weak on Turkish and mixed dishes. The problems identified there (P1–P7 in [5]) are addressed by the use cases of this document, mainly UC-4.2 Log Meal by Photo, UC-2.1 Complete Onboarding and UC-7.2 Manage Consents."),
  H2("1.7. Modelling Conventions"),
  B("**Notation:** UML 2.5.1 [3]. Use case descriptions follow the structure suggested in [1] and [4]: actors, pre-conditions, main flow of events, alternative flows, post-conditions and quality requirements."),
  B("**Identifiers:** use cases are numbered UC-*p.n*, where *p* is the use case package (Section 3.2). Requirement identifiers FR-*x.y* and NFR-*n* are those of Revision 1.0."),
  B("**Alternative flows:** “3a” is an alternative to step 3 of the main flow; “*a” can occur at any step."),
  B("**Use case diagrams:** a dashed ellipse is a use case of another package, shown for its relationship. System actors carry the stereotype «system». «include» and «extend» are used as defined in [3]; the extension point of an «extend» relationship is given in parentheses."),
  B("**Priorities:** Must, Should, Could and Phase 2, as defined in Revision 1.0 (Section 5)."),
  B("**System:** “the system” refers to the Zindeo mobile application together with its backend."),
  H2("1.8. Changes from Revision 1.0"),
  P("Modelling the requirements revealed details that are added in this revision without changing the meaning of the existing requirements:"),
  B("Two system actors are added: **Health Platform** (Apple Health / Health Connect, FR-8.8) and **Location and Map Service** (FR-14.1)."),
  B("The data entities of Revision 1.0 (Section 6) are refined into a domain class model with attributes, multiplicities and enumerations (Section 5). The state **In Review** is added to catalogue foods (FR-15.2) and **Cancelled** to subscriptions (FR-10.7)."),
  B("The behavioural requirements of Revision 1.0 (Section 7) are modelled as state machines; two state machines are added for catalogue foods and consents (Section 6)."),
  H2("1.9. Document Overview"),
  P("Section 2 lists the use cases. Section 3 describes the actors and the use case diagrams. Section 4, the largest section, gives the description of every use case with activity and sequence diagrams for the complex flows. Section 5 gives the domain class model and Section 6 the state machines. Section 7 models the machine learning development requirements. Section 8 lists the non-functional requirements with the deployment environment. Section 9 gives the traceability matrix, Section 10 the constraints and assumptions, Section 11 the glossary and Section 12 the references."),
];

// 2. Requirements list
const s2 = [
  H1("2. Requirements List"),
  P(`Table 2.1 lists the functional requirements of Zindeo as ${ALL_UCS.length} use cases in ${PACKAGES.length} groups. The explanations are deliberately short; the detailed descriptions are given in Section 4. Use cases are defined at the level of a user goal, such as logging a meal, rather than as elementary functions, such as entering a quantity.`),
  table(["No", "Use Case", "Short Explanation", "Priority"],
    PACKAGES.flatMap((p) => [{ group: `${p.id} ${p.name}` }, ...p.ucs.map((u) => [u.id, u.name, u.short, u.priority])]),
    [1000, 2700, 4638, 1300]),
  tcap("Requirements list in terms of use cases"),
  P("The machine learning development requirements (FR-16) are project requirements rather than interactions with the system; they are modelled in Section 7. The non-functional requirements (NFR-1 to NFR-38) are given in Section 8."),
];

// 3. Actors and use case diagrams
const UC_FIGS = [
  ["uc-1-account.png", "UC-1"], ["uc-2-profile.png", "UC-2"], ["uc-3-catalogue.png", "UC-3"], ["uc-4-logging.png", "UC-4"],
  ["uc-5-progress.png", "UC-5"], ["uc-6-subscription.png", "UC-6"], ["uc-7-privacy.png", "UC-7"], ["uc-8-settings.png", "UC-8"],
  ["uc-9-smart.png", "UC-9"], ["uc-10-admin.png", "UC-10"],
];
const ucDiagramNotes = {
  "UC-1": "Registration includes the onboarding of Package UC-2. Password reset is an optional extension of sign-in.",
  "UC-2": "Target calculation (UC-2.2) is included by every use case that changes the inputs of the calculation, and is triggered by the Scheduler on the user's birthday.",
  "UC-4": "The Premium offer extends photo logging when the daily quota is exhausted; adding a product from its label extends barcode logging when a product is not found.",
  "UC-5": "Premium User is a specialisation of User and inherits all of its use cases.",
};
const s3 = [
  H1("3. Actors and Use Case Diagrams"),
  H2("3.1. Actors"),
  P("Table 3.1 lists the actors of Zindeo. Premium User is a specialisation of User: a Premium user can perform every use case of a user, without the daily recognition limit, and additionally UC-5.3."),
  table(["Actor", "Type", "Description", "Main use cases"], [
    ["Guest", "Human", "A person who has installed the application but is not signed in.", "UC-1.1–UC-1.3"],
    ["User", "Human", "A registered user with completed onboarding. Logs meals, tracks progress, manages privacy and settings. Free users have a daily limit of photo recognitions.", "UC-1.4, UC-2 to UC-9"],
    ["Premium User", "Human", "A user with an active subscription. Specialisation of User.", "UC-5.3; all use cases of User"],
    ["Content Administrator", "Human", "A Zindeo team member who maintains the food catalogue. Changes are reviewed by another administrator.", "UC-10.1–UC-10.3"],
    ["Food Recognition Service", "System", "Recognizes foods and estimates weights from a photo; detects fridge ingredients. Phase 1: a cloud vision-language model behind the backend; Phase 2: Zindeo's on-device models.", "UC-4.2, UC-9.1"],
    ["Identity Provider", "System", "Apple and Google sign-in services.", "UC-1.1, UC-1.2"],
    ["App Store / Google Play", "System", "Sell subscriptions, validate purchases and send notifications about renewals, cancellations and refunds.", "UC-6.1–UC-6.3"],
    ["Open Food Facts", "System", "Open database of packaged products, queried by barcode [11].", "UC-4.3"],
    ["Notification Service", "System", "Delivers push notifications to the device.", "UC-8.3"],
    ["Health Platform", "System", "Apple Health (iOS) or Health Connect (Android). New in Revision 2.0.", "UC-5.5"],
    ["Location and Map Service", "System", "Provides nearby restaurants and maps. New in Revision 2.0.", "UC-9.3"],
    ["Scheduler (Time)", "System", "Triggers time-based events: reminders and target recalculation on the user's birthday.", "UC-2.2, UC-8.3"],
  ], [2000, 900, 4638, 2100]),
  tcap("Actors of Zindeo"),
  H2("3.2. Use Case Groups"),
  P(`The use cases are grouped into ${PACKAGES.length} packages by the area of the problem they belong to. Figure 3.1 shows the packages and the dependencies between them; a dependency means that a use case of one package includes, extends or uses the results of a use case of the other package. The packages describe groups of requirements, not the software architecture, which will be defined in the Design Specification Document.`),
  ...uml("uc-packages.png", "3.1", "Use case packages of Zindeo and their dependencies", { maxW: 560 }),
  table(["Package", "Purpose", "Use cases"], PACKAGES.map((p) => [`${p.id} ${p.name}`, p.intro, String(p.ucs.length)]), [3000, 5438, 1200]),
  tcap("Use case packages"),
  H2("3.3. Use Case Diagrams"),
  P("Figures 3.2–3.11 show the use case diagram of each package."),
  ...UC_FIGS.flatMap(([file, id], i) => {
    const p = PACKAGES.find((x) => x.id === id);
    return [
      H3(`3.3.${i + 1}. ${p.name} Use Case Diagram`),
      ...(ucDiagramNotes[id] ? [P(ucDiagramNotes[id])] : []),
      ...uml(file, `3.${i + 2}`, `Use case diagram of package ${p.id} ${p.name}`),
    ];
  }),
];

// 4. Use case descriptions
const UW = [2100, 7538];
function ucTable(u) {
  const lines = (a) => a.join("\n");
  const rows = [
    ["Actors", u.actors],
    ["Priority", u.priority],
    ["Requirements", fmtRefs(u.traces)],
    ["Description", u.desc],
    ["Pre-conditions", lines(u.pre)],
    ["Main flow of events", lines(u.main.map((s, i) => `${i + 1}. ${s}`))],
    ["Alternative flows", u.alt.length ? lines(u.alt) : "None."],
    ["Post-conditions", lines(u.post)],
    ["Quality requirements", lines(u.quality)],
    ["Relationships", u.rel],
  ];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: UW,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: [cell("Use case", UW[0], { header: true }), cell(`${u.id} ${u.name}`, UW[1], { header: true })] }),
      ...rows.map(([k, v]) => new TableRow({ children: [cell(`**${k}**`, UW[0], { fill: "F2F2F2" }), cell(v, UW[1])] })),
    ],
  });
}
const s4 = [
  H1("4. Use Case Descriptions"),
  P("This section describes every use case in the format given in Section 1.7. Activity diagrams are given for use cases with many decisions (Figures 4.2, 4.3, 4.4, 4.6 and 4.8) and sequence diagrams for use cases with significant interaction with external systems (Figures 4.1, 4.5 and 4.7). The sequence diagrams show the Zindeo App and the Zindeo Backend separately, because several requirements (e.g. NFR-18 and NFR-20) state on which side a step must take place."),
  ...PACKAGES.flatMap((p, pi) => [
    H2(`4.${pi + 1}. ${p.name} Use Case Descriptions`),
    ...p.ucs.flatMap((u, ui) => [
      H3(`4.${pi + 1}.${ui + 1}. ${u.id} ${u.name}`),
      ucTable(u),
      tcap(`Description of ${u.id} ${u.name}`),
      ...(u.figs || []).flatMap(([file, num, text]) => uml(file, num, text)),
    ]),
  ]),
];

// 5. Domain model
const s5 = [
  H1("5. Domain Model"),
  P("The domain model describes the information that Zindeo keeps, as UML class diagrams. It refines the data entities of Revision 1.0 (Section 6) and is derived from the nouns of the use case descriptions. It is an analysis model: classes have attributes and associations but no operations, and it does not prescribe the database tables, which will be designed in the Design Specification Document."),
  H2("5.1. Overview"),
  P("Figure 5.1 shows all classes and their associations. Every piece of personal data belongs to exactly one user account (composition), which realises the account deletion requirement FR-1.6: deleting the account deletes all of its parts. The food catalogue is shared by all users."),
  ...uml("cd-overview.png", "5.1", "Overview of the domain model"),
  H2("5.2. Food Catalogue"),
  P("Figure 5.2 shows the food catalogue. A food belongs to a two-level category hierarchy, has alternative names used in search, food-specific portion units and, for home dishes, a standard recipe from which its nutrition values are calculated (FR-3.5). Visually similar foods are grouped into confusion groups, which are offered as alternatives in photo recognition (FR-5.4). The permanent code of a food is also the label of its recognition class (FR-15.4)."),
  ...uml("cd-catalogue.png", "5.2", "Class diagram of the food catalogue"),
  H2("5.3. User and Tracking"),
  P("Figure 5.3 shows the data of a user. A nutrition target is valid from a date; a new one is created at every recalculation, so that past days are evaluated with the targets valid on them (FR-2.9). A meal entry stores a snapshot of its nutrition values (FR-4.5) and its synchronisation state (FR-4.8); its identifier is generated on the device so that an entry sent twice is not duplicated."),
  ...uml("cd-user.png", "5.3", "Class diagram of user and tracking data"),
  H2("5.4. Recognition, Subscription and Consent"),
  P("Figure 5.4 shows the records of photo recognition, subscriptions and consents. A recognition keeps the candidates proposed by the recognition engine and the final food and weight chosen by the user; the difference is both a quality measure and a training label (FR-5.6). Daily recognition usage implements the free-tier quota (FR-5.7). Consent records are only added, never changed (FR-11.4)."),
  ...uml("cd-recognition.png", "5.4", "Class diagram of recognition, subscription and consent"),
  H2("5.5. Enumerations"),
  P("Figure 5.5 lists the enumerations used as attribute types."),
  ...uml("cd-enums.png", "5.5", "Enumerations of the domain model", { maxW: 520 }),
  H2("5.6. Data Rules"),
  B("Nutrition values are stored per 100 g of the edible portion; energy, protein, carbohydrate and fat are mandatory."),
  B("The source of each value is recorded. The priority of sources is: TürKomp [9]; USDA FoodData Central [10]; Zindeo standard recipes; product labels and Open Food Facts [11]; user input (only for the user's own foods)."),
  B("A user's data can be read and changed only by that user. Subscription status and recognition usage can be changed only by the server."),
  B("When a user deletes the account, all personal data and photos of the user are deleted."),
];

// 6. Behavioural model
const s6 = [
  H1("6. Behavioural Model"),
  P("This section models, as UML state machine diagrams, the objects of the domain model whose behaviour depends on their history. They refine the behavioural requirements of Revision 1.0 (Section 7). Transitions are labelled *event [guard] / effect*."),
  H2("6.1. Photo Recognition"),
  P("A recognition (Figure 6.1) starts when a photo is taken. In Phase 1 it is uploaded and the quota is consumed on the server; in Phase 2 it is first recognized on the device and uploaded only as a fallback. In the composite state Reviewing, each item is shown either as a single result or with alternatives (FR-5.4) until the user saves or cancels. A failed recognition returns the consumed quota."),
  ...uml("sm-recognition.png", "6.1", "State machine of a photo recognition"),
  H2("6.2. Subscription"),
  P("Figure 6.2 models the subscription states reported by the stores (FR-10.7). Premium features are available in the states Trial, Active, Grace Period and Cancelled; they are removed when the subscription becomes Expired or Refunded."),
  ...uml("sm-subscription.png", "6.2", "State machine of a subscription"),
  H2("6.3. Meal Entry Synchronisation"),
  P("A meal entry created or edited without a connection (Figure 6.3) is shown immediately and kept in Pending Sync until it is confirmed by the server. Because the identifier is generated on the device, sending the same entry again does not create a duplicate (FR-4.8)."),
  ...uml("sm-sync.png", "6.3", "State machine of meal entry synchronisation", { maxW: 400 }),
  H2("6.4. Weight Goal"),
  P("A weight goal (Figure 6.4) is Active after onboarding. Each weight entry recalculates the targets; reaching the target weight moves the goal to Reached and the maintain goal is offered (FR-2.11). Changing the goal replaces it with a new Active goal."),
  ...uml("sm-goal.png", "6.4", "State machine of a weight goal"),
  H2("6.5. Catalogue Food"),
  P("Figure 6.5 models the life cycle of a catalogue food (FR-15.2, FR-15.3). Only Verified foods are visible to users. A correction to a Verified food is reviewed again while the current values stay visible. A food is never deleted; it becomes Deprecated."),
  ...uml("sm-food.png", "6.5", "State machine of a catalogue food"),
  H2("6.6. Consent"),
  P("Each consent type of a user follows the state machine of Figure 6.6 (FR-11.1–FR-11.4). Every transition adds a consent record. When a new version of a consent text is published, a granted consent requires the user's decision again."),
  ...uml("sm-consent.png", "6.6", "State machine of a consent of one type", { maxW: 420 }),
];

// 7. ML development
const s7 = [
  H1("7. Machine Learning Development Requirements"),
  P("The requirements FR-16.1–FR-16.10 define the work needed to produce Zindeo's own models. They are project requirements rather than interactions with the system, and are therefore modelled as an activity diagram (Figure 7.1) instead of use cases. The fixed, held-out test set is the common basis for selecting the Phase 1 service, for measuring the Phase 2 models against NFR-5, NFR-6 and NFR-9, and for comparing the two."),
  ...uml("ad-ml.png", "7.1", "Activity diagram of the machine learning development"),
  P("Table 7.1 repeats the requirements of Revision 1.0 for reference."),
  table(["ID", "Requirement", "Priority"], [
    ["FR-16.1", "The team shall build a labelled Turkish food image dataset covering at least 100 dishes, combining public datasets whose licences allow commercial use with photos collected by the team and, with consent, by users. Datasets licensed for non-commercial research only shall be used for experiments only. The licence of each public dataset shall be confirmed with its original authors before it is used for the product model.", "Must"],
    ["FR-16.2", "The team shall write a labelling guideline. Each image shall be labelled with catalogue codes; a subset shall include weighed portions (grams).", "Must"],
    ["FR-16.3", "The team shall define a fixed, held-out test set of Turkish dishes, which shall not be used for training, and shall measure top-1 and top-3 accuracy and the energy estimation error on it.", "Must"],
    ["FR-16.4", "The team shall evaluate candidate cloud vision-language models on the test set and select the Phase 1 recognition service based on the results.", "Must"],
    ["FR-16.5", "The team shall train a food recognition model with PyTorch, using transfer learning from mobile-friendly architectures.", "Phase 2"],
    ["FR-16.6", "The team shall calibrate the model's confidence scores so that the uncertainty threshold in FR-5.4 is meaningful.", "Phase 2"],
    ["FR-16.7", "The team shall train a model for plate detection and food segmentation for portion estimation (FR-6.3–FR-6.5).", "Phase 2"],
    ["FR-16.8", "The team shall train an ingredient detection model for the fridge feature (FR-13.1).", "Phase 2"],
    ["FR-16.9", "The team shall compress the models (e.g. 8-bit quantization) and convert them to a mobile runtime.", "Phase 2"],
    ["FR-16.10", "The team shall compare the own models with the Phase 1 cloud service on the same test set and report the results.", "Phase 2"],
  ], RW),
  tcap("Machine learning development requirements"),
];

// 8. Non-functional requirements (unchanged from Revision 1.0, references renumbered)
const s8 = [
  H1("8. Non-Functional Requirements"),
  P("The non-functional requirements are unchanged from Revision 1.0. They are grouped by quality attribute in Tables 8.1–8.10 and are referenced from the quality requirements of the use case descriptions. Section 8.11 shows the deployment environment that several of them constrain."),
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
    ["NFR-11", "The application shall support dynamic text size and screen readers, and shall meet WCAG 2.1 AA colour contrast [13].", "Must"],
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
    ["NFR-23", "Body weight, height and nutrition records may be regarded as health data, which is special category personal data under KVKK [8]; they shall be processed only with explicit consent and with additional security measures.", "Must"],
    ["NFR-24", "Since the Phase 1 recognition service may be located outside Türkiye, the transfer of photos abroad shall be evaluated under KVKK and disclosed to the user.", "Must"],
    ["NFR-25", "Data deletion requests shall be completed within 30 days.", "Must"],
    ["NFR-26", "The application shall comply with the App Store Review Guidelines [12] and Google Play policies, including offering an equivalent privacy-focused login option alongside Google sign-in (Sign in with Apple, FR-1.1), in-app account deletion and in-app purchase for digital content.", "Must"],
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
  H2("8.11. Deployment Environment"),
  P("Figure 8.1 shows, as a UML deployment diagram, the hardware and software environment required by NFR-31 to NFR-34 and the places where the security requirements apply: all communication is encrypted (NFR-17), external services are called only from the server functions (NFR-18), access to the database is controlled per row (NFR-19), and photos are kept in private storage (NFR-21). The internal structure of the components will be designed in the Design Specification Document."),
  ...uml("deployment.png", "8.1", "Deployment environment of Zindeo"),
];

// 9. Traceability
function traceRows() {
  // Merge consecutive requirements of the same group that map to the same elements
  const rows = [];
  for (const fr of ALL_FR) {
    const target = [...new Set(traceMap[fr])].join(", ") + (OTHER_TRACES[fr] ? (traceMap[fr].length ? "; " : "") + OTHER_TRACES[fr] : "");
    const group = fr.split(".")[0];
    const last = rows[rows.length - 1];
    if (last && last.group === group && last.target === target) last.to = fr;
    else rows.push({ group, from: fr, to: fr, target });
  }
  return rows.map((r) => [r.from === r.to ? r.from : `${r.from}–${r.to.split("-")[1]}`, r.target]);
}
const s9 = [
  H1("9. Requirements Traceability"),
  P(`Table 9.1 traces every functional requirement of Revision 1.0 to the use cases and other model elements that realise it. All ${ALL_FR.length} functional requirements are covered. The table is generated from the use case descriptions in Section 4, so the two cannot differ. The non-functional requirements are traced from the quality requirements of the use case descriptions.`),
  table(["Requirement(s)", "Use cases and model elements"], traceRows(), [2400, 7238]),
  tcap("Traceability from functional requirements to the requirements model"),
];

// 10. Constraints and assumptions
const s10 = [
  H1("10. Constraints and Assumptions"),
  H2("10.1. Constraints"),
  B("**Time and team:** the project is developed by a team of three students over two semesters, in parallel with other courses."),
  B("**Knowledge:** the team has software development experience but no prior experience in deep learning; these skills will be acquired during the project, with the guidance of the project advisor."),
  B("**Budget:** development uses free tiers of services; paid plans are needed only near the public release."),
  B("**Computing resources:** model training requires GPUs; free resources (e.g. Google Colab, Kaggle) and, if available, university resources will be used."),
  B("**Data licences:** only datasets with suitable licences can be used for the product. The commercial use of TürKomp data requires permission."),
  B("**Store policies:** App Store and Google Play rules on payments, account deletion and health claims must be followed."),
  B("**Device diversity:** the models must work on mid-range phones without depth sensors."),
  H2("10.2. Assumptions"),
  B("Permission to use TürKomp data can be obtained; otherwise, USDA data and Zindeo standard recipes will be used."),
  B("A cloud vision-language model with acceptable accuracy, cost and terms for Turkish dishes is available for Phase 1."),
  B("A sufficient number of users will give consent for the use of their photos for training."),
  B("Most meals in Türkiye are served on plates of standard sizes, which makes the plate a usable size reference."),
];

// 11. Glossary
const s11 = [
  H1("11. Glossary"),
  P("Table 11.1 defines the domain terms and the modelling terms used in this document."),
  table(["Term", "Definition"], [
    ["Actor", "A role played by a person or an external system that interacts with Zindeo."],
    ["Alternative flow", "A sequence of steps that replaces part of the main flow of a use case under a stated condition."],
    ["BMI", "Body Mass Index: weight (kg) divided by the square of height (m)."],
    ["BMR", "Basal Metabolic Rate: the energy the body uses at rest per day."],
    ["Confidence calibration", "Adjusting a model's confidence scores so that they reflect the real probability of being correct."],
    ["Confusion group", "A group of visually similar foods with different nutrition values, offered as alternatives."],
    ["Cooking yield factor", "Ratio of the cooked weight of a dish to the total raw weight of its ingredients."],
    ["Extension point", "A named point in a use case at which another use case may add behaviour («extend»)."],
    ["Food catalogue", "Zindeo's curated database of foods with nutrition values and portion units."],
    ["Freemium", "Business model in which the basic product is free and advanced features require a subscription."],
    ["KVKK", "Kişisel Verilerin Korunması Kanunu, Turkish Personal Data Protection Law No. 6698."],
    ["kcal", "Kilocalorie, the unit of food energy."],
    ["Macronutrients", "Protein, carbohydrate and fat; they provide 4, 4 and 9 kcal per gram respectively."],
    ["Nutrition snapshot", "The grams, energy and macronutrients of a meal entry, copied at logging time."],
    ["On-device inference", "Running an AI model on the phone instead of a server."],
    ["Phase 1 / Phase 2", "The development phases of Zindeo, described in Section 1.4."],
    ["Portion unit", "A household measure (bowl, slice, piece…) with a food-specific weight in grams."],
    ["Quantization", "Representing model weights with fewer bits to make a model smaller and faster."],
    ["Segmentation", "Finding which pixels of an image belong to each object."],
    ["Standard recipe", "The reference recipe from which the nutrition values of a home dish are calculated."],
    ["TDEE", "Total Daily Energy Expenditure: BMR multiplied by an activity factor."],
    ["Top-1 / Top-3 accuracy", "The percentage of test images whose correct food is the first prediction / among the first three predictions."],
    ["Use case", "A goal of an actor that the system fulfils through a sequence of interactions."],
    ["Vision-language model", "A large AI model that processes images and text; used as the Phase 1 recognition service."],
  ], [2600, 7038]),
  tcap("Glossary of terms"),
];

// 12. References
const refs = [
  "S. Bennett, S. McRobb and R. Farmer, *Object-Oriented Systems Analysis and Design Using UML*, 4th ed. McGraw-Hill, 2010.",
  "R. S. Pressman, *Software Engineering: A Practitioner's Approach*, 7th ed. McGraw-Hill, 2010.",
  "Object Management Group, *OMG Unified Modeling Language (OMG UML)*, Version 2.5.1, formal/17-12-05, Dec. 2017.",
  "A. Cockburn, *Writing Effective Use Cases*. Addison-Wesley, 2001.",
  "Zindeo Team, “Zindeo: Requirements Specifications Document, Revision 1.0,” COMP 4910 Senior Design Project 1, Oct. 30, 2026.",
  "Zindeo Team, “Zindeo – Competitor Analysis, Literature, Datasets and Method Sources,” internal research document, Oct. 20, 2026.",
  "M. D. Mifflin, S. T. St Jeor, L. A. Hill, B. J. Scott, S. A. Daugherty and Y. O. Koh, “A new predictive equation for resting energy expenditure in healthy individuals,” *American Journal of Clinical Nutrition*, vol. 51, no. 2, pp. 241–247, 1990.",
  "Republic of Türkiye, Law No. 6698 on the Protection of Personal Data (KVKK), 2016.",
  "Republic of Türkiye Ministry of Agriculture and Forestry, TürKomp – National Food Composition Database. [Online]. Available: turkomp.tarimorman.gov.tr",
  "U.S. Department of Agriculture, FoodData Central. [Online]. Available: fdc.nal.usda.gov",
  "Open Food Facts. [Online]. Available: openfoodfacts.org",
  "Apple Inc., App Store Review Guidelines. [Online]. Available: developer.apple.com/app-store/review/guidelines",
  "World Wide Web Consortium, *Web Content Accessibility Guidelines (WCAG) 2.1*, W3C Recommendation, 2018.",
];
const s12 = [
  H1("12. References"),
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
      new TextRun({ text: `Zindeo-RSD-2.0, Revision 2.0, ${DATE}`, size: 18 }),
      new TextRun({ text: "\t", size: 18 }),
      new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 18 }),
    ],
  })],
});

const doc = new Document({
  creator: "Zindeo Team",
  title: "Zindeo Requirements Specifications Document, Revision 2.0",
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
    children: [...cover, ...revision, ...toc, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8, ...s9, ...s10, ...s11, ...s12],
  }],
});

const out = process.argv[2] || "Zindeo-RSD-2.0.docx";
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out); });
