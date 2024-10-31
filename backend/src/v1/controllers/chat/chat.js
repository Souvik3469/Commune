const { PrismaClient } = require('@prisma/client');
const Ably = require('ably');
const { generateInviteLink } = require('../../../utils/InviteLink');

const prisma = new PrismaClient();
const ably = new Ably.Realtime(process.env.ABLY_API_KEY);

const chatController = {
 async createChat(req, res, next) {
    try {
        const { userIds, isGroup, name, logo } = req.body;
        const currentUserId = req.user.id;

        let chat;
        if (isGroup) {
            chat = await prisma.chat.create({
                data: {
                    name,
                    logo,
                    isGroup: true,
                    lastModified: new Date(),
                    adminId: currentUserId,
                    userIds: [currentUserId, ...userIds],
                    users: {
                        connect: [{ id: currentUserId }, ...userIds.map(id => ({ id }))],
                    },
                },
                include: {
                    users: {
                        select: {
                            name: true,
                            email: true,
                            profilePic: true,
                            dob: true,
                        },
                    },
                    messages: {
                        select: {
                            content: true,
                            type: true,
                            timestamp: true,
                            sender: {
                                select: {
                                    name: true,
                                    email: true,
                                    profilePic: true,
                                    dob: true,
                                }
                            }
                        }
                    }
                }
            });
        } else {
            const existingChat = await prisma.chat.findFirst({
                where: {
                    AND: [
                        { userIds: { has: currentUserId } },
                        { userIds: { has: userIds[0] } },
                        { isGroup: false },
                    ],
                },
                include: {
                    users: {
                        select: {
                            name: true,
                            email: true,
                            profilePic: true,
                            dob: true,
                        },
                    },
                    messages: {
                        select: {
                            content: true,
                            type: true,
                            timestamp: true,
                            sender: {
                                select: {
                                    name: true,
                                    email: true,
                                    profilePic: true,
                                    dob: true,
                                }
                            }
                        }
                    }
                }
            });

            if (existingChat) {
                return res.json(existingChat);
            }

            chat = await prisma.chat.create({
                data: {
                    userIds: [currentUserId, userIds[0]],
                    users: {
                        connect: [{ id: currentUserId }, { id: userIds[0] }],
                    },
                    lastModified: new Date(),
                },
                include: {
                    users: {
                        select: {
                            name: true,
                            email: true,
                            profilePic: true,
                            dob: true,
                        },
                    },
                    messages: {
                        select: {
                            content: true,
                            type: true,
                            timestamp: true,
                            sender: {
                                select: {
                                    name: true,
                                    email: true,
                                    profilePic: true,
                                    dob: true,
                                }
                            }
                        }
                    }
                }
            });
        }

        res.json(chat);
    } catch (err) {
        next(err);
    }
},

async getChats(req, res, next) {
    try {
        const userId = req.user.id;

        const chats = await prisma.chat.findMany({
            where: {
                userIds: {
                    has: userId,
                },
            },
            include: {
                users: {
                    select: {
                        name: true,
                        email: true,
                        profilePic: true,
                        dob: true,
                    },
                },
                messages: {
                    select: {
                        content: true,
                        type: true,
                        timestamp: true,
                        sender: {
                            select: {
                                name: true,
                                email: true,
                                profilePic: true,
                                dob: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                lastModified: 'desc',
            },
        });

        res.json(chats);
    } catch (err) {
        console.log(err);
        next(err);
    }
},

  async createMessage(req, res, next) {
    try {
        const { content, chatId, type, fileUrl } = req.body;
        const currentUserId = req.user.id;

   
        const chat = await prisma.chat.findUnique({
            where: { id: chatId },
            include: { users: true }
        });

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

  
        const isUserInChat = chat.users.some(user => user.id === currentUserId);

        if (!isUserInChat) {
            return res.status(403).json({ error: 'User is not a member of this chat' });
        }
        if(type!=="text" && type!=="file") return res.status(400).json({ error: 'Please enter a valid message type' });
        let messageContent =  '';
        if(type=="text")messageContent=content;
        else messageContent=fileUrl
        // if (fileUrl) {
        //     messageContent = messageContent ? `${messageContent}\n${fileUrl}` : fileUrl;
        // }

   
        const message = await prisma.message.create({
            data: {
                content: messageContent,
                chatId,
                senderId: currentUserId,
                type: type || 'text',
            },
            include: {
                sender: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                chat: {
                    select: {
                        name: true,
                        isGroup: true,
                        admin: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            },
        });

   
        ably.channels.get(`chat-${chatId}`).publish('message', {
            ...message,
            sender: {
                name: message.sender.name,
                email: message.sender.email
            },
            chat: {
                name: message.chat.name,
                isGroup: message.chat.isGroup,
                admin: message.chat.admin
            }
        });

   
        await prisma.chat.update({
            where: { id: chatId },
            data: { lastModified: new Date() },
        });

    
        res.json({
            ...message,
            sender: {
                name: message.sender.name,
                email: message.sender.email
            },
            chat: {
                name: message.chat.name,
                isGroup: message.chat.isGroup,
                admin: message.chat.admin
            }
        });
    } catch (err) {
        next(err);
    }
},
  async getMessagesByChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const { page = 1, limit = 10 } = req.query; 


      const pageInt = parseInt(page, 10);
      const limitInt = parseInt(limit, 10);

 
      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          users: {
            some: {
              id: req.user.id,
            },
          },
        },
      });

      if (!chat) {
        return res.status(404).json({ error: 'Chat not found or user is not a member of this chat' });
      }

      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { timestamp: 'desc' },
        skip: (pageInt - 1) * limitInt,
        take: limitInt,
        include: {
          sender: {
            select: {
              name: true,
              email: true,
              profilePic: true,
              dob: true,
            },
          },
        },
      });

      res.json(messages);
    } catch (err) {
      next(err);
    }
  },
  async  updateGroupChat(req, res, next) {
  try {
    const { chatId } = req.params;
    const { name, logo, newUserIds } = req.body;
    const currentUserId = req.user.id;


    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    if (chat.adminId !== currentUserId) {
      return res.status(403).json({ error: 'Only the admin can update the group chat' });
    }


    const updateData = {
      lastModified: new Date(),
    };

    if (name) updateData.name = name;
    if (logo) updateData.logo = logo;

    if (newUserIds && newUserIds.length > 0) {
      const existingUserIds = chat.users.map(user => user.id);
      const validNewUserIds = newUserIds.filter(id => !existingUserIds.includes(id));

      updateData.userIds = {
        set: [...existingUserIds, ...validNewUserIds],
      };

      updateData.users = {
        connect: validNewUserIds.map(id => ({ id })),
      };
    }

 
    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: updateData,
      include: {
        users: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(updatedChat);
  } catch (err) {
    next(err);
  }
},
//if sending invitelink via email
// async  sendInviteLink(req, res, next) {
//   try {
//     const { chatId } = req.params;
//     const currentUserId = req.user.id;
//     const { email } = req.body;

//     
//     const inviteLink = await generateInviteLink(chatId, currentUserId);

//   
//     await sendEmail(email, inviteLink);

//     res.json({ message: 'Invite link sent successfully' });
//   } catch (err) {
//     next(err);
//   }
// },
// async  sendEmail(email, inviteLink) {
//   console.log(`Sending invite link to ${email}: ${inviteLink}`);
//   
// },


async  generateInvite(req, res, next) {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user.id;
    const inviteLink = await generateInviteLink(chatId, currentUserId);

    res.status(200).json({inviteLink});
  } catch (err) {
    next(err);
  }
},
async  acceptInviteLink(req, res, next) {
  try {
    const { inviteToken } = req.params;
    const currentUserId = req.user.id;

 
    const invite = await prisma.inviteToken.findUnique({
      where: { token: inviteToken },
      include: {
        chat: {
          include: {
            users: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invite token' });
    }

 
    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite token has expired' });
    }

    
    if (invite.chat.users.some(user => user.id === currentUserId)) {
      return res.status(400).json({ error: 'You are already a member of this group chat' });
    }


    const updatedChat = await prisma.chat.update({
      where: { id: invite.chatId },
      data: {
        userIds: {
          push: currentUserId,
        },
        users: {
          connect: { id: currentUserId },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

 
    // await prisma.inviteToken.delete({
    //   where: { token: inviteToken },
    // });

    res.json({ message: 'Successfully joined the group chat', chat: updatedChat });
  } catch (err) {
    next(err);
  }
},
async  removeGroupMembers(req, res, next) {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user.id;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Invalid userIds array' });
    }

   
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        users: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    if (!chat.isGroup) {
      return res.status(400).json({ error: 'Operation allowed only for group chats' });
    }

    if (chat.adminId !== currentUserId) {
      return res.status(403).json({ error: 'Only the admin can remove members' });
    }

   
    const chatUserIds = chat.users.map(user => user.id);
    for (const userId of userIds) {
      if (!chatUserIds.includes(userId)) {
        return res.status(400).json({ error: `User with id ${userId} is not a member of this group chat` });
      }
    }

 
    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: {
        userIds: {
          set: chatUserIds.filter(id => !userIds.includes(id)),
        },
        users: {
          disconnect: userIds.map(id => ({ id })),
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ message: 'Users removed successfully', chat: updatedChat });
  } catch (err) {
    next(err);
  }
},

};

module.exports = chatController;
