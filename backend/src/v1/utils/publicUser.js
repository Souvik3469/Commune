/**
 * Fields that must never leave the server. `password` is a bcrypt hash and the
 * reset fields are a live credential — both used to be returned verbatim by
 * `register`, `myDetails` and `updateUser`.
 */
const PRIVATE_USER_FIELDS = [
  "password",
  "resetPasswordToken",
  "resetPasswordExpiry",
  "resetPasswordTries",
  "googleId",
];

export const publicUser = (user) => {
  if (!user) return user;
  const safe = { ...user };
  PRIVATE_USER_FIELDS.forEach((field) => delete safe[field]);
  return safe;
};

/** `select` clause equivalent, for queries that should never load the hash. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  username: true,
  gender: true,
  dob: true,
  bio: true,
  profilePic: true,
  phoneNumber: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

export default publicUser;
