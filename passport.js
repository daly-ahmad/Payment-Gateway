const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/user");
const bcrypt = require("bcryptjs");

function initialize(passport) {
  const authenticateUser = async (email, password, done) => {
    try {
      const user = await User.findOne({ email }).select("+password");
      if (user === null) {
        return done(null, false, { message: "Invalid Credentials (Email not found)" });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: "Invalid Credentials (Wrong Password)" });
      }

      return done(null, user);
    } catch (error) {
      done(error);
    }
  };

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
      },
      authenticateUser
    )
  );

  passport.serializeUser((user, done) => {
    console.log('serializing user: ');
    console.log(user.name);
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    const user = await User.findById({ _id: id });
    done(null, user);
  });
}

module.exports = initialize;