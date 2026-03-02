import { DiaryPage } from "../models/DiaryPage";

const DIARY_TYPE = "CANTrac-Breast";
const DIARY_CODE = "CANTrac-A001";

type QuestionType = "yes_no" | "date" | "select" | "text" | "info";

interface Question {
    id: string;
    text: string;
    textHi?: string;
    type: QuestionType;
    category: string;
    options?: string[];
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
        { id: "q1_date", text: "First Appointment Date", textHi: "पहली अपॉइंटमेंट की तारीख", type: "date", category: "schedule" },
        { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "schedule" },
        { id: "q2_date", text: "Second Attempt Date (If First Missed/Cancelled)", textHi: "दूसरे प्रयास की तारीख (यदि पहला छूट गया/रद्द हो गया)", type: "date", category: "schedule" },
        { id: "q2_status", text: "Second Attempt Status", textHi: "दूसरे प्रयास की स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "schedule" },
        { id: "q3", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "schedule" },
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

const PAGES: PageDef[] = [
    // ─── Page 01: New Case (Patient Form) ───
    {
        pageNumber: 1,
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

    // ─── Page 02: Investigations Summary 1 ───
    {
        pageNumber: 2,
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

    // ─── Page 03: Investigations Summary 2 ───
    {
        pageNumber: 3,
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

    // ─── Page 04: Mammogram Schedule ───
    {
        pageNumber: 4, title: "Mammogram Schedule", titleHi: "मैमोग्राम अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 05: Mammogram Done & Report Collected ───
    {
        pageNumber: 5, title: "Mammogram Done & Report Collected", titleHi: "मैमोग्राम किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Mammogram", "मैमोग्राम"),
    },

    // ─── Page 06: USG Breast Schedule ───
    {
        pageNumber: 6, title: "USG Breast Schedule", titleHi: "यूएसजी ब्रेस्ट अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 07: USG Breast Done & Report Collected ───
    {
        pageNumber: 7, title: "USG Breast Done & Report Collected", titleHi: "यूएसजी ब्रेस्ट किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("USG Breast(s)", "यूएसजी ब्रेस्ट"),
    },

    // ─── Page 08: Biopsy Breast Lump Schedule ───
    {
        pageNumber: 8, title: "Biopsy Breast Lump Schedule", titleHi: "स्तन गांठ की बायोप्सी अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 09: Biopsy Done & Report Collected ───
    {
        pageNumber: 9, title: "Biopsy Done & Report Collected", titleHi: "बायोप्सी किया गया और रिपोर्ट ली गई",
        layoutType: "done_report",
        questions: doneReportQuestions("Biopsy", "बायोप्सी", [
            { id: "q1", text: "Biopsy Of Right Breast Lump Done", textHi: "दाहिने स्तन गांठ की बायोप्सी किया गया", type: "yes_no", category: "completion" },
            { id: "q2", text: "Biopsy Of Left Breast Lump Done", textHi: "बाएं स्तन की गांठ से बायॉप्सी किया गया", type: "yes_no", category: "completion" },
        ]),
    },

    // ─── Page 10: FNAC Axillary Node Schedule ───
    {
        pageNumber: 10, title: "FNAC Axillary Node Schedule", titleHi: "एफएनएसी अक्षीय नोड अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 11: FNAC Done & Report Collected ───
    {
        pageNumber: 11, title: "FNAC Done & Report Collected", titleHi: "एफएनएसी किया गया और रिपोर्ट ली गई",
        layoutType: "done_report",
        questions: doneReportQuestions("FNAC", "एफएनएसी", [
            { id: "q1", text: "FNAC Of Right Axillary Node Done", textHi: "दाहिने बगल की ओर का एफएनएसी किया गया", type: "yes_no", category: "completion" },
            { id: "q2", text: "FNAC Of Left Axillary Node Done", textHi: "बाएं बगल की ओर एफएनएसी किया गया", type: "yes_no", category: "completion" },
        ]),
    },

    // ─── Page 12: PET CT Scan Schedule ───
    {
        pageNumber: 12, title: "PET CT Scan Schedule", titleHi: "पीईटी सीटी स्कैन अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 13: Pet CT Scan Done & Report Collected ───
    {
        pageNumber: 13, title: "Pet CT Scan Done & Report Collected", titleHi: "पीईटी सीटी स्कैन किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("PET CT Scan", "पीईटी सीटी स्कैन"),
    },

    // ─── Page 14: MRI Breasts Schedule ───
    {
        pageNumber: 14, title: "MRI Breasts Schedule", titleHi: "एमआरआई स्तन अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 15: MRI Breasts Done & Report Collected ───
    {
        pageNumber: 15, title: "MRI Breasts Done & Report Collected", titleHi: "एमआरआई स्तन की गई और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("MRI Breasts", "एमआरआई स्तन"),
    },

    // ─── Page 16: Genetic Testing Schedule ───
    {
        pageNumber: 16, title: "Genetic Testing", titleHi: "आनुवंशिक परीक्षण",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 17: Genetic Testing Done & Report Collected ───
    {
        pageNumber: 17, title: "Genetic Testing Done & Report Collected", titleHi: "आनुवंशिक परीक्षण किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Genetic Testing", "आनुवंशिक परीक्षण"),
    },

    // ─── Page 18: MUGA Scan Schedule ───
    {
        pageNumber: 18, title: "MUGA Scan Schedule", titleHi: "म्यूगा स्कैन अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 19: MUGA Scan Done & Report Collected ───
    {
        pageNumber: 19, title: "MUGA Scan Done & Report Collected", titleHi: "म्यूगा स्कैन किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("MUGA Scan", "म्यूगा स्कैन"),
    },

    // ─── Page 20: Echocardiography Schedule ───
    {
        pageNumber: 20, title: "Echocardiography Schedule", titleHi: "इकोकार्डियोग्राफी अनुसूची",
        layoutType: "schedule", questions: scheduleQuestions(),
    },

    // ─── Page 21: Echocardiography Done & Report Collected ───
    {
        pageNumber: 21, title: "Echocardiography Done & Report Collected", titleHi: "इकोकार्डियोग्राफी की गई और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Echocardiography", "इकोकार्डियोग्राफी"),
    },

    // ─── Page 22: Bone Dexa Scan Done & Report Collected ───
    {
        pageNumber: 22, title: "Bone Dexa Scan Done & Report Collected", titleHi: "बोन डेक्सा स्कैन किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Bone Dexa Scan", "बोन डेक्सा स्कैन"),
    },

    // ─── Page 23: ECG Done & Report Collected ───
    {
        pageNumber: 23, title: "ECG Done & Report Collected", titleHi: "ईसीजी किया गया और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("ECG", "ईसीजी"),
    },

    // ─── Page 24: Chest Xray Done & Report Collected ───
    {
        pageNumber: 24, title: "Chest Xray Done & Report Collected", titleHi: "छाती का एक्सरे किया गया और रिपोर्ट ली गई",
        layoutType: "done_report",
        questions: doneReportQuestions("Chest Xray", "छाती का एक्सरे", [
            { id: "q1", text: "Chest Xray PA View Done", textHi: "छाती का एक्स-रे पीए व्यू किया गया", type: "yes_no", category: "completion" },
        ]),
    },

    // ─── Page 25: Blood Tests Done & Report Collected ───
    {
        pageNumber: 25, title: "Blood Tests Done & Report Collected", titleHi: "ब्लड टेस्ट किए गए और रिपोर्ट ली गई",
        layoutType: "done_report", questions: doneReportQuestions("Blood Tests", "खून की जांच"),
    },

    // ─── Page 26: Treatment Planned In Breast DMG/MDT ───
    {
        pageNumber: 26,
        title: "Your Treatment Is Being Planned In Breast DMG/MDT",
        titleHi: "आपका ट्रीटमेंट ब्रेस्ट DMG/MDT में प्लान किया जा रहा है",
        layoutType: "treatment",
        questions: [
            { id: "q1", text: "Planned For Chemotherapy (NACT)", textHi: "कीमोथेरेपी के लिए नियोजित (NACT)", type: "yes_no", category: "treatment" },
            { id: "q2", text: "Surgery Planned", textHi: "सर्जरी की योजना", type: "select", options: ["BCS", "Mastectomy"], category: "treatment" },
        ],
    },

    // ─── Page 27: Next Steps If Planned For NACT BCS ───
    {
        pageNumber: 27,
        title: "Next Steps If Planned For NACT BCS",
        titleHi: "NACT BCS के लिए योजना बनाए जाने पर अगले कदम",
        layoutType: "next_steps",
        questions: [
            { id: "q1", text: "Clip Placed In Breast Lump", textHi: "स्तन की गांठ में क्लिप डाली गई है", type: "yes_no", category: "procedure" },
            { id: "q2", text: "Clip Placed In Axillary Node", textHi: "एक्सिलरी नोड में क्लिप लगाई गई", type: "yes_no", category: "procedure" },
        ],
    },

    // ─── Page 28: Appointment Date For Clip Placement ───
    {
        pageNumber: 28,
        title: "Appointment Date For Clip Placement",
        titleHi: "क्लिप लगाने की तारीख",
        layoutType: "schedule",
        questions: [
            { id: "q1_date", text: "Get A Date For Clip Placement", textHi: "क्लिप लगाने के लिए तारीख", type: "date", category: "schedule" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "schedule" },
            { id: "q2_date", text: "Get A Redate For Clip Placement", textHi: "क्लिप लगाने की नई तारीख", type: "date", category: "schedule" },
            { id: "q2_status", text: "Redate Status", textHi: "नई तारीख की स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "schedule" },
            { id: "q3", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "schedule" },
        ],
    },

    // ─── Page 29: Next Steps ───
    {
        pageNumber: 29,
        title: "Next Steps",
        titleHi: "अगला चरण",
        layoutType: "next_steps",
        questions: [
            { id: "q1", text: "Mammogram (Post clipping) Reviewed By Surgeon", textHi: "सर्जन द्वारा मैमोग्राम (क्लिपिंग के बाद) की समीक्षा", type: "yes_no", category: "review" },
        ],
    },

    // ─── Page 30: A Query ───
    {
        pageNumber: 30,
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

    // ─── Page 31: Your NACT Start Date ───
    {
        pageNumber: 31,
        title: "Your NACT (Chemotherapy/Systemic Therapy) Start Date",
        titleHi: "आपकी NACT (कीमोथेरेपी/सिस्टमिक थेरेपी) शुरू होने की तारीख",
        layoutType: "chemotherapy_schedule",
        questions: [
            { id: "q1_date", text: "Chemotherapy/Systemic Therapy Cycle Start Date", textHi: "कीमोथेरेपी/सिस्टमिक थेरेपी चक्र प्रारंभ तिथि", type: "date", category: "chemotherapy" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "chemotherapy" },
            { id: "q2", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "chemotherapy" },
        ],
    },

    // ─── Page 32: How Are You Going Through Your Chemotherapy? ───
    {
        pageNumber: 32,
        title: "How Are You Going Through Your Chemotherapy?",
        titleHi: "आपकी कीमोथेरेपी कैसी चल रही है?",
        layoutType: "chemotherapy_tracking",
        questions: [
            { id: "q1", text: "Your Tumor Is Increasing In Size Besides Chemotherapy", textHi: "कीमोथेरेपी के बावजूद आपके ट्यूमर (गांठ) का आकार बढ़ रहा है।", type: "yes_no", category: "side_effects" },
            { id: "q2", text: "You are unable to go through chemotherapy as planned by doctor", textHi: "आप डॉक्टर द्वारा योजना बनाई गई कीमोथेरेपी कराने में असमर्थ हैं।", type: "yes_no", category: "side_effects" },
        ],
    },

    // ─── Page 33: Your NACT Completed ───
    {
        pageNumber: 33,
        title: "Your NACT Completed (Chemotherapy/Systemic)",
        titleHi: "आपका NACT (कीमोथेरेपी/सिस्टेमिक) पूरा हो गया है।",
        layoutType: "chemotherapy_schedule",
        questions: [
            { id: "q1_date", text: "Last Chemotherapy/Systemic Therapy Cycle Date", textHi: "पिछली कीमोथेरेपी/सिस्टमिक थेरेपी साइकिल की तारीख", type: "date", category: "chemotherapy" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "chemotherapy" },
            { id: "q2", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "chemotherapy" },
        ],
    },

    // ─── Page 34: Surgery Admission Date Provided ───
    {
        pageNumber: 34,
        title: "Surgery Admission Date Provided",
        titleHi: "सर्जरी के लिए भर्ती होने की तारीख दे दी गई है",
        layoutType: "schedule",
        questions: [
            { id: "q1_date", text: "Get A Date Of Admission For Surgery", textHi: "सर्जरी के लिए एडमिशन की तारीख", type: "date", category: "surgery" },
            { id: "q1_status", text: "Status", textHi: "स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "surgery" },
            { id: "q2_date", text: "Get A Redate For Admission For Surgery", textHi: "सर्जरी के लिए एडमिशन की नई तारीख", type: "date", category: "surgery" },
            { id: "q2_status", text: "Redate Status", textHi: "नई तारीख की स्थिति (एक चुनें)", type: "select", options: ["Scheduled", "Completed", "Missed", "Cancelled"], category: "surgery" },
            { id: "q3", text: "Next Appointment Required?", textHi: "अगला अपॉइंटमेंट चाहिए?", type: "yes_no", category: "surgery" },
        ],
    },

    // ─── Page 35: End of CANTrac-Breast Tracker ───
    {
        pageNumber: 35,
        title: "End of CANTrac-Breast Tracker",
        titleHi: "कैंट्रैक-ब्रेस्ट ट्रैकर का अंत",
        layoutType: "transition",
        questions: [
            { id: "q1", text: "If you want to go for Surgery then proceed to the next page", textHi: "अगर आप सर्जरी करवाना चाहते हैं तो अगले पेज पर जाएं", type: "info", category: "transition" },
        ],
    },

    // ─── Page 36: Start CANTrac-Breast Surgery Tracker ───
    {
        pageNumber: 36,
        title: "Start CANTrac-Breast Surgery Tracker",
        titleHi: "कैंट्रैक-ब्रेस्ट ब्रेस्ट सर्जरी शुरू करें",
        layoutType: "transition",
        questions: [
            { id: "q1", text: "Start CANTrac-Breast Surgery Tracker", textHi: "कैंट्रैक-ब्रेस्ट ब्रेस्ट सर्जरी शुरू करें", type: "yes_no", category: "transition" },
        ],
    },
];

/**
 * Seed all 36 CANTrac Breast diary pages into the database.
 * Uses findOrCreate to avoid duplicates on re-run.
 */
export async function seedDiaryPages(): Promise<number> {
    let count = 0;

    for (const page of PAGES) {
        const [, created] = await DiaryPage.findOrCreate({
            where: {
                pageNumber: page.pageNumber,
                diaryType: DIARY_TYPE,
            },
            defaults: {
                diaryCode: DIARY_CODE,
                title: page.title,
                titleHi: page.titleHi,
                layoutType: page.layoutType,
                questions: page.questions,
                isActive: true,
            },
        });

        if (created) count++;
    }

    return count;
}
