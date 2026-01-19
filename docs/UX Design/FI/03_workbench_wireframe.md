# FI Engagement Workbench Wireframes

## 1. The Workbench View
**Goal**: Allow Susan to efficiently validate extracted data against source documents.

### Concept: "Split-Screen Truth"
Left side: The "Source" (PDF/Image). Right side: The "Truth" (Extracted Data Schema).

**Layout**:
-   **Header**: [ **< Back** ] [ **Acme Hedge Fund (Fund A)** ] [Status: **In Review**] [ **Approve & Finalize** ]
-   **Main Area**: Split Pane.
    -   **Left (50%)**: Document Viewer (PDF.js).
    -   **Right (50%)**: Data Extraction & Validation Grid.

### Mockup
```
+--------------------------------------------------------------------------------------+
| < Back |  Acme Hedge Fund (Fund A) - Onboarding               [Review] [ **Approve** ] |
+----------------------------------------+---------------------------------------------+
| DOCUMENT VIEWER                        | DATA VALIDATION (The "Golden Record")       |
| [cert_inc.pdf v] [Page 1/4] [-] [+]    | Filter: [ All ] [ Confirmed ] [ **Issues** ]|
|                                        |                                             |
| .------------------------------------. |  Section: COMPANY DETAILS                   |
| | CERTIFICATE OF INCORPORATION       | |                                           |
| |                                    | |  [x] Legal Name                           |
| | Number: 12345678                   | |  [ Acme Hedge Fund                    ]   |
| |                                    | |  (Source: Pg 1, Ln 4) [Edit]              |
| | The Registrar of Companies for     | |                                           |
| | England and Wales...               | |  [ ] Registration Number                  |
| |                                    | |  [ 12345678                           ]   |
| | Name: Acme Hedge Fund              | |  (Source: Pg 1, Ln 6) [Edit]              |
| |                                    | |                                           |
| | Date: 12th January 2023            | |  [!] Date of Incorporation                |
| |                                    | |  [ 2023-01-12                         ]   |
| '------------------------------------' |  (Source: Pg 1, Ln 10)                    |
|                                        |  [ **Confirm** ] [ **Flag Issue** ]         |
|                                        |                                             |
|                                        |  Section: DIRECTORS                         |
|                                        |  ...                                        |
+----------------------------------------+---------------------------------------------+
```

## 2. Interaction Model: Validation
**Happy Path**:
1.  Susan sees "Marketing Name" field.
2.  She hovers over the value "Acme Fund".
3.  The specific text on the PDF **highlights** in yellow.
4.  She clicks the "Checkmark" (Confirm) icon next to the field.
5.  Field turns **Green**. Progress bar advances.

**Unhappy Path (Flagging)**:
1.  Susan sees "Date of Incorporation" is "2023-01-12" but the PDF says "2024".
2.  She clicks "Flag Issue".
3.  A comment box appears linked to that field.
4.  She types: "Date on certificate is 2024, not 2023. Please clarify."
5.  Field turns **Amber** (Flagged).

## 3. The "Approve" Action
When all fields are Green (or deemed acceptable).
**Action**: Click "Approve & Finalize".
**Result**:
1.  Data is committed to the "Golden Record" (Standing Data).
2.  Status changes to "Approved".
3.  Webhooks fire to update the Core Banking System.
