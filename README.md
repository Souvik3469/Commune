🚀 Commune — Advanced Real-Time Chat Platform

Commune is a modern, full-stack, real-time chat application designed with industry-grade architecture, performance optimizations, and rich collaboration features.
It supports seamless one-to-one and group communication, real-time audio/video calling, and scalable message handling.

Built completely from scratch, focusing on real-world chat system challenges like throttling, message persistence, role-based access, and real-time UX.

🔥 Key Features
🔐 Authentication & Profile

Secure Register / Login

Avatar upload during registration

Edit profile metadata & avatar

Persistent user identity across sessions

💬 Real-Time Messaging

One-to-One Chat

Group Chat (Real-Time)

Message timestamps

Typing / message indicators (1–1 & group)

Emoji support

Scroll-to-latest message behavior

🧠 Smart Message Handling

Server-side message throttling

Loads messages dynamically based on viewport

Improves performance for long conversations

Chat deletion logic:

Deleting a chat does not remove it for the other user

Deletion point is preserved if the chat resumes later

👥 Group Chat Management

Create group chats

Add / remove members

Edit group metadata

Admin-only permissions enforced at server level

📞 Audio & Video Calling

One-to-One and Group Calls

Real-time incoming call detection

Draggable video call modal for smooth UX

Call support while app remains active

🔍 Discovery & Usability

Search users globally

Light / Dark mode support

Responsive UI for all screen sizes

🧪 Sandbox Test Accounts

To explore all features without creating accounts:

Email: user1@gmail.com to user5@gmail.com
Password: same as email

Test data resets daily at 12:00 AM IST

🛠️ Tech Stack
Frontend

React

TypeScript

Tailwind CSS

WebSockets (real-time messaging)

WebRTC (audio/video calls)

Backend

Node.js

Express.js

WebSocket / Socket.IO

JWT Authentication

Role-based authorization

Database

MongoDB

Optimized message pagination & indexing

⚙️ System Highlights

Scalable real-time architecture

Efficient message pagination

Clean separation of concerns

Built with production-level patterns

📚 Documentation

Written retrospectively as an honest engineering record of this codebase — architecture, data
model, and an audit of what's wrong with it. Nothing was fixed in the process.

| Doc | What's in it |
|---|---|
| [`docs/deep-dive.html`](docs/deep-dive.html) | Full HLD/LLD walkthrough — the two-transport realtime split, the message pipeline, cursor pagination, the `DeletedChat` watermark, WebRTC signalling, and a "what I'd do differently" section. Open in a browser. |
| [`docs/flaws.md`](docs/flaws.md) | Known flaws, severity-ordered — security, correctness, performance, hygiene. Documented, **not fixed**. |
| [`docs/api-contract.md`](docs/api-contract.md) | Every REST endpoint, auth requirements, and the pagination contract. |
| [`docs/db-schema.md`](docs/db-schema.md) | The seven Prisma models, their relations, and the indexes that are missing. |

> **Note on this README.** The feature list below predates the current code in places — read
> receipts and file handling are listed as "future enhancements" but are partly implemented. The
> docs above describe what the repository actually does.

📸 Screenshots

(Attach screenshots here)

📌 Future Enhancements

Message reactions

Read receipts

Media sharing

Push notifications

👤 Author

Ron S
