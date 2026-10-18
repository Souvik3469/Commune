import prisma from "../../prisma/index";
import { userIdFromToken, bearerFromHeader } from "../utils/tokens";
import { publicUserSelect } from "../utils/publicUser";

const authMiddleware = async (req, res, next) => {
  const token = bearerFromHeader(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  const userId = userIdFromToken(token);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized. Invalid token." });
  }

  try {
    // `select` rather than the whole row: req.user used to carry the bcrypt
    // hash and the live password-reset code into every controller, and
    // `myDetails` returned it to the client.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized. User not found." });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

export default authMiddleware;
