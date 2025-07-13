interface Message {
  sender: "User1" | "User2";
  name: string;
  message: string;
  avatar: string;
  time: string;
}

export const messages: Message[] = [
  {
    sender: "User1",
    name: "Grace Miller",
    message:
      "Hey Olivia, did you check out the new series everyone is talking about?",
    avatar: "https://i.pravatar.cc/150?img=58",
    time: "9:15 AM",
  },
  {
    sender: "User2",
    name: "Olivia Brown",
    message: "Not yet! Which one are you referring to?",
    avatar: "https://i.pravatar.cc/150?img=10",
    time: "9:17 AM",
  },
  {
    sender: "User1",
    name: "Grace Miller",
    message:
      "The one on mystery crime, 'Hidden Truths.' It's all over the internet!",
    avatar: "https://i.pravatar.cc/150?img=58",
    time: "9:18 AM",
  },
  {
    sender: "User2",
    name: "Olivia Brown",
    message: "Oh yes, I’ve seen the trailers. Is it worth watching?",
    avatar: "https://i.pravatar.cc/150?img=10",
    time: "9:20 AM",
  },
  {
    sender: "User1",
    name: "Grace Miller",
    message:
      "Absolutely! It keeps you hooked till the very end. You should give it a shot.",
    avatar: "https://i.pravatar.cc/150?img=58",
    time: "9:22 AM",
  },
  {
    sender: "User2",
    name: "Olivia Brown",
    message: "Cool, I’ll start it this weekend. Thanks for the recommendation!",
    avatar: "https://i.pravatar.cc/150?img=10",
    time: "9:25 AM",
  },
  {
    sender: "User2",
    name: "Olivia Brown",
    message: "By the way, did you complete the presentation for Monday?",
    avatar: "https://i.pravatar.cc/150?img=10",
    time: "9:26 AM",
  },
  {
    sender: "User1",
    name: "Grace Miller",
    message: "Yes, I’m just polishing it now. How’s yours coming along?",
    avatar: "https://i.pravatar.cc/150?img=58",
    time: "9:28 AM",
  },
  {
    sender: "User2",
    name: "Olivia Brown",
    message:
      "Still working on it. I might need some help with the graphs later.",
    avatar: "https://i.pravatar.cc/150?img=10",
    time: "9:30 AM",
  },
  {
    sender: "User1",
    name: "Grace Miller",
    message: "Sure thing! Just ping me whenever you’re ready.",
    avatar: "https://i.pravatar.cc/150?img=58",
    time: "9:32 AM",
  },
  {
    sender: "User2",
    name: "Olivia Brown",
    message: "Thanks, Grace! Oh, and are you free for coffee later today?",
    avatar: "https://i.pravatar.cc/150?img=10",
    time: "9:35 AM",
  },
  {
    sender: "User1",
    name: "Grace Miller",
    message: "I’d love that. Let’s meet at 4 PM at the usual spot?",
    avatar: "https://i.pravatar.cc/150?img=58",
    time: "9:37 AM",
  },
  {
    sender: "User2",
    name: "Olivia Brown",
    message: "Perfect! See you then. 😊",
    avatar: "https://i.pravatar.cc/150?img=10",
    time: "9:40 AM",
  },
];
