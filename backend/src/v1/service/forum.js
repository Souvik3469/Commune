import prisma from "../../prisma";

class Forum {
  static createPost(payload) {
    // console.log(payload, "payload");
    return prisma.post.create({
      data: {
        ...payload,
      },
    });
  }
  static async updatePost(payload) {
    const { id, ...data } = payload;
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([key, value]) => value !== undefined)
    );
    // console.log(updateData, "updateData");

    return await prisma.post.update({
      where: {
        id: payload.id,
      },
      data: updateData,
    });
  }
  static async getPostById(payload) {
    return await prisma.post.findUnique({
      where: {
        id: payload.id,
      },
      include: {
        comments: {
          include:{
            user:true
          }
        },
        user: true,
      },
    });
  }
  static async getUserPost(payload) {
    // const friends = await prisma.friend.findMany({
    //   where: {
    //     userId: payload.userId,
    //   },
    //   select: {
    //     friendId: true,
    //   },
    // });

    // const friendIds = friends.map((friend) => friend.friendId);

    return await prisma.post.findMany({
      include:{
        comments:true,
        user:true

      }
    });
    // where: {
    //   OR: [{ userId: payload.userId }, { userId: { in: friendIds } }],
    // },
    // include: {
    //   user: true,
    // },
  }
  static async postComment(payload) {
    return await prisma.comment.create({
      data: {
        ...payload,
      },
    });
  }
  static async updateComment(payload) {
    const { id, comment } = payload;

    return await prisma.comment.update({
      where: {
        id: id,
      },
      data: { comment: comment },
    });
  }
  static async getComments(payload) {
    return await prisma.comment.findFirst({
      where: {
        postId: payload.postId,
      },
      include: {
        children: true,
      },
    });
  }
  static async getComment(payload) {
    return await prisma.comment.findUnique({
      where: {
        id: payload.id,
      },
      include: {
        children: true,
      },
    });
  }
  static async deleteComment(payload) {
    return await prisma.$transaction(async (prisma) => {
      await prisma.comment.deleteMany({
        where: {
          parentId: payload.id,
        },
      });

      return await prisma.comment.delete({
        where: {
          id: payload.id,
        },
      });
    });
  }
  static async deletePost(payload) {
    return await prisma.post.delete({
      where: {
        id: payload.id,
      },
    });
  }
  static async likePost(payload) {
    const { id, userId } = payload;
    return await prisma.post.update({
      where: {
        id: id,
      },
      data: {
        likes: {
          push: userId,
        },
      },
    });
  }
  static async dislikePost(payload) {
    const { id, userId,likes } = payload;

    return await prisma.post.update({
      where: {
        id: id,
      },
      data: {
        likes: {
          set: likes.filter((like) => like !== userId),
        },
      },
    });
  }
}
export default Forum;
