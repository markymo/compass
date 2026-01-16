# UX Exploration: Engagement Workbench V2 (Conversational)

**Core Challenge**: Show "What do I owe?" and "What do they have?" while emphasizing the *relationship* (conversation).

## Concept 1: The "Secure Messenger" (Linear Feed)
*   **Mental Model**: WhatsApp / iMessage / Slack.
*   **Layout**:
    *   **Center**: A reverse-chronological feed of events.
    *   **Right Rail (Collapsible)**: "The Vault" (Current State/Shared Docs).
*   **The "Conversation"**:
    *   *Event*: "J.P. Morgan requested 'Wolfsberg Questionnaire'" (System Msg)
    *   *Action*: You click "Reply" -> Attach Questionnaire -> Send.
    *   *Event*: "You shared 'Audited Financials 2024'".
*   **Pros**: Extremely natural for "interactions". clear history.
*   **Cons**: Can get messy if there are 50 requests. "What do I owe" might get lost in the scroll.

## Concept 2: The "Smart Inbox" (Task Focused)
*   **Mental Model**: Email Inbox or Asana.
*   **Layout**:
    *   **Top (Urgent)**: "3 Pending Requests from JPM".
    *   **Middle (History)**: List of completed exchanges.
*   **The "Conversation"**:
    *   Each "Thread" is a specific requirement (e.g., "KYC Refresh 2025").
    *   Clicking a thread opens the back-and-forth for *that specific item*.
*   **Pros**: Great for "What do I owe". Keeps tasks organized.
*   **Cons**: Less feeling of a continuous "Relationship stream".

## Concept 3: The "Negotiation Table" (State Based)
*   **Mental Model**: A shared desk. Use "Cards" that move.
*   **Layout**: Single column context.
*   **Top Section**: "The Table" (Active interactions). Icons/Avatars of JPM team members.
*   **Content**:
    *   **"They are asking for..."**: Cards with JPM's avatar.
    *   **"You need to approve..."**: Cards with your avatar.
*   **The "Conversation"**:
    *   Visual "Ping Pong". You see who holds the ball for each item.

## Recommendation: Hybrid "Feed + State"
We use **Concept 1 (Messenger)** but with a **"Pinned" Top Bar** for outstanding tasks.
1.  **Sticky Header**: "Action Required: 2 Items". (Click to jump to them in the feed).
2.  **The Feed**: The living history of the relationship.
3.  **The Drawer**: Click "View Access" to see the "What they have" list (The Vault) sliding in from the right overlay.

### Mockup (Messenger Style)
```
[ Header: J.P. Morgan | Status: Active | "View Shared Data (Vault)" > ]

[ ------------------- FEED ------------------- ]

(Yesterday)
[JPM System]: Requested "Certificate of Incumbency".
              [ BUTTON: Upload / Digitize ]

(Today)
[You]: Uploaded "Cert_Incumbency_v2.pdf".

(Now)
[JPM Agent - Sarah]: "Thanks Alex. Can you also clarify the UBO structure?"
                     [ BUTTON: Reply ]

[ -------------------------------------------- ]
[ Reply / Attach Box...                        ]
```
