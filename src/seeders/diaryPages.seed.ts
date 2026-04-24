import { Op } from "sequelize";
import { DiaryPage } from "../models/DiaryPage";

const DIARY_TYPE = "CanTRAC-Breast";
const DIARY_CODE = "CanTRAC-A001";

type QuestionType = "yes_no" | "date" | "select" | "text" | "info";

interface Question {
    id: string;
    text: string;
    textHi?: string;
    type: QuestionType;
    category: string;
    options?: string[];
    linkedPageNumber?: number;
}

interface PageDef {
    pageNumber: number;
    title: string;
    titleHi?: string;
    layoutType: string;
    questions: Question[];
}

// ── Helper: standard schedule questions (shared by all schedule pages) ──
function scheduleQuestions(): Question[] {
    return [
        { id: "q1_date", text: "First Appointment Date", textHi: "पहली अपॉइंटमेंट की तारीख", type: "date", category: "appointment" },
        { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "appointment" },
        { id: "q2_date", text: "Second Attempt Date (If First Missed/Cancelled)", textHi: "दूसरे प्रयास की तारीख (यदि पहला छूट गया/रद्द हो गया)", type: "date", category: "appointment" },
        { id: "q2_status", text: "Second Attempt Status", textHi: "दूसरे प्रयास की स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "appointment" },
        // { id: "q3", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "appointment" },
    ];
}

// ── Helper: standard "done & report" questions ──
function doneReportQuestions(
    testName: string,
    testNameHi: string,
    extra?: Question[]
): Question[] {
    const qs: Question[] = [];
    if (extra) {
        qs.push(...extra);
    } else {
        qs.push({
            id: "q1", text: `${testName} Done`, textHi: `${testNameHi} किया गया`,
            type: "yes_no", category: "completion",
        });
    }
    const nextIdx = qs.length + 1;
    qs.push(
        { id: `q${nextIdx}`, text: `${testName} Report Collected`, textHi: `${testNameHi} रिपोर्ट प्राप्त की गई`, type: "yes_no", category: "completion" },
        { id: `q${nextIdx + 1}`, text: "Facing A Major Problem With This Test", textHi: "मुझे इस टेस्ट में एक बड़ी समस्या आ रही है", type: "yes_no", category: "problem" },
        { id: `q${nextIdx + 2}`, text: "Facing a Major Problem Getting This Report", textHi: "इस रिपोर्ट को प्राप्त करने में बड़ी समस्या का सामना करना पड़ रहा है।", type: "yes_no", category: "problem" },
    );
    return qs;
}

// ── Helper: index entries for Table of Content page ──
function indexEntries(): Question[] {
    return [
        { id: "idx_01", text: "Table Of Content", textHi: "पृष्ठ की तालिका", type: "info", category: "index", linkedPageNumber: 1 },
        { id: "idx_02", text: "पृष्ठ की तालिका", textHi: "पृष्ठ की तालिका", type: "info", category: "index", linkedPageNumber: 2 },
        { id: "idx_03", text: "Breast Cancer Care Journey", textHi: "स्तन कैंसर देखभाल यात्रा", type: "info", category: "index", linkedPageNumber: 3 },
        { id: "idx_04", text: "Care Diary for Breast Cancer", textHi: "स्तन कैंसर के लिए देखभाल डायरी", type: "info", category: "index", linkedPageNumber: 4 },
        { id: "idx_05", text: "Investigations Summary 1", textHi: "जाँच सारांश 1", type: "info", category: "index", linkedPageNumber: 5 },
        { id: "idx_06", text: "Investigations Summary 2", textHi: "जाँच सारांश 2", type: "info", category: "index", linkedPageNumber: 6 },
        { id: "idx_07", text: "Mammogram Schedule", textHi: "मैमोग्राम अनुसूची", type: "info", category: "index", linkedPageNumber: 7 },
        { id: "idx_08", text: "Mammogram Done & Report Collected", textHi: "मैमोग्राम किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 8 },
        { id: "idx_09", text: "Ultrasound USG Breast Schedule", textHi: "यूएसजी ब्रेस्ट अनुसूची", type: "info", category: "index", linkedPageNumber: 9 },
        { id: "idx_10", text: "Ultrasound USG Breast Done & Report Collected", textHi: "यूएसजी ब्रेस्ट किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 10 },
        { id: "idx_11", text: "Biopsy Breast Lump Schedule", textHi: "स्तन गांठ की बायोप्सी अनुसूची", type: "info", category: "index", linkedPageNumber: 11 },
        { id: "idx_12", text: "Biopsy Done & Report Collected", textHi: "बायोप्सी किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 12 },
        { id: "idx_13", text: "FNAC Axillary Node Schedule", textHi: "एफएनएसी अक्षीय नोड अनुसूची", type: "info", category: "index", linkedPageNumber: 13 },
        { id: "idx_14", text: "FNAC Done & Report Collected", textHi: "एफएनएसी किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 14 },
        { id: "idx_15", text: "PET CT Scan Schedule", textHi: "पीईटी सीटी स्कैन अनुसूची", type: "info", category: "index", linkedPageNumber: 15 },
        { id: "idx_16", text: "Pet CT Scan Done & Report Collected", textHi: "पीईटी सीटी स्कैन किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 16 },
        { id: "idx_17", text: "MRI Breasts Schedule", textHi: "एमआरआई स्तन अनुसूची", type: "info", category: "index", linkedPageNumber: 17 },
        { id: "idx_18", text: "MRI Breasts Done & Report Collected", textHi: "एमआरआई स्तन की गई और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 18 },
        { id: "idx_19", text: "Genetic Testing", textHi: "आनुवंशिक परीक्षण", type: "info", category: "index", linkedPageNumber: 19 },
        { id: "idx_20", text: "Genetic Testing Done & Report Collected", textHi: "आनुवंशिक परीक्षण किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 20 },
        { id: "idx_21", text: "MUGA Scan Schedule", textHi: "म्यूगा स्कैन अनुसूची", type: "info", category: "index", linkedPageNumber: 21 },
        { id: "idx_22", text: "MUGA Scan Done & Report Collected", textHi: "म्यूगा स्कैन किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 22 },
        { id: "idx_23", text: "Echocardiography Schedule", textHi: "इकोकार्डियोग्राफी अनुसूची", type: "info", category: "index", linkedPageNumber: 23 },
        { id: "idx_24", text: "Echocardiography Done & Report Collected", textHi: "इकोकार्डियोग्राफी की गई और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 24 },
        { id: "idx_25", text: "Bone Dexa Scan & Report Collected", textHi: "बोन डेक्सा स्कैन किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 25 },
        { id: "idx_26", text: "ECG Done & Report Collected", textHi: "ईसीजी किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 26 },
        { id: "idx_27", text: "Chest Xray Done & Report Collected", textHi: "छाती का एक्सरे किया गया और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 27 },
        { id: "idx_28", text: "Blood Tests Done & Report Collected", textHi: "ब्लड टेस्ट किए गए और रिपोर्ट ली गई", type: "info", category: "index", linkedPageNumber: 28 },
        { id: "idx_29", text: "Treatment Planned In Breast DMG/MDT", textHi: "ब्रेस्ट DMG/MDT में ट्रीटमेंट प्लान किया जा रहा है", type: "info", category: "index", linkedPageNumber: 29 },
        { id: "idx_30", text: "Next Steps If Planned For NACT BCS", textHi: "NACT BCS के लिए अगले कदम", type: "info", category: "index", linkedPageNumber: 30 },
        { id: "idx_31", text: "Appointment Date For Clip Placement", textHi: "क्लिप लगाने की तारीख", type: "info", category: "index", linkedPageNumber: 31 },
        { id: "idx_32", text: "Next Steps", textHi: "अगला चरण", type: "info", category: "index", linkedPageNumber: 32 },
        { id: "idx_33", text: "A Query", textHi: "पूछताछ", type: "info", category: "index", linkedPageNumber: 33 },
        { id: "idx_34", text: "Your NACT Start Date", textHi: "आपकी NACT शुरू होने की तारीख", type: "info", category: "index", linkedPageNumber: 34 },
        { id: "idx_35", text: "How Are You Going Through Your Chemotherapy?", textHi: "आपकी कीमोथेरेपी कैसी चल रही है?", type: "info", category: "index", linkedPageNumber: 35 },
        { id: "idx_36", text: "Your NACT Completed", textHi: "आपका NACT पूरा हो गया", type: "info", category: "index", linkedPageNumber: 36 },
        { id: "idx_37", text: "Radiation Therapy Date Booked Before start of Surgery?", textHi: "क्या सर्जरी शुरू होने से पहले रेडिएशन थेरेपी की तारीख बुक की गई है?", type: "info", category: "index", linkedPageNumber: 37 },
        { id: "idx_38", text: "Surgery Admission Date Provided", textHi: "सर्जरी के लिए भर्ती की तारीख दी गई", type: "info", category: "index", linkedPageNumber: 38 },
        { id: "idx_39", text: "End of CANTrac-Breast Tracker", textHi: "कैंट्रैक-ब्रेस्ट ट्रैकर का अंत", type: "info", category: "index", linkedPageNumber: 39 },
        { id: "idx_40", text: "Start CANTrac Surgery Tracker", textHi: "कैंट्रैक सर्जरी ट्रैकर शुरू करें", type: "info", category: "index", linkedPageNumber: 40 },
    ];
}

const PAGES: PageDef[] = [
    // ─── Page 01: Table of Content (English) ───
    {
        pageNumber: 1,
        title: "Table Of Content",
        titleHi: "विषय सूची",
        layoutType: "index",
        questions: indexEntries(),
    },

    // ─── Page 02: Table of Content (Hindi) ───
    {
        pageNumber: 2,
        title: "पृष्ठ की तालिका",
        titleHi: "पृष्ठ की तालिका",
        layoutType: "index",
        questions: indexEntries(),
    },

    // ─── Page 03: Breast Cancer Care Journey (Patient Form) ───
    {
        pageNumber: 3,
        title: "Breast Cancer Care Journey",
        titleHi: "स्तन कैंसर देखभाल यात्रा",
        layoutType: "patient_form",
        questions: [
            { id: "q1", text: "Name", textHi: "नाम", type: "text", category: "patient_info" },
            { id: "q2", text: "Age", textHi: "उम्र", type: "text", category: "patient_info" },
            { id: "q3", text: "Sex", textHi: "लिंग", type: "text", category: "patient_info" },
            { id: "q4", text: "UHID", textHi: "यूएचआईडी", type: "text", category: "patient_info" },
            { id: "q5", text: "NCI No.", textHi: "एनसीआई नम्बर", type: "text", category: "patient_info" },
            { id: "q6", text: "Address", textHi: "पता", type: "text", category: "patient_info" },
            { id: "q7", text: "Phone No.", textHi: "फोन नंबर", type: "text", category: "patient_info" },
        ],
    },

    // ─── Page 04: Care Diary for Breast Cancer (Instructions) ───
    {
        pageNumber: 4,
        title: "Care Diary for Breast Cancer",
        titleHi: "स्तन कैंसर के लिए देखभाल डायरी",
        layoutType: "info",
        questions: [
            { id: "q1", text: "Instructions & Information about using this diary", textHi: "इस डायरी के उपयोग के बारे में निर्देश और जानकारी", type: "info", category: "instructions" },
        ],
    },

    // ─── Page 05: Investigations Summary 1 ───
    {
        pageNumber: 5,
        title: "Investigations Summary 1",
        titleHi: "जाँच सारांश 1",
        layoutType: "investigation_summary",
        questions: [
            { id: "q1", text: "Mammogram", textHi: "मैमोग्राम", type: "yes_no", category: "investigation" },
            { id: "q2", text: "USG Breast(s)", textHi: "स्तन का अल्ट्रासाउंड", type: "yes_no", category: "investigation" },
            { id: "q3", text: "Biopsy Breast Lump", textHi: "स्तन गांठ की बायोप्सी", type: "yes_no", category: "investigation" },
            { id: "q4", text: "FNAC Axillary Node", textHi: "एफएनएसी अक्षीय नोड", type: "yes_no", category: "investigation" },
            { id: "q5", text: "PET CT Scan", textHi: "पीईटी सीटी स्कैन", type: "yes_no", category: "investigation" },
            { id: "q6", text: "MRI Breasts", textHi: "एमआरआई स्तन", type: "yes_no", category: "investigation" },
            { id: "q7", text: "Genetic Testing", textHi: "आनुवंशिक परीक्षण", type: "yes_no", category: "investigation" },
        ],
    },

    // ─── Page 06: Investigations Summary 2 ───
    {
        pageNumber: 6,
        title: "Investigations Summary 2",
        titleHi: "जाँच सारांश 2",
        layoutType: "investigation_summary",
        questions: [
            { id: "q1", text: "MUGA Scan", textHi: "म्यूगा स्कैन", type: "yes_no", category: "investigation" },
            { id: "q2", text: "Echocardiography", textHi: "इकोकार्डियोग्राफी", type: "yes_no", category: "investigation" },
            { id: "q3", text: "Bone Dexa Scan", textHi: "अस्थि डेक्सा स्कैन", type: "yes_no", category: "investigation" },
            { id: "q4", text: "ECG", textHi: "ईसीजी", type: "yes_no", category: "investigation" },
            { id: "q5", text: "Chest Xray", textHi: "छाती का एक्स-रे", type: "yes_no", category: "investigation" },
            { id: "q6", text: "Blood Tests", textHi: "खून की जांच", type: "yes_no", category: "investigation" },
            { id: "q7", text: "Other Tests", textHi: "अन्य जांच", type: "yes_no", category: "investigation" },
        ],
    },

    // ─── Page 07: Mammogram Schedule ───
    {
        pageNumber: 7, title: "Mammogram Schedule", titleHi: "मैमोग्राम अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 08: Mammogram Done & Report Collected ───
    {
        pageNumber: 8, title: "Mammogram Done & Report Collected", titleHi: "मैमोग्राम किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Mammogram", "मैमोग्राम"),
    },

    // ─── Page 09: USG Breast Schedule ───
    {
        pageNumber: 9, title: "Ultrasound USG Breast Schedule", titleHi: "यूएसजी ब्रेस्ट अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 10: USG Breast Done & Report Collected ───
    {
        pageNumber: 10, title: "Ultrasound USG Breast Done & Report Collected", titleHi: "यूएसजी ब्रेस्ट किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("USG Breast(s)", "यूएसजी ब्रेस्ट"),
    },

    // ─── Page 11: Biopsy Breast Lump Schedule ───
    {
        pageNumber: 11, title: "Biopsy Breast Lump Schedule", titleHi: "स्तन गांठ की बायोप्सी अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 12: Biopsy Done & Report Collected ───
    {
        pageNumber: 12, title: "Biopsy Done & Report Collected", titleHi: "बायोप्सी किया गया और रिपोर्ट ली गई",
        layoutType: "done_report",
        questions: doneReportQuestions("Biopsy", "बायोप्सी", [
            { id: "q1", text: "Biopsy Of Right Breast Lump Done", textHi: "दाहिने स्तन गांठ की बायोप्सी किया गया", type: "yes_no", category: "completion" },
            { id: "q2", text: "Biopsy Of Left Breast Lump Done", textHi: "बाएं स्तन की गांठ से बायॉप्सी किया गया", type: "yes_no", category: "completion" },
        ]),
    },

    // ─── Page 13: FNAC Axillary Node Schedule ───
    {
        pageNumber: 13, title: "FNAC Axillary Node Schedule", titleHi: "एफएनएसी अक्षीय नोड अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 14: FNAC Done & Report Collected ───
    {
        pageNumber: 14, title: "FNAC Done & Report Collected", titleHi: "एफएनएसी किया गया और रिपोर्ट ली गई",
        layoutType: "done_report",
        questions: doneReportQuestions("FNAC", "एफएनएसी", [
            { id: "q1", text: "FNAC Of Right Axillary Node Done", textHi: "दाहिने बगल की ओर का एफएनएसी किया गया", type: "yes_no", category: "completion" },
            { id: "q2", text: "FNAC Of Left Axillary Node Done", textHi: "बाएं बगल की ओर एफएनएसी किया गया", type: "yes_no", category: "completion" },
        ]),
    },

    // ─── Page 15: PET CT Scan Schedule ───
    {
        pageNumber: 15, title: "PET CT Scan Schedule", titleHi: "पीईटी सीटी स्कैन अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 16: Pet CT Scan Done & Report Collected ───
    {
        pageNumber: 16, title: "Pet CT Scan Done & Report Collected", titleHi: "पीईटी सीटी स्कैन किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("PET CT Scan", "पीईटी सीटी स्कैन"),
    },

    // ─── Page 17: MRI Breasts Schedule ───
    {
        pageNumber: 17, title: "MRI Breasts Schedule", titleHi: "एमआरआई स्तन अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 18: MRI Breasts Done & Report Collected ───
    {
        pageNumber: 18, title: "MRI Breasts Done & Report Collected", titleHi: "एमआरआई स्तन की गई और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("MRI Breasts", "एमआरआई स्तन"),
    },

    // ─── Page 19: Genetic Testing Schedule ───
    {
        pageNumber: 19, title: "Genetic Testing", titleHi: "आनुवंशिक परीक्षण",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 20: Genetic Testing Done & Report Collected ───
    {
        pageNumber: 20, title: "Genetic Testing Done & Report Collected", titleHi: "आनुवंशिक परीक्षण किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Genetic Testing", "आनुवंशिक परीक्षण"),
    },

    // ─── Page 21: MUGA Scan Schedule ───
    {
        pageNumber: 21, title: "MUGA Scan Schedule", titleHi: "म्यूगा स्कैन अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 22: MUGA Scan Done & Report Collected ───
    {
        pageNumber: 22, title: "MUGA Scan Done & Report Collected", titleHi: "म्यूगा स्कैन किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("MUGA Scan", "म्यूगा स्कैन"),
    },

    // ─── Page 23: Echocardiography Schedule ───
    {
        pageNumber: 23, title: "Echocardiography Schedule", titleHi: "इकोकार्डियोग्राफी अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 24: Echocardiography Done & Report Collected ───
    {
        pageNumber: 24, title: "Echocardiography Done & Report Collected", titleHi: "इकोकार्डियोग्राफी की गई और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Echocardiography", "इकोकार्डियोग्राफी"),
    },

    // ─── Page 25: Bone Dexa Scan Done & Report Collected ───
    {
        pageNumber: 25, title: "Bone Dexa Scan & Report Collected", titleHi: "बोन डेक्सा स्कैन किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Bone Dexa Scan", "बोन डेक्सा स्कैन"),
    },

    // ─── Page 26: ECG Done & Report Collected ───
    {
        pageNumber: 26, title: "ECG Done & Report Collected", titleHi: "ईसीजी किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("ECG", "ईसीजी"),
    },

    // ─── Page 27: Chest Xray Done & Report Collected ───
    {
        pageNumber: 27, title: "Chest Xray Done & Report Collected", titleHi: "छाती का एक्सरे किया गया और रिपोर्ट ली गई",
        layoutType: "done_report",
        questions: doneReportQuestions("Chest Xray", "छाती का एक्सरे", [
            { id: "q1", text: "Chest Xray PA View Done", textHi: "छाती का एक्स-रे पीए व्यू किया गया", type: "yes_no", category: "completion" },
        ]),
    },

    // ─── Page 28: Blood Tests Done & Report Collected ───
    {
        pageNumber: 28, title: "Blood Tests Done & Report Collected", titleHi: "ब्लड टेस्ट किए गए और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Blood Tests", "खून की जांच"),
    },

    // ─── Page 29: Treatment Plan Summary (Doctor Pre-filled) ───
    {
        pageNumber: 29,
        title: "Your Treatment Is Being Planned In Breast DMG/MDT",
        titleHi: "आपका ट्रीटमेंट ब्रेस्ट DMG/MDT में प्लान किया जा रहा है",
        layoutType: "treatment_summary",
        questions: [
            { id: "q1", text: "Planned For Chemotherapy (NACT)", textHi: "कीमोथेरेपी के लिए नियोजित (NACT)", type: "yes_no", category: "treatment" },
            { id: "q2", text: "Surgery Planned", textHi: "सर्जरी की योजना", type: "select", options: ["None", "BCS", "Mastectomy"], category: "treatment" },
            { id: "q3", text: "Radiotherapy Planned", textHi: "रेडियोथेरेपी की योजना", type: "yes_no", category: "treatment" },
            { id: "q4", text: "Any Other Treatment Planned", textHi: "कोई अन्य उपचार नियोजित", type: "yes_no", category: "treatment" },
            { id: "q5", text: "All reports ready but treatment not yet planned", textHi: "सभी रिपोर्ट तैयार हैं लेकिन अभी तक इलाज की योजना नहीं बनाई गई", type: "yes_no", category: "treatment" },
        ],
    },

    // ─── Page 30: Next Steps If Planned For NACT BCS ───
    {
        pageNumber: 30,
        title: "Next Steps If Planned For NACT BCS",
        titleHi: "NACT BCS के लिए योजना बनाए जाने पर अगले कदम",
        layoutType: "next_steps",
        questions: [
            { id: "q1", text: "Clip Placed In Breast Lump", textHi: "स्तन की गांठ में क्लिप डाली गई है", type: "yes_no", category: "procedure" },
            { id: "q2", text: "Clip Placed In Axillary Node", textHi: "एक्सिलरी नोड में क्लिप लगाई गई", type: "yes_no", category: "procedure" },
        ],
    },

    // ─── Page 31: Appointment Date For Clip Placement ───
    {
        pageNumber: 31,
        title: "Appointment Date For Clip Placement",
        titleHi: "क्लिप लगाने की तारीख",
        layoutType: "schedule",
        questions: [
            { id: "q1_date", text: "Get A Date For Clip Placement", textHi: "क्लिप लगाने के लिए तारीख", type: "date", category: "appointment" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "appointment" },
            { id: "q2_date", text: "Get A Redate For Clip Placement", textHi: "क्लिप लगाने की नई तारीख", type: "date", category: "appointment" },
            { id: "q2_status", text: "Redate Status", textHi: "नई तारीख की स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "appointment" },
            // { id: "q3", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "appointment" },
        ],
    },

    // ─── Page 32: Next Steps ───
    {
        pageNumber: 32,
        title: "Next Steps",
        titleHi: "अगला चरण",
        layoutType: "next_steps",
        questions: [
            { id: "q1", text: "Mammogram (Post clipping) Reviewed By Surgeon", textHi: "सर्जन द्वारा मैमोग्राम (क्लिपिंग के बाद) की समीक्षा", type: "yes_no", category: "review" },
        ],
    },

    // ─── Page 33: A Query ───
    {
        pageNumber: 33,
        title: "A Query",
        titleHi: "पूछताछ",
        layoutType: "query",
        questions: [
            {
                id: "q1",
                text: "Your First Chemotherapy Cycle Started But Clips Has Not Been Placed In Your Breast/Axilla Yet",
                textHi: "आपका पहला कीमोथेरेपी साइकिल शुरू हो गया है लेकिन क्लिप्स अभी तक आपके ब्रेस्ट/एक्सिला में नहीं डाली गई है",
                type: "yes_no", category: "query",
            },
        ],
    },

    // ─── Page 34: Your NACT Start Date ───
    {
        pageNumber: 34,
        title: "Your NACT (Chemotherapy/Systemic Therapy) Start Date",
        titleHi: "आपकी NACT (कीमोथेरेपी/सिस्टमिक थेरेपी) शुरू होने की तारीख",
        layoutType: "chemotherapy_schedule",
        questions: [
            { id: "q1_date", text: "Chemotherapy/Systemic Therapy Cycle Start Date", textHi: "कीमोथेरेपी/सिस्टमिक थेरेपी चक्र प्रारंभ तिथि", type: "date", category: "chemotherapy" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "chemotherapy" },
            // { id: "q2", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "chemotherapy" },
        ],
    },

    // ─── Page 35: How Are You Going Through Your Chemotherapy? ───
    {
        pageNumber: 35,
        title: "How Are You Going Through Your Chemotherapy?",
        titleHi: "आपकी कीमोथेरेपी कैसी चल रही है?",
        layoutType: "chemotherapy_tracking",
        questions: [
            { id: "q1", text: "Your Tumor Is Increasing In Size Besides Chemotherapy", textHi: "कीमोथेरेपी के बावजूद आपके ट्यूमर (गांठ) का आकार बढ़ रहा है।", type: "yes_no", category: "side_effects" },
            { id: "q2", text: "You are unable to go through chemotherapy as planned by doctor", textHi: "आप डॉक्टर द्वारा योजना बनाई गई कीमोथेरेपी कराने में असमर्थ हैं।", type: "yes_no", category: "side_effects" },
        ],
    },

    // ─── Page 36: Your NACT Completed ───
    {
        pageNumber: 36,
        title: "Your NACT Completed (Chemotherapy/Systemic)",
        titleHi: "आपका NACT (कीमोथेरेपी/सिस्टेमिक) पूरा हो गया है।",
        layoutType: "chemotherapy_schedule",
        questions: [
            { id: "q1_date", text: "Last Chemotherapy/Systemic Therapy Cycle Date", textHi: "पिछली कीमोथेरेपी/सिस्टमिक थेरेपी साइकिल की तारीख", type: "date", category: "chemotherapy" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "chemotherapy" },
            // { id: "q2", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "chemotherapy" },
        ],
    },

    // ─── Page 37: Radiation Therapy Date Booked Before start of Surgery? ───
    {
        pageNumber: 37,
        title: "Radiation Therapy Date Booked Before start of Surgery?",
        titleHi: "क्या सर्जरी शुरू होने से पहले रेडिएशन थेरेपी की तारीख बुक की गई है?",
        layoutType: "schedule",
        questions: [
            { id: "q1_date", text: "Got a date for Radiation Therapy", textHi: "रेडिएशन थेरेपी के लिए डेट मिल गई है", type: "date", category: "appointment" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "appointment" },
            { id: "q2_date", text: "Got a reappointment date", textHi: "दोबारा अपॉइंटमेंट की तारीख मिल गई है", type: "date", category: "appointment" },
            { id: "q2_status", text: "Reappointment Status", textHi: "दोबारा अपॉइंटमेंट की स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "appointment" },
            // { id: "q3", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "appointment" },
        ],
    },

    // ─── Page 38: Surgery Admission Date Provided ───
    {
        pageNumber: 38,
        title: "Surgery Admission Date Provided",
        titleHi: "सर्जरी के लिए भर्ती होने की तारीख दे दी गई है",
        layoutType: "schedule",
        questions: [
            { id: "q1_date", text: "Get A Date Of Admission For Surgery", textHi: "सर्जरी के लिए एडमिशन की तारीख", type: "date", category: "surgery" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "surgery" },
            { id: "q2_date", text: "Get A Redate For Admission For Surgery", textHi: "सर्जरी के लिए एडमिशन की नई तारीख", type: "date", category: "surgery" },
            { id: "q2_status", text: "Redate Status", textHi: "नई तारीख की स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "surgery" },
            // { id: "q3", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "surgery" },
        ],
    },

    // ─── Page 39: End of CANTrac-Breast Tracker ───
    {
        pageNumber: 39,
        title: "End of CANTrac-Breast Tracker",
        titleHi: "कैंट्रैक-ब्रेस्ट ट्रैकर का अंत",
        layoutType: "transition",
        questions: [
            { id: "q1", text: "If you want to go for Surgery then proceed to the next page", textHi: "अगर आप सर्जरी करवाना चाहते हैं तो अगले पेज पर जाएं", type: "info", category: "transition" },
        ],
    },

    // ─── Page 40: Start CANTrac-Breast Surgery Tracker ───
    {
        pageNumber: 40,
        title: "Start CANTrac-Breast Surgery Tracker",
        titleHi: "कैंट्रैक-ब्रेस्ट ब्रेस्ट सर्जरी शुरू करें",
        layoutType: "transition",
        questions: [
            { id: "q1", text: "Start CANTrac-Breast Surgery Tracker", textHi: "कैंट्रैक-ब्रेस्ट ब्रेस्ट सर्जरी शुरू करें", type: "yes_no", category: "transition" },
        ],
    },

];

/**
 * Seed all 40 CANTrac Breast diary pages into the database.
 * Drops all existing CANTrac-Breast pages first, then re-seeds fresh.
 */
export async function seedDiaryPages(): Promise<number> {
    // Drop all existing pages for this diary type (covers old and new casing)
    await DiaryPage.destroy({
        where: {
            diaryType: {
                [Op.in]: ["CanTRAC-Breast", "CANTrac-Breast", "breast-cancer-treatment"],
            },
        },
    });

    // Re-seed all pages
    let count = 0;
    for (const page of PAGES) {
        await DiaryPage.create({
            diaryCode: DIARY_CODE,
            diaryType: DIARY_TYPE,
            pageNumber: page.pageNumber,
            title: page.title,
            titleHi: page.titleHi,
            layoutType: page.layoutType,
            questions: page.questions,
            isActive: true,
        });
        count++;
    }

    return count;
}
