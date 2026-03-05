# Diary Page Scan — Full Lifecycle

## High-Level Flow

```mermaid
flowchart TD
    subgraph PATIENT["Patient (Mobile App)"]
        A[📷 Patient takes photo of diary page]
        B[Upload image via POST /api/v1/bubble-scan/upload]
    end

    subgraph API["Backend API (Node.js)"]
        C[Multer saves image to /uploads/]
        D[Create BubbleScanResult record\nstatus: pending]
        E[Update status: processing]
        F{Resolve page number}
        F1[From request body\nif provided]
        F2[QR decode → diary_id\nOCR top region → page_number]
        G[Query DB: DiaryPage\nWHERE pageNumber = X\nAND diaryType = Y\nAND isActive = true]
        H[Get question schema\nfields, types, options]
    end

    subgraph AI["AI Processing (Gemini 2.5 Flash via OpenRouter)"]
        I[Read image as base64]
        J[Build prompt with extraction rules]
        K[POST to OpenRouter API\nmodel: google/gemini-2.5-flash]
        L[Parse JSON response\nsections → fields → values + confidence]
    end

    subgraph MATCH["Field Matching & Enrichment"]
        M[Match AI field names\nto DiaryPage.questions by text/id]
        N{Per-field confidence\ncheck}
        N1[confidence >= 0.8\nAccept value]
        N2[confidence < 0.8\nFlag for review]
    end

    subgraph STORE["Database Storage"]
        O[Update BubbleScanResult\nstatus: completed\nscanResults: enriched JSON\nrawConfidenceScores: scores\nprocessingMetadata: tokens, time]
        P[Upsert ScanLog\npatientId + pageId\nscanData: flat key-value]
        Q[Update status: failed\nerrorMessage: reason]
    end

    subgraph DOCTOR["Doctor Review"]
        R[GET /api/v1/bubble-scan/doctor/all\nFilters: flagged, unreviewed, patient]
        S[View scan results + original image]
        T[PUT /api/v1/bubble-scan/:id/review\nApprove / Override / Flag]
        U[Store doctorOverrides\nUpdate scanResults with corrections\nMark doctorReviewed: true]
    end

    A --> B --> C --> D --> E --> F
    F -->|provided| F1
    F -->|auto-detect| F2
    F1 --> G
    F2 --> G
    G --> H --> I --> J --> K --> L
    L --> M --> N
    N -->|high| N1
    N -->|low| N2
    N1 --> O
    N2 --> O
    O --> P
    L -->|parse error / API error| Q

    O --> R --> S --> T --> U

    style PATIENT fill:#e8f5e9,stroke:#2e7d32
    style AI fill:#fff3e0,stroke:#ef6c00
    style STORE fill:#e3f2fd,stroke:#1565c0
    style DOCTOR fill:#fce4ec,stroke:#c62828
    style N2 fill:#fff9c4,stroke:#f57f17
```

## Detailed Data Flow

```mermaid
sequenceDiagram
    actor Patient
    participant App as Mobile App
    participant API as Express API
    participant DB as PostgreSQL
    participant OR as OpenRouter
    participant Gemini as Gemini 2.5 Flash

    Note over Patient,Gemini: === UPLOAD & PROCESS ===

    Patient->>App: Takes photo of diary page
    App->>API: POST /bubble-scan/upload<br/>{pageId, image file}
    API->>API: Multer saves to /uploads/

    API->>DB: INSERT bubble_scan_results<br/>status: "pending"
    DB-->>API: scanRecord.id

    API->>DB: UPDATE status → "processing"

    API->>DB: SELECT FROM diary_pages<br/>WHERE pageNumber = X<br/>AND diaryType = Y<br/>AND isActive = true
    DB-->>API: DiaryPage {questions[], title}

    Note over API,Gemini: === AI EXTRACTION ===

    API->>API: Read image → base64
    API->>OR: POST /chat/completions<br/>model: gemini-2.5-flash<br/>[prompt + base64 image]
    OR->>Gemini: Forward request
    Gemini-->>OR: JSON response
    OR-->>API: {sections, fields, values, confidence}

    Note over API,DB: === ENRICHMENT & STORAGE ===

    API->>API: Match AI fields → DiaryPage.questions<br/>Enrich with questionId, category

    alt All fields confidence >= 0.8
        API->>DB: UPDATE bubble_scan_results<br/>status: "completed"<br/>scanResults: enriched JSON<br/>rawConfidenceScores: per-field scores
    else Any field confidence < 0.8
        API->>DB: UPDATE bubble_scan_results<br/>status: "completed"<br/>flagged: true<br/>scanResults: enriched JSON
    end

    API->>DB: UPSERT scan_logs<br/>ON (patientId, pageId)<br/>scanData: flat answers

    API-->>App: 201 {scanResult}
    App-->>Patient: Show extracted answers<br/>"Is this correct?"

    Note over Patient,DB: === DOCTOR REVIEW ===

    actor Doctor
    Doctor->>API: GET /bubble-scan/doctor/all<br/>?flagged=true&reviewed=false
    API->>DB: SELECT FROM bubble_scan_results<br/>JOIN patients<br/>WHERE doctorId = Z<br/>AND flagged = true
    DB-->>API: flagged scans[]
    API-->>Doctor: List of scans needing review

    Doctor->>API: PUT /bubble-scan/:id/review<br/>{overrides: {q1: "No"}, flagged: false}
    API->>DB: UPDATE bubble_scan_results<br/>doctorOverrides: {q1: {original, corrected}}<br/>scanResults: corrected values<br/>doctorReviewed: true<br/>reviewedBy: doctorId
    API-->>Doctor: 200 Updated
```

## Database Schema Relationships

```mermaid
erDiagram
    Patient ||--o{ BubbleScanResult : "has many"
    Patient ||--o{ ScanLog : "has many"
    DiaryPage ||--o{ BubbleScanResult : "template for"

    Patient {
        uuid id PK
        string caseType
        uuid doctorId FK
    }

    DiaryPage {
        uuid id PK
        int pageNumber
        string diaryType
        string title
        jsonb questions "[{id, text, type, options}]"
        bool isActive
    }

    BubbleScanResult {
        uuid id PK
        uuid patientId FK
        uuid diaryPageId FK
        enum submissionType "scan | manual"
        int pageNumber
        string pageId
        string imageUrl
        enum processingStatus "pending | processing | completed | failed"
        jsonb scanResults "AI extracted + enriched"
        jsonb rawConfidenceScores "per-field scores"
        jsonb processingMetadata "tokens, time, model"
        text errorMessage
        bool doctorReviewed
        uuid reviewedBy
        jsonb doctorOverrides "{qId: {original, corrected}}"
        bool flagged
    }

    ScanLog {
        uuid id PK
        uuid patientId FK
        string pageId
        jsonb scanData "flat key-value answers"
        bool doctorReviewed
        bool flagged
        int updatedCount
    }
```

## scanResults JSONB Structure (after enrichment)

```json
{
  "q1": {
    "answer": "Yes",
    "confidence": 0.95,
    "questionText": "Mammogram",
    "category": "investigation"
  },
  "q2": {
    "answer": "No",
    "confidence": 0.88,
    "questionText": "USG Breast(s)",
    "category": "investigation"
  }
}
```

## Processing Cost Estimate

| Volume | Cost (Gemini 2.5 Flash) |
|--------|------------------------|
| 1 image | ~$0.0007 |
| 1,000 images | ~$0.70 |
| 40,000 images | ~$28 |
| Monthly (2,000 pages) | ~$1.40/month |
