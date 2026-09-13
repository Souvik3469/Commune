
# Commune — Advanced Real-Time Chat Platform

Commune is a modern, full-stack, real-time chat application designed with industry-grade architecture, performance optimizations, and rich collaboration features.
It supports seamless one-to-one and group communication, real-time audio/video calling, and scalable message handling.

Built completely from scratch, focusing on real-world chat system challenges like throttling, message persistence, role-based access, and real-time UX.

## Authors

- [@Souvik3469](https://github.com/Souvik3469)(Souvik Sen)

## Prototype Demo 
https://commune-beta.vercel.app

## Documentation

Written retrospectively as an engineering record of this codebase — architecture, data model, and
the API surface. Nothing in `src/` was changed in the process.

| Doc | What's in it |
|---|---|
| [`docs/deep-dive.html`](docs/deep-dive.html) | Full HLD/LLD walkthrough — the two-transport realtime split, the message pipeline, cursor pagination, the `DeletedChat` watermark, WebRTC signalling, and a "what I'd do differently" section. Open in a browser. |
| [`docs/api-contract.md`](docs/api-contract.md) | Every REST endpoint, auth requirements, and the pagination contract. |
| [`docs/db-schema.md`](docs/db-schema.md) | The seven Prisma models, their relations, and the indexes that are missing. |

## Tech Stack
- FrontEnd: React, Vite, Tailwind CSS, Typescript, React Query
- BackEnd: Node Js, Express, Prisma, MongoDB, Web Sockets, WebRTC

<!-- 111
## Installation

To start the project in your local machine

```bash
  git clone https://github.com/Souvik3469/SnapSync.git

  cd .\frontend\
  npm install
  npm run dev

  cd .\backend\
  npm install
  npm run dev

```
```
## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`PORT`=YOUR_PORT

`MONGO_URI`=YOUR_MONGO_URI

`JWT_SECRET`=YOUR_JWT_SECRET

`SMPT_SERVICE`=YOUR_SMPT_SERVICE(like gmail)

`SMPT_HOST`=YOUR_SMPT_HOST

`SMPT_PORT`=YOUR_SMPT_PORT

`SMPT_MAIL`=YOUR_SMPT_MAIL

`SMPT_PASS`=YOUR_SMPT_PASS

`CLOUDINARY_NAME`=YOUR_CLOUDINARY_NAME

`CLOUDINARY_API_KEY`=YOUR_CLOUDINARY_API_KEY

`CLOUDINARY_API_SECRET`=YOUR_CLOUDINARY_API_SECRET
-->

## Features

### Authentication & Profile
- Secure Register / Login
- Avatar upload during registration
- Edit profile metadata & avatar
- Persistent user identity across sessions

### Real-Time Messaging
- One-to-One Chat
- Group Chat (Real-Time)
- Message timestamps
- Typing / message indicators (1–1 & group)
- Emoji support
- Scroll-to-latest message behavior

### Smart Message Handling
- Server-side message throttling
- Loads messages dynamically based on viewport
- Improves performance for long conversations

### Chat deletion logic:
- Deleting a chat does not remove it for the other user
- Deletion point is preserved if the chat resumes later

### Group Chat Management
- Create group chats
- Add / remove members
- Edit group metadata
- Admin-only permissions enforced at server level

### Audio & Video Calling
- One-to-One and Group Calls
- Real-time incoming call detection
- Draggable video call modal for smooth UX
- Call support while app remains active

### Discovery & Usability
- Search users globally
- Light / Dark mode support
- Responsive UI for all screen sizes

### Sandbox Test Accounts

- To explore all features without creating accounts:
  - Email: user1@gmail.com to user5@gmail.com
  - Password: same as email
- Test data resets daily at 12:00 AM IST


## Screenshots

![Register](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/register.png)
![Login](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/login.png)
![One-To-One-Light](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/one-to-one-light.png)
![One-To-One-Dark](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/one-to-one-dark.png)
![Search-Light](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/search-light.png)
![Search-Dark](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/search-dark.png)
![Group-Chat-Light](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/group-light.png)
![Group-Chat-Dark](https://github.com/Souvik3469/Commune/blob/main/frontend/public/screenshots/group-dark.png)



## License

[MIT](https://choosealicense.com/licenses/mit/)

